// backend/routes/hrRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// Import models
const LeaveType = require('../models/LeaveType');
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const MissedPunchRequest = require('../models/MissedPunchRequest');
const attendanceSyncService = require('../services/attendanceSyncService');
const User = require('../models/User');

// ============================================
// ALL HR ROUTES REQUIRE HR ROLE
// ============================================
router.use(protect);
router.use(authorize('HR', 'Admin'));

// ============================================
// LEAVE MANAGEMENT (HR)
// ============================================

// GET /api/hr/leave/pending - Get all pending leave applications
router.get('/leave/pending', async (req, res) => {
    try {
        const pendingLeaves = await LeaveApplication.find({ status: 'pending' })
            .populate('employeeId', 'name email employeeCode designation department')
            .sort({ appliedAt: 1 });
        
        res.json({ success: true, data: pendingLeaves });
    } catch (error) {
        console.error('Error fetching pending leaves:', error);
        res.status(500).json({ error: 'Failed to fetch pending leaves' });
    }
});

// GET /api/hr/leave/all - Get all leave applications with filters
router.get('/leave/all', async (req, res) => {
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
            .populate('employeeId', 'name email employeeCode designation department')
            .sort({ appliedAt: -1 });
        
        res.json({ success: true, data: leaves });
    } catch (error) {
        console.error('Error fetching leave applications:', error);
        res.status(500).json({ error: 'Failed to fetch leave applications' });
    }
});

// PATCH /api/hr/leave/:id/approve - Approve a leave application
router.patch('/leave/:id/approve', async (req, res) => {
    try {
        const leave = await LeaveApplication.findById(req.params.id);
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave application not found' });
        }
        
        if (leave.status !== 'pending') {
            return res.status(400).json({ error: 'Leave already processed' });
        }
        
        // Calculate number of days
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const daysToDeduct = leave.isHalfDay ? 0.5 : daysDiff;
        
        // Update user's leave balance
        const user = await User.findById(leave.employeeId);
        if (!user) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Get current balance for this leave type
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
        await user.save();
        
        // Update leave application
        leave.status = 'approved';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        await leave.save();
        
        // Create notification for employee
        await user.addNotification({
            type: 'leave_approved',
            message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`,
        });
        
        // Emit socket notification
        const io = req.app.get('io');
        if (io) {
            io.to(leave.employeeId.toString()).emit('leave_approved', {
                leaveId: leave._id,
                message: `Your leave request has been approved`,
                leaveType: leave.leaveType,
                dates: `${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`
            });
        }
        
        res.json({ success: true, data: leave });
    } catch (error) {
        console.error('Error approving leave:', error);
        res.status(500).json({ error: 'Failed to approve leave' });
    }
});

// PATCH /api/hr/leave/:id/reject - Reject a leave application
router.patch('/leave/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        
        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        
        const leave = await LeaveApplication.findById(req.params.id);
        
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
        
        // Create notification for employee
        const user = await User.findById(leave.employeeId);
        if (user) {
            await user.addNotification({
                type: 'leave_rejected',
                message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been rejected. Reason: ${rejectionReason}`,
            });
            
            const io = req.app.get('io');
            if (io) {
                io.to(leave.employeeId.toString()).emit('leave_rejected', {
                    leaveId: leave._id,
                    message: `Your leave request has been rejected`,
                    reason: rejectionReason
                });
            }
        }
        
        res.json({ success: true, data: leave });
    } catch (error) {
        console.error('Error rejecting leave:', error);
        res.status(500).json({ error: 'Failed to reject leave' });
    }
});

// ============================================
// ATTENDANCE MANAGEMENT (HR)
// ============================================

// GET /api/hr/attendance/corrections - Get all pending missed punch requests
router.get('/attendance/corrections', async (req, res) => {
    try {
        const corrections = await MissedPunchRequest.find({ status: 'pending' })
            .populate('employeeId', 'name email employeeCode designation department')
            .sort({ createdAt: 1 });
        
        res.json({ success: true, data: corrections });
    } catch (error) {
        console.error('Error fetching corrections:', error);
        res.status(500).json({ error: 'Failed to fetch corrections' });
    }
});

