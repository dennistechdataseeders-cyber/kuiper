// backend/routes/employeeRoutes.js - COMPLETE FIXED VERSION
// ✅ Fixed: 10:09 AM and 10:17 AM are now correctly marked as ON TIME (not late)

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
// HELPER: Get IST date string from any date
// ============================================
const getISTDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// ============================================
// HELPER: Get IST date at midnight (returns UTC date)
// ============================================
const getISTMidnight = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// ============================================
// HELPER: Get start and end of day in IST (UTC boundaries)
// ============================================
const getISTDayRange = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { start, end };
};

// ============================================
// HELPER: Get the current date in IST
// ============================================
const getTodayIST = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// ============================================
// ✅ CORRECTED: Check if punch is late (after 10:45 AM IST)
// ============================================
const isLatePunch = (punchTime) => {
  if (!punchTime) return false;
  
  const punchDate = new Date(punchTime);
  const istPunchStr = punchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istPunch = new Date(istPunchStr);
  
  const hours = istPunch.getHours();
  const minutes = istPunch.getMinutes();
  
  // Office starts at 10:45 AM IST with grace period
  // Late if AFTER 10:45 AM (i.e., 10:46 or later)
  // 10:45 is ON TIME (grace period ends at 10:45)
  // 10:44, 10:45 are ON TIME
  // 10:46+ are LATE
  return hours > 10 || (hours === 10 && minutes > 45);
};

// ============================================
// ✅ CORRECTED: Get late minutes (if late)
// ============================================
const getLateMinutes = (punchTime) => {
  if (!punchTime) return 0;
  
  const punchDate = new Date(punchTime);
  const istPunchStr = punchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istPunch = new Date(istPunchStr);
  
  const hours = istPunch.getHours();
  const minutes = istPunch.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const officeMinutes = 10 * 60 + 45; // 10:45 AM IST
  
  return Math.max(0, totalMinutes - officeMinutes);
};

// ============================================
// ALL EMPLOYEE ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(protect);

// ============================================
// ATTENDANCE ROUTES FOR EMPLOYEES
// ============================================

// GET /api/employee/attendance/today - Get today's attendance status
router.get('/attendance/today', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get today's date in IST
    const todayStr = getTodayIST();
    const { start, end } = getISTDayRange(todayStr);
    
    const punchLogs = await EmployeePunchLog.find({
      employeeId: userId,
      date: { $gte: start, $lte: end }
    });
    
    const punchLog = punchLogs.length > 0 ? punchLogs[punchLogs.length - 1] : null;
    
    const onLeave = await LeaveApplication.findOne({
      employeeId: userId,
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: 'approved'
    });
    
    let status = 'absent';
    let statusMessage = 'Not Punched In';
    let punchInTime = null;
    let punchOutTime = null;
    let isLate = false;
    let lateMinutes = 0;
    
    if (onLeave) {
      status = 'on_leave';
      statusMessage = `On Leave (${onLeave.leaveType})`;
    } else if (punchLog) {
      punchInTime = punchLog.punchIn;
      punchOutTime = punchLog.punchOut;
      
      if (punchLog.punchIn) {
        // ✅ FIX: Use corrected isLatePunch function
        isLate = isLatePunch(punchLog.punchIn);
        lateMinutes = getLateMinutes(punchLog.punchIn);
        
        if (isLate) {
          status = 'late';
          statusMessage = 'Punched In (Late)';
        } else {
          status = 'on_time';
          statusMessage = 'Punched In (On Time)';
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
        onLeave: !!onLeave,
        isLate: isLate,
        lateMinutes: lateMinutes
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
    const { month, year } = req.query;
    
    let startOfMonth, endOfMonth;
    
    if (month && year) {
      const monthNum = parseInt(month) - 1;
      const yearNum = parseInt(year);
      startOfMonth = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0));
      endOfMonth = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
    } else {
      const todayStr = getTodayIST();
      const [yearNum, monthNum] = todayStr.split('-').map(Number);
      startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0));
      endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
    }
    
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
    
    // Create a map of punch logs by date (using IST date string)
    const punchMap = new Map();
    punchLogs.forEach(log => {
      const dateStr = getISTDateString(log.date);
      if (dateStr && !punchMap.has(dateStr)) {
        punchMap.set(dateStr, log);
      }
    });
    
    // Create a map of leave days (using IST date string)
    const leaveMap = new Map();
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = getISTDateString(current);
        if (dateStr && !leaveMap.has(dateStr)) {
          leaveMap.set(dateStr, leave);
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    // Calculate stats
    let workingDays = 0;
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const todayStr = getTodayIST();
    
    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const dateStr = getISTDateString(current);
      if (!dateStr) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }
      
      // Skip future dates (IST)
      if (dateStr > todayStr) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }
      
      const dayOfWeek = current.getUTCDay();
      const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      // Get punch log for this day
      const punchLog = punchMap.get(dateStr) || null;
      
      // Check if on leave
      const onLeave = leaveMap.get(dateStr) || null;
      
      // Determine status
      let status = 'absent';
      let punchIn = null;
      let punchOut = null;
      let isLate = false;
      let lateMinutes = 0;
      
      if (!isWorkingDay) {
        status = 'weekend';
      } else if (onLeave) {
        status = 'leave';
        workingDays++;
      } else if (punchLog) {
        // Get punch times from the log
        if (punchLog.sessions && punchLog.sessions.length > 0) {
          const firstSession = punchLog.sessions[0];
          const lastSession = punchLog.sessions[punchLog.sessions.length - 1];
          punchIn = firstSession.punchIn;
          punchOut = lastSession.punchOut || null;
        } else {
          punchIn = punchLog.punchIn;
          punchOut = punchLog.punchOut;
        }
        
        // ✅ FIX: Use corrected isLatePunch function
        if (punchIn) {
          isLate = isLatePunch(punchIn);
          lateMinutes = getLateMinutes(punchIn);
          
          if (isLate) {
            status = 'late';
          } else if (punchOut) {
            status = 'present';
          } else {
            status = 'partial';
          }
        } else if (punchOut) {
          status = 'partial';
        }
        
        workingDays++;
      } else {
        // No punch log, no leave - absent
        if (isWorkingDay) {
          workingDays++;
        }
      }
      
      days.push({
        date: dateStr,
        dayName: dayNames[dayOfWeek],
        status: status,
        punchIn: punchIn,
        punchOut: punchOut,
        isWeekend: !isWorkingDay,
        leaveType: onLeave?.leaveType || null,
        isLate: isLate,
        lateMinutes: lateMinutes
      });
      
      current.setUTCDate(current.getUTCDate() + 1);
    }
    
    // Calculate totals
    const presentDays = days.filter(d => d.status === 'present' || d.status === 'late');
    const absentDays = days.filter(d => d.status === 'absent');
    const lateDays = days.filter(d => d.status === 'late');
    const leaveDays = days.filter(d => d.status === 'leave');
    
    res.json({
      success: true,
      data: {
        workingDays,
        presentDays: presentDays.length,
        absentDays: absentDays.length,
        leaveDays: leaveDays.length,
        lateDays: lateDays.length,
        totalPunches: punchLogs.length,
        days: days,
        lateCount: lateDays.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ error: 'Failed to fetch monthly stats' });
  }
});

