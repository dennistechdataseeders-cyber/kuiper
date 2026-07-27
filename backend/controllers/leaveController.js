// backend/controllers/leaveController.js

const LeaveApplication = require('../models/LeaveApplication');
const User = require('../models/User');
const sendEmail = require('../services/zohoMailer');

// ============================================
// GET LEAVE BALANCES
// ============================================
exports.getLeaveBalances = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        // Update balances if needed
        await user.updateLeaveBalances();
        await user.grantAnnualLeaves();
        
        const balances = {};
        user.leaveBalances.forEach((value, key) => {
            balances[key] = value;
        });
        
        // Add max limits
        const maxLimits = {
            'Paid Leave': 12,
            'Sick Leave': 4,
            'Casual Leave': 2,
            'Unpaid Leave': null // Unlimited
        };
        
        res.json({
            success: true,
            data: {
                balances,
                maxLimits,
                lastUpdated: user.leaveBalancesLastUpdated
            }
        });
    } catch (error) {
        console.error('Error fetching leave balances:', error);
        res.status(500).json({ error: 'Failed to fetch leave balances' });
    }
};

// ============================================
// GET LEAVE HISTORY
// ============================================
exports.getLeaveHistory = async (req, res) => {
    try {
        const { status, year } = req.query;
        const userId = req.user._id;
        
        let filter = { employeeId: userId };
        if (status) filter.status = status;
        
        if (year) {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            filter.startDate = { $gte: start, $lte: end };
        }
        
        const leaves = await LeaveApplication.find(filter)
            .sort({ appliedAt: -1 });
        
        res.json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error('Error fetching leave history:', error);
        res.status(500).json({ error: 'Failed to fetch leave history' });
    }
};

// ============================================
// APPLY FOR LEAVE
// ============================================
exports.applyLeave = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, isHalfDay, reason } = req.body;
        const userId = req.user._id;
        
        // Validate inputs
        if (!leaveType || !startDate || !endDate || !reason) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Get user with updated balances
        const user = await User.findById(userId);
        await user.updateLeaveBalances();
        await user.grantAnnualLeaves();
        
        // Check overlapping leaves
        const overlapping = await LeaveApplication.findOne({
            employeeId: userId,
            status: { $in: ['pending', 'approved'] },
            $or: [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
                { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
            ]
        });
        
        if (overlapping) {
            return res.status(400).json({ 
                error: 'You already have a leave request overlapping with these dates' 
            });
        }
        
        // Calculate days
        const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const daysToDeduct = isHalfDay ? 0.5 : daysDiff;
        
        // For Unpaid Leave, skip balance check
        if (leaveType !== 'Unpaid Leave') {
            const currentBalance = user.leaveBalances.get(leaveType) || 0;
            if (currentBalance < daysToDeduct) {
                return res.status(400).json({
                    error: 'Insufficient leave balance',
                    balance: currentBalance,
                    requested: daysToDeduct
                });
            }
        }
        
        // Create leave application
        const leaveApplication = new LeaveApplication({
            employeeId: userId,
            leaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isHalfDay: isHalfDay || false,
            reason: reason.trim(),
            status: 'pending'
        });
        
        await leaveApplication.save();
        
        // ============================================
        // NOTIFY HR, PM, TL, and Developer of the employee
        // ============================================
        await notifyLeaveStakeholders(leaveApplication, user);
        
        res.status(201).json({
            success: true,
            data: leaveApplication,
            message: 'Leave request submitted successfully'
        });
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ error: 'Failed to apply for leave' });
    }
};

// ============================================
// HR: GET ALL PENDING LEAVES
// ============================================
exports.getPendingLeaves = async (req, res) => {
    try {
        const pendingLeaves = await LeaveApplication.find({ status: 'pending' })
            .populate('employeeId', 'name email employeeCode designation department role')
            .sort({ appliedAt: 1 });
        
        res.json({
            success: true,
            data: pendingLeaves
        });
    } catch (error) {
        console.error('Error fetching pending leaves:', error);
        res.status(500).json({ error: 'Failed to fetch pending leaves' });
    }
};

