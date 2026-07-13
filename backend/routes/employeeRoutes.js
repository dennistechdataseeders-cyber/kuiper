// backend/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import models
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const MissedPunchRequest = require('../models/MissedPunchRequest');
const User = require('../models/User');
const LeaveType = require('../models/LeaveType');

// ============================================
// ALL EMPLOYEE ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(protect);

// ============================================
// ATTENDANCE
// ============================================

// GET /api/employee/attendance/today - Get today's attendance status
router.get('/attendance/today', async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get today's punch log
        const punchLog = await EmployeePunchLog.findOne({
            employeeId: userId,
            date: { $gte: today, $lt: tomorrow }
        });
        
        // Check if on leave today
        const onLeave = await LeaveApplication.findOne({
            employeeId: userId,
            startDate: { $lte: today },
            endDate: { $gte: today },
            status: 'approved'
        });
        
        let status = 'absent';
        let statusMessage = 'Not Punched In';
        let punchInTime = null;
        let punchOutTime = null;
        
        if (onLeave) {
            status = 'on_leave';
            statusMessage = `On Leave (${onLeave.leaveType})`;
        } else if (punchLog) {
            punchInTime = punchLog.punchIn;
            punchOutTime = punchLog.punchOut;
            
            if (punchLog.punchIn) {
                const punchInHour = new Date(punchLog.punchIn).getHours();
                if (punchInHour < 10) {
                    status = 'on_time';
                    statusMessage = 'Punched In (On Time)';
                } else {
                    status = 'late';
                    statusMessage = 'Punched In (Late)';
                }
            }
            
            if (punchLog.punchOut) {
                status = 'completed';
                statusMessage = 'Shift Completed';
            } else if (punchLog.punchIn) {
                statusMessage = 'Working (Punched In)';
            }
        }
        
        res.json({
            success: true,
            data: {
                status,
                statusMessage,
                punchInTime,
                punchOutTime,
                onLeave: !!onLeave
            }
        });
    } catch (error) {
        console.error('Error fetching today attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// GET /api/employee/attendance/monthly-stats - Get monthly attendance stats
router.get('/attendance/monthly-stats', async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Get all punch logs for the month
        const punchLogs = await EmployeePunchLog.find({
            employeeId: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        
        // Get all approved leaves for the month
        const leaves = await LeaveApplication.find({
            employeeId: userId,
            status: 'approved',
            $or: [
                { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
                { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
                { startDate: { $lte: startOfMonth }, endDate: { $gte: endOfMonth } }
            ]
        });
        
        // Calculate working days (weekdays only)
        let workingDays = 0;
        let leaveDays = 0;
        const daysInMonth = endOfMonth.getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(now.getFullYear(), now.getMonth(), day);
            const dayOfWeek = date.getDay();
            // Monday (1) to Friday (5)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                workingDays++;
            }
        }
        
        // Calculate leave days taken this month (days within the month)
        leaves.forEach(leave => {
            const start = new Date(Math.max(leave.startDate.getTime(), startOfMonth.getTime()));
            const end = new Date(Math.min(leave.endDate.getTime(), endOfMonth.getTime()));
            const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            leaveDays += leave.isHalfDay ? 0.5 : diffDays;
        });
        
        // Count present days (days with punch in)
        const presentDays = punchLogs.length;
        
        // Count late days
        const lateDays = punchLogs.filter(p => {
            const punchInHour = new Date(p.punchIn).getHours();
            return punchInHour >= 10;
        }).length;
        
        res.json({
            success: true,
            data: {
                workingDays,
                presentDays,
                absentDays: Math.max(0, workingDays - presentDays - Math.ceil(leaveDays)),
                leaveDays: Math.ceil(leaveDays),
                lateDays,
                totalPunches: punchLogs.length
            }
        });
    } catch (error) {
        console.error('Error fetching monthly stats:', error);
        res.status(500).json({ error: 'Failed to fetch monthly stats' });
    }
});

// ============================================
// LEAVE MANAGEMENT (Employee)
// ============================================

// POST /api/employee/leave/apply - Apply for leave
router.post('/leave/apply', async (req, res) => {
    try {
        const { leaveType, startDate, endDate, isHalfDay, reason } = req.body;
        const userId = req.user._id;
        
        // Validate inputs
        if (!leaveType || !startDate || !endDate || !reason) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check if leave type exists and is active
        const leaveTypeConfig = await LeaveType.findOne({ name: leaveType, isActive: true });
        if (!leaveTypeConfig) {
            return res.status(400).json({ error: 'Invalid or inactive leave type' });
        }
        
        // Check for overlapping leave requests
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
        
        // Check leave balance
        const user = await User.findById(userId);
        const currentBalance = user.leaveBalances.get(leaveType) || 0;
        const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const daysToDeduct = isHalfDay ? 0.5 : daysDiff;
        
        if (currentBalance < daysToDeduct) {
            return res.status(400).json({
                error: 'Insufficient leave balance',
                balance: currentBalance,
                requested: daysToDeduct
            });
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
        
        // Notify HR
        const hrUsers = await User.find({ role: 'HR' });
        for (const hr of hrUsers) {
            await hr.addNotification({
                type: 'leave_request',
                message: `${user.name} has requested ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
            });
        }
        
        // Emit socket notification to HR
        const io = req.app.get('io');
        if (io) {
            hrUsers.forEach(hr => {
                io.to(hr._id.toString()).emit('new_leave_request', {
                    employeeName: user.name,
                    leaveType,
                    dates: `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
                    leaveId: leaveApplication._id
                });
            });
        }
        
        res.status(201).json({
            success: true,
            data: leaveApplication,
            message: 'Leave request submitted successfully'
        });
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ error: 'Failed to apply for leave' });
    }
});

