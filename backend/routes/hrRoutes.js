// backend/routes/hrRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios'); // ✅ ADD THIS - Required for device API calls
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
// ATTENDANCE SYNC ROUTES (FROM DEVICE API)
// ============================================

// POST /api/hr/attendance/sync - Sync attendance logs from device
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

// GET /api/hr/attendance/employee/:employeeCode - Get attendance from device API
// GET /api/hr/attendance/employee/:employeeCode - Get attendance from device API
router.get('/attendance/employee/:employeeCode', async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const { fromDate, toDate } = req.query;
    
    console.log(`🔍 Fetching attendance for employee code: ${employeeCode}`);
    console.log(`   Date range: ${fromDate} to ${toDate}`);
    
    if (!employeeCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Employee code is required' 
      });
    }
    
    // Find the user by employee code to get their name
    const user = await User.findOne({ employeeCode }).select('name email designation department');
    
    // Set default date range
    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || today;
    const to = toDate || today;
    
    // Fetch logs from the device API
    const deviceUrl = 'http://103.170.149.84:82/api/v2/WebAPI/GetDeviceLogs';
    const params = {
      APIKey: '384410062609',
      FromDate: from,
      ToDate: to
    };
    
    console.log(`📡 Fetching from device API: ${deviceUrl}`);
    console.log(`📋 Params:`, params);
    
    const response = await axios.get(deviceUrl, { 
      params,
      timeout: 30000
    });
    
    const allLogs = response.data || [];
    console.log(`📊 Received ${allLogs.length} total logs from device`);
    
    // Filter logs by employee code
    const employeeLogs = allLogs.filter(log => 
      log.EmployeeCode === employeeCode || 
      log.employeeCode === employeeCode
    );
    
    console.log(`📊 Found ${employeeLogs.length} logs for employee ${employeeCode}`);
    
    if (employeeLogs.length === 0) {
      return res.json({
        success: true,
        data: {
          employee: {
            name: user?.name || 'Unknown',
            employeeCode: employeeCode,
            email: user?.email || 'N/A',
            designation: user?.designation || 'N/A',
            department: user?.department || 'N/A'
          },
          summary: {
            totalLogs: 0,
            workingDays: 0,
            present: 0,
            absent: 0,
            late: 0,
            totalHours: 0,
            averageHours: 0
          },
          days: [],
          logs: []
        },
        message: 'No logs found for this employee'
      });
    }
    
    // Process the logs - group by date
    const logsByDate = {};
    employeeLogs.forEach(log => {
      const dateStr = log.LogDate.split(' ')[0]; // Get YYYY-MM-DD
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = [];
      }
      logsByDate[dateStr].push(log);
    });
    
    // Calculate stats
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const start = new Date(from);
    const end = new Date(to);
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
        const dayLogs = logsByDate[dateStr] || [];
        
        // Find punch in and punch out - handle various formats
        // Check for "in", "In", "IN", or any non-empty string that might indicate a punch
        const punchIn = dayLogs.find(l => {
          const dir = (l.PunchDirection || '').trim().toLowerCase();
          return dir === 'in' || dir === '1' || (dir !== '' && dir !== 'out' && dir !== '2');
        });
        
        const punchOut = dayLogs.find(l => {
          const dir = (l.PunchDirection || '').trim().toLowerCase();
          return dir === 'out' || dir === '2';
        });
        
        let status = 'absent';
        let hoursWorked = 0;
        let punchInTime = null;
        let punchOutTime = null;
        
        if (punchIn) {
          punchInTime = punchIn.LogDate;
          status = 'partial';
          
          // Try to find a matching punch out
          if (punchOut) {
            punchOutTime = punchOut.LogDate;
            const inTime = new Date(punchIn.LogDate);
            const outTime = new Date(punchOut.LogDate);
            hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
            status = 'present';
            presentDays++;
            totalHours += hoursWorked;
            
            // Check for late (after 10:00 AM)
            if (inTime.getHours() >= 10) {
              lateDays++;
            }
          } else {
            // Look for any other log that could be a punch out (same day, different time)
            const possibleOut = dayLogs.find(l => 
              l.LogDate !== punchIn.LogDate && 
              (l.PunchDirection || '').trim() === ''
            );
            if (possibleOut) {
              punchOutTime = possibleOut.LogDate;
              const inTime = new Date(punchIn.LogDate);
              const outTime = new Date(possibleOut.LogDate);
              hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
              if (hoursWorked > 0 && hoursWorked < 24) {
                status = 'present';
                presentDays++;
                totalHours += hoursWorked;
                
                if (inTime.getHours() >= 10) {
                  lateDays++;
                }
              }
            }
          }
        }
        
        // If we have multiple logs, try to determine presence
        if (status === 'absent' && dayLogs.length > 0) {
          // If there are any logs for this day, consider it present
          status = 'present';
          presentDays++;
          
          // Try to calculate hours from first and last log
          const sortedLogs = [...dayLogs].sort((a, b) => {
            return new Date(a.LogDate) - new Date(b.LogDate);
          });
          
          if (sortedLogs.length >= 2) {
            const first = new Date(sortedLogs[0].LogDate);
            const last = new Date(sortedLogs[sortedLogs.length - 1].LogDate);
            hoursWorked = (last - first) / (1000 * 60 * 60);
            totalHours += hoursWorked;
          }
        }
        
        days.push({
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          status,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          punchIn: punchInTime,
          punchOut: punchOutTime,
          logCount: dayLogs.length,
          logs: dayLogs
        });
      }
      current.setDate(current.getDate() + 1);
    }
    
    const responseData = {
      success: true,
      data: {
        employee: {
          name: user?.name || 'Unknown',
          employeeCode: employeeCode,
          email: user?.email || 'N/A',
          designation: user?.designation || 'N/A',
          department: user?.department || 'N/A'
        },
        summary: {
          totalLogs: employeeLogs.length,
          workingDays: workingDays,
          present: presentDays,
          absent: workingDays - presentDays,
          late: lateDays,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0
        },
        days: days,
        logs: employeeLogs
      }
    };
    
    console.log(`✅ Attendance summary: ${presentDays} present, ${workingDays - presentDays} absent, ${lateDays} late`);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching employee attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch employee attendance',
      details: error.message 
    });
  }
});