// ============================================
// HR: APPROVE LEAVE
// ============================================
exports.approveLeave = async (req, res) => {
    try {
        const leave = await LeaveApplication.findById(req.params.id).populate('employeeId', 'name email role');
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave application not found' });
        }
        
        if (leave.status !== 'pending') {
            return res.status(400).json({ error: 'Leave already processed' });
        }
        
        // Calculate days
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const daysToDeduct = leave.isHalfDay ? 0.5 : daysDiff;
        
        // Update user's leave balance (skip for Unpaid Leave)
        if (leave.leaveType !== 'Unpaid Leave') {
            const user = await User.findById(leave.employeeId._id);
            const currentBalance = user.leaveBalances.get(leave.leaveType) || 0;
            
            if (currentBalance < daysToDeduct) {
                return res.status(400).json({ 
                    error: 'Insufficient leave balance',
                    balance: currentBalance,
                    requested: daysToDeduct
                });
            }
            
            // Deduct leave days
            user.leaveBalances.set(leave.leaveType, currentBalance - daysToDeduct);
            
            // Log the deduction
            user.leaveBalanceHistory.push({
                type: 'deducted',
                leaveType: leave.leaveType,
                amount: daysToDeduct,
                previousBalance: currentBalance,
                newBalance: currentBalance - daysToDeduct,
                reason: `Leave approved: ${leave._id}`
            });
            
            await user.save();
        }
        
        // Update leave application
        leave.status = 'approved';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        await leave.save();
        
        // Send approval email to employee
        await sendLeaveApprovalEmail(leave);
        
        // Create notification for employee
        const employee = await User.findById(leave.employeeId._id);
        await employee.addNotification({
            type: 'leave_approved',
            message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`
        });
        
        res.json({
            success: true,
            data: leave,
            message: 'Leave approved successfully'
        });
    } catch (error) {
        console.error('Error approving leave:', error);
        res.status(500).json({ error: 'Failed to approve leave' });
    }
};

// ============================================
// HR: REJECT LEAVE
// ============================================
exports.rejectLeave = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        
        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        
        const leave = await LeaveApplication.findById(req.params.id).populate('employeeId', 'name email');
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave application not found' });
        }
        
        if (leave.status !== 'pending') {
            return res.status(400).json({ error: 'Leave already processed' });
        }
        
        leave.status = 'rejected';
        leave.rejectionReason = rejectionReason.trim();
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        await leave.save();
        
        // Send rejection email to employee
        await sendLeaveRejectionEmail(leave);
        
        // Create notification for employee
        const employee = await User.findById(leave.employeeId._id);
        await employee.addNotification({
            type: 'leave_rejected',
            message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been rejected. Reason: ${rejectionReason}`
        });
        
        res.json({
            success: true,
            data: leave,
            message: 'Leave rejected'
        });
    } catch (error) {
        console.error('Error rejecting leave:', error);
        res.status(500).json({ error: 'Failed to reject leave' });
    }
};

