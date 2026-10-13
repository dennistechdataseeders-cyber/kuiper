// backend/routes/workReportRoutes.js - UPDATED
// ✅ Aligns timing with the Worklog page:
//    - Respects `stoppedBySystem` (auto-stop at 23:55 IST = 0 seconds)
//    - Respects explicit `duration` on closed blocks
//    - Only counts an "open" block up to `now` if it belongs to TODAY and
//      the timer is genuinely still running (not abandoned)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const WorkLog = require('../models/WorkLog');
const Ticket = require('../models/Ticket');
const TicketWorkLog = require('../models/TicketWorkLog');
const WorkDescription = require('../models/WorkDescription');

const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// ============================================
// HELPER: Calculate NET time from time blocks
//
// Rules (matched to the Worklog frontend):
//   1. Closed block (startTime + endTime) → use its timestamps.
//   2. Open block on a log where `stoppedBySystem === true`
//      → treat as closed; use stored `duration` (usually 0).
//   3. Open block on a log where `isRunning === true` AND
//      the log is for TODAY → count up to `now`.
//   4. Open block on a log where `isRunning === false` AND
//      no endTime AND not system-stopped → ABANDONED. Counts as 0.
// ============================================
function calculateNetSeconds(timeBlocks, isRunning, startedAt, logDate, stoppedBySystem) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // ---- Fallback: no time blocks ----
  if (!timeBlocks || timeBlocks.length === 0) {
    if (isRunning && startedAt && logDate === todayStr && !stoppedBySystem) {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      return Math.max(0, elapsed);
    }
    return 0;
  }

  const intervals = [];
  const now = Date.now();

  timeBlocks.forEach(block => {
    if (!block || !block.startTime) return;

    const start = new Date(block.startTime).getTime();
    if (!Number.isFinite(start)) return;

    // ---------- CLOSED BLOCK ----------
    if (block.endTime) {
      const end = new Date(block.endTime).getTime();
      if (Number.isFinite(end) && end > start) {
        intervals.push({ start, end });
      }
      return;
    }

    // ---------- OPEN BLOCK ----------
    // If the log was auto-stopped by the system, this open block's
    // duration is 0 by design. Do NOT count it as "still running".
    if (stoppedBySystem) {
      return; // contributes 0
    }

    // If the log is running AND it's a log for today → count up to now
    if (isRunning && logDate === todayStr) {
      intervals.push({ start, end: now });
      return;
    }

    // Otherwise: abandoned block (open, not running, not today).
    // Contributes 0 — this is what fixes the "3-month runaway timer" bug.
  });

  if (intervals.length === 0) return 0;

  // Merge overlapping intervals so we don't double-count
  intervals.sort((a, b) => a.start - b.start);
  const merged = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }

  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000);
}

function formatSeconds(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function toHours(seconds) {
  return Number(((seconds || 0) / 3600).toFixed(2));
}

// ============================================
// HELPER: Filter logs by date range (inclusive)
// ============================================
function buildDateFilter(startDate, endDate) {
  const filter = {};
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }
  return filter;
}

// ============================================
// HELPER: check PM scope for a developer
// ============================================
async function pmCanViewDeveloper(pmUserId, developerId) {
  const pmProjects = await Project.find({ projectManager: pmUserId }).select('_id');
  const projectIds = pmProjects.map(p => p._id);

  const feedCount = await Feed.countDocuments({
    projectId: { $in: projectIds },
    assignedDevelopers: developerId
  });

  return feedCount > 0;
}

