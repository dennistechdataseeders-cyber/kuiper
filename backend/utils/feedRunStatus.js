// backend/utils/feedRunStatus.js
// The ONE place that decides which FeedStatus run is shown for a feed and what its status is.
// Used by every route that reads feed status, so all pages agree. Nothing here writes to FeedStatus,
// and "today" is always passed in by the caller (this file does no date conversion of its own).

const Feed = require('../models/Feed');
const FeedStatus = require('../models/FeedStatus');
const { NO_PROJECT, normalize, createStatusMatcher, feedKey } = require('./feedStatusMatch');

// In Progress with no activity for longer than this is shown as Stalled
const STALL_HOURS = 3;

const STAGES = [
  ['extraction_done', 'Extraction Done'],
  ['file_generated', 'File Generated'],
  ['file_integrity', 'Integrity Check'],
  ['upload_path', 'Uploading'],
  ['process_complete', 'Completed'],
];
const STAGE_LABELS = Object.fromEntries(STAGES);

const NO_RUN = {
  runDate: null, isToday: false, isPreviousRun: false, displayStatus: 'No run yet', progress: 0,
  currentStage: null, currentStageLabel: null, lastCompletedStage: null, lastCompletedStageLabel: null,
  stagesDone: 0, stagesTotal: STAGES.length, stageWarnings: [],
  deliveredAt: null, lastUpdatedAt: null, isStalled: false,
};

const timeOf = (value) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Status, progress and stages of one run.
 * @param {Object|null} record - plain FeedStatus document (lean / aggregate, not hydrated: a hydrated
 *   document fills in the stages the pipeline never sent)
 * @param {string} today - the caller's existing 'YYYY-MM-DD'
 */
function describeRun(record, today) {
  if (!record) return { ...NO_RUN };

  const stages = record.stages || {};
  const present = STAGES.map(([key]) => key).filter((key) => stages[key]);
  const isDone = (key) => stages[key]?.completed === true;
  // Until a delivery stage is on the record, the later stages are still to come: count all of them
  const reachesDelivery = !!(stages.upload_path || stages.process_complete);
  const expected = reachesDelivery ? present : STAGES.map(([key]) => key);
  const done = present.filter(isDone);
  const allDone = reachesDelivery && done.length === expected.length;
  const firstIncomplete = expected.find((key) => !isDone(key)) || null;

  // a stage done while an earlier one is not: still counted, but flagged
  const stageWarnings = done.filter((key) => expected.slice(0, expected.indexOf(key)).some((k) => !isDone(k)));

  const stageProgress = (done.length / expected.length) * 100;
  const progress = Math.min(100, Math.max(0, Number(record.progress) || 0, stageProgress));

  // Last activity = updated_at, which the server sets on every update. Stage times come from the scraper's
  // own clock (some are stored hours ahead), so they are used only when there is no updated_at.
  const stageTimes = done.map((key) => timeOf(stages[key].completed_at)).filter((t) => t !== null);
  const lastActivity = timeOf(record.updated_at) ?? (stageTimes.length ? Math.max(...stageTimes) : null);
  const lastUpdatedAt = lastActivity === null ? null : new Date(lastActivity);

  let displayStatus;
  if (record.failed === true || record.status === 'Failed') displayStatus = 'Failed';
  else if (isDone('process_complete') || allDone || record.status === 'Completed' || progress >= 100) displayStatus = 'Completed';
  else if (done.length > 0 || progress > 0 || record.status === 'In Progress') displayStatus = 'In Progress';
  else displayStatus = 'Pending';

  const isStalled = displayStatus === 'In Progress' && !!lastUpdatedAt
    && Date.now() - lastUpdatedAt.getTime() > STALL_HOURS * 60 * 60 * 1000;
  if (isStalled) displayStatus = 'Stalled';

  const isOpen = ['In Progress', 'Stalled', 'Failed'].includes(displayStatus);
  const currentStage = isOpen ? firstIncomplete : null;
  const lastCompletedStage = done[done.length - 1] || null;

  return {
    runDate: record.date || null,
    isToday: record.date === today,
    isPreviousRun: !!record.date && record.date < today, // a run dated ahead of "today" is not a previous one
    displayStatus,
    // a delivered run is always 100%; an unfinished one is never rounded up to it
    progress: displayStatus === 'Completed' ? 100 : Math.min(99, Math.round(progress)),
    currentStage,
    currentStageLabel: STAGE_LABELS[currentStage] || null,
    lastCompletedStage,
    lastCompletedStageLabel: STAGE_LABELS[lastCompletedStage] || null,
    stagesDone: done.length,
    stagesTotal: expected.length,
    stageWarnings,
    // the server's own time first: stage times come from the scraper's clock (see lastActivity above)
    deliveredAt: displayStatus === 'Completed'
      ? record.updated_at || stages.process_complete?.completed_at || stages.upload_path?.completed_at || null
      : null,
    lastUpdatedAt,
    isStalled,
  };
}

