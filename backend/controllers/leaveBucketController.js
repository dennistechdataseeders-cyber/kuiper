// backend/controllers/leaveBucketController.js - COMPLETE FIXED FILE
// ✅ UPDATED: adjustEmployeeBalance now returns a message noting the employee was notified

const leaveBucketService = require('../services/leaveBucketService');
const LeaveApplication = require('../models/LeaveApplication');
const User = require('../models/User');

// ============================================
// GET LEAVE BALANCE SUMMARY
// ============================================
exports.getLeaveSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const summary = await leaveBucketService.getEmployeeLeaveSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting leave summary:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET PENDING LEAVES
// ============================================
exports.getPendingLeaves = async (req, res) => {
  try {
    const pendingLeaves = await LeaveApplication.find({ status: 'pending' })
      .populate('employeeId', 'name email employeeCode role isProbationary')
      .sort({ appliedAt: 1 });

    res.json({
      success: true,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('Error fetching pending leaves:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: APPROVE LEAVE
// ============================================
exports.approveLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const approvedBy = req.user._id;

    const result = await leaveBucketService.approveLeave(leaveId, approvedBy);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: REJECT LEAVE
// ============================================
exports.rejectLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await leaveBucketService.rejectLeave(leaveId, rejectionReason, req.user._id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET EMPLOYEE LEAVE SUMMARY
// ============================================
exports.getEmployeeLeaveSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const summary = await leaveBucketService.getEmployeeLeaveSummary(userId);

    res.json({
      success: true,
      data: {
        employee: {
          name: user.name,
          email: user.email,
          role: user.role
        },
        ...summary
      }
    });
  } catch (error) {
    console.error('Error fetching employee leave summary:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET ALL EMPLOYEES WITH BUCKET DATA
// ============================================
exports.getAllEmployeeBuckets = async (req, res) => {
  try {
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    }).select('_id name email role isProbationary employeeCode');

    const bucketData = await Promise.all(
      employees.map(async (employee) => {
        const summary = await leaveBucketService.getEmployeeLeaveSummary(employee._id);
        return {
          employee: {
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            employeeCode: employee.employeeCode || null,
            isProbationary: employee.isProbationary || false
          },
          summary
        };
      })
    );

    res.json({
      success: true,
      data: bucketData
    });
  } catch (error) {
    console.error('Error fetching employee buckets:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// ✅ HR/ADMIN: ADJUST AN EMPLOYEE'S BALANCE (REWARD / PENALTY)
// Body: { newBalance: number, reason: string }
// Now triggers an email to the employee with prev/current balance,
// change amount, reason, and who adjusted it.
// ============================================
exports.adjustEmployeeBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newBalance, reason } = req.body;

    if (newBalance === undefined || newBalance === null || isNaN(newBalance)) {
      return res.status(400).json({ error: 'newBalance is required and must be a number' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for a balance adjustment' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await leaveBucketService.adjustBalance(
      userId,
      parseFloat(newBalance),
      reason.trim(),
      req.user._id
    );

    res.json({
      success: true,
      message: 'Leave balance updated and employee notified by email',
      data: result
    });
  } catch (error) {
    console.error('Error adjusting balance:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// ✅ ONE-SHOT LEAVE REQUEST (paid + unpaid + half days in one go)
// ============================================
exports.previewLeave = async (req, res) => {
  try {
    const plan = await leaveBucketService.planLeave(req.user._id, req.body || {});
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error previewing leave:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.applyLeaveRequest = async (req, res) => {
  try {
    const result = await leaveBucketService.applyLeaveRequest(req.user._id, req.body || {});
    res.status(201).json({
      success: true,
      data: { requestGroupId: result.requestGroupId, totals: result.plan.totals, pieces: result.pieces.length },
      message: 'Leave request submitted. HR has been notified.',
    });
  } catch (error) {
    console.error('Error applying for leave request:', error.message);
    res.status(400).json({ error: error.message, plan: error.plan || null });
  }
};

exports.approveLeaveGroup = async (req, res) => {
  try {
    const result = await leaveBucketService.approveLeaveGroup(req.params.groupId, req.user._id);
    res.json({ success: true, data: result, message: 'Leave request approved' });
  } catch (error) {
    console.error('Error approving leave request:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.rejectLeaveGroup = async (req, res) => {
  try {
    const result = await leaveBucketService.rejectLeaveGroup(req.params.groupId, req.body?.rejectionReason || '', req.user._id);
    res.json({ success: true, data: result, message: 'Leave request rejected' });
  } catch (error) {
    console.error('Error rejecting leave request:', error.message);
    res.status(400).json({ error: error.message });
  }
};
