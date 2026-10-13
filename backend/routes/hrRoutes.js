// backend/routes/hrRoutes.js - COMPLETE UPDATED VERSION
// ✅ Shift-based late evaluation (Option B — ShiftHistory)
//    - Late-ness is now READ from EmployeePunchLog (isLate / lateMinutes),
//      never recomputed on the fly using a hardcoded 10:45 AM cutoff.
//    - Uses resolveLateness() helper (self-healing lazy evaluation).
// ✅ The /attendance/today-status endpoint (used by employee dashboards)
//    now reads the persisted lateness flags.
// ✅ Manual punch endpoint evaluates + persists lateness immediately.
// ✅ /attendance/employee-timeline/:userId reads persisted flags.
// ✅ /attendance/employee-report reads persisted flags + returns shift info.
// ✅ /attendance/employee-report now also returns holiday flags per day.
// ✅ /dashboard/stats reads persisted flags instead of recomputing.
// ✅ Kept: MSSQL sync, biometric sync, leave management, probation, etc.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const mssqlService = require('../services/mssqlBiometricService');

// Import models
const LeaveType = require('../models/LeaveType');
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const MissedPunchRequest = require('../models/MissedPunchRequest');
const attendanceSyncService = require('../services/attendanceSyncService');
const User = require('../models/User');
const Holiday = require('../models/Holiday'); // ✅ NEW

// Import shift service (Option B — ShiftHistory)
const {
  getISTDateString,
  getShiftStartMinutesForDate,
  evaluateLateness,
  evaluateAndPersistLateness,
  toShiftStartMinutes
} = require('../services/shiftService');

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

  try {
    await evaluateAndPersistLateness(log);
    return {
      isLate: !!log.isLate,
      lateMinutes: log.lateMinutes || 0
    };
  } catch (e) {
    console.error('resolveLateness fallback error:', e.message);
    return { isLate: false, lateMinutes: 0 };
  }
};

// ============================================
// HELPER FUNCTION: Get employee status for today
// (Used only where an explicit one-off status is needed.)
// ============================================
async function getEmployeeStatus(employeeId, dateStr) {
  try {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const punchLog = await EmployeePunchLog.findOne({
      employeeId: employeeId,
      date: { $gte: start, $lte: end }
    });

    const onLeave = await LeaveApplication.findOne({
      employeeId: employeeId,
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: 'approved'
    });

    if (onLeave) return 'leave';

    if (punchLog && punchLog.punchIn) {
      const lateness = await resolveLateness(punchLog);
      if (lateness.isLate) return 'late';
      if (punchLog.punchOut) return 'present';
      return 'partial';
    }

    return 'absent';
  } catch (error) {
    console.error('Error getting employee status:', error);
    return 'absent';
  }
}

