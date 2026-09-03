// backend/controllers/resourceAnalyticsController.js
//
// Resource Analytics — rebuilt from scratch.
//
// Goals:
//   1. Net time spent on Feeds and Tickets (overlapping timer intervals for
//      the SAME developer are merged so they aren't double counted).
//   2. Filter by one or more developers.
//   3. Filter by date range.
//
// Net time is always computed per-developer first (a single person cannot
// really "work" two overlapping intervals at once, so their timeBlocks are
// merged), and totals are the SUM of each developer's net time. We never
// merge intervals *across* different developers — two different people
// working the same hour on different things is 2 hours of real work, not 1.

const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

/* ============================================================
   TIME HELPERS
   ============================================================ */

// Build a list of {start, end} (ms epoch) intervals from a set of logs
// (WorkLog or TicketWorkLog documents share the same shape).
function getIntervals(logs) {
  const now = Date.now();
  const intervals = [];

  logs.forEach((log) => {
    if (Array.isArray(log.timeBlocks) && log.timeBlocks.length > 0) {
      log.timeBlocks.forEach((block) => {
        if (!block.startTime) return;
        const start = new Date(block.startTime).getTime();
        const end = block.endTime
          ? new Date(block.endTime).getTime()
          : now; // still running block
        if (end > start) intervals.push({ start, end });
      });
    } else if (log.isRunning && log.startedAt) {
      // No timeBlocks recorded yet, but a timer is currently running
      const start = new Date(log.startedAt).getTime();
      if (now > start) intervals.push({ start, end: now });
    }
  });

  return intervals;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

// Net seconds for a set of logs belonging to ONE developer (safe to merge).
function netSecondsForOneDeveloper(logs) {
  const intervals = getIntervals(logs);

  if (intervals.length === 0) {
    // No timeBlocks at all recorded — fall back to the raw totalTime sum.
    return logs.reduce((sum, l) => sum + (l.totalTime || 0), 0);
  }

  const merged = mergeIntervals(intervals);
  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000);
}