// PATCH /api/hr/attendance/correction/:id - Approve or reject a missed punch request
router.patch('/attendance/correction/:id', async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const correction = await MissedPunchRequest.findById(req.params.id);
        
        if (!correction) {
            return res.status(404).json({ error: 'Correction request not found' });
        }
        
        if (correction.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        
        correction.status = action === 'approve' ? 'approved' : 'rejected';
        correction.reviewedBy = req.user._id;
        correction.reviewedAt = new Date();
        await correction.save();
        
        // If approved, create a punch log entry
        if (action === 'approve') {
            const punchLog = new EmployeePunchLog({
                employeeId: correction.employeeId,
                punchIn: correction.type === 'in' ? correction.expectedTime : null,
                punchOut: correction.type === 'out' ? correction.expectedTime : null,
                date: correction.date,
                isManualCorrection: true,
                correctionNote: correction.reason,
                createdBy: req.user._id
            });
            
            // If it's a punch-out, we need to find the matching punch-in for the day
            if (correction.type === 'out') {
                // Find the punch-in for the same day
                const punchInLog = await EmployeePunchLog.findOne({
                    employeeId: correction.employeeId,
                    date: correction.date,
                    punchOut: null
                });
                
                if (punchInLog) {
                    punchInLog.punchOut = correction.expectedTime;
                    await punchInLog.save();
                    // Don't create a new entry, just update the existing one
                    await punchLog.deleteOne();
                } else {
                    // No matching punch-in found, create a standalone entry
                    await punchLog.save();
                }
            } else {
                // Punch-in correction - check if there's already a punch-in for this day
                const existingPunch = await EmployeePunchLog.findOne({
                    employeeId: correction.employeeId,
                    date: correction.date
                });
                
                if (existingPunch) {
                    // Update existing entry instead of creating new one
                    existingPunch.punchIn = correction.expectedTime;
                    existingPunch.isManualCorrection = true;
                    existingPunch.correctionNote = correction.reason;
                    await existingPunch.save();
                    await punchLog.deleteOne();
                } else {
                    await punchLog.save();
                }
            }
            
            // Notification for employee
            const user = await User.findById(correction.employeeId);
            if (user) {
                await user.addNotification({
                    type: 'missed_punch_approved',
                    message: `Your missed ${correction.type === 'in' ? 'punch-in' : 'punch-out'} request for ${new Date(correction.date).toLocaleDateString()} has been approved.`,
                });
            }
        } else {
            // Rejected - notify employee
            const user = await User.findById(correction.employeeId);
            if (user) {
                await user.addNotification({
                    type: 'missed_punch_rejected',
                    message: `Your missed ${correction.type === 'in' ? 'punch-in' : 'punch-out'} request for ${new Date(correction.date).toLocaleDateString()} has been rejected.`,
                });
            }
        }
        
        res.json({ success: true, data: correction });
    } catch (error) {
        console.error('Error processing correction:', error);
        res.status(500).json({ error: 'Failed to process correction' });
    }
});

// POST /api/hr/attendance/manual-punch - Manually add a punch log
router.post('/attendance/manual-punch', async (req, res) => {
    try {
        const { employeeId, punchIn, punchOut, date, note } = req.body;
        
        if (!employeeId || !date) {
            return res.status(400).json({ error: 'Employee ID and date are required' });
        }
        
        // Check if punch log already exists for this date
        const existingPunch = await EmployeePunchLog.findOne({
            employeeId,
            date: new Date(date)
        });
        
        let punchLog;
        if (existingPunch) {
            // Update existing
            if (punchIn) existingPunch.punchIn = new Date(punchIn);
            if (punchOut) existingPunch.punchOut = new Date(punchOut);
            existingPunch.isManualCorrection = true;
            if (note) existingPunch.correctionNote = note;
            existingPunch.createdBy = req.user._id;
            punchLog = await existingPunch.save();
        } else {
            // Create new
            punchLog = new EmployeePunchLog({
                employeeId,
                punchIn: punchIn ? new Date(punchIn) : null,
                punchOut: punchOut ? new Date(punchOut) : null,
                date: new Date(date),
                isManualCorrection: true,
                correctionNote: note || 'Manual entry by HR',
                createdBy: req.user._id
            });
            await punchLog.save();
        }
        
        res.status(201).json({ success: true, data: punchLog });
    } catch (error) {
        console.error('Error creating manual punch:', error);
        res.status(500).json({ error: 'Failed to create manual punch' });
    }
});

// ============================================
// BIOMETRIC ATTENDANCE SYNC ROUTES (WORKING VERSION)
// ============================================

// POST /api/hr/attendance/sync - Sync attendance logs from biometric device
router.post('/attendance/sync', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || today;
    const to = toDate || today;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }
    
    console.log(`🔄 Starting attendance sync from ${from} to ${to}`);
    
    const result = await attendanceSyncService.syncAttendanceLogs(from, to);
    
    res.json({
      success: true,
      message: 'Attendance sync completed',
      data: result
    });
  } catch (error) {
    console.error('❌ Attendance sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync attendance',
      details: error.message 
    });
  }
});