// ============================================
// CORE: Build a single developer's report
// ============================================
async function buildDeveloperReport(developer, startDate, endDate) {
  const developerId = developer._id;
  const dateFilter = buildDateFilter(startDate, endDate);

  // ============================================
  // FETCH FEED WORKLOGS
  // ============================================
  const feedLogs = await WorkLog.find({
    developerId,
    ...dateFilter
  })
    .populate({
      path: 'feedId',
      select: 'name projectId',
      populate: { path: 'projectId', select: 'name projectCustomId' }
    })
    .sort({ date: -1 });

  // ============================================
  // FETCH TICKET WORKLOGS
  // ============================================
  const allTicketLogs = await TicketWorkLog.find({
    developerId,
    ...dateFilter
  })
    .populate({
      path: 'ticketId',
      select: 'ticketNumber title status priority projectId assignedTo',
      populate: { path: 'projectId', select: 'name projectCustomId' }
    })
    .sort({ date: -1 });

  // Only keep ticket logs where the developer is the ASSIGNEE
  const ticketLogs = allTicketLogs.filter((log) => {
    const assigned = log.ticketId?.assignedTo;
    if (!assigned) return false;
    const assignedId =
      typeof assigned === 'object'
        ? (assigned._id || assigned).toString()
        : assigned.toString();
    return assignedId === developerId.toString();
  });

  // ============================================
  // FETCH DESCRIPTIONS
  // ============================================
  const descriptions = await WorkDescription.find({
    developer: developerId,
    ...dateFilter
  }).select('feed date description');

  const descriptionsByFeedDate = {};
  descriptions.forEach(d => {
    const key = `${d.feed}_${d.date}`;
    descriptionsByFeedDate[key] = d.description;
  });

  // ============================================
  // AGGREGATE: PER FEED
  // ============================================
  const feedMap = new Map();

  feedLogs.forEach(log => {
    if (!log.feedId) return;

    const feedKey = log.feedId._id.toString();

    // ✅ NEW: pass stoppedBySystem + logDate
    const netSeconds = calculateNetSeconds(
      log.timeBlocks,
      log.isRunning,
      log.startedAt,
      log.date,
      log.stoppedBySystem
    );

    if (netSeconds <= 0) return;

    if (!feedMap.has(feedKey)) {
      feedMap.set(feedKey, {
        feedId: feedKey,
        feedName: log.feedId.name || 'Unknown Feed',
        projectId: log.feedId.projectId?._id,
        projectName: log.feedId.projectId?.name || 'N/A',
        projectCustomId: log.feedId.projectId?.projectCustomId || 'N/A',
        totalSeconds: 0,
        daysWorked: new Set(),
        entries: []
      });
    }

    const entry = feedMap.get(feedKey);
    entry.totalSeconds += netSeconds;
    if (log.date) entry.daysWorked.add(log.date);

    entry.entries.push({
      date: log.date,
      seconds: netSeconds,
      formatted: formatSeconds(netSeconds),
      hours: toHours(netSeconds),
      description:
        descriptionsByFeedDate[`${feedKey}_${log.date}`] || '',
      isRunning: !!log.isRunning,
      stoppedBySystem: !!log.stoppedBySystem
    });
  });

  const perFeed = [...feedMap.values()]
    .map(f => ({
      ...f,
      daysWorked: f.daysWorked.size,
      totalFormatted: formatSeconds(f.totalSeconds),
      totalHours: toHours(f.totalSeconds),
      entries: f.entries.sort((a, b) => (a.date < b.date ? 1 : -1))
    }))
    .filter(f => f.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  // ============================================
  // AGGREGATE: PER TICKET
  // ============================================
  const ticketMap = new Map();

  ticketLogs.forEach(log => {
    if (!log.ticketId) return;

    const ticketKey = log.ticketId._id.toString();

    // ✅ NEW: pass stoppedBySystem + logDate
    const netSeconds = calculateNetSeconds(
      log.timeBlocks,
      log.isRunning,
      log.startedAt,
      log.date,
      log.stoppedBySystem
    );

    if (netSeconds <= 0) return;

    if (!ticketMap.has(ticketKey)) {
      ticketMap.set(ticketKey, {
        ticketId: ticketKey,
        ticketNumber: log.ticketId.ticketNumber || 'N/A',
        ticketTitle: log.ticketId.title || 'Unknown Ticket',
        status: log.ticketId.status || '',
        priority: log.ticketId.priority || '',
        projectId: log.ticketId.projectId?._id,
        projectName: log.ticketId.projectId?.name || 'N/A',
        projectCustomId: log.ticketId.projectId?.projectCustomId || 'N/A',
        totalSeconds: 0,
        daysWorked: new Set(),
        entries: []
      });
    }

    const entry = ticketMap.get(ticketKey);
    entry.totalSeconds += netSeconds;
    if (log.date) entry.daysWorked.add(log.date);

    entry.entries.push({
      date: log.date,
      seconds: netSeconds,
      formatted: formatSeconds(netSeconds),
      hours: toHours(netSeconds),
      description: log.description || '',
      isRunning: !!log.isRunning,
      stoppedBySystem: !!log.stoppedBySystem
    });
  });

  const perTicket = [...ticketMap.values()]
    .map(t => ({
      ...t,
      daysWorked: t.daysWorked.size,
      totalFormatted: formatSeconds(t.totalSeconds),
      totalHours: toHours(t.totalSeconds),
      entries: t.entries.sort((a, b) => (a.date < b.date ? 1 : -1))
    }))
    .filter(t => t.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  // ============================================
  // SUMMARY TOTALS
  // ============================================
  const totalFeedSeconds = perFeed.reduce((s, f) => s + f.totalSeconds, 0);
  const totalTicketSeconds = perTicket.reduce((s, t) => s + t.totalSeconds, 0);
  const totalSeconds = totalFeedSeconds + totalTicketSeconds;

  const allDates = new Set();
  feedLogs.forEach(l => l.date && allDates.add(l.date));
  ticketLogs.forEach(l => l.date && allDates.add(l.date));

  return {
    success: true,
    developer: {
      _id: developer._id,
      name: developer.name,
      email: developer.email,
      employeeCode: developer.employeeCode
    },
    range: {
      startDate: startDate || null,
      endDate: endDate || null
    },
    summary: {
      totalSeconds,
      totalFormatted: formatSeconds(totalSeconds),
      totalHours: toHours(totalSeconds),

      totalFeedSeconds,
      totalFeedFormatted: formatSeconds(totalFeedSeconds),
      totalFeedHours: toHours(totalFeedSeconds),

      totalTicketSeconds,
      totalTicketFormatted: formatSeconds(totalTicketSeconds),
      totalTicketHours: toHours(totalTicketSeconds),

      feedsWorkedOn: perFeed.length,
      ticketsWorkedOn: perTicket.length,
      activeDays: allDates.size
    },
    perFeed,
    perTicket
  };
}

// ============================================
// GET /api/work-report/developers
// ============================================
router.get(
  '/developers',
  protect,
  authorize('Super Admin', 'Admin', 'Project Manager'),
  async (req, res) => {
    try {
      let developerIds = null;

      if (req.user.role === 'Project Manager') {
        const pmProjects = await Project.find({ projectManager: req.user._id }).select('_id');
        const projectIds = pmProjects.map(p => p._id);

        const feeds = await Feed.find({ projectId: { $in: projectIds } })
          .select('assignedDevelopers');
        const idSet = new Set();
        feeds.forEach(f => {
          (f.assignedDevelopers || []).forEach(id => idSet.add(id.toString()));
        });
        developerIds = [...idSet];
      }

      const query = { role: 'Developer', isActive: true };
      if (developerIds) {
        query._id = { $in: developerIds };
      }

      const developers = await User.find(query)
        .select('_id name email employeeCode')
        .sort({ name: 1 });

      res.json({ success: true, developers });
    } catch (err) {
      console.error('Error fetching developers for report:', err);
      res.status(500).json({ error: 'Failed to fetch developers' });
    }
  }
);

// ============================================
// GET /api/work-report
// Query params:
//   developerId - required. Single dev id OR 'all'
//   startDate   - YYYY-MM-DD (optional)
//   endDate     - YYYY-MM-DD (optional)
// ============================================
router.get(
  '/',
  protect,
  authorize('Super Admin', 'Admin', 'Project Manager'),
  async (req, res) => {
    try {
      const { developerId, startDate, endDate } = req.query;

      if (!developerId) {
        return res.status(400).json({ error: 'developerId is required' });
      }

      // ============================================
      // MODE: ALL DEVELOPERS
      // ============================================
      if (developerId === 'all') {
        let query = { role: 'Developer', isActive: true };

        if (req.user.role === 'Project Manager') {
          const pmProjects = await Project.find({ projectManager: req.user._id }).select('_id');
          const projectIds = pmProjects.map(p => p._id);

          const feeds = await Feed.find({ projectId: { $in: projectIds } })
            .select('assignedDevelopers');
          const idSet = new Set();
          feeds.forEach(f => {
            (f.assignedDevelopers || []).forEach(id => idSet.add(id.toString()));
          });

          query._id = { $in: [...idSet] };
        }

        const developers = await User.find(query)
          .select('_id name email employeeCode role')
          .sort({ name: 1 });

        const reports = await Promise.all(
          developers.map(async (dev) => {
            try {
              const report = await buildDeveloperReport(dev, startDate, endDate);
              if (report.summary.totalSeconds > 0) return report;
              return null;
            } catch (err) {
              console.error(`Failed to build report for ${dev.name}:`, err.message);
              return null;
            }
          })
        );

        const filteredReports = reports.filter(Boolean);

        return res.json({
          success: true,
          mode: 'all',
          range: {
            startDate: startDate || null,
            endDate: endDate || null
          },
          totalDevelopers: developers.length,
          developersWithActivity: filteredReports.length,
          developers: filteredReports
        });
      }

      // ============================================
      // MODE: SINGLE DEVELOPER
      // ============================================
      if (req.user.role === 'Project Manager') {
        const canView = await pmCanViewDeveloper(req.user._id, developerId);
        if (!canView) {
          return res.status(403).json({ error: 'Not authorized to view this developer' });
        }
      }

      const developer = await User.findById(developerId)
        .select('_id name email employeeCode role');

      if (!developer) {
        return res.status(404).json({ error: 'Developer not found' });
      }

      const report = await buildDeveloperReport(developer, startDate, endDate);

      res.json(report);
    } catch (err) {
      console.error('Work report error:', err);
      res.status(500).json({
        error: 'Failed to generate work report',
        details: err.message
      });
    }
  }
);

module.exports = router;