// ============================================
// SPECIAL ROUTE: Allow Developer role for sync-logs
// Place this BEFORE the global authorize middleware
// ============================================
router.post('/attendance/sync-logs', protect, async (req, res) => {
  try {
    const { logs, source } = req.body;

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Logs array is required and must not be empty'
      });
    }

    console.log(`📥 Received ${logs.length} logs from ${source || 'external script'}`);

    const users = await User.find({
      employeeCode: { $ne: null, $ne: '' }
    }).select('_id employeeCode name');

    const userMap = {};
    users.forEach(u => {
      userMap[String(u.employeeCode)] = u;
    });

    console.log(`👤 Found ${Object.keys(userMap).length} users with employee codes`);

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: [],
      unmatchedCodes: new Set()
    };

    const logsByEmployee = {};

    for (const log of logs) {
      const empCode = String(log.EmpCode || log.employeeCode || log.empCode);
      if (!empCode) {
        results.errors.push({ log, error: 'No employee code found' });
        continue;
      }

      if (!logsByEmployee[empCode]) {
        logsByEmployee[empCode] = [];
      }
      logsByEmployee[empCode].push(log);
    }

    for (const [empCode, employeeLogs] of Object.entries(logsByEmployee)) {
      const user = userMap[empCode];

      if (!user) {
        results.unmatchedCodes.add(empCode);
        results.errors.push({
          employeeCode: empCode,
          error: 'User not found in database',
          logCount: employeeLogs.length
        });
        continue;
      }

      for (const log of employeeLogs) {
        try {
          const logDateStr = log.IOTime || log.LogDate || log.date || log.timestamp;
          if (!logDateStr) {
            results.errors.push({
              employeeCode: empCode,
              error: 'No date found in log entry'
            });
            continue;
          }

          const logDate = new Date(logDateStr);
          if (isNaN(logDate.getTime())) {
            results.errors.push({
              employeeCode: empCode,
              error: `Invalid date format: ${logDateStr}`
            });
            continue;
          }

          const istDateStr = logDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const [year, month, day] = istDateStr.split('-').map(Number);
          const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

          const punchDirection = (log.IOMode || log.PunchDirection || log.mode || '').toString().trim().toLowerCase();
          const isPunchIn = punchDirection === 'in' || punchDirection === '1' || punchDirection === '';
          const isPunchOut = punchDirection === 'out' || punchDirection === '2';

          let punchLog = await EmployeePunchLog.findOne({
            employeeId: user._id,
            date: date
          });

          let isNew = false;
          if (!punchLog) {
            isNew = true;
            punchLog = new EmployeePunchLog({
              employeeId: user._id,
              date: date,
              sessions: [],
              isManualCorrection: false,
              correctionNote: `Imported from ${source || 'external script'} at ${new Date().toISOString()}`,
              createdBy: null
            });
          }

          if (isPunchIn) {
            const openSession = punchLog.sessions.find(s => !s.punchOut);

            if (openSession) {
              if (logDate < openSession.punchIn) {
                openSession.punchIn = logDate;
              }
            } else {
              punchLog.sessions.push({
                punchIn: logDate,
                punchOut: null
              });
            }

            if (!punchLog.punchIn || logDate < punchLog.punchIn) {
              punchLog.punchIn = logDate;
            }
          } else if (isPunchOut) {
            const openSession = punchLog.sessions.find(s => !s.punchOut);

            if (openSession) {
              openSession.punchOut = logDate;
              if (!punchLog.punchOut || logDate > punchLog.punchOut) {
                punchLog.punchOut = logDate;
              }
            } else {
              punchLog.sessions.push({
                punchIn: logDate,
                punchOut: logDate
              });
              if (!punchLog.punchOut || logDate > punchLog.punchOut) {
                punchLog.punchOut = logDate;
              }
            }
          }

          if (!punchLog.correctionNote || punchLog.correctionNote.includes('Manual correction')) {
            punchLog.correctionNote = `Imported from ${source || 'external script'} at ${new Date().toISOString()}`;
          }

          await punchLog.save();

          // ✅ Evaluate & persist lateness immediately
          try {
            await evaluateAndPersistLateness(punchLog);
          } catch (evalErr) {
            console.error(`Lateness evaluation failed for ${empCode}:`, evalErr.message);
          }

          results.processed++;
          if (isNew) results.created++;
          else results.updated++;

        } catch (logError) {
          console.error(`Error processing log for ${empCode}:`, logError.message);
          results.errors.push({
            employeeCode: empCode,
            error: logError.message
          });
        }
      }
    }

    const response = {
      success: true,
      message: `Processed ${results.processed} logs from ${source || 'external script'}`,
      data: {
        processed: results.processed,
        created: results.created,
        updated: results.updated,
        unmatchedCodes: Array.from(results.unmatchedCodes),
        errors: results.errors.slice(0, 50)
      }
    };

    console.log(`✅ Sync complete: ${results.processed} processed, ${results.created} created, ${results.updated} updated`);
    if (results.unmatchedCodes.size > 0) {
      console.log(`⚠️ Unmatched employee codes: ${Array.from(results.unmatchedCodes).join(', ')}`);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync attendance logs',
      details: error.message
    });
  }
});