// POST /api/hr/attendance/sync-progress - Sync with progress tracking
router.post('/attendance/sync-progress', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || today;
    const to = toDate || today;
    
    const result = await attendanceSyncService.syncAttendanceLogs(from, to);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync attendance',
      details: error.message 
    });
  }
});

// GET /api/hr/attendance/employee/:employeeCode - Get attendance for a specific employee
router.get('/attendance/employee/:employeeCode', async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const { fromDate, toDate } = req.query;
    
    console.log(`🔍 Fetching attendance for employee code: ${employeeCode}`);
    
    if (!employeeCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Employee code is required' 
      });
    }
    
    const user = await User.findOne({ employeeCode }).select('name email designation department employeeCode');
    
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || today;
    const to = toDate || today;
    
    // Get punch logs from database
    const punchLogs = await EmployeePunchLog.find({
      employeeId: user?._id,
      date: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    }).sort({ date: 1 });
    
    // Also fetch from device API for complete data
    const deviceLogs = await attendanceSyncService.fetchAttendanceLogs(from, to);
    const employeeDeviceLogs = deviceLogs.filter(log => 
      String(log.EmployeeCode || log.employeeCode) === String(employeeCode)
    );
    
    // Process and combine data
    const logsByDate = {};
    
    // Process device logs
    employeeDeviceLogs.forEach(log => {
      const dateStr = new Date(log.LogDate || log.IOTime).toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = { device: [], db: [] };
      }
      logsByDate[dateStr].device.push(log);
    });
    
    // Process DB logs
    punchLogs.forEach(log => {
      const dateStr = log.date.toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = { device: [], db: [] };
      }
      logsByDate[dateStr].db.push(log);
    });
    
    // Calculate stats
    const start = new Date(from);
    const end = new Date(to);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let workingDays = 0;
    let presentDays = 0;
    let lateDays = 0;
    let totalHours = 0;
    const days = [];
    
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = current.toISOString().split('T')[0];
      
      if (!isWeekend) {
        workingDays++;
        const dayData = logsByDate[dateStr] || { device: [], db: [] };
        
        // Check device logs for punch in/out
        const devicePunchIn = dayData.device.find(l => {
          const dir = (l.PunchDirection || l.IOMode || '').toString().trim().toLowerCase();
          return dir === 'in' || dir === '1' || (dir !== '' && dir !== 'out' && dir !== '2');
        });
        const devicePunchOut = dayData.device.find(l => {
          const dir = (l.PunchDirection || l.IOMode || '').toString().trim().toLowerCase();
          return dir === 'out' || dir === '2';
        });
        
        const dbPunchIn = dayData.db.find(l => l.punchIn);
        const dbPunchOut = dayData.db.find(l => l.punchOut);
        
        const punchIn = dbPunchIn?.punchIn || devicePunchIn?.LogDate || devicePunchIn?.IOTime;
        const punchOut = dbPunchOut?.punchOut || devicePunchOut?.LogDate || devicePunchOut?.IOTime;
        
        let status = 'absent';
        let hoursWorked = 0;
        
        if (punchIn && punchOut) {
          status = 'present';
          presentDays++;
          const inTime = new Date(punchIn);
          const outTime = new Date(punchOut);
          hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
          totalHours += hoursWorked;
          
          if (inTime.getHours() >= 10) {
            lateDays++;
          }
        } else if (punchIn) {
          status = 'partial';
        }
        
        days.push({
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          status,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          punchIn: punchIn ? new Date(punchIn).toISOString() : null,
          punchOut: punchOut ? new Date(punchOut).toISOString() : null,
          deviceLogs: dayData.device.length,
          dbLogs: dayData.db.length
        });
      }
      current.setDate(current.getDate() + 1);
    }
    
    res.json({
      success: true,
      data: {
        employee: user ? {
          name: user.name,
          employeeCode: user.employeeCode,
          email: user.email,
          designation: user.designation || 'N/A',
          department: user.department || 'N/A'
        } : {
          name: 'Unknown',
          employeeCode: employeeCode,
          email: 'N/A',
          designation: 'N/A',
          department: 'N/A'
        },
        summary: {
          totalLogs: employeeDeviceLogs.length + punchLogs.length,
          workingDays: workingDays,
          present: presentDays,
          absent: workingDays - presentDays,
          late: lateDays,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0
        },
        days: days,
        deviceLogs: employeeDeviceLogs,
        dbLogs: punchLogs
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching employee attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch employee attendance',
      details: error.message 
    });
  }
});