// GET /api/employee/attendance/timeline - Get employee's attendance timeline
router.get('/attendance/timeline', async (req, res) => {
  try {
    const userId = req.user._id;
    const { months = 3 } = req.query;
    
    const todayStr = getTodayIST();
    const [year, month, day] = todayStr.split('-').map(Number);
    
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const startDate = new Date(endDate);
    startDate.setUTCMonth(startDate.getUTCMonth() - parseInt(months));
    startDate.setUTCHours(0, 0, 0, 0);
    
    const punchLogs = await EmployeePunchLog.find({
      employeeId: userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
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
      let isLate = false;
      let lateMinutes = 0;
      
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
        
        // ✅ FIX: Use corrected isLatePunch function
        if (punchInUTC) {
          isLate = isLatePunch(punchInUTC);
          lateMinutes = getLateMinutes(punchInUTC);
          
          if (isLate) {
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
        leaveType: onLeave?.leaveType || null,
        isLate: isLate,
        lateMinutes: lateMinutes
      });
      
      current.setUTCDate(current.getUTCDate() + 1);
    }
    
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
            } else if (day.date === getTodayIST()) {
              const now = new Date();
              effectiveHours += (now - inTime) / (1000 * 60 * 60);
              lastOut = now;
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
    
    res.json({
      success: true,
      data: {
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
          latePercentage: latePercentage
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching attendance timeline:', error);
    res.status(500).json({ error: 'Failed to fetch attendance timeline' });
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
    
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const leaveTypeConfig = await LeaveType.findOne({ name: leaveType, isActive: true });
    if (!leaveTypeConfig) {
      return res.status(400).json({ error: 'Invalid or inactive leave type' });
    }
    
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
    
    const hrUsers = await User.find({ role: 'HR' });
    for (const hr of hrUsers) {
      await hr.addNotification({
        type: 'leave_request',
        message: `${user.name} has requested ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
      });
    }
    
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
    
    const leaveTypes = await LeaveType.find({ isActive: true });
    const maxDaysMap = {};
    leaveTypes.forEach(lt => {
      maxDaysMap[lt.name] = lt.maxDays;
    });
    
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
router.get('/leave/balance', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('leaveBalances');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const balances = {};
    if (user.leaveBalances && typeof user.leaveBalances === 'object') {
      if (user.leaveBalances instanceof Map) {
        user.leaveBalances.forEach((value, key) => {
          balances[key] = value;
        });
      } else {
        Object.keys(user.leaveBalances).forEach(key => {
          balances[key] = user.leaveBalances[key];
        });
      }
    }
    
    const leaveTypes = await LeaveType.find({ isActive: true });
    const maxDays = {};
    leaveTypes.forEach(lt => {
      maxDays[lt.name] = lt.maxDays;
    });
    
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

// POST /api/employee/timesheet/missed-punch - Report a missed punch
router.post('/timesheet/missed-punch', async (req, res) => {
  try {
    const { date, type, expectedTime, reason } = req.body;
    const userId = req.user._id;
    
    if (!date || !type || !expectedTime || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
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

// GET /api/employee/profile - Get employee profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('organizationId', 'companyName website address');
    
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