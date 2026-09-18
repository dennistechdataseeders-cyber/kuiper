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
  });

  // Add currently running session
  if (isRunning && startedAt) {
    const start = new Date(startedAt).getTime();
    // only add if not already captured as an open block
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
  // PM can view a developer if that developer is assigned to any feed in a project managed by this PM
  const pmProjects = await Project.find({ projectManager: pmUserId }).select('_id');
  const projectIds = pmProjects.map(p => p._id);

  const feedCount = await Feed.countDocuments({
    projectId: { $in: projectIds },
    assignedDevelopers: developerId
  });

  return feedCount > 0;
}

// ============================================
// GET /api/work-report/developers
// List of developers a PM can report on
// ============================================
router.get(
  '/developers',
  protect,
  authorize('Super Admin', 'Admin', 'Project Manager'),
  async (req, res) => {
    try {
      let developerIds = null;

      // PMs only see devs on their projects; Admin/Super Admin see all
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
//   developerId (required)
//   startDate   (YYYY-MM-DD, optional)
//   endDate     (YYYY-MM-DD, optional)
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

      // Access control for PMs
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
      const ticketLogs = await TicketWorkLog.find({
        developerId,
        ...dateFilter
      })
        .populate({
          path: 'ticketId',
          select: 'ticketNumber title status priority projectId',
          populate: { path: 'projectId', select: 'name projectCustomId' }
        })
        .sort({ date: -1 });

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
          isRunning: !!log.isRunning
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
          isRunning: !!log.isRunning
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

      res.json({
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
      });
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