// backend/routes/hrRoutes.js - UPDATED

// ============================================
// GET /api/hr/attendance/employee-codes - Get all employee codes
// ✅ FIX: Exclude Client role users
// ============================================
router.get('/attendance/employee-codes', async (req, res) => {
  try {
    console.log('📋 Fetching all employee codes...');
    
    // ✅ FIX: Exclude users with role 'Client'
    const users = await User.find({ 
      employeeCode: { $ne: null, $ne: '' },
      role: { $ne: 'Client' } // EXCLUDE Client role
    }).select('employeeCode name email designation department role');
    
    console.log(`📊 Found ${users.length} users with employee codes (Clients excluded)`);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('❌ Error fetching employee codes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch employee codes',
      details: error.message 
    });
  }
});

// POST /api/hr/attendance/test-connection - Test device API connection
router.post('/attendance/test-connection', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || today;
    const to = toDate || today;
    
    console.log(`📡 Testing connection to biometric API...`);
    console.log(`📋 Date range: ${from} to ${to}`);
    
    const result = await attendanceSyncService.testConnection(from, to);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Connection test failed',
      details: error.message 
    });
  }
});

// GET /api/hr/attendance/device-codes - Get all employee codes from the device
router.get('/attendance/device-codes', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || '2026-07-01';
    const to = toDate || today;
    
    const codes = await attendanceSyncService.getDeviceEmployeeCodes(from, to);
    
    res.json({
      success: true,
      data: codes
    });
  } catch (error) {
    console.error('❌ Error fetching device codes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch device codes',
      details: error.message 
    });
  }
});
// ============================================
// DASHBOARD STATS (HR) - FIXED with IST timezone and proper status mapping
// ============================================

// ============================================
// DASHBOARD STATS (HR) - Uses employee-timeline logic
// ============================================

// GET /api/hr/dashboard/stats - Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
    try {
        // Get today's date in IST
        const now = new Date();
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayStr = istNow.toISOString().split('T')[0];
        
        // Build date range in UTC
        const [year, month, day] = todayStr.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        
        // Get all active employees (excluding Admin, HR, Client)
        const allEmployees = await User.find({ 
            isActive: true,
            role: { $nin: ['Admin', 'HR', 'Client'] }
        });
        const totalEmployees = allEmployees.length;
        
        // Get today's punch logs
        const todayPunches = await EmployeePunchLog.find({
            date: { $gte: startDate, $lte: endDate }
        });
        
        // Create a map of employee IDs to punch logs
        const punchMap = {};
        todayPunches.forEach(p => {
            const empId = p.employeeId.toString();
            if (!punchMap[empId]) {
                punchMap[empId] = p;
            }
        });
        
        // Helper to check if punch is late (after 10:45 AM IST)
        const isLatePunch = (punchTime) => {
            if (!punchTime) return false;
            const punchDate = new Date(punchTime);
            const istPunchStr = punchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            const istPunch = new Date(istPunchStr);
            const hours = istPunch.getHours();
            const minutes = istPunch.getMinutes();
            // Late if AFTER 10:45 AM IST (10:46 or later)
            return hours > 10 || (hours === 10 && minutes > 45);
        };
        
        // Get approved leaves for today
        const approvedLeaves = await LeaveApplication.find({
            status: 'approved',
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
            ]
        });
        
        // Create a set of employee IDs on leave
        const onLeaveIds = new Set();
        approvedLeaves.forEach(leave => {
            onLeaveIds.add(leave.employeeId.toString());
        });
        
        // Count employees by status
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let onLeaveCount = onLeaveIds.size;
        
        allEmployees.forEach(emp => {
            const empId = emp._id.toString();
            
            // Check if on leave
            if (onLeaveIds.has(empId)) {
                onLeaveCount++;
                return;
            }
            
            // Check if has punch today
            const punch = punchMap[empId];
            if (punch) {
                presentCount++;
                // Check if late
                if (punch.punchIn && isLatePunch(punch.punchIn)) {
                    lateCount++;
                }
            } else {
                absentCount++;
            }
        });
        
        const pendingLeaves = await LeaveApplication.countDocuments({ status: 'pending' });
        const pendingCorrections = await MissedPunchRequest.countDocuments({ status: 'pending' });
        
        res.json({
            success: true,
            data: {
                present: presentCount,
                absent: absentCount,
                late: lateCount,
                onLeave: onLeaveCount,
                totalEmployees,
                pendingLeaves,
                pendingCorrections,
                attendanceRate: totalEmployees > 0 
                    ? Math.round((presentCount / totalEmployees) * 100) 
                    : 0
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// ============================================
// LEAVE TYPE MANAGEMENT (Admin/HR)
// ============================================

// GET /api/hr/leave-types - Get all leave types
router.get('/leave-types', async (req, res) => {
    try {
        const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, data: leaveTypes });
    } catch (error) {
        console.error('Error fetching leave types:', error);
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
});

// POST /api/hr/leave-types - Create a new leave type (Admin only)
router.post('/leave-types', authorize('Admin'), async (req, res) => {
    try {
        const { name, code, maxDays, isActive, requiresApproval } = req.body;
        
        const existing = await LeaveType.findOne({ 
            $or: [{ name }, { code }] 
        });
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Leave type with this name or code already exists' 
            });
        }
        
        const leaveType = new LeaveType({
            name,
            code,
            maxDays,
            isActive: isActive !== undefined ? isActive : true,
            requiresApproval: requiresApproval !== undefined ? requiresApproval : true
        });
        
        await leaveType.save();
        res.status(201).json({ success: true, data: leaveType });
    } catch (error) {
        console.error('Error creating leave type:', error);
        res.status(500).json({ error: 'Failed to create leave type' });
    }
});