// Today's run first, then the newest date, then a run that carries its project, then the newest update
const runOrder = (record, today) => [
  record.date === today ? 1 : 0,
  record.date || '',
  NO_PROJECT.includes(record.project ?? null) ? 0 : 1,
  timeOf(record.updated_at) || 0,
];
function isBetterRun(a, b, today) {
  const [x, y] = [runOrder(a, today), runOrder(b, today)];
  const i = x.findIndex((v, n) => v !== y[n]);
  return i !== -1 && x[i] > y[i];
}

/**
 * The run to show for every feed the matcher knows: today's, else the most recent one.
 * One aggregate query, not one per feed.
 * @param {string} [upTo] - ignore runs dated after this day
 * @returns {Promise<Map<string, Object>>} feedKey(projectId, feed name) -> FeedStatus record
 */
async function getLatestRuns(matcher, today, upTo) {
  const latest = await FeedStatus.aggregate([
    { $match: { project: { $in: matcher.projectValues }, ...(upTo ? { date: { $lte: upTo } } : {}) } },
    { $unset: ['files', 'file_metadata'] },
    { $addFields: { isTodayRun: { $cond: [{ $eq: ['$date', today] }, 1, 0] } } },
    { $sort: { isTodayRun: -1, date: -1, updated_at: -1 } },
    { $group: { _id: { feed: '$feed_name', project: '$project' }, run: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$run' } },
  ]).allowDiskUse(true);

  // the same feed can be spelled differently, or be stored under more than one project key
  const runs = new Map();
  for (const { record, projectIds } of await matcher.assign(latest)) {
    for (const projectId of projectIds) {
      const key = feedKey(projectId, record.feed_name);
      if (!runs.has(key) || isBetterRun(record, runs.get(key), today)) runs.set(key, record);
    }
  }
  return runs;
}

/**
 * The run of one feed just before a date (for the "Show previous run" button).
 * @returns {Promise<Object|null>} FeedStatus record
 */
async function getPreviousRun(project, feedName, before) {
  const words = normalize(feedName).split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = await createStatusMatcher([project]);
  const records = await FeedStatus.find({
    project: { $in: matcher.projectValues },
    feed_name: { $regex: `^\\s*${words.join('\\s+')}\\s*$`, $options: 'i' },
    date: { $lt: before },
  }).select('-files -file_metadata').sort({ date: -1, updated_at: -1 }).lean();

  let best = null;
  for (const { record } of await matcher.assign(records)) {
    if (!best || isBetterRun(record, best, null)) best = record;
  }
  return best;
}

/**
 * One entry per feed of the project: today's run if there is one, else the feed's most recent run,
 * else no run at all.
 * @returns {Promise<Array<{ name, record, feed }>>} record is null for a feed that never ran; feed is
 *   the Feed document, or null for a run whose name is not a feed of this project
 */
async function getProjectRuns(project, today) {
  const [matcher, feeds] = await Promise.all([
    createStatusMatcher([project]),
    Feed.find({ projectId: project._id }).select('name feedType feedStatus').lean(),
  ]);

  const runs = new Map([...(await getLatestRuns(matcher, today)).values()].map((r) => [normalize(r.feed_name), r]));
  const feedByName = new Map(feeds.map((f) => [normalize(f.name), f]));
  const result = [];
  for (const [key, record] of runs) {
    const feed = feedByName.get(key) || null;
    // a Closed feed is listed only if it really ran today (same as before)
    if (feed?.feedStatus === 'Closed' && record.date !== today) continue;
    result.push({ name: record.feed_name, record, feed });
  }
  for (const [key, feed] of feedByName) {
    const status = feed.feedStatus || '';
    if (runs.has(key) || status === 'Closed' || status.includes('ON hold')) continue;
    result.push({ name: feed.name, record: null, feed });
  }
  return result.sort((a, b) => !a.record - !b.record || a.name.localeCompare(b.name));
}

module.exports = { STALL_HOURS, STAGES, describeRun, getLatestRuns, getPreviousRun, getProjectRuns };