function formatTime(seconds = 0) {
  seconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function toHours(seconds = 0) {
  return (seconds / 3600).toFixed(2);
}

/* ============================================================
   FILTER PARSING
   ============================================================ */

// developerId query param can be: absent/'all', a single id, or a
// comma-separated list of ids ("id1,id2,id3") for multi-select filtering.
function parseDeveloperIds(developerId) {
  if (!developerId || developerId === 'all') return null;
  return developerId
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function buildBaseFilter({ developerIds, projectId, startDate, endDate }) {
  const filter = {};

  if (developerIds) {
    filter.developerId = developerIds.length === 1 ? developerIds[0] : { $in: developerIds };
  }

  if (projectId && projectId !== 'all') {
    filter.projectId = projectId;
  }

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate; // dates stored as 'YYYY-MM-DD' strings
    if (endDate) filter.date.$lte = endDate;
  }

  return filter;
}

/* ============================================================
   MAIN ENDPOINT
   ============================================================ */

exports.getResourceAnalytics = async (req, res) => {
  try {
    const { developerId, projectId, startDate, endDate } = req.query;

    const developerIds = parseDeveloperIds(developerId);
    const baseFilter = buildBaseFilter({ developerIds, projectId, startDate, endDate });

    // Feed filter also honours an optional feedId narrower filter.
    const feedFilter = { ...baseFilter };
    if (req.query.feedId && req.query.feedId !== 'all') {
      feedFilter.feedId = req.query.feedId;
    }

    // Ticket filter also honours an optional ticketId narrower filter.
    const ticketFilter = { ...baseFilter };
    if (req.query.ticketId && req.query.ticketId !== 'all') {
      ticketFilter.ticketId = req.query.ticketId;
    }

    // The "master list" filters — these decide which Feeds/Tickets/Developers
    // exist in the tables at all. They deliberately ignore date/time filters
    // (a feed doesn't stop existing because nothing was logged this month)
    // but DO respect the project filter, since that scopes "what am I looking at".
    const feedListFilter = {};
    if (projectId && projectId !== 'all') feedListFilter.projectId = projectId;

    const ticketListFilter = {};
    if (projectId && projectId !== 'all') ticketListFilter.projectId = projectId;

    /* ------------------------------------------------------------
       FETCH RAW LOGS + MASTER LISTS (feeds/tickets/developers all exist
       independently of whether anyone has logged time against them)
       ------------------------------------------------------------ */

    const [feedLogs, ticketLogs, allFeeds, allTickets, allDevelopers, projects] = await Promise.all([
      WorkLog.find(feedFilter)
        .populate('developerId', 'name email')
        .populate('feedId', 'name')
        .populate('projectId', 'name projectCustomId')
        .sort({ date: -1 })
        .lean(),
      TicketWorkLog.find(ticketFilter)
        .populate('developerId', 'name email')
        .populate('ticketId', 'title ticketNumber status priority')
        .populate('projectId', 'name projectCustomId')
        .sort({ date: -1 })
        .lean(),
      Feed.find(feedListFilter).select('name projectId').lean(),
      Ticket.find(ticketListFilter).select('title ticketNumber status priority projectId').lean(),
      User.find({ role: 'Developer' }).select('name email').sort({ name: 1 }).lean(),
      Project.find().select('name projectCustomId').lean(),
    ]);

    // Narrow the master developer list down when a developer filter is applied,
    // so filtering by a developer doesn't bring back everyone else at 0s.
    const developers = developerIds
      ? allDevelopers.filter((d) => developerIds.includes(d._id.toString()))
      : allDevelopers;

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
    const projectLabel = (idOrDoc) => {
      const id = typeof idOrDoc === 'object' ? idOrDoc?._id?.toString() : idOrDoc?.toString();
      const p = id ? projectMap.get(id) : null;
      return p ? p.projectCustomId || p.name : 'Unknown';
    };

    /* ------------------------------------------------------------
       GROUP BY DEVELOPER (net time on feeds, tickets, and combined)
       Seeded from every Developer-role user, not just ones with logs,
       so devs with zero logged time still show up (at 0s).
       ------------------------------------------------------------ */

    const devMap = new Map(); // developerId -> { info, feedLogs: [], ticketLogs: [] }

    developers.forEach((d) => {
      devMap.set(d._id.toString(), {
        developerId: d._id.toString(),
        developerName: d.name || 'Unknown',
        email: d.email || '',
        feedLogs: [],
        ticketLogs: [],
      });
    });

    const ensureDev = (userDoc) => {
      const id = userDoc?._id?.toString();
      if (!id) return null;
      if (!devMap.has(id)) {
        // Log references a user outside the current developer filter/role
        // (e.g. role changed since the log was created) — still track them.
        devMap.set(id, {
          developerId: id,
          developerName: userDoc.name || 'Unknown',
          email: userDoc.email || '',
          feedLogs: [],
          ticketLogs: [],
        });
      }
      return devMap.get(id);
    };

    feedLogs.forEach((log) => {
      const entry = ensureDev(log.developerId);
      if (entry) entry.feedLogs.push(log);
    });

    ticketLogs.forEach((log) => {
      const entry = ensureDev(log.developerId);
      if (entry) entry.ticketLogs.push(log);
    });

    const byDeveloper = [];
    let totalNetFeedTime = 0;
    let totalNetTicketTime = 0;
    let totalNetCombinedTime = 0;

    for (const dev of devMap.values()) {
      const netFeedTime = netSecondsForOneDeveloper(dev.feedLogs);
      const netTicketTime = netSecondsForOneDeveloper(dev.ticketLogs);
      // Combined: merge feed + ticket intervals together for this developer
      // so time spent simultaneously on both isn't counted twice.
      const netCombinedTime = netSecondsForOneDeveloper([...dev.feedLogs, ...dev.ticketLogs]);

      const rawFeedTime = dev.feedLogs.reduce((s, l) => s + (l.totalTime || 0), 0);
      const rawTicketTime = dev.ticketLogs.reduce((s, l) => s + (l.totalTime || 0), 0);

      totalNetFeedTime += netFeedTime;
      totalNetTicketTime += netTicketTime;
      totalNetCombinedTime += netCombinedTime;

      byDeveloper.push({
        developerId: dev.developerId,
        developerName: dev.developerName,
        email: dev.email,
        netFeedTime,
        netFeedTimeFormatted: formatTime(netFeedTime),
        netTicketTime,
        netTicketTimeFormatted: formatTime(netTicketTime),
        netCombinedTime,
        netCombinedTimeFormatted: formatTime(netCombinedTime),
        rawFeedTime,
        rawTicketTime,
        overlapTime: Math.max(0, rawFeedTime + rawTicketTime - netCombinedTime),
        feedLogCount: dev.feedLogs.length,
        ticketLogCount: dev.ticketLogs.length,
      });
    }

    byDeveloper.sort((a, b) => b.netCombinedTime - a.netCombinedTime);

    /* ------------------------------------------------------------
       GROUP BY FEED — one row per Feed (seeded from ALL feeds, even
       ones with zero logged time), with a per-developer breakdown
       so multiple developers on one feed are still overlap-safe.
       ------------------------------------------------------------ */

    const feedGroups = new Map(); // feedId -> { feed info, logsByDev: Map<devId, logs[]> }

    allFeeds.forEach((feed) => {
      const feedId = feed._id.toString();
      feedGroups.set(feedId, {
        feedId,
        feedName: feed.name || 'Unknown',
        projectId: feed.projectId ? feed.projectId.toString() : null,
        projectName: projectLabel(feed.projectId),
        logsByDev: new Map(),
        lastDate: '',
      });
    });

    feedLogs.forEach((log) => {
      const feedId = log.feedId?._id?.toString();
      const developerId = log.developerId?._id?.toString();
      if (!feedId || !developerId) return;

      // Log references a feed outside the current project filter (shouldn't
      // normally happen) — skip rather than fabricate a group for it.
      if (!feedGroups.has(feedId)) return;

      const group = feedGroups.get(feedId);
      if (!group.logsByDev.has(developerId)) {
        group.logsByDev.set(developerId, {
          developerId,
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
        });
      }
      group.logsByDev.get(developerId).logs.push(log);
      if (log.date > group.lastDate) group.lastDate = log.date;
    });

    const byFeed = [...feedGroups.values()].map((group) => {
      const devBreakdown = [...group.logsByDev.values()].map((d) => {
        const netTime = netSecondsForOneDeveloper(d.logs);
        return {
          developerId: d.developerId,
          developerName: d.developerName,
          netTime,
          netTimeFormatted: formatTime(netTime),
          rawTime: d.logs.reduce((s, l) => s + (l.totalTime || 0), 0),
          logCount: d.logs.length,
        };
      });

      const netTime = devBreakdown.reduce((s, d) => s + d.netTime, 0);
      const rawTime = devBreakdown.reduce((s, d) => s + d.rawTime, 0);
      const logCount = devBreakdown.reduce((s, d) => s + d.logCount, 0);

      return {
        feedId: group.feedId,
        feedName: group.feedName,
        projectId: group.projectId,
        projectName: group.projectName,
        developers: devBreakdown.sort((a, b) => b.netTime - a.netTime),
        developerNames: devBreakdown.map((d) => d.developerName).join(', '),
        netTime,
        netTimeFormatted: formatTime(netTime),
        rawTime,
        rawTimeFormatted: formatTime(rawTime),
        overlapTime: Math.max(0, rawTime - netTime),
        logCount,
        lastDate: group.lastDate || null,
      };
    });
    byFeed.sort((a, b) => b.netTime - a.netTime);

    /* ------------------------------------------------------------
       GROUP BY TICKET — one row per Ticket (seeded from ALL tickets,
       even ones with zero logged time), same per-developer breakdown.
       ------------------------------------------------------------ */

    const ticketGroups = new Map();

    allTickets.forEach((ticket) => {
      const ticketId = ticket._id.toString();
      ticketGroups.set(ticketId, {
        ticketId,
        ticketNumber: ticket.ticketNumber || 'N/A',
        ticketTitle: ticket.title || 'Unknown Ticket',
        status: ticket.status || '',
        priority: ticket.priority || '',
        projectId: ticket.projectId ? ticket.projectId.toString() : null,
        projectName: projectLabel(ticket.projectId),
        logsByDev: new Map(),
        lastDate: '',
      });
    });

    ticketLogs.forEach((log) => {
      const ticketId = log.ticketId?._id?.toString();
      const developerId = log.developerId?._id?.toString();
      if (!ticketId || !developerId) return;

      if (!ticketGroups.has(ticketId)) return;

      const group = ticketGroups.get(ticketId);
      if (!group.logsByDev.has(developerId)) {
        group.logsByDev.set(developerId, {
          developerId,
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
        });
      }
      group.logsByDev.get(developerId).logs.push(log);
      if (log.date > group.lastDate) group.lastDate = log.date;
    });

    const byTicket = [...ticketGroups.values()].map((group) => {
      const devBreakdown = [...group.logsByDev.values()].map((d) => {
        const netTime = netSecondsForOneDeveloper(d.logs);
        return {
          developerId: d.developerId,
          developerName: d.developerName,
          netTime,
          netTimeFormatted: formatTime(netTime),
          rawTime: d.logs.reduce((s, l) => s + (l.totalTime || 0), 0),
          logCount: d.logs.length,
        };
      });

      const netTime = devBreakdown.reduce((s, d) => s + d.netTime, 0);
      const rawTime = devBreakdown.reduce((s, d) => s + d.rawTime, 0);
      const logCount = devBreakdown.reduce((s, d) => s + d.logCount, 0);

      return {
        ticketId: group.ticketId,
        ticketNumber: group.ticketNumber,
        ticketTitle: group.ticketTitle,
        status: group.status,
        priority: group.priority,
        projectId: group.projectId,
        projectName: group.projectName,
        developers: devBreakdown.sort((a, b) => b.netTime - a.netTime),
        developerNames: devBreakdown.map((d) => d.developerName).join(', '),
        netTime,
        netTimeFormatted: formatTime(netTime),
        rawTime,
        rawTimeFormatted: formatTime(rawTime),
        overlapTime: Math.max(0, rawTime - netTime),
        logCount,
        lastDate: group.lastDate || null,
      };
    });
    byTicket.sort((a, b) => b.netTime - a.netTime);

    /* ------------------------------------------------------------
       SUMMARY
       ------------------------------------------------------------ */

    const totalRawFeedTime = feedLogs.reduce((s, l) => s + (l.totalTime || 0), 0);
    const totalRawTicketTime = ticketLogs.reduce((s, l) => s + (l.totalTime || 0), 0);

    const summary = {
      totalDevelopers: devMap.size,
      totalFeeds: allFeeds.length,
      totalFeedsWithTime: byFeed.filter((f) => f.netTime > 0).length,
      totalTickets: allTickets.length,
      totalTicketsWithTime: byTicket.filter((t) => t.netTime > 0).length,
      totalFeedLogs: feedLogs.length,
      totalTicketLogs: ticketLogs.length,

      totalNetFeedTime,
      totalNetFeedTimeFormatted: formatTime(totalNetFeedTime),
      totalNetFeedHours: toHours(totalNetFeedTime),

      totalNetTicketTime,
      totalNetTicketTimeFormatted: formatTime(totalNetTicketTime),
      totalNetTicketHours: toHours(totalNetTicketTime),

      totalNetCombinedTime,
      totalNetCombinedTimeFormatted: formatTime(totalNetCombinedTime),
      totalNetCombinedHours: toHours(totalNetCombinedTime),

      totalRawFeedTime,
      totalRawTicketTime,
      totalOverlapTime: Math.max(0, totalRawFeedTime + totalRawTicketTime - totalNetCombinedTime),
    };

    res.json({
      success: true,
      summary,
      byDeveloper,
      byFeed,
      byTicket,
      projects,
      developers: allDevelopers,
      filtersApplied: {
        developerIds: developerIds || 'all',
        projectId: projectId || 'all',
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Resource analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource analytics',
      details: error.message,
    });
  }
};