// PUT /api/hr/leave-types/:id - Update a leave type (Admin only)
router.put('/leave-types/:id', authorize('Admin'), async (req, res) => {
    try {
        const { name, code, maxDays, isActive, requiresApproval } = req.body;
        
        const leaveType = await LeaveType.findById(req.params.id);
        if (!leaveType) {
            return res.status(404).json({ error: 'Leave type not found' });
        }
        
        const existing = await LeaveType.findOne({
            $or: [{ name }, { code }],
            _id: { $ne: req.params.id }
        });
        
        if (existing) {
            return res.status(400).json({ 
                error: 'Another leave type with this name or code already exists' 
            });
        }
        
        leaveType.name = name;
        leaveType.code = code;
        leaveType.maxDays = maxDays;
        leaveType.isActive = isActive !== undefined ? isActive : leaveType.isActive;
        leaveType.requiresApproval = requiresApproval !== undefined ? requiresApproval : leaveType.requiresApproval;
        
        await leaveType.save();
        res.json({ success: true, data: leaveType });
    } catch (error) {
        console.error('Error updating leave type:', error);
        res.status(500).json({ error: 'Failed to update leave type' });
    }
});

// DELETE /api/hr/leave-types/:id - Delete a leave type (Admin only)
router.delete('/leave-types/:id', authorize('Admin'), async (req, res) => {
    try {
        const leaveType = await LeaveType.findById(req.params.id);
        if (!leaveType) {
            return res.status(404).json({ error: 'Leave type not found' });
        }
        
        leaveType.isActive = false;
        await leaveType.save();
        
        res.json({ success: true, message: 'Leave type deactivated' });
    } catch (error) {
        console.error('Error deleting leave type:', error);
        res.status(500).json({ error: 'Failed to delete leave type' });
    }
});

// ============================================
// EMPLOYEE MANAGEMENT (HR)
// ============================================

// PATCH /api/hr/employee/:id/leave-balance - Manually adjust employee leave balance
router.patch('/employee/:id/leave-balance', async (req, res) => {
    try {
        const { leaveType, adjustment, note } = req.body;
        const employee = await User.findById(req.params.id);
        
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        const currentBalance = employee.leaveBalances.get(leaveType) || 0;
        const newBalance = Math.max(0, currentBalance + adjustment);
        
        employee.leaveBalances.set(leaveType, newBalance);
        await employee.save();
        
        res.json({
            success: true,
            data: {
                leaveType,
                previousBalance: currentBalance,
                adjustment,
                newBalance,
                note: note || 'Manual adjustment by HR'
            }
        });
    } catch (error) {
        console.error('Error adjusting leave balance:', error);
        res.status(500).json({ error: 'Failed to adjust leave balance' });
    }
});

