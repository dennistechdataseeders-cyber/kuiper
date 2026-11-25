// backend/services/feedProgressService.js
// Live feed progress for the PM and Developer dashboards: the feeds a user should see, each with
// its matching FeedStatus run. Nothing here reads the manual Feed.completionHistory log.

const Feed = require('../models/Feed');
require('../models/Project');
require('../models/User');
const FeedStatus = require('../models/FeedStatus');
const { getServerTimestamp } = require('../utils/serverTime');
const { createStatusMatcher, feedKey, effectiveStatus } = require('../utils/feedStatusMatch');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// FeedStatus.date is written as the server's UTC day, so "today" must be that same day
const serverToday = () => getServerTimestamp().toISOString().split('T')[0];

const isValidDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

// Everything below works on 'YYYY-MM-DD' strings in UTC, so no local timezone can shift a day
const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().split('T')[0];

function getPeriods(date) {
  const d = new Date(date);
  const weekStart = addDays(date, -((d.getUTCDay() + 6) % 7)); // Monday
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const month = date.slice(0, 7);
  return {
    date,
    dayName: DAYS[d.getUTCDay()],
    dayOfMonth: d.getUTCDate(),
    daysInMonth,
    weekStart,
    weekEnd: addDays(weekStart, 6),
    monthStart: `${month}-01`,
    monthEnd: `${month}-${String(daysInMonth).padStart(2, '0')}`,
  };
}

// The Feed model stores 'Add hoc' (typo) while other code uses 'Ad hoc': accept both
function getGroup(feedType) {
  if (feedType === 'Daily') return 'daily';
  if (feedType === 'Weekly') return 'weekly';
  if (feedType === 'Monthly') return 'monthly';
  return 'adhoc'; // Ad hoc / Add hoc / Once off: no schedule
}

// monthDay 31 in a 30-day month (or 29-31 in February) is due on the last day
const getDueDay = (feed, periods) => (feed.monthDay ? Math.min(feed.monthDay, periods.daysInMonth) : null);

function isDueToday(feed, group, periods) {
  if (group === 'daily') return true;
  if (group === 'weekly') return feed.weekDay === periods.dayName;
  if (group === 'monthly') return getDueDay(feed, periods) === periods.dayOfMonth;
  return false;
}

const toRun = (r) => r && ({
  date: r.date,
  status: effectiveStatus(r),
  progress: Math.round(r.progress || 0),
  failed: !!r.failed,
  error_message: r.error_message || '',
  stages: r.stages || {},
  record_count: r.record_count ?? null,
  updated_at: r.updated_at || null,
});

/**
 * @param {Object} feedFilter - Mongo filter for the feeds in scope
 * @param {string} date - 'YYYY-MM-DD'
 */
async function getLiveProgress(feedFilter, date) {
  const periods = getPeriods(date);

  const feeds = (await Feed.find({ ...feedFilter, feedStatus: { $ne: 'Closed' } })
    .select('name projectId feedType weekDay monthDay feedStatus assignedDevelopers')
    .populate('projectId', 'name projectCustomId')
    .populate('assignedDevelopers', 'name')
    .sort({ name: 1 })
    .lean())
    .filter((f) => f.projectId); // project was deleted

  const projects = [...new Map(feeds.map((f) => [String(f.projectId._id), f.projectId])).values()];
  const matcher = projects.length ? await createStatusMatcher(projects) : null;

  // One FeedStatus query for every feed. Past days are only needed for feeds that are not daily.
  const onlyDaily = feeds.every((f) => getGroup(f.feedType) === 'daily');
  const from = onlyDaily ? date : (periods.weekStart < periods.monthStart ? periods.weekStart : periods.monthStart);
  const records = matcher
    ? await FeedStatus.find({ project: { $in: matcher.projectValues }, date: { $gte: from, $lte: date } })
      .select('feed_name project date status progress failed error_message stages record_count updated_at')
      .sort({ date: -1, updated_at: -1 })
      .lean()
    : [];

  const runsByFeed = new Map(); // newest first
  for (const { record, projectIds } of matcher ? await matcher.assign(records) : []) {
    for (const projectId of projectIds) {
      const key = feedKey(projectId, record.feed_name);
      if (!runsByFeed.has(key)) runsByFeed.set(key, []);
      runsByFeed.get(key).push(record);
    }
  }
  // same date: a run that carries the project stays ahead of one matched by name only
  for (const runs of runsByFeed.values()) runs.sort((a, b) => b.date.localeCompare(a.date));

  const result = [];
  for (const feed of feeds) {
    const group = getGroup(feed.feedType);
    const runs = runsByFeed.get(feedKey(feed.projectId._id, feed.name)) || [];
    const today = runs.find((r) => r.date === date) || null;

    let period = today;
    if (group === 'weekly') period = runs.find((r) => r.date >= periods.weekStart) || null;
    if (group === 'monthly') period = runs.find((r) => r.date >= periods.monthStart) || null;
    if (group === 'adhoc') {
      // No schedule: shown only with a run today, or while its latest run is still in progress
      if (!today && !(runs[0] && effectiveStatus(runs[0]) === 'In Progress')) continue;
      period = today || runs[0];
    }

    result.push({
      _id: feed._id,
      name: feed.name,
      feedType: feed.feedType === 'Add hoc' ? 'Ad hoc' : feed.feedType,
      group,
      feedStatus: feed.feedStatus,
      weekDay: feed.weekDay || '',
      monthDay: feed.monthDay ?? null,
      dueDay: group === 'monthly' ? getDueDay(feed, periods) : null,
      dueToday: isDueToday(feed, group, periods),
      project: { _id: feed.projectId._id, name: feed.projectId.name, projectCustomId: feed.projectId.projectCustomId },
      developers: (feed.assignedDevelopers || []).filter(Boolean).map((d) => ({ _id: d._id, name: d.name })),
      today: toRun(today),
      period: toRun(period),
    });
  }

  return { ...periods, serverTime: getServerTimestamp().toISOString(), feeds: result };
}

module.exports = { getLiveProgress, getPeriods, getGroup, getDueDay, isDueToday, isValidDate, serverToday };