// ============================================
// HR: GET ALL LEAVES WITH FILTERS
// ============================================
exports.getAllLeaves = async (req, res) => {
    try {
        const { status, startDate, endDate, employeeId } = req.query;
        let filter = {};
        
        if (status) filter.status = status;
        if (employeeId) filter.employeeId = employeeId;
        if (startDate || endDate) {
            filter.startDate = {};
            if (startDate) filter.startDate.$gte = new Date(startDate);
            if (endDate) filter.startDate.$lte = new Date(endDate);
        }
        
        const leaves = await LeaveApplication.find(filter)
            .populate('employeeId', 'name email employeeCode designation department role')
            .populate('approvedBy', 'name email')
            .sort({ appliedAt: -1 });
        
        res.json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
};

// ============================================
// HELPER: Notify stakeholders
// ============================================
async function notifyLeaveStakeholders(leave, employee) {
    // Get HR users
    const hrUsers = await User.find({ role: 'HR' });
    
    // Get employee's PM, TL, and any developers assigned to their projects
    // This is a simplified version - you may want to add more logic here
    const stakeholders = [];
    
    // Add HR
    hrUsers.forEach(hr => {
        stakeholders.push({
            email: hr.email,
            name: hr.name,
            role: 'HR'
        });
    });
    
    // Try to find PM and TL from projects
    const Project = require('../models/Project');
    const projects = await Project.find({
        $or: [
            { projectManager: employee._id },
            { teamLead: employee._id },
            { assignedDevelopers: employee._id }
        ]
    }).populate('projectManager teamLead');
    
    projects.forEach(project => {
        if (project.projectManager) {
            stakeholders.push({
                email: project.projectManager.email,
                name: project.projectManager.name,
                role: 'Project Manager'
            });
        }
        if (project.teamLead) {
            stakeholders.push({
                email: project.teamLead.email,
                name: project.teamLead.name,
                role: 'Team Lead'
            });
        }
    });
    
    // Send emails
    const emailPromises = stakeholders.map(stakeholder => 
        sendLeaveNotificationEmail(leave, employee, stakeholder)
    );
    
    await Promise.all(emailPromises);
    
    // Create notifications for stakeholders
    const notificationPromises = stakeholders.map(stakeholder => 
        User.findOne({ email: stakeholder.email }).then(user => {
            if (user) {
                return user.addNotification({
                    type: 'leave_request',
                    message: `${employee.name} has requested ${leave.leaveType} leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}`
                });
            }
        })
    );
    
    await Promise.all(notificationPromises);
}

// ============================================
// HELPER: Email functions
// ============================================
async function sendLeaveNotificationEmail(leave, employee, stakeholder) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const leaveUrl = `${frontendUrl}/hr/leaves`;
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="max-width:550px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">Leave Management System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9; padding:28px 36px;">
              <div style="font-size:13px; font-weight:700; color:#475569; letter-spacing:0.06em; text-transform:uppercase;">Leave Request</div>
              <div style="font-size:26px; font-weight:800; color:#0f172a; margin-top:6px;">${leave.leaveType}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin-bottom:20px; color:#1e293b;"><strong>${employee.name}</strong> has requested leave:</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Leave Type</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leave.leaveType}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Date</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:14px 18px; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Half Day</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leave.isHalfDay ? 'Yes' : 'No'}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Status</div>
                    <div style="font-size:14px; font-weight:700; color:#f59e0b; margin-top:2px;">Pending</div>
                  </td>
                </tr>
              </table>
              
              <div style="background:#f8fafc; padding:16px 20px; border-radius:12px; margin-bottom:20px;">
                <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Reason</div>
                <p style="margin:0; font-size:13px; line-height:1.5; color:#334155;">${leave.reason}</p>
              </div>
              
              <a href="${leaveUrl}" style="display:block; text-align:center; background:#2563eb; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:13px;">
                Review Leave Request →
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Leave Notification</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    await sendEmail({
        to: stakeholder.email,
        subject: `Leave Request: ${employee.name} - ${leave.leaveType}`,
        html: emailHtml
    });
}

async function sendLeaveApprovalEmail(leave) {
    const employee = await User.findById(leave.employeeId._id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="background:#10b981; padding:28px 36px; text-align:center;">
              <div style="font-size:32px;">✅</div>
              <div style="font-size:20px; font-weight:800; color:white; margin-top:8px;">Leave Approved</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin-bottom:20px; color:#1e293b;">Dear <strong>${employee.name}</strong>,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">Your leave request has been approved.</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Type</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leave.leaveType}</div>
                  </td>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Dates</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px 16px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Half Day</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leave.isHalfDay ? 'Yes' : 'No'}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Leave Approved</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    await sendEmail({
        to: employee.email,
        subject: `Leave Approved: ${leave.leaveType}`,
        html: emailHtml
    });
}

async function sendLeaveRejectionEmail(leave) {
    const employee = await User.findById(leave.employeeId._id);
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          <tr>
            <td style="background:#ef4444; padding:28px 36px; text-align:center;">
              <div style="font-size:32px;">❌</div>
              <div style="font-size:20px; font-weight:800; color:white; margin-top:8px;">Leave Rejected</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin-bottom:20px; color:#1e293b;">Dear <strong>${employee.name}</strong>,</p>
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">Your leave request has been rejected.</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Type</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${leave.leaveType}</div>
                  </td>
                  <td width="50%" style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Dates</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px 16px;">
                    <div style="font-size:10px; font-weight:700; color:#ef4444; text-transform:uppercase;">Reason</div>
                    <div style="font-size:13px; color:#ef4444; margin-top:2px;">${leave.rejectionReason}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Leave Rejected</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    await sendEmail({
        to: employee.email,
        subject: `Leave Rejected: ${leave.leaveType}`,
        html: emailHtml
    });
}