// ============================================
// TODAY STATUS — For Employee Dashboard
// Accessible to ALL authenticated users (not just HR/Admin)
// Must be placed BEFORE the global authorize middleware.
// ============================================
router.get('/attendance/today-status', protect, async (req, res) => {
  try {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = istNow.toISOString().split('T')[0];

    const [year, month, day] = todayStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Exclude Admin / HR / Client / Super Admin
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    }).select('name email employeeCode role shiftHour shiftMinute shiftAmPm profileImage');

    if (employees.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const employeeIds = employees.map(e => e._id);

    const punchLogs = await EmployeePunchLog.find({
      employeeId: { $in: employeeIds },
      date: { $gte: startDate, $lte: endDate }
    });

    const punchMap = {};
    punchLogs.forEach(p => {
      punchMap[p.employeeId.toString()] = p;
    });

    const leaves = await LeaveApplication.find({
      employeeId: { $in: employeeIds },
      status: 'approved',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    });

    const leaveMap = {};
    leaves.forEach(l => {
      leaveMap[l.employeeId.toString()] = l;
    });

    const results = await Promise.all(employees.map(async (emp) => {
      const empId = emp._id.toString();
      const punch = punchMap[empId];
      const leave = leaveMap[empId];

      let status = 'absent';
      let punchInUTC = null;
      let punchOutUTC = null;
      let isCurrentlyIn = false;
      let lateMinutes = 0;

      if (punch) {
        if (punch.sessions && punch.sessions.length > 0) {
          const first = punch.sessions[0];
          const last = punch.sessions[punch.sessions.length - 1];
          punchInUTC = first.punchIn ? first.punchIn.toISOString() : null;
          punchOutUTC = last.punchOut ? last.punchOut.toISOString() : null;
        } else {
          punchInUTC = punch.punchIn ? punch.punchIn.toISOString() : null;
          punchOutUTC = punch.punchOut ? punch.punchOut.toISOString() : null;
        }

        const hasOpenSession = (punch.sessions || []).some(s => s.punchIn && !s.punchOut);
        isCurrentlyIn = hasOpenSession || (punchInUTC && !punchOutUTC);

        if (punchInUTC) {
          // ✅ Read persisted lateness (self-heals if missing)
          const lateness = await resolveLateness(punch);
          lateMinutes = lateness.lateMinutes;
          status = lateness.isLate ? 'late' : 'present';
        }
      }

      if (leave && !punchInUTC) {
        status = 'leave';
      }

      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        employeeCode: emp.employeeCode || null,
        profileImage: emp.profileImage || null,
        shiftHour: emp.shiftHour ?? 10,
        shiftMinute: emp.shiftMinute ?? 30,
        shiftAmPm: emp.shiftAmPm || 'AM',
        status,
        isCurrentlyIn,
        punchInUTC,
        punchOutUTC,
        lateMinutes,
        leaveType: leave ? leave.leaveType : null,
        isHalfDay: leave ? !!leave.isHalfDay : false,
        halfDayType: leave ? leave.halfDayType : null
      };
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching today-status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today status' });
  }
});

// ============================================
// ALL OTHER HR ROUTES - Keep HR/Admin only
// ============================================
router.use(protect);
router.use(authorize('HR', 'Admin'));

// ============================================
// LEAVE MANAGEMENT (HR)
// ============================================

// GET /api/hr/leave/pending
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

// GET /api/hr/leave/all
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

// PATCH /api/hr/leave/:id/approve
router.patch('/leave/:id/approve', async (req, res) => {
  try {
    const leave = await LeaveApplication.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ error: 'Leave application not found' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: 'Leave already processed' });
    }

    const user = await User.findById(leave.employeeId);
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (leave.leaveType === 'Unpaid Leave') {
      leave.status = 'approved';
      leave.approvedBy = req.user._id;
      leave.approvedAt = new Date();
      await leave.save();

      try {
        if (!user.unreadNotifications) {
          user.unreadNotifications = [];
        }
        user.unreadNotifications.push({
          type: 'leave_approved',
          message: `Your Unpaid Leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`,
          createdAt: new Date(),
          read: false
        });
        user.notificationCount = (user.notificationCount || 0) + 1;
        await user.save();
      } catch (notifError) {
        console.error('Failed to send notification:', notifError.message);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(leave.employeeId.toString()).emit('leave_approved', {
          leaveId: leave._id,
          message: `Your Unpaid Leave request has been approved`,
          leaveType: leave.leaveType,
          dates: `${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`
        });
      }

      return res.json({
        success: true,
        data: leave,
        message: 'Unpaid Leave approved successfully'
      });
    }

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const daysToDeduct = leave.isHalfDay ? 0.5 : daysDiff;

    const currentBalance = user.leaveBalances.get(leave.leaveType) || 0;
    if (currentBalance < daysToDeduct) {
      return res.status(400).json({
        error: 'Insufficient leave balance',
        balance: currentBalance,
        requested: daysToDeduct
      });
    }

    user.leaveBalances.set(leave.leaveType, currentBalance - daysToDeduct);
    await user.save();

    leave.status = 'approved';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    await leave.save();

    try {
      if (!user.unreadNotifications) {
        user.unreadNotifications = [];
      }
      user.unreadNotifications.push({
        type: 'leave_approved',
        message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`,
        createdAt: new Date(),
        read: false
      });
      user.notificationCount = (user.notificationCount || 0) + 1;
      await user.save();
    } catch (notifError) {
      console.error('Failed to send notification:', notifError.message);
    }

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

// PATCH /api/hr/leave/:id/reject
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

    const user = await User.findById(leave.employeeId);
    if (user) {
      await user.addNotification({
        type: 'leave_rejected',
        message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been rejected. Reason: ${rejectionReason}`
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

// GET /api/hr/attendance/corrections
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

// PATCH /api/hr/attendance/correction/:id
router.patch('/attendance/correction/:id', async (req, res) => {
  try {
    const { action } = req.body;
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

      if (correction.type === 'out') {
        const punchInLog = await EmployeePunchLog.findOne({
          employeeId: correction.employeeId,
          date: correction.date,
          punchOut: null
        });

        if (punchInLog) {
          punchInLog.punchOut = correction.expectedTime;
          await punchInLog.save();

          // ✅ Re-evaluate lateness for the updated log
          try {
            await evaluateAndPersistLateness(punchInLog);
          } catch (evalErr) {
            console.error('Lateness re-eval failed:', evalErr.message);
          }

          await punchLog.deleteOne();
        } else {
          await punchLog.save();
          try {
            await evaluateAndPersistLateness(punchLog);
          } catch (evalErr) {
            console.error('Lateness eval failed:', evalErr.message);
          }
        }
      } else {
        const existingPunch = await EmployeePunchLog.findOne({
          employeeId: correction.employeeId,
          date: correction.date
        });

        if (existingPunch) {
          existingPunch.punchIn = correction.expectedTime;
          existingPunch.isManualCorrection = true;
          existingPunch.correctionNote = correction.reason;
          await existingPunch.save();

          try {
            await evaluateAndPersistLateness(existingPunch);
          } catch (evalErr) {
            console.error('Lateness re-eval failed:', evalErr.message);
          }

          await punchLog.deleteOne();
        } else {
          await punchLog.save();
          try {
            await evaluateAndPersistLateness(punchLog);
          } catch (evalErr) {
            console.error('Lateness eval failed:', evalErr.message);
          }
        }
      }

      const user = await User.findById(correction.employeeId);
      if (user) {
        await user.addNotification({
          type: 'missed_punch_approved',
          message: `Your missed ${correction.type === 'in' ? 'punch-in' : 'punch-out'} request for ${new Date(correction.date).toLocaleDateString()} has been approved.`
        });
      }
    } else {
      const user = await User.findById(correction.employeeId);
      if (user) {
        await user.addNotification({
          type: 'missed_punch_rejected',
          message: `Your missed ${correction.type === 'in' ? 'punch-in' : 'punch-out'} request for ${new Date(correction.date).toLocaleDateString()} has been rejected.`
        });
      }
    }

    res.json({ success: true, data: correction });
  } catch (error) {
    console.error('Error processing correction:', error);
    res.status(500).json({ error: 'Failed to process correction' });
  }
});

// POST /api/hr/attendance/manual-punch
router.post('/attendance/manual-punch', async (req, res) => {
  try {
    const { employeeId, punchIn, punchOut, date, note } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({ error: 'Employee ID and date are required' });
    }

    const existingPunch = await EmployeePunchLog.findOne({
      employeeId,
      date: new Date(date)
    });

    let punchLog;
    if (existingPunch) {
      if (punchIn) existingPunch.punchIn = new Date(punchIn);
      if (punchOut) existingPunch.punchOut = new Date(punchOut);
      existingPunch.isManualCorrection = true;
      if (note) existingPunch.correctionNote = note;
      existingPunch.createdBy = req.user._id;
      punchLog = await existingPunch.save();
    } else {
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

    // ✅ Evaluate & persist lateness
    try {
      await evaluateAndPersistLateness(punchLog);
    } catch (evalErr) {
      console.error('Lateness eval failed for manual punch:', evalErr.message);
    }

    res.status(201).json({ success: true, data: punchLog });
  } catch (error) {
    console.error('Error creating manual punch:', error);
    res.status(500).json({ error: 'Failed to create manual punch' });
  }
});

// ============================================
// BIOMETRIC ATTENDANCE SYNC ROUTES
// ============================================

// POST /api/hr/attendance/sync
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

// POST /api/hr/attendance/sync-progress
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

// GET /api/hr/attendance/employee/:employeeCode
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

    const punchLogs = await EmployeePunchLog.find({
      employeeId: user?._id,
      date: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    }).sort({ date: 1 });

    const deviceLogs = await attendanceSyncService.fetchAttendanceLogs(from, to);
    const employeeDeviceLogs = deviceLogs.filter(log =>
      String(log.EmployeeCode || log.employeeCode) === String(employeeCode)
    );

    const logsByDate = {};

    employeeDeviceLogs.forEach(log => {
      const dateStr = new Date(log.LogDate || log.IOTime).toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = { device: [], db: [] };
      }
      logsByDate[dateStr].device.push(log);
    });

    punchLogs.forEach(log => {
      const dateStr = log.date.toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = { device: [], db: [] };
      }
      logsByDate[dateStr].db.push(log);
    });

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
        let isLate = false;
        let lateMinutes = 0;

        if (punchIn && punchOut) {
          status = 'present';
          presentDays++;
          const inTime = new Date(punchIn);
          const outTime = new Date(punchOut);
          hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
          totalHours += hoursWorked;

          // ✅ Prefer persisted lateness from DB log if available
          if (dbPunchIn) {
            const lateness = await resolveLateness(dbPunchIn);
            isLate = lateness.isLate;
            lateMinutes = lateness.lateMinutes;
          }

          if (isLate) {
            status = 'late';
            lateDays++;
          }
        } else if (punchIn) {
          status = 'partial';

          if (dbPunchIn) {
            const lateness = await resolveLateness(dbPunchIn);
            isLate = lateness.isLate;
            lateMinutes = lateness.lateMinutes;
            if (isLate) {
              status = 'late';
              lateDays++;
            }
          }
        }

        days.push({
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          status,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          punchIn: punchIn ? new Date(punchIn).toISOString() : null,
          punchOut: punchOut ? new Date(punchOut).toISOString() : null,
          deviceLogs: dayData.device.length,
          dbLogs: dayData.db.length,
          isLate,
          lateMinutes
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
          workingDays,
          present: presentDays,
          absent: workingDays - presentDays,
          late: lateDays,
          totalHours: Math.round(totalHours * 100) / 100,
          averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0
        },
        days,
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

// GET /api/hr/attendance/employee-codes
router.get('/attendance/employee-codes', async (req, res) => {
  try {
    console.log('📋 Fetching all employee codes...');

    const users = await User.find({
      employeeCode: { $ne: null, $ne: '' },
      role: { $ne: 'Client' }
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

// POST /api/hr/attendance/test-connection
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

// GET /api/hr/attendance/device-codes
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
// DASHBOARD STATS (HR)
// Now reads persisted lateness flags from EmployeePunchLog
// ============================================
router.get('/dashboard/stats', async (req, res) => {
  try {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = istNow.toISOString().split('T')[0];

    const [year, month, day] = todayStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const allEmployees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client'] }
    }).select('_id name email employeeCode role');

    const totalEmployees = allEmployees.length;

    const todayPunches = await EmployeePunchLog.find({
      date: { $gte: startDate, $lte: endDate }
    });

    const punchMap = {};
    todayPunches.forEach(p => {
      const empId = p.employeeId.toString();
      if (!punchMap[empId]) {
        punchMap[empId] = p;
      }
    });

    const approvedLeaves = await LeaveApplication.find({
      status: 'approved',
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    const onLeaveIds = new Set();
    approvedLeaves.forEach(leave => {
      onLeaveIds.add(leave.employeeId.toString());
    });

    const presentEmployees = [];
    const absentEmployees = [];
    const lateEmployees = [];
    const onLeaveEmployees = [];
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let onLeaveCount = onLeaveIds.size;

    for (const emp of allEmployees) {
      const empId = emp._id.toString();
      const empData = {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        employeeCode: emp.employeeCode,
        role: emp.role
      };

      if (onLeaveIds.has(empId)) {
        onLeaveEmployees.push(empData);
        continue;
      }

      const punch = punchMap[empId];
      if (punch) {
        presentCount++;

        // ✅ Read persisted lateness (self-heals if missing)
        const lateness = await resolveLateness(punch);

        if (lateness.isLate) {
          lateCount++;
          lateEmployees.push({
            ...empData,
            lateMinutes: lateness.lateMinutes
          });
        } else {
          presentEmployees.push(empData);
        }
      } else {
        absentCount++;
        absentEmployees.push(empData);
      }
    }

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
          : 0,
        presentEmployees,
        absentEmployees,
        lateEmployees,
        onLeaveEmployees
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

router.get('/leave-types', async (req, res) => {
  try {
    const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: leaveTypes });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

router.post('/leave-types', async (req, res) => {
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

router.put('/leave-types/:id', async (req, res) => {
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

router.delete('/leave-types/:id', async (req, res) => {
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

// POST /api/hr/biometric/manual-sync
router.post('/biometric/manual-sync', async (req, res) => {
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
// Reads persisted lateness flags.
// ============================================
router.get('/attendance/employee-timeline/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { months = 3 } = req.query;

    const employee = await User.findById(userId)
      .select('name email role employeeCode');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const getDateString = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getISTDateString(new Date());
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
      const dateStr = getDateString(log.date);
      if (dateStr) punchMap[dateStr] = log;
    });

    const leaveMap = {};
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = getISTDateString(cur);
        if (dateStr && !leaveMap[dateStr]) leaveMap[dateStr] = leave;
        cur.setDate(cur.getDate() + 1);
      }
    });

    const days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = getDateString(cur);
      if (!dateStr) {
        cur.setUTCDate(cur.getUTCDate() + 1);
        continue;
      }

      const dayOfWeek = cur.getUTCDay();
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
          sessions = dbSessions.map(s => ({
            punchInUTC: s.punchIn ? s.punchIn.toISOString() : null,
            punchOutUTC: s.punchOut ? s.punchOut.toISOString() : null
          }));
          const first = dbSessions[0];
          const last = dbSessions[dbSessions.length - 1];
          if (first && first.punchIn) punchInUTC = first.punchIn.toISOString();
          if (last && last.punchOut) punchOutUTC = last.punchOut.toISOString();
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

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

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
        days
      }
    });
  } catch (error) {
    console.error('Error fetching employee attendance timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee attendance timeline' });
  }
});

// ============================================
// GET /api/hr/attendance/employee-report
// Reads persisted lateness flags + returns shift info + holiday flag.
// ============================================
router.get('/attendance/employee-report', async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    const monthNum = parseInt(month) - 1;
    const yearNum = parseInt(year);
    const startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));

    const getISTDateStringLocal = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    };

    const employeeFilter = {
      role: { $nin: ['Admin', 'HR', 'Client'] },
      isActive: true
    };
    if (employeeId && employeeId !== 'all') {
      employeeFilter._id = employeeId;
    }

    const employees = await User.find(employeeFilter)
      .select('_id name email employeeCode role')
      .sort({ name: 1 });

    if (employees.length === 0) {
      return res.json({ success: true, data: [], message: 'No employees found' });
    }

    const employeeIds = employees.map(e => e._id);

    const [punchLogs, leaves, holidays] = await Promise.all([
      EmployeePunchLog.find({
        employeeId: { $in: employeeIds },
        date: { $gte: startDate, $lte: endDate }
      }).sort({ employeeId: 1, date: 1 }),
      LeaveApplication.find({
        employeeId: { $in: employeeIds },
        status: 'approved',
        $or: [
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ]
      }),
      // ✅ NEW: fetch holidays for the month
      Holiday.find({
        date: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    // ✅ NEW: build date -> holiday name map (YYYY-MM-DD -> name)
    const holidayMap = {};
    holidays.forEach(h => {
      const d = new Date(h.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      holidayMap[key] = h.name || 'Holiday';
    });

    const punchMap = {};
    punchLogs.forEach(log => {
      const empId = log.employeeId.toString();
      const dateStr = getISTDateStringLocal(log.date);
      if (!dateStr) return;
      if (!punchMap[empId]) punchMap[empId] = {};
      punchMap[empId][dateStr] = log;
    });

    const leaveMap = {};
    leaves.forEach(leave => {
      const empId = leave.employeeId.toString();
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = getISTDateStringLocal(cur);
        if (dateStr) {
          if (!leaveMap[empId]) leaveMap[empId] = {};
          leaveMap[empId][dateStr] = leave;
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    const reportData = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    for (const employee of employees) {
      const empId = employee._id.toString();
      const empPunchMap = punchMap[empId] || {};
      const empLeaveMap = leaveMap[empId] || {};

      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = getISTDateStringLocal(current);
        if (!dateStr) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }

        const dayOfWeek = current.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayLog = empPunchMap[dateStr] || null;
        const onLeave = empLeaveMap[dateStr] || null;

        // ✅ NEW: holiday lookup for this date
        const holidayName = holidayMap[dateStr] || null;
        const isHoliday = !!holidayName;

        let status = 'absent';
        let punchIn = null;
        let punchOut = null;
        let effectiveHours = 0;
        let grossHours = 0;
        let sessions = [];
        let isLate = false;
        let lateMinutes = 0;
        let shiftStartMinutesUsed = null;

        if (isHoliday && !dayLog && !onLeave) {
          // Holiday with no punch and no leave → mark as holiday.
          // (If the employee actually punched in on a holiday, we fall
          //  through to the punch-based branch below.)
          status = 'holiday';
        } else if (isWeekend) {
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

          // ✅ Read persisted lateness (self-heals if missing)
          if (punchIn) {
            const lateness = await resolveLateness(dayLog);
            isLate = lateness.isLate;
            lateMinutes = lateness.lateMinutes;
            shiftStartMinutesUsed = dayLog.shiftStartMinutesUsed ?? null;

            if (isLate) {
              status = 'late';
            } else if (punchOut) {
              status = 'present';
            } else {
              status = 'partial';
            }
          }
        }

        reportData.push({
          employeeName: employee.name,
          employeeCode: employee.employeeCode || 'N/A',
          employeeEmail: employee.email,
          employeeRole: employee.role,
          employeeId: employee._id,
          date: dateStr,
          day: dayNames[dayOfWeek],
          status:
            status === 'holiday' ? 'Holiday' :
            status === 'weekend' ? 'Weekend' :
            status === 'leave'   ? 'Leave'   :
            status === 'present' ? 'Present' :
            status === 'late'    ? 'Late'    :
            status === 'partial' ? 'Partial' : 'Absent',

          punchInUTC: punchIn ? punchIn.toISOString() : null,
          punchOutUTC: punchOut ? punchOut.toISOString() : null,

          effectiveHours: effectiveHours > 0 ? Number(effectiveHours.toFixed(4)) : 0,
          grossHours: grossHours > 0 ? Number(grossHours.toFixed(4)) : 0,

          sessions: sessions.map(s => ({
            punchInUTC: s.punchIn ? s.punchIn.toISOString() : null,
            punchOutUTC: s.punchOut ? s.punchOut.toISOString() : null
          })),

          isWeekend,
          isLate,
          lateMinutes,
          shiftStartMinutesUsed,

          // ✅ NEW: holiday flags per record
          holiday: isHoliday,
          holidayName: holidayName || null
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

// GET /api/hr/employees - Excludes Clients
router.get('/employees', async (req, res) => {
  try {
    const employees = await User.find({
      role: { $nin: ['Admin', 'HR', 'Client'] },
      isActive: true
    }).select('name email employeeCode role _id')
      .sort({ name: 1 });

    res.json({ success: true, employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

// ============================================
// MSSQL BIOMETRIC ROUTES
// ============================================

router.post('/biometric/mssql/sync', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = toDate || today;

    const result = await mssqlService.syncAttendanceToMongoDB(from, to);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ MSSQL Sync error:', error);
    res.status(500).json({ error: 'Failed to sync from MSSQL', details: error.message });
  }
});

router.get('/biometric/mssql/logs', async (req, res) => {
  try {
    const { fromDate, toDate, employeeCode } = req.query;

    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = toDate || today;

    let logs;
    if (employeeCode) {
      logs = await mssqlService.getEmployeeTodayAttendance(employeeCode);
    } else {
      logs = await mssqlService.getDeviceLogs(from, to);
    }

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('❌ Error fetching MSSQL logs:', error);
    res.status(500).json({ error: 'Failed to fetch MSSQL logs', details: error.message });
  }
});

router.get('/biometric/mssql/employees', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const today = new Date().toISOString().split('T')[0];
    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = toDate || today;

    const codes = await mssqlService.getEmployeeCodes(from, to);

    res.json({ success: true, data: codes });
  } catch (error) {
    console.error('❌ Error fetching employee codes:', error);
    res.status(500).json({ error: 'Failed to fetch employee codes', details: error.message });
  }
});

router.get('/biometric/mssql/test', async (req, res) => {
  try {
    const result = await mssqlService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('❌ MSSQL test error:', error);
    res.status(500).json({ error: 'MSSQL connection test failed', details: error.message });
  }
});

// ============================================
// PROBATION MANAGEMENT (HR/Admin)
// ============================================

router.get('/employees/probation', authorize('HR', 'Admin'), async (req, res) => {
  try {
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client'] }
    }).select('name email employeeCode role dateOfJoining isProbationary probationEndDate');

    const employeesWithStatus = employees.map(emp => {
      const probationStatus = emp.getProbationStatus ? emp.getProbationStatus() : { isProbationary: false };
      return {
        ...emp.toObject(),
        probationStatus
      };
    });

    res.json({ success: true, data: employeesWithStatus });
  } catch (error) {
    console.error('Error fetching probation employees:', error);
    res.status(500).json({ error: 'Failed to fetch probation employees' });
  }
});

router.patch('/employees/:id/probation', authorize('HR', 'Admin'), async (req, res) => {
  try {
    const { isProbationary, probationEndDate } = req.body;
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (['Admin', 'HR', 'Client'].includes(employee.role)) {
      return res.status(400).json({ error: 'This user type cannot be put on probation' });
    }

    if (isProbationary !== undefined) {
      employee.isProbationary = isProbationary;
    }

    if (probationEndDate) {
      employee.probationEndDate = new Date(probationEndDate);
    } else if (isProbationary) {
      if (employee.dateOfJoining) {
        const endDate = new Date(employee.dateOfJoining);
        endDate.setMonth(endDate.getMonth() + 3);
        employee.probationEndDate = endDate;
      }
    }

    await employee.save();

    await employee.addNotification({
      type: 'system',
      message: `Your probation status has been updated. ${employee.isProbationary ? 'You are on probation until ' + new Date(employee.probationEndDate).toLocaleDateString() : 'You have completed your probation period.'}`
    });

    res.json({
      success: true,
      data: {
        isProbationary: employee.isProbationary,
        probationEndDate: employee.probationEndDate,
        probationStatus: employee.getProbationStatus ? employee.getProbationStatus() : { isProbationary: false }
      }
    });
  } catch (error) {
    console.error('Error updating probation status:', error);
    res.status(500).json({ error: 'Failed to update probation status' });
  }
});

router.post('/employees/:id/complete-probation', authorize('HR', 'Admin'), async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!employee.isProbationary) {
      return res.status(400).json({ error: 'Employee is not on probation' });
    }

    employee.isProbationary = false;
    await employee.save();

    await employee.addNotification({
      type: 'system',
      message: 'Congratulations! You have successfully completed your probation period.'
    });

    res.json({
      success: true,
      message: 'Probation completed successfully',
      data: {
        isProbationary: false,
        probationEndDate: null
      }
    });
  } catch (error) {
    console.error('Error completing probation:', error);
    res.status(500).json({ error: 'Failed to complete probation' });
  }
});

module.exports = router;