// GET /api/hr/employee/:id/leave-balance - Get employee's leave balances
router.get('/employee/:id/leave-balance', async (req, res) => {
    try {
        const employee = await User.findById(req.params.id).select('leaveBalances');
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        const balances = {};
        employee.leaveBalances.forEach((value, key) => {
            balances[key] = value;
        });
        
        const leaveTypes = await LeaveType.find({ isActive: true });
        const maxDays = {};
        leaveTypes.forEach(lt => {
            maxDays[lt.name] = lt.maxDays;
        });
        
        res.json({
            success: true,
            data: {
                balances,
                maxDays,
                employeeId: employee._id
            }
        });
    } catch (error) {
        console.error('Error fetching leave balance:', error);
        res.status(500).json({ error: 'Failed to fetch leave balance' });
    }
});

// POST /api/hr/biometric/manual-sync - Manual trigger
router.post('/biometric/manual-sync', authorize('Admin', 'HR'), async (req, res) => {
  try {
    const syncService = require('../cron/biometricSync');
    await syncService.syncAttendance();
    res.json({ success: true, message: 'Manual sync completed' });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/hr/attendance/employee-timeline/:userId
// Get attendance timeline for a specific employee (HR/Admin only)
// ============================================
router.get('/attendance/employee-timeline/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { months = 3 } = req.query;
    
    // Verify user exists
    const employee = await User.findById(userId).select('name email role employeeCode');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    
    // Get IST date helpers
    const getISTDateString = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    };
    
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const endDate = new Date(Date.UTC(
      istNow.getFullYear(),
      istNow.getMonth(),
      istNow.getDate(),
      23, 59, 59, 999
    ));
    
    const startDate = new Date(endDate);
    startDate.setUTCMonth(startDate.getUTCMonth() - parseInt(months));
    startDate.setUTCHours(0, 0, 0, 0);
    
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
    
    const punchMap = {};
    punchLogs.forEach(log => {
      const dateStr = getISTDateString(log.date);
      if (dateStr) {
        punchMap[dateStr] = log;
      }
    });
    
    const leaveMap = {};
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = getISTDateString(current);
        if (dateStr && !leaveMap[dateStr]) {
          leaveMap[dateStr] = leave;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = getISTDateString(current);
      if (!dateStr) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }
      
      const dayOfWeek = current.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const dayLog = punchMap[dateStr] || null;
      const onLeave = leaveMap[dateStr] || null;
      
      let status = 'absent';
      let punchInUTC = null;
      let punchOutUTC = null;
      let sessions = [];
      
      if (isWeekend) {
        status = 'weekend';
      } else if (onLeave) {
        status = 'leave';
      } else if (dayLog) {
        if (dayLog.sessions && dayLog.sessions.length > 0) {
          sessions = dayLog.sessions.map(session => ({
            punchInUTC: session.punchIn ? session.punchIn.toISOString() : null,
            punchOutUTC: session.punchOut ? session.punchOut.toISOString() : null
          }));
          
          const firstSession = dayLog.sessions[0];
          const lastSession = dayLog.sessions[dayLog.sessions.length - 1];
          
          if (firstSession && firstSession.punchIn) {
            punchInUTC = firstSession.punchIn.toISOString();
          }
          if (lastSession && lastSession.punchOut) {
            punchOutUTC = lastSession.punchOut.toISOString();
          }
        } else {
          if (dayLog.punchIn) {
            punchInUTC = dayLog.punchIn.toISOString();
            sessions = [{ punchInUTC, punchOutUTC: dayLog.punchOut ? dayLog.punchOut.toISOString() : null }];
          }
        }
        
        if (punchInUTC) {
          const punchDate = new Date(punchInUTC);
          const hour = punchDate.getUTCHours();
          const minute = punchDate.getUTCMinutes();
          if (hour > 10 || (hour === 10 && minute > 45)) {
            status = 'late';
          } else if (punchOutUTC) {
            status = 'present';
          } else {
            status = 'partial';
          }
        }
      }
      
      days.push({
        date: dateStr,
        dayName: dayNames[dayOfWeek],
        status: status,
        isWeekend: isWeekend,
        punchInUTC: punchInUTC,
        punchOutUTC: punchOutUTC,
        sessions: sessions,
        leaveType: onLeave?.leaveType || null
      });
      
      current.setUTCDate(current.getUTCDate() + 1);
    }
    
    // Calculate summary stats
    const workingDays = days.filter(d => !d.isWeekend);
    const presentDays = workingDays.filter(d => d.status === 'present' || d.status === 'late');
    const absentDays = workingDays.filter(d => d.status === 'absent');
    const leaveDays = workingDays.filter(d => d.status === 'leave');
    const lateDays = workingDays.filter(d => d.status === 'late');
    
    let totalEffectiveHours = 0;
    let totalGrossHours = 0;
    
    presentDays.forEach(day => {
      if (day.sessions && day.sessions.length > 0) {
        let effectiveHours = 0;
        let firstIn = null;
        let lastOut = null;
        
        day.sessions.forEach(session => {
          if (session.punchInUTC) {
            const inTime = new Date(session.punchInUTC);
            if (!firstIn || inTime < firstIn) firstIn = inTime;
            
            if (session.punchOutUTC) {
              const outTime = new Date(session.punchOutUTC);
              effectiveHours += (outTime - inTime) / (1000 * 60 * 60);
              if (!lastOut || outTime > lastOut) lastOut = outTime;
            }
          }
        });
        
        if (firstIn && lastOut) {
          totalGrossHours += (lastOut - firstIn) / (1000 * 60 * 60);
        }
        totalEffectiveHours += effectiveHours;
      } else if (day.punchInUTC && day.punchOutUTC) {
        const inTime = new Date(day.punchInUTC);
        const outTime = new Date(day.punchOutUTC);
        totalEffectiveHours += (outTime - inTime) / (1000 * 60 * 60);
        totalGrossHours += (outTime - inTime) / (1000 * 60 * 60);
      }
    });
    
    const avgEffectiveHours = presentDays.length > 0 ? totalEffectiveHours / presentDays.length : 0;
    const avgGrossHours = presentDays.length > 0 ? totalGrossHours / presentDays.length : 0;
    const latePercentage = presentDays.length > 0 ? (lateDays.length / presentDays.length) * 100 : 0;
    const attendanceRate = workingDays.length > 0 ? (presentDays.length / workingDays.length) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          employeeCode: employee.employeeCode
        },
        days: days,
        summary: {
          totalDays: days.length,
          workingDays: workingDays.length,
          present: presentDays.length,
          absent: absentDays.length,
          onLeave: leaveDays.length,
          weekends: days.filter(d => d.isWeekend).length,
          late: lateDays.length,
          totalEffectiveHours: totalEffectiveHours,
          totalGrossHours: totalGrossHours,
          averageEffectiveHours: avgEffectiveHours,
          averageGrossHours: avgGrossHours,
          latePercentage: latePercentage,
          attendanceRate: attendanceRate
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching employee attendance timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee attendance timeline' });
  }
});

