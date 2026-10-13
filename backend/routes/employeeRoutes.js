// backend/routes/employeeRoutes.js - COMPLETE UPDATED VERSION
// ✅ Shift-based late evaluation (Option B — ShiftHistory)
//    - Late-ness is now READ from EmployeePunchLog (isLate / lateMinutes),
//      never recomputed on the fly using a hardcoded 10:45 AM cutoff.
//    - Falls back to on-the-fly evaluation ONLY if the punch log
//      was never evaluated (e.g. legacy data not yet backfilled).
// ✅ Kept: Half-day leave support, extended timeline range, debug endpoint
// ✅ PROFILE ROUTE: shift changes through /profile now record ShiftHistory

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import models
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const MissedPunchRequest = require('../models/MissedPunchRequest');
const User = require('../models/User');
const LeaveType = require('../models/LeaveType');

// Import shift service (Option B — ShiftHistory)
const {
  getISTDateString,
  getShiftStartMinutesForDate,
  evaluateLateness,
  evaluateAndPersistLateness,
  recordShiftChange,
  toShiftStartMinutes
} = require('../services/shiftService');

// ============================================
// HELPER: Get date string preserving stored time (UTC as-is)
// ============================================
const getDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================
// HELPER: Get start and end of day in UTC (for DB queries)
// ============================================
const getUTCDayRange = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { start, end };
};

// ============================================
// HELPER: Resolve { isLate, lateMinutes } for a punch log.
//
// Priority order:
//   1. If the log was already evaluated (lateEvaluatedAt set),
//      trust the persisted fields.
//   2. Otherwise, evaluate on the fly using ShiftHistory for the
//      log's IST date, and persist the result (self-healing backfill).
// ============================================
const resolveLateness = async (log) => {
  if (!log) return { isLate: false, lateMinutes: 0 };

  if (log.lateEvaluatedAt) {
    return {
      isLate: !!log.isLate,
      lateMinutes: log.lateMinutes || 0
    };
  }

  // Not yet evaluated — evaluate & persist so subsequent reads are fast.
  try {
    await evaluateAndPersistLateness(log);
    return {
      isLate: !!log.isLate,
      lateMinutes: log.lateMinutes || 0
    };
  } catch (e) {
    // Never let lateness resolution crash the endpoint.
    console.error('resolveLateness fallback error:', e.message);
    return { isLate: false, lateMinutes: 0 };
  }
};

// ============================================
// ALL EMPLOYEE ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(protect);

// ============================================
// GET /api/employee/attendance/today
// ============================================
router.get('/attendance/today', async (req, res) => {
  try {
    const userId = req.user._id;

    const todayStr = getISTDateString(new Date());
    const { start, end } = getUTCDayRange(todayStr);

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
    let shiftStartMinutesUsed = null;

    if (onLeave) {
      status = 'on_leave';
      statusMessage = `On Leave (${onLeave.leaveType})`;
    } else if (punchLog) {
      punchInTime = punchLog.punchIn;
      punchOutTime = punchLog.punchOut;

      if (punchLog.punchIn) {
        const lateness = await resolveLateness(punchLog);
        isLate = lateness.isLate;
        lateMinutes = lateness.lateMinutes;
        shiftStartMinutesUsed = punchLog.shiftStartMinutesUsed ?? null;

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
        isLate,
        lateMinutes,
        shiftStartMinutesUsed
      }
    });
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ============================================
// GET /api/employee/attendance/monthly-stats
// ============================================
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
      const todayStr = getISTDateString(new Date());
      const [yearNum, monthNum] = todayStr.split('-').map(Number);
      startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0));
      endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
    }

    const punchLogs = await EmployeePunchLog.find({
      employeeId: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const leaves = await LeaveApplication.find({
      employeeId: userId,
      status: 'approved',
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { startDate: { $lte: startOfMonth }, endDate: { $gte: endOfMonth } }
      ]
    });

    const punchMap = new Map();
    punchLogs.forEach(log => {
      const dateStr = getDateString(log.date);
      if (dateStr && !punchMap.has(dateStr)) {
        punchMap.set(dateStr, log);
      }
    });

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

    let workingDays = 0;
    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const todayStr = getISTDateString(new Date());

    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const dateStr = getDateString(current);
      if (!dateStr) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      if (dateStr > todayStr) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      const dayOfWeek = current.getUTCDay();
      const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;

      const punchLog = punchMap.get(dateStr) || null;
      const onLeave = leaveMap.get(dateStr) || null;

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
        if (punchLog.sessions && punchLog.sessions.length > 0) {
          const firstSession = punchLog.sessions[0];
          const lastSession = punchLog.sessions[punchLog.sessions.length - 1];
          punchIn = firstSession.punchIn;
          punchOut = lastSession.punchOut || null;
        } else {
          punchIn = punchLog.punchIn;
          punchOut = punchLog.punchOut;
        }

        if (punchIn) {
          // ✅ Read persisted lateness (self-heals if missing)
          const lateness = await resolveLateness(punchLog);
          isLate = lateness.isLate;
          lateMinutes = lateness.lateMinutes;

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
        if (isWorkingDay) {
          workingDays++;
        }
      }

      days.push({
        date: dateStr,
        dayName: dayNames[dayOfWeek],
        status,
        punchIn,
        punchOut,
        isWeekend: !isWorkingDay,
        leaveType: onLeave?.leaveType || null,
        isLate,
        lateMinutes
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

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
        days,
        lateCount: lateDays.length
      }
    });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ error: 'Failed to fetch monthly stats' });
  }
});

