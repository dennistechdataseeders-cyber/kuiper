// backend/routes/workReportRoutes.js

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
//   - Closed blocks with duration > 0 count toward the total
//   - Closed blocks with duration === 0 (system auto-stop) contribute nothing
//   - Open blocks on a RUNNING timer count live up to now
//   - Open blocks on a STOPPED timer (abandoned) contribute nothing
// ============================================
function calculateNetSeconds(timeBlocks, isRunning, startedAt) {
  if (!timeBlocks || timeBlocks.length === 0) {
    if (isRunning && startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      return Math.max(0, elapsed);
    }
    return 0;
  }

  const intervals = [];
  const now = Date.now();

  timeBlocks.forEach(block => {
    if (block.startTime && block.endTime) {
      // ✅ Respect an explicitly-zeroed duration (system auto-stop).
      //    If the persisted duration is 0, treat the block as contributing 0
      //    even though start/end times exist.
      const persistedDuration = Number(block.duration);
      if (Number.isFinite(persistedDuration) && persistedDuration === 0) {
        return;
      }
      intervals.push({
        start: new Date(block.startTime).getTime(),
        end: new Date(block.endTime).getTime()
      });
    } else if (block.startTime && !block.endTime && isRunning) {
      intervals.push({
        start: new Date(block.startTime).getTime(),
        end: now
      });
    }
    // else: open block on a stopped timer → abandoned → skip
  });

  if (isRunning && startedAt) {
    const start = new Date(startedAt).getTime();
    const alreadyOpen = timeBlocks.some(b => b.startTime && !b.endTime);
    if (!alreadyOpen) {
      intervals.push({ start, end: now });
    }
  }

  if (intervals.length === 0) return 0;

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
// HELPER: detect if a log has any abandoned (open) block
//   An abandoned block = startTime present, endTime present, duration 0
//   (this is what worklogService.stopAllRunningTimers writes)
// ============================================
function hasAbandonedBlock(log) {
  if (!log || !Array.isArray(log.timeBlocks)) return false;

  return log.timeBlocks.some(block => {
    if (!block || !block.startTime) return false;
    // Block that was force-closed at duration 0
    if (block.endTime && Number(block.duration) === 0) return true;
    // Block still open on a stopped timer
    if (!block.endTime && !log.isRunning) return true;
    return false;
  });
}

// ============================================
// HELPER: safely coerce an ObjectId / populated doc / string to a string
// ============================================
function toIdStr(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    const inner = val._id || val;
    return inner ? inner.toString() : null;
  }
  return val.toString();
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
  //
  // ✅ FIXED: We now populate `createdBy` and `watchers` in
  //    addition to `assignedTo`, and the filter below keeps any
  //    log where the developer has a legitimate stake in the
  //    ticket (assignedTo OR createdBy OR watcher).
  //
  //    Previously, only logs where the developer was the
  //    ticket's `assignedTo` were kept — which silently hid
  //    timers that a PM / Team Lead / collaborator had started
  //    on tickets they were not formally assigned to.
  //
  //    The Mongo query above already guarantees
  //    log.developerId === developerId, so we can never leak
  //    another developer's timer into this report.
  // ============================================
  const allTicketLogs = await TicketWorkLog.find({
    developerId,
    ...dateFilter
  })
    .populate({
      path: 'ticketId',
      select:
        'ticketNumber title status priority projectId assignedTo createdBy watchers',
      populate: { path: 'projectId', select: 'name projectCustomId' }
    })
    .sort({ date: -1 });

  const devIdStr = developerId.toString();

  const ticketLogs = allTicketLogs.filter((log) => {
    const ticket = log.ticketId;

    // Ticket must still exist (not deleted / orphaned)
    if (!ticket) return false;

    const assignedTo = toIdStr(ticket.assignedTo);
    const createdBy = toIdStr(ticket.createdBy);

    const watchers = Array.isArray(ticket.watchers)
      ? ticket.watchers.map(toIdStr).filter(Boolean)
      : [];

    return (
      assignedTo === devIdStr ||
      createdBy === devIdStr ||
      watchers.includes(devIdStr)
    );
  });

  // ============================================
  // FETCH DESCRIPTIONS (for the same range)
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
  //   ✅ Zero-time feeds are KEPT if they have an abandoned block,
  //      otherwise they are dropped.
  // ============================================
  const feedMap = new Map();

  feedLogs.forEach(log => {
    if (!log.feedId) return;

    const feedKey = log.feedId._id.toString();
    const netSeconds = calculateNetSeconds(
      log.timeBlocks,
      log.isRunning,
      log.startedAt
    );

    const abandoned = hasAbandonedBlock(log);

    // ✅ Skip only if there's no net time AND no abandoned block.
    //    This is what keeps "0s · auto-stopped" rows visible.
    if (netSeconds <= 0 && !abandoned) return;

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
      stoppedBySystem: !!log.stoppedBySystem,
      abandoned: abandoned
    });
  });

  const perFeed = [...feedMap.values()]
    .map(f => ({
      ...f,
      daysWorked: f.daysWorked.size,
      totalFormatted: formatSeconds(f.totalSeconds),
      totalHours: toHours(f.totalSeconds),
      entries: f.entries.sort((a, b) => (a.date < b.date ? 1 : -1)),
      hasAbandoned: f.entries.some(e => e.abandoned),
      allZero: f.totalSeconds === 0
    }))
    // ✅ Keep entries that either logged real time OR contain an abandoned block
    .filter(f => f.totalSeconds > 0 || f.hasAbandoned)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  // ============================================
  // AGGREGATE: PER TICKET
  // ============================================
  const ticketMap = new Map();

  ticketLogs.forEach(log => {
    if (!log.ticketId) return;

    const ticketKey = log.ticketId._id.toString();
    const netSeconds = calculateNetSeconds(
      log.timeBlocks,
      log.isRunning,
      log.startedAt
    );

    const abandoned = hasAbandonedBlock(log);

    // ✅ Same rule as feeds
    if (netSeconds <= 0 && !abandoned) return;

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
      stoppedBySystem: !!log.stoppedBySystem,
      abandoned: abandoned
    });
  });

  const perTicket = [...ticketMap.values()]
    .map(t => ({
      ...t,
      daysWorked: t.daysWorked.size,
      totalFormatted: formatSeconds(t.totalSeconds),
      totalHours: toHours(t.totalSeconds),
      entries: t.entries.sort((a, b) => (a.date < b.date ? 1 : -1)),
      hasAbandoned: t.entries.some(e => e.abandoned),
      allZero: t.totalSeconds === 0
    }))
    .filter(t => t.totalSeconds > 0 || t.hasAbandoned)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  // ============================================
  // SUMMARY TOTALS
  // ============================================
  const totalFeedSeconds = perFeed.reduce((s, f) => s + f.totalSeconds, 0);
  const totalTicketSeconds = perTicket.reduce((s, t) => s + t.totalSeconds, 0);
  const totalSeconds = totalFeedSeconds + totalTicketSeconds;

  // Unique days worked (union of feed days + ticket days)
  const allDates = new Set();
  feedLogs.forEach(l => l.date && allDates.add(l.date));
  ticketLogs.forEach(l => l.date && allDates.add(l.date));

  // Count of abandoned entries (for the "System Stop" badge on the header)
  const abandonedFeedCount = perFeed.reduce(
    (sum, f) => sum + f.entries.filter(e => e.abandoned).length,
    0
  );
  const abandonedTicketCount = perTicket.reduce(
    (sum, t) => sum + t.entries.filter(e => e.abandoned).length,
    0
  );

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
      activeDays: allDates.size,

      // How many entries were auto-stopped (any where netSeconds > 0 or not)
      abandonedEntries: abandonedFeedCount + abandonedTicketCount
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
              // ✅ Keep devs who have ANY logged work OR any abandoned entry
              if (
                report.summary.totalSeconds > 0 ||
                report.summary.abandonedEntries > 0
              ) {
                return report;
              }
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