// ============================================
// GET /api/hr/attendance/employee-report
// Get attendance report for all employees or a specific employee
// EXCLUDES Clients
// ============================================
router.get('/attendance/employee-report', async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    
    // Build date range
    const monthNum = parseInt(month) - 1;
    const yearNum = parseInt(year);
    const startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
    
    // Get IST date helper
    const getISTDateString = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    };
    
    // Build employee filter - EXCLUDE Clients
    let employeeFilter = { 
      role: { $nin: ['Admin', 'HR', 'Client'] }, // EXCLUDE Client role
      isActive: true 
    };
    
    // If a specific employee is selected, add that to the filter
    if (employeeId && employeeId !== 'all') {
      employeeFilter._id = employeeId;
    }
    
    // Get employees (excluding Admin, HR, and Client)
    const employees = await User.find(employeeFilter)
      .select('_id name email employeeCode role')
      .sort({ name: 1 });
    
    if (employees.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No employees found'
      });
    }
    
    const employeeIds = employees.map(e => e._id);
    
    // Get punch logs for all employees
    const punchLogs = await EmployeePunchLog.find({
      employeeId: { $in: employeeIds },
      date: { $gte: startDate, $lte: endDate }
    }).sort({ employeeId: 1, date: 1 });
    
    // Get approved leaves
    const leaves = await LeaveApplication.find({
      employeeId: { $in: employeeIds },
      status: 'approved',
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });
    
    // Build maps
    const punchMap = {};
    punchLogs.forEach(log => {
      const empId = log.employeeId.toString();
      const dateStr = getISTDateString(log.date);
      if (!dateStr) return;
      if (!punchMap[empId]) punchMap[empId] = {};
      punchMap[empId][dateStr] = log;
    });
    
    const leaveMap = {};
    leaves.forEach(leave => {
      const empId = leave.employeeId.toString();
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = getISTDateString(current);
        if (dateStr) {
          if (!leaveMap[empId]) leaveMap[empId] = {};
          leaveMap[empId][dateStr] = leave;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    // Generate report data
    const reportData = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // For each employee
    for (const employee of employees) {
      const empId = employee._id.toString();
      const empPunchMap = punchMap[empId] || {};
      const empLeaveMap = leaveMap[empId] || {};
      
      // Iterate through each day of the month
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = getISTDateString(current);
        if (!dateStr) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }
        
        const dayOfWeek = current.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayLog = empPunchMap[dateStr] || null;
        const onLeave = empLeaveMap[dateStr] || null;
        
        let status = 'absent';
        let punchIn = null;
        let punchOut = null;
        let effectiveHours = 0;
        let grossHours = 0;
        let arrivalStatus = '—';
        let sessions = [];
        
        if (isWeekend) {
          status = 'weekend';
        } else if (onLeave) {
          status = 'leave';
        } else if (dayLog) {
          if (dayLog.sessions && dayLog.sessions.length > 0) {
            sessions = dayLog.sessions;
            let firstIn = null;
            let lastOut = null;
            
            sessions.forEach(session => {
              if (session.punchIn) {
                if (!firstIn || session.punchIn < firstIn) firstIn = session.punchIn;
                if (session.punchOut) {
                  effectiveHours += (session.punchOut - session.punchIn) / (1000 * 60 * 60);
                  if (!lastOut || session.punchOut > lastOut) lastOut = session.punchOut;
                }
              }
            });
            
            if (firstIn && lastOut) {
              grossHours = (lastOut - firstIn) / (1000 * 60 * 60);
            } else if (sessions.length === 1 && sessions[0].punchIn) {
              grossHours = effectiveHours;
            }
            
            if (sessions.length > 0 && sessions[0].punchIn) {
              punchIn = sessions[0].punchIn;
              if (sessions[sessions.length - 1].punchOut) {
                punchOut = sessions[sessions.length - 1].punchOut;
              }
            }
          } else {
            punchIn = dayLog.punchIn;
            punchOut = dayLog.punchOut;
            if (punchIn && punchOut) {
              effectiveHours = (punchOut - punchIn) / (1000 * 60 * 60);
              grossHours = effectiveHours;
            }
          }
          
          if (punchIn) {
            const punchDate = new Date(punchIn);
            const hour = punchDate.getUTCHours();
            const minute = punchDate.getUTCMinutes();
            if (hour > 10 || (hour === 10 && minute > 45)) {
              status = 'late';
              const totalMinutes = hour * 60 + minute;
              const officeMinutes = 10 * 60 + 45;
              const diff = totalMinutes - officeMinutes;
              arrivalStatus = `${diff}m late`;
            } else if (punchOut) {
              status = 'present';
              arrivalStatus = 'On Time';
            } else {
              status = 'partial';
              arrivalStatus = 'No Out';
            }
          }
        }
        
        // Format times for display
        const formatTime = (date) => {
          if (!date) return '—';
          const d = new Date(date);
          if (isNaN(d.getTime())) return '—';
          let hours = d.getUTCHours();
          const minutes = String(d.getUTCMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          return `${hours}:${minutes} ${ampm}`;
        };
        
        reportData.push({
          employeeName: employee.name,
          employeeCode: employee.employeeCode || 'N/A',
          employeeEmail: employee.email,
          employeeRole: employee.role,
          employeeId: employee._id,
          date: dateStr,
          day: dayNames[dayOfWeek],
          status: status === 'weekend' ? 'Weekend' : 
                  status === 'leave' ? 'Leave' :
                  status === 'present' ? 'Present' :
                  status === 'late' ? 'Late' :
                  status === 'partial' ? 'Partial' : 'Absent',
          punchIn: formatTime(punchIn),
          punchOut: formatTime(punchOut),
          effectiveHours: effectiveHours > 0 ? effectiveHours.toFixed(1) : '0',
          grossHours: grossHours > 0 ? grossHours.toFixed(1) : '0',
          arrival: arrivalStatus,
          isWeekend: isWeekend
        });
        
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }
    
    res.json({
      success: true,
      data: reportData,
      summary: {
        totalEmployees: employees.length,
        totalRecords: reportData.length,
        month: `${monthNames[monthNum]} ${yearNum}`
      }
    });
    
  } catch (error) {
    console.error('Error generating employee report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

// Helper: month names
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

// backend/routes/hrRoutes.js - UPDATED

// ============================================
// GET /api/hr/employees - Updated to exclude Clients
// ============================================
router.get('/employees', async (req, res) => {
  try {
    // EXCLUDE Clients from the employee list
    const employees = await User.find({
      role: { $nin: ['Admin', 'HR', 'Client'] }, // EXCLUDE Client role
      isActive: true
    }).select('name email employeeCode role _id')
    .sort({ name: 1 });
    
    res.json({ success: true, employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

module.exports = router;