// ============================================
// GET /api/employee/attendance/timeline
// ============================================
router.get('/attendance/timeline', async (req, res) => {
  try {
    const userId = req.user._id;
    const { months = 12 } = req.query;

    console.log(`📊 Fetching attendance timeline for user ${userId} with ${months} months`);

    const todayStr = getISTDateString(new Date());
    const [year, month, day] = todayStr.split('-').map(Number);

    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const startDate = new Date(endDate);
    startDate.setUTCMonth(startDate.getUTCMonth() - parseInt(months));
    startDate.setUTCHours(0, 0, 0, 0);

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const punchLogs = await EmployeePunchLog.find({
      employeeId: userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    console.log(`📊 Found ${punchLogs.length} punch logs for user`);

    const leaves = await LeaveApplication.find({
      employeeId: userId,
      status: 'approved',
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    console.log(`📊 Found ${leaves.length} approved leaves`);

    const punchMap = {};
    punchLogs.forEach(log => {
      const dateStr = getDateString(log.date);
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
      const dateStr = getDateString(current);
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
      } else if (dayLog) {
        const dbSessions = dayLog.sessions || [];

        if (dbSessions.length > 0) {
          sessions = dbSessions.map(session => ({
            punchInUTC: session.punchIn ? session.punchIn.toISOString() : null,
            punchOutUTC: session.punchOut ? session.punchOut.toISOString() : null
          }));

          const firstSession = dbSessions[0];
          const lastSession = dbSessions[dbSessions.length - 1];

          if (firstSession && firstSession.punchIn) {
            punchInUTC = firstSession.punchIn.toISOString();
          }
          if (lastSession && lastSession.punchOut) {
            punchOutUTC = lastSession.punchOut.toISOString();
          }
        } else if (dayLog.punchIn) {
          punchInUTC = dayLog.punchIn.toISOString();
          punchOutUTC = dayLog.punchOut ? dayLog.punchOut.toISOString() : null;
          sessions = [{ punchInUTC, punchOutUTC }];
        }

        if (onLeave) {
          status = 'leave';
        } else if (punchInUTC) {
          // ✅ Read persisted lateness (self-heals if missing)
          const lateness = await resolveLateness(dayLog);
          isLate = lateness.isLate;
          lateMinutes = lateness.lateMinutes;
          status = isLate ? 'late' : 'present';
        }
      } else if (onLeave) {
        status = 'leave';
      }

      days.push({
        date: dateStr,
        dayName: dayNames[dayOfWeek],
        status,
        isWeekend,
        punchInUTC,
        punchOutUTC,
        sessions,
        leaveType: onLeave?.leaveType || null,
        isHalfDay: onLeave?.isHalfDay || false,
        halfDayType: onLeave?.halfDayType || null,
        leaveId: onLeave?._id || null,
        isLate,
        lateMinutes
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    console.log(`📊 Processed ${days.length} days for timeline`);

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

    res.json({
      success: true,
      data: {
        days,
        summary: {
          totalDays: days.length,
          workingDays: workingDays.length,
          present: presentDays.length,
          absent: absentDays.length,
          onLeave: leaveDays.length,
          weekends: days.filter(d => d.isWeekend).length,
          late: lateDays.length,
          totalEffectiveHours,
          totalGrossHours,
          averageEffectiveHours: avgEffectiveHours,
          averageGrossHours: avgGrossHours,
          latePercentage
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance timeline:', error);
    res.status(500).json({ error: 'Failed to fetch attendance timeline' });
  }
});

// ============================================
// DEBUG ENDPOINT
// ============================================
router.get('/attendance/debug', async (req, res) => {
  try {
    const userId = req.user._id;

    console.log(`🔍 Debug: Fetching all punch logs for user ${userId}`);

    const allLogs = await EmployeePunchLog.find({ employeeId: userId })
      .sort({ date: -1 })
      .limit(100);

    const user = await User.findById(userId).select('name email employeeCode');

    const logsByMonth = {};
    allLogs.forEach(log => {
      const dateStr = getDateString(log.date);
      if (dateStr) {
        const monthKey = dateStr.substring(0, 7);
        logsByMonth[monthKey] = (logsByMonth[monthKey] || 0) + 1;
      }
    });

    res.json({
      success: true,
      user: {
        id: user?._id || userId,
        name: user?.name || 'Unknown',
        email: user?.email || 'Unknown',
        employeeCode: user?.employeeCode || 'Not set'
      },
      logCount: allLogs.length,
      logsByMonth,
      logs: allLogs.map(log => ({
        date: log.date,
        punchIn: log.punchIn,
        punchOut: log.punchOut,
        sessionCount: log.sessions?.length || 0,
        isManualCorrection: log.isManualCorrection || false,
        isLate: log.isLate || false,
        lateMinutes: log.lateMinutes || 0,
        shiftStartMinutesUsed: log.shiftStartMinutesUsed ?? null,
        lateEvaluatedAt: log.lateEvaluatedAt || null
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/employee/leave/apply
// ============================================
router.post('/leave/apply', async (req, res) => {
  try {
    const { leaveType, startDate, endDate, isHalfDay, halfDayType, reason } = req.body;
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
      halfDayType: isHalfDay ? (halfDayType || 'first') : null,
      reason: reason.trim(),
      status: 'pending'
    });

    await leaveApplication.save();

    const hrUsers = await User.find({ role: 'HR' });
    for (const hr of hrUsers) {
      await hr.addNotification({
        type: 'leave_request',
        message: `${user.name} has requested ${leaveType} leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
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

// ============================================
// GET /api/employee/leave/history
// ============================================
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

    const leaves = await LeaveApplication.find(filter).sort({ appliedAt: -1 });

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

// ============================================
// GET /api/employee/leave/balance
// ============================================
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
      data: { balances, maxDays }
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
// POST /api/employee/timesheet/missed-punch
// ============================================
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
        message: `${user.name} has reported a missed ${type === 'in' ? 'punch-in' : 'punch-out'} for ${new Date(date).toLocaleDateString()}`
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
// GET /api/employee/profile
// ============================================
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
      dateOfBirth: user.dateOfBirth,
      contactNumber: user.contactNumber,
      emergencyContact: user.emergencyContact,
      address: user.address,
      shiftHour: user.shiftHour || 9,
      shiftMinute: user.shiftMinute || 0,
      shiftAmPm: user.shiftAmPm || 'AM',
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

// ============================================
// PUT /api/employee/profile
// ✅ Shift changes now recorded in ShiftHistory
// ============================================
router.put('/profile', async (req, res) => {
  try {
    const {
      phoneNumber,
      department,
      designation,
      name,
      dateOfJoining,
      dateOfBirth,
      contactNumber,
      emergencyContact,
      address,
      shiftHour,
      shiftMinute,
      shiftAmPm
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (department && user.role !== 'Client') user.department = department;
    if (designation && user.role !== 'Client') user.designation = designation;

    if (user.role !== 'Admin' && user.role !== 'Super Admin' && user.role !== 'Client') {
      if (dateOfJoining !== undefined) user.dateOfJoining = dateOfJoining || null;
      if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
      if (contactNumber !== undefined) user.contactNumber = contactNumber || '';
      if (emergencyContact !== undefined) user.emergencyContact = emergencyContact || '';
      if (address !== undefined) user.address = address || '';

      // ------------------------------------------------------------
      // ✅ Shift handling — capture -> history -> commit
      // ------------------------------------------------------------
      const parsedShiftHour = shiftHour !== undefined ? parseInt(shiftHour) : undefined;
      const parsedShiftMinute = shiftMinute !== undefined ? parseInt(shiftMinute) : undefined;
      const parsedShiftAmPm = shiftAmPm !== undefined ? shiftAmPm : undefined;

      const prevHour = user.shiftHour ?? 9;
      const prevMinute = user.shiftMinute ?? 0;
      const prevAmPm = user.shiftAmPm ?? 'AM';

      const shiftChanging =
        (parsedShiftHour !== undefined && parsedShiftHour !== prevHour) ||
        (parsedShiftMinute !== undefined && parsedShiftMinute !== prevMinute) ||
        (parsedShiftAmPm !== undefined && parsedShiftAmPm !== prevAmPm);

      if (shiftChanging) {
        const nextHour = parsedShiftHour !== undefined ? parsedShiftHour : prevHour;
        const nextMinute = parsedShiftMinute !== undefined ? parsedShiftMinute : prevMinute;
        const nextAmPm = parsedShiftAmPm !== undefined ? parsedShiftAmPm : prevAmPm;

        await recordShiftChange(
          user._id,
          { hour: nextHour, minute: nextMinute, ampm: nextAmPm },
          req.user._id,
          `Shift updated by self via profile`
        );

        user.shiftHour = nextHour;
        user.shiftMinute = nextMinute;
        user.shiftAmPm = nextAmPm;
      }
    }

    await user.save();

    res.json({
      success: true,
      data: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        department: user.department,
        designation: user.designation,
        dateOfJoining: user.dateOfJoining,
        dateOfBirth: user.dateOfBirth,
        contactNumber: user.contactNumber,
        emergencyContact: user.emergencyContact,
        address: user.address,
        shiftHour: user.shiftHour,
        shiftMinute: user.shiftMinute,
        shiftAmPm: user.shiftAmPm
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// GET /api/employee/team-culture
// ============================================
router.get('/team-culture', async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const currentDate = now.getUTCDate();

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

    const users = await User.find({
      isActive: true,
      role: { $ne: 'Client' }
    }).select('name dateOfBirth dateOfJoining role designation');

    const birthdays = [];
    const anniversaries = [];
    const newHires = [];

    users.forEach((user) => {
      if (user.dateOfBirth) {
        const birthDate = new Date(user.dateOfBirth);
        if (
          birthDate.getUTCMonth() === currentMonth &&
          birthDate.getUTCDate() >= currentDate
        ) {
          birthdays.push({
            _id: user._id,
            name: user.name,
            date: user.dateOfBirth,
            dateDisplay: birthDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            role: user.role
          });
        }
      }

      if (user.dateOfJoining) {
        const joinDate = new Date(user.dateOfJoining);
        const years = currentYear - joinDate.getUTCFullYear();
        if (
          joinDate.getUTCMonth() === currentMonth &&
          joinDate.getUTCDate() >= currentDate &&
          years >= 1
        ) {
          anniversaries.push({
            _id: user._id,
            name: user.name,
            date: user.dateOfJoining,
            dateDisplay: joinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            years,
            role: user.role
          });
        }
      }

      if (user.dateOfJoining) {
        const joinDate = new Date(user.dateOfJoining);
        if (joinDate >= oneMonthAgo && joinDate <= now) {
          newHires.push({
            _id: user._id,
            name: user.name,
            date: user.dateOfJoining,
            dateDisplay: joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
            role: user.role,
            designation: user.designation || 'Team Member'
          });
        }
      }
    });

    birthdays.sort((a, b) => new Date(a.date).getUTCDate() - new Date(b.date).getUTCDate());
    anniversaries.sort((a, b) => new Date(a.date).getUTCDate() - new Date(b.date).getUTCDate());
    newHires.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        birthdays: birthdays.slice(0, 5),
        anniversaries: anniversaries.slice(0, 5),
        newHires: newHires.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Error fetching team culture data:', error);
    res.status(500).json({ error: 'Failed to fetch team culture data' });
  }
});

module.exports = router;