// GET /api/employee/leave/history - Get employee's leave history
router.get('/leave/history', async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, year } = req.query;
        
        let filter = { employeeId: userId };
        if (status) filter.status = status;
        
        if (year) {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            filter.startDate = { $gte: start, $lte: end };
        }
        
        const leaves = await LeaveApplication.find(filter)
            .sort({ appliedAt: -1 });
        
        // Get leave type max days for reference
        const leaveTypes = await LeaveType.find({ isActive: true });
        const maxDaysMap = {};
        leaveTypes.forEach(lt => {
            maxDaysMap[lt.name] = lt.maxDays;
        });
        
        // Enhance with max days
        const enhancedLeaves = leaves.map(leave => ({
            ...leave.toObject(),
            maxDays: maxDaysMap[leave.leaveType] || 0,
            daysRequested: Math.ceil((leave.endDate - leave.startDate) / (1000 * 60 * 60 * 24)) + 1
        }));
        
        res.json({ success: true, data: enhancedLeaves });
    } catch (error) {
        console.error('Error fetching leave history:', error);
        res.status(500).json({ error: 'Failed to fetch leave history' });
    }
});

// GET /api/employee/leave/balance - Get employee's leave balances
// backend/routes/employeeRoutes.js - Fix the leave balance endpoint

// GET /api/employee/leave/balance - Get employee's leave balances
router.get('/leave/balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('leaveBalances');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Convert Map to plain object for response
    const balances = {};
    if (user.leaveBalances && typeof user.leaveBalances === 'object') {
      // Handle both Map and plain object
      if (user.leaveBalances instanceof Map) {
        user.leaveBalances.forEach((value, key) => {
          balances[key] = value;
        });
      } else {
        // If it's already a plain object
        Object.keys(user.leaveBalances).forEach(key => {
          balances[key] = user.leaveBalances[key];
        });
      }
    }
    
    // Get max allowed days for each leave type
    const leaveTypes = await LeaveType.find({ isActive: true });
    const maxDays = {};
    leaveTypes.forEach(lt => {
      maxDays[lt.name] = lt.maxDays;
    });
    
    // Ensure all leave types have a balance (even if 0)
    leaveTypes.forEach(lt => {
      if (!(lt.name in balances)) {
        balances[lt.name] = 0;
      }
    });
    
    res.json({
      success: true,
      data: {
        balances,
        maxDays
      }
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leave balance',
      details: error.message 
    });
  }
});
// ============================================
// TIMESHEET & ATTENDANCE VIEW
// ============================================