// GET /api/hr/attendance/employee-codes - Get all employee codes
router.get('/attendance/employee-codes', async (req, res) => {
  try {
    console.log('📋 Fetching all employee codes...');
    
    const users = await User.find({ 
      employeeCode: { $ne: null, $ne: '' } 
    }).select('employeeCode name email designation department');
    
    console.log(`📊 Found ${users.length} users with employee codes`);
    
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
    
    const deviceUrl = 'http://103.170.149.84:82/api/v2/WebAPI/GetDeviceLogs';
    const params = {
      APIKey: '384410062609',
      FromDate: from,
      ToDate: to
    };
    
    console.log(`📡 Testing connection to device API...`);
    console.log(`🔗 URL: ${deviceUrl}`);
    console.log(`📋 Params:`, params);
    
    const response = await axios.get(deviceUrl, { 
      params,
      timeout: 30000
    });
    
    const logs = response.data || [];
    
    const employeeCodes = [...new Set(logs.map(l => l.EmployeeCode || l.employeeCode).filter(Boolean))];
    
    const existingEmployees = await User.find({
      employeeCode: { $in: employeeCodes }
    }).select('employeeCode name email');
    
    const existingCodes = new Set(existingEmployees.map(e => e.employeeCode));
    const missingCodes = employeeCodes.filter(code => !existingCodes.has(code));
    
    res.json({
      success: true,
      message: 'Connection test successful',
      data: {
        totalLogs: logs.length,
        uniqueEmployees: employeeCodes.length,
        existingEmployees: existingEmployees.length,
        missingEmployees: missingCodes,
        sampleLogs: logs.slice(0, 5),
        employeeCodes: employeeCodes
      }
    });
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Connection test failed',
      details: error.message 
    });
  }
});

// ============================================
// DASHBOARD STATS (HR)
// ============================================

// GET /api/hr/dashboard/stats - Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayPunches = await EmployeePunchLog.find({
            date: { $gte: today, $lt: tomorrow }
        });
        
        const uniquePunchEmployees = new Set(todayPunches.map(p => p.employeeId.toString()));
        const presentCount = uniquePunchEmployees.size;
        
        const allEmployees = await User.find({ 
            isActive: true,
            role: { $nin: ['Admin', 'HR'] }
        });
        const totalEmployees = allEmployees.length;
        const absentCount = Math.max(0, totalEmployees - presentCount);
        
        const lateArrivals = todayPunches.filter(p => {
            if (!p.punchIn) return false;
            const punchInHour = new Date(p.punchIn).getHours();
            return punchInHour >= 10;
        }).length;
        
        const leaveCount = await LeaveApplication.countDocuments({
            startDate: { $lte: today },
            endDate: { $gte: today },
            status: 'approved'
        });
        
        const pendingLeaves = await LeaveApplication.countDocuments({ status: 'pending' });
        const pendingCorrections = await MissedPunchRequest.countDocuments({ status: 'pending' });
        
        res.json({
            success: true,
            data: {
                present: presentCount,
                absent: absentCount,
                late: lateArrivals,
                onLeave: leaveCount,
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

module.exports = router;