const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

const {
  APP_TZ,
  MAX_SESSION_SECONDS,
  todayKey,
  netSecondsForOneDeveloper,
  activeDayKeys,
  splitIntervalsByDay,
  formatTime,
  toHours,
  avg,
} = require('../utils/workTime');

/* ============================================================
   FILTER PARSING
   ============================================================ */

// developerId can be absent / 'all' / a single id / 'id1,id2,id3'.
function parseDeveloperIds(developerId) {
  if (!developerId || developerId === 'all') return null;
  const ids = String(developerId)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length ? ids : null;
}

function buildLogFilter({ developerIds, startDate, endDate }) {
  const filter = {};

  if (developerIds) {
    filter.developerId =
      developerIds.length === 1 ? developerIds[0] : { $in: developerIds };
  }

  // `date` is a 'YYYY-MM-DD' string, so lexical comparison is chronological.
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
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
    const hasProjectFilter = projectId && projectId !== 'all';

    // Everything in this request is measured against one consistent instant
    // and one consistent "today", so no two numbers on the page disagree.
    const now = new Date();
    const today = todayKey();
    const timeOpts = { now, today, startDate, endDate };

    const baseFilter = buildLogFilter({ developerIds, startDate, endDate });

    const feedFilter = { ...baseFilter };
    if (hasProjectFilter) feedFilter.projectId = projectId; // feed logs always carry projectId
    if (req.query.feedId && req.query.feedId !== 'all') {
      feedFilter.feedId = req.query.feedId;
    }

    // NOTE: deliberately NOT filtering ticket logs on log.projectId — most
    // ticket logs have projectId:null. Ticket project scoping happens below,
    // driven by the Ticket document.
    const ticketFilter = { ...baseFilter };
    if (req.query.ticketId && req.query.ticketId !== 'all') {
      ticketFilter.ticketId = req.query.ticketId;
    }

    const feedListFilter = hasProjectFilter ? { projectId } : {};
    const ticketListFilter = hasProjectFilter ? { projectId } : {};

    const [feedLogs, rawTicketLogs, allFeeds, allTickets, allDevelopers, projects] =
      await Promise.all([
        WorkLog.find(feedFilter)
          .populate('developerId', 'name email')
          .populate('feedId', 'name')
          .populate('projectId', 'name projectCustomId')
          .sort({ date: -1 })
          .lean(),
        TicketWorkLog.find(ticketFilter)
          .populate('developerId', 'name email')
          .populate('ticketId', 'title ticketNumber status priority projectId')
          .sort({ date: -1 })
          .lean(),
        Feed.find(feedListFilter).select('name projectId').lean(),
        Ticket.find(ticketListFilter)
          .select('title ticketNumber status priority projectId')
          .lean(),
        User.find({ role: 'Developer' }).select('name email').sort({ name: 1 }).lean(),
        Project.find().select('name projectCustomId').lean(),
      ]);

    // Apply the project filter to ticket logs via their Ticket, not via the
    // (usually null) projectId on the log itself.
    const allowedTicketIds = new Set(allTickets.map((t) => t._id.toString()));
    const ticketLogs = hasProjectFilter
      ? rawTicketLogs.filter((l) => {
          const tid = l.ticketId?._id?.toString();
          return tid && allowedTicketIds.has(tid);
        })
      : rawTicketLogs;

    const developers = developerIds
      ? allDevelopers.filter((d) => developerIds.includes(d._id.toString()))
      : allDevelopers;

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
    const projectLabel = (idOrDoc) => {
      const id =
        typeof idOrDoc === 'object'
          ? idOrDoc?._id?.toString()
          : idOrDoc?.toString();
      const p = id ? projectMap.get(id) : null;
      return p ? p.projectCustomId || p.name : 'Unassigned';
    };

    // Running totals for the data-quality block.
    let totalRunningTimers = 0;
    const abandonedTimers = [];

    /* ------------------------------------------------------------
       BY DEVELOPER — net feed time, net ticket time, combined,
       plus the averages this page exists to show.
       ------------------------------------------------------------ */

    const devMap = new Map();

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
      // A log by someone who is no longer role:'Developer' still counts, but
      // only when no explicit developer filter is narrowing the view.
      if (!devMap.has(id)) {
        if (developerIds && !developerIds.includes(id)) return null;
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
    let totalActiveDayCount = 0;

    for (const dev of devMap.values()) {
      const feed = netSecondsForOneDeveloper(dev.feedLogs, timeOpts);
      const ticket = netSecondsForOneDeveloper(dev.ticketLogs, timeOpts);
      // Merge feed + ticket together so time double-tracked on both isn't
      // counted twice in the combined figure.
      const combined = netSecondsForOneDeveloper(
        [...dev.feedLogs, ...dev.ticketLogs],
        timeOpts
      );

      totalRunningTimers += combined.runningCount;
      combined.abandoned.forEach((a) =>
        abandonedTimers.push({ ...a, developerName: dev.developerName })
      );

      // Days this developer actually recorded time on, in APP_TZ.
      const activeDays = activeDayKeys(combined.merged).size;
      totalActiveDayCount += activeDays;

      // Day-by-day split: how much of this developer's feed / ticket / combined
      // net time landed on each calendar day (APP_TZ), so the UI can show a
      // per-day breakdown when this developer is selected.
      const feedByDay = splitIntervalsByDay(feed.merged);
      const ticketByDay = splitIntervalsByDay(ticket.merged);
      const combinedByDay = splitIntervalsByDay(combined.merged);
      const dayKeys = new Set([
        ...feedByDay.keys(),
        ...ticketByDay.keys(),
        ...combinedByDay.keys(),
      ]);
      const dailyBreakdown = [...dayKeys].sort().map((date) => {
        const netFeedTime = feedByDay.get(date) || 0;
        const netTicketTime = ticketByDay.get(date) || 0;
        const netCombinedTime = combinedByDay.get(date) || 0;
        return {
          date,
          netFeedTime,
          netFeedTimeFormatted: formatTime(netFeedTime),
          netTicketTime,
          netTicketTimeFormatted: formatTime(netTicketTime),
          netCombinedTime,
          netCombinedTimeFormatted: formatTime(netCombinedTime),
        };
      });

      // Distinct feeds / tickets they touched with real logged time.
      const feedsTouched = new Set(
        dev.feedLogs.map((l) => l.feedId?._id?.toString()).filter(Boolean)
      ).size;
      const ticketsTouched = new Set(
        dev.ticketLogs.map((l) => l.ticketId?._id?.toString()).filter(Boolean)
      ).size;

      const rawFeedTime = dev.feedLogs.reduce((s, l) => s + (l.totalTime || 0), 0);
      const rawTicketTime = dev.ticketLogs.reduce((s, l) => s + (l.totalTime || 0), 0);

      totalNetFeedTime += feed.seconds;
      totalNetTicketTime += ticket.seconds;
      totalNetCombinedTime += combined.seconds;

      // ---- the averages ----
      const avgPerActiveDay = avg(combined.seconds, activeDays);
      const avgPerFeed = avg(feed.seconds, feedsTouched);
      const avgPerTicket = avg(ticket.seconds, ticketsTouched);

      byDeveloper.push({
        developerId: dev.developerId,
        developerName: dev.developerName,
        email: dev.email,

        netFeedTime: feed.seconds,
        netFeedTimeFormatted: formatTime(feed.seconds),
        netFeedHours: toHours(feed.seconds),

        netTicketTime: ticket.seconds,
        netTicketTimeFormatted: formatTime(ticket.seconds),
        netTicketHours: toHours(ticket.seconds),

        netCombinedTime: combined.seconds,
        netCombinedTimeFormatted: formatTime(combined.seconds),
        netCombinedHours: toHours(combined.seconds),

        activeDays,
        feedsTouched,
        ticketsTouched,
        dailyBreakdown,

        avgSecondsPerActiveDay: avgPerActiveDay,
        avgHoursPerActiveDay: toHours(avgPerActiveDay),
        avgPerActiveDayFormatted: formatTime(avgPerActiveDay),

        avgSecondsPerFeed: avgPerFeed,
        avgHoursPerFeed: toHours(avgPerFeed),
        avgPerFeedFormatted: formatTime(avgPerFeed),

        avgSecondsPerTicket: avgPerTicket,
        avgHoursPerTicket: toHours(avgPerTicket),
        avgPerTicketFormatted: formatTime(avgPerTicket),

        rawFeedTime,
        rawTicketTime,
        overlapTime: Math.max(0, rawFeedTime + rawTicketTime - combined.seconds),

        feedLogCount: dev.feedLogs.length,
        ticketLogCount: dev.ticketLogs.length,
        runningTimers: combined.runningCount,
        abandonedTimers: combined.abandoned.length,
      });
    }

    byDeveloper.sort((a, b) => b.netCombinedTime - a.netCombinedTime);

    /* ------------------------------------------------------------
       BY FEED
       ------------------------------------------------------------ */

    const feedGroups = new Map();

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
      const devId = log.developerId?._id?.toString();
      if (!feedId || !devId || !feedGroups.has(feedId)) return;

      const group = feedGroups.get(feedId);
      if (!group.logsByDev.has(devId)) {
        group.logsByDev.set(devId, {
          developerId: devId,
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
        });
      }
      group.logsByDev.get(devId).logs.push(log);
      if (log.date > group.lastDate) group.lastDate = log.date;
    });

    const byFeed = [...feedGroups.values()].map((group) => {
      const devBreakdown = [...group.logsByDev.values()].map((d) => {
        const r = netSecondsForOneDeveloper(d.logs, timeOpts);
        return {
          developerId: d.developerId,
          developerName: d.developerName,
          netTime: r.seconds,
          netTimeFormatted: formatTime(r.seconds),
          netHours: toHours(r.seconds),
          rawTime: d.logs.reduce((s, l) => s + (l.totalTime || 0), 0),
          logCount: d.logs.length,
        };
      });

      const netTime = devBreakdown.reduce((s, d) => s + d.netTime, 0);
      const rawTime = devBreakdown.reduce((s, d) => s + d.rawTime, 0);
      const logCount = devBreakdown.reduce((s, d) => s + d.logCount, 0);
      const devCount = devBreakdown.filter((d) => d.netTime > 0).length;
      const avgPerDev = avg(netTime, devCount);

      return {
        feedId: group.feedId,
        feedName: group.feedName,
        projectId: group.projectId,
        projectName: group.projectName,
        developers: devBreakdown.sort((a, b) => b.netTime - a.netTime),
        developerNames: devBreakdown.map((d) => d.developerName).join(', '),
        developerCount: devCount,
        netTime,
        netTimeFormatted: formatTime(netTime),
        netHours: toHours(netTime),
        avgSecondsPerDeveloper: avgPerDev,
        avgHoursPerDeveloper: toHours(avgPerDev),
        avgPerDeveloperFormatted: formatTime(avgPerDev),
        rawTime,
        rawTimeFormatted: formatTime(rawTime),
        overlapTime: Math.max(0, rawTime - netTime),
        logCount,
        lastDate: group.lastDate || null,
      };
    });
    byFeed.sort((a, b) => b.netTime - a.netTime);

    /* ------------------------------------------------------------
       BY TICKET
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
      const devId = log.developerId?._id?.toString();
      if (!ticketId || !devId || !ticketGroups.has(ticketId)) return;

      const group = ticketGroups.get(ticketId);
      if (!group.logsByDev.has(devId)) {
        group.logsByDev.set(devId, {
          developerId: devId,
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
        });
      }
      group.logsByDev.get(devId).logs.push(log);
      if (log.date > group.lastDate) group.lastDate = log.date;
    });

    const byTicket = [...ticketGroups.values()].map((group) => {
      const devBreakdown = [...group.logsByDev.values()].map((d) => {
        const r = netSecondsForOneDeveloper(d.logs, timeOpts);
        return {
          developerId: d.developerId,
          developerName: d.developerName,
          netTime: r.seconds,
          netTimeFormatted: formatTime(r.seconds),
          netHours: toHours(r.seconds),
          rawTime: d.logs.reduce((s, l) => s + (l.totalTime || 0), 0),
          logCount: d.logs.length,
        };
      });

      const netTime = devBreakdown.reduce((s, d) => s + d.netTime, 0);
      const rawTime = devBreakdown.reduce((s, d) => s + d.rawTime, 0);
      const logCount = devBreakdown.reduce((s, d) => s + d.logCount, 0);
      const devCount = devBreakdown.filter((d) => d.netTime > 0).length;
      const avgPerDev = avg(netTime, devCount);

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
        developerCount: devCount,
        netTime,
        netTimeFormatted: formatTime(netTime),
        netHours: toHours(netTime),
        avgSecondsPerDeveloper: avgPerDev,
        avgHoursPerDeveloper: toHours(avgPerDev),
        avgPerDeveloperFormatted: formatTime(avgPerDev),
        rawTime,
        rawTimeFormatted: formatTime(rawTime),
        overlapTime: Math.max(0, rawTime - netTime),
        logCount,
        lastDate: group.lastDate || null,
      };
    });
    byTicket.sort((a, b) => b.netTime - a.netTime);

    /* ------------------------------------------------------------
       SUMMARY + AVERAGES
       ------------------------------------------------------------ */

    const totalRawFeedTime = feedLogs.reduce((s, l) => s + (l.totalTime || 0), 0);
    const totalRawTicketTime = ticketLogs.reduce((s, l) => s + (l.totalTime || 0), 0);

    // Only developers who actually logged something count toward the average,
    // otherwise every idle account drags the mean to zero. Both variants are
    // returned so the UI can show whichever the PM prefers.
    const activeDevelopers = byDeveloper.filter((d) => d.netCombinedTime > 0).length;
    const feedsWithTime = byFeed.filter((f) => f.netTime > 0).length;
    const ticketsWithTime = byTicket.filter((t) => t.netTime > 0).length;

    const avgPerActiveDeveloper = avg(totalNetCombinedTime, activeDevelopers);
    const avgPerAnyDeveloper = avg(totalNetCombinedTime, devMap.size);
    const avgFeedPerActiveDeveloper = avg(totalNetFeedTime, activeDevelopers);
    const avgTicketPerActiveDeveloper = avg(totalNetTicketTime, activeDevelopers);
    const avgPerActiveDay = avg(totalNetCombinedTime, totalActiveDayCount);
    const avgPerFeed = avg(totalNetFeedTime, feedsWithTime);
    const avgPerTicket = avg(totalNetTicketTime, ticketsWithTime);

    const summary = {
      totalDevelopers: devMap.size,
      activeDevelopers,
      totalFeeds: allFeeds.length,
      totalFeedsWithTime: feedsWithTime,
      totalTickets: allTickets.length,
      totalTicketsWithTime: ticketsWithTime,
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

      // ---------- AVERAGES ----------
      avgHoursPerDeveloper: toHours(avgPerActiveDeveloper),
      avgPerDeveloperFormatted: formatTime(avgPerActiveDeveloper),
      avgHoursPerDeveloperIncludingIdle: toHours(avgPerAnyDeveloper),

      avgFeedHoursPerDeveloper: toHours(avgFeedPerActiveDeveloper),
      avgFeedPerDeveloperFormatted: formatTime(avgFeedPerActiveDeveloper),

      avgTicketHoursPerDeveloper: toHours(avgTicketPerActiveDeveloper),
      avgTicketPerDeveloperFormatted: formatTime(avgTicketPerActiveDeveloper),

      totalActiveDayCount,
      avgHoursPerActiveDay: toHours(avgPerActiveDay),
      avgPerActiveDayFormatted: formatTime(avgPerActiveDay),

      avgHoursPerFeed: toHours(avgPerFeed),
      avgPerFeedFormatted: formatTime(avgPerFeed),

      avgHoursPerTicket: toHours(avgPerTicket),
      avgPerTicketFormatted: formatTime(avgPerTicket),

      totalRawFeedTime,
      totalRawTicketTime,
      totalOverlapTime: Math.max(
        0,
        totalRawFeedTime + totalRawTicketTime - totalNetCombinedTime
      ),

      // ---------- DATA QUALITY ----------
      // Surfaces the problem instead of silently inflating the totals with it.
      dataQuality: {
        timezone: APP_TZ,
        today,
        maxSessionHours: MAX_SESSION_SECONDS / 3600,
        runningTimers: totalRunningTimers,
        abandonedTimerCount: abandonedTimers.length,
        abandonedTimers: abandonedTimers
          .sort((a, b) => b.openForHours - a.openForHours)
          .slice(0, 25),
        note: abandonedTimers.length
          ? 'Some timers were started and never stopped. They are excluded from all totals because their real end time is unknown. Run scripts/closeStaleTimers.js to clean them up.'
          : null,
      },
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
        timezone: APP_TZ,
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