// GET /api/employee/timesheet/monthly - Get monthly timesheet
router.get('/timesheet/monthly', async (req, res) => {
    try {
        const userId = req.user._id;
        const { month, year } = req.query;
        
        let startDate, endDate;
        if (month && year) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0);
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        
        // Get punch logs
        const punchLogs = await EmployeePunchLog.find({
            employeeId: userId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });
        
        // Get approved leaves
        const leaves = await LeaveApplication.find({
            employeeId: userId,
            status: 'approved',
            $or: [
                { startDate: { $gte: startDate, $lte: endDate } },
                { endDate: { $gte: startDate, $lte: endDate } },
                { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
            ]
        });
        
        // Build daily status map
        const daysInMonth = endDate.getDate();
        const calendarData = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(startDate);
            date.setDate(day);
            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            
            // Check if it's a weekend
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Check if on leave
            const onLeave = leaves.find(leave => {
                const leaveStart = new Date(leave.startDate);
                const leaveEnd = new Date(leave.endDate);
                return date >= leaveStart && date <= leaveEnd;
            });
            
            // Check if punched in
            const punch = punchLogs.find(p => {
                const punchDate = new Date(p.date);
                return punchDate.getFullYear() === date.getFullYear() &&
                       punchDate.getMonth() === date.getMonth() &&
                       punchDate.getDate() === date.getDate();
            });
            
            let status = isWeekend ? 'weekend' : 'absent';
            let statusLabel = isWeekend ? 'Weekend' : 'Absent';
            
            if (onLeave) {
                status = 'leave';
                statusLabel = `Leave (${onLeave.leaveType})`;
            } else if (punch) {
                status = 'present';
                statusLabel = 'Present';
                if (new Date(punch.punchIn).getHours() >= 10) {
                    statusLabel = 'Present (Late)';
                }
                if (punch.punchOut) {
                    statusLabel += ' ✓';
                }
            }
            
            calendarData.push({
                date: dateStr,
                day,
                status,
                statusLabel,
                isWeekend,
                punchIn: punch?.punchIn || null,
                punchOut: punch?.punchOut || null,
                leaveType: onLeave?.leaveType || null
            });
        }
        
        res.json({
            success: true,
            data: {
                calendarData,
                stats: {
                    present: calendarData.filter(d => d.status === 'present').length,
                    leave: calendarData.filter(d => d.status === 'leave').length,
                    absent: calendarData.filter(d => d.status === 'absent' && !d.isWeekend).length,
                    weekend: calendarData.filter(d => d.isWeekend).length
                }
            }
        });
    } catch (error) {
        console.error('Error fetching timesheet:', error);
        res.status(500).json({ error: 'Failed to fetch timesheet' });
    }
});

// POST /api/employee/timesheet/missed-punch - Report a missed punch
router.post('/timesheet/missed-punch', async (req, res) => {
    try {
        const { date, type, expectedTime, reason } = req.body;
        const userId = req.user._id;
        
        if (!date || !type || !expectedTime || !reason) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check if already have a pending request for this date/type
        const existing = await MissedPunchRequest.findOne({
            employeeId: userId,
            date: new Date(date),
            type,
            status: 'pending'
        });
        
        if (existing) {
            return res.status(400).json({ error: 'You already have a pending request for this date and type' });
        }
        
        const missedPunch = new MissedPunchRequest({
            employeeId: userId,
            date: new Date(date),
            type,
            expectedTime: new Date(expectedTime),
            reason: reason.trim(),
            status: 'pending'
        });
        
        await missedPunch.save();
        
        // Notify HR
        const user = await User.findById(userId);
        const hrUsers = await User.find({ role: 'HR' });
        for (const hr of hrUsers) {
            await hr.addNotification({
                type: 'missed_punch_request',
                message: `${user.name} has reported a missed ${type === 'in' ? 'punch-in' : 'punch-out'} for ${new Date(date).toLocaleDateString()}`,
            });
        }
        
        res.status(201).json({
            success: true,
            data: missedPunch,
            message: 'Missed punch request submitted successfully'
        });
    } catch (error) {
        console.error('Error reporting missed punch:', error);
        res.status(500).json({ error: 'Failed to report missed punch' });
    }
});

// ============================================
// PROFILE MANAGEMENT (Employee)
// ============================================

// GET /api/employee/profile - Get employee profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('organizationId', 'companyName website address');
        
        // Format the response
        const profile = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            employeeCode: user.employeeCode,
            designation: user.designation,
            department: user.department,
            dateOfJoining: user.dateOfJoining,
            phoneNumber: user.phoneNumber,
            organization: user.organizationId ? {
                id: user.organizationId._id,
                name: user.organizationId.companyName,
                website: user.organizationId.website
            } : null,
            leaveBalances: Object.fromEntries(user.leaveBalances || new Map())
        };
        
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/employee/profile - Update employee profile
router.put('/profile', async (req, res) => {
    try {
        const { phoneNumber, department, designation, name } = req.body;
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Only allow updating certain fields
        if (name) user.name = name;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (department && user.role !== 'Client') user.department = department;
        if (designation && user.role !== 'Client') user.designation = designation;
        
        await user.save();
        
        res.json({
            success: true,
            data: {
                name: user.name,
                phoneNumber: user.phoneNumber,
                department: user.department,
                designation: user.designation
            },
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;