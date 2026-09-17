const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const MAX_SESSION_SECONDS =
  (Number(process.env.MAX_SESSION_HOURS) || 12) * 3600;

function tzParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const out = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  // en-CA renders midnight as '24' in some ICU builds; normalise it.
  if (out.hour === '24') out.hour = '00';
  return out;
}

// 'YYYY-MM-DD' for a given instant, in APP_TZ.
// THIS is what must be written to WorkLog.date / TicketWorkLog.date.
// (The old code used `new Date().toISOString().split('T')[0]`, which is always
// UTC — so IST work done between 00:00 and 05:30 was filed under the previous
// day, and never matched the date the UI was filtering on.)
function dayKey(date = new Date()) {
  const p = tzParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// Today's 'YYYY-MM-DD' in APP_TZ.
function todayKey() {
  return dayKey(new Date());
}

// The UTC offset of APP_TZ at a given instant, in minutes (e.g. 330 for IST).
function tzOffsetMinutes(date = new Date()) {
  const p = tzParts(date);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Epoch-ms bounds of a 'YYYY-MM-DD' day, as that day exists in APP_TZ.
function dayBounds(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return null;

  // Guess with a fixed offset, then correct once (handles DST edges).
  const naiveStart = Date.UTC(y, m - 1, d, 0, 0, 0);
  let offset = tzOffsetMinutes(new Date(naiveStart));
  let startMs = naiveStart - offset * 60000;
  offset = tzOffsetMinutes(new Date(startMs));
  startMs = naiveStart - offset * 60000;

  const naiveEnd = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  let endOffset = tzOffsetMinutes(new Date(naiveEnd));
  const endMs = naiveEnd - endOffset * 60000;

  return { startMs, endMs };
}

/* ------------------------------------------------------------------
   INTERVAL EXTRACTION
   ------------------------------------------------------------------
   An "open" block is one with a startTime and no endTime.

   The old controller treated EVERY open block as if it were still running
   right now: `end = Date.now()`. A timer abandoned in June therefore added
   three months of "work" to the totals, and the number grew every time the
   page was refreshed. That is the entire reason the figures looked fine
   locally (fresh data, nothing abandoned yet) and absurd on the VPS.

   New policy:
     - closed block            -> trust its timestamps
     - open block, log is TODAY and started < MAX_SESSION ago
                               -> genuinely running, count up to now
     - open block, anything else
                               -> ABANDONED. Contributes ZERO seconds, and is
                                  reported separately so the UI can flag it.
   ------------------------------------------------------------------ */

function extractIntervals(logs, opts = {}) {
  const now = opts.now instanceof Date ? opts.now.getTime() : Date.now();
  const today = opts.today || todayKey();

  const intervals = [];
  let runningCount = 0;
  const abandoned = [];

  for (const log of logs || []) {
    let blocks =
      Array.isArray(log.timeBlocks) && log.timeBlocks.length > 0
        ? log.timeBlocks
        : [];

    // Legacy rows: timer running but no timeBlocks were ever written.
    if (blocks.length === 0 && log.isRunning && log.startedAt) {
      blocks = [{ startTime: log.startedAt, endTime: null }];
    }

    for (const block of blocks) {
      if (!block || !block.startTime) continue;

      const start = new Date(block.startTime).getTime();
      if (!Number.isFinite(start)) continue;

      let end;

      if (block.endTime) {
        end = new Date(block.endTime).getTime();
        if (!Number.isFinite(end)) continue;
      } else if (log.date === today && now - start <= MAX_SESSION_SECONDS * 1000) {
        end = now;
        runningCount++;
      } else {
        abandoned.push({
          logId: log._id ? String(log._id) : null,
          date: log.date,
          startedAt: new Date(start).toISOString(),
          openForHours: Math.round(((now - start) / 3600000) * 10) / 10,
        });
        continue; // contributes nothing
      }

      if (end <= start) continue;

      // Hard safety net: no single block may exceed the max session length,
      // even if a bad endTime was written at some point.
      if (end - start > MAX_SESSION_SECONDS * 1000) {
        end = start + MAX_SESSION_SECONDS * 1000;
      }

      intervals.push({ start, end });
    }
  }

  return { intervals, runningCount, abandoned };
}

// Clamp intervals to a [startDate, endDate] window (inclusive, APP_TZ days),
// so a session is only credited for the part that falls inside the filter.
function clampToRange(intervals, startDate, endDate) {
  if (!startDate && !endDate) return intervals;

  const lo = startDate ? dayBounds(startDate)?.startMs ?? -Infinity : -Infinity;
  const hi = endDate ? dayBounds(endDate)?.endMs ?? Infinity : Infinity;

  const out = [];
  for (const iv of intervals) {
    const start = Math.max(iv.start, lo);
    const end = Math.min(iv.end, hi);
    if (end > start) out.push({ start, end });
  }
  return out;
}

// Union of overlapping intervals. Only ever called with intervals belonging to
// ONE developer — two different people working the same hour is 2 real hours.
function mergeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

// Net seconds for one developer's logs, overlap-free.
function netSecondsForOneDeveloper(logs, opts = {}) {
  const { intervals, runningCount, abandoned } = extractIntervals(logs, opts);
  const clamped = clampToRange(intervals, opts.startDate, opts.endDate);
  const merged = mergeIntervals(clamped);
  const seconds = Math.floor(
    merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 1000
  );

  return { seconds, runningCount, abandoned, merged };
}

// Distinct APP_TZ days a developer actually logged time on. Derived from the
// merged intervals rather than the stored `date` string, so a session that
// crosses midnight counts toward both days.
function activeDayKeys(mergedIntervals) {
  const days = new Set();
  for (const iv of mergedIntervals) {
    let cursor = iv.start;
    while (cursor < iv.end) {
      const key = dayKey(new Date(cursor));
      days.add(key);
      const bounds = dayBounds(key);
      if (!bounds || bounds.endMs <= cursor) break;
      cursor = bounds.endMs + 1;
    }
  }
  return days;
}

// Splits a set of (already overlap-merged, single-developer) intervals into
// per-APP_TZ-day seconds. A session crossing midnight is sliced at the day
// boundary so each day only gets the portion of time that actually fell on
// it — same slicing logic as activeDayKeys, but summing duration instead of
// just marking the day as touched.
function splitIntervalsByDay(mergedIntervals) {
  const map = new Map();
  for (const iv of mergedIntervals || []) {
    let cursor = iv.start;
    while (cursor < iv.end) {
      const key = dayKey(new Date(cursor));
      const bounds = dayBounds(key);
      const segmentEnd = bounds ? Math.min(iv.end, bounds.endMs + 1) : iv.end;
      const seconds = Math.max(0, Math.floor((segmentEnd - cursor) / 1000));
      if (seconds > 0) map.set(key, (map.get(key) || 0) + seconds);
      if (!bounds || bounds.endMs <= cursor) break;
      cursor = bounds.endMs + 1;
    }
  }
  return map;
}

/* ------------------------------------------------------------------
   FORMATTING
   ------------------------------------------------------------------ */

function formatTime(seconds = 0) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function toHours(seconds = 0) {
  return Number((Math.max(0, seconds || 0) / 3600).toFixed(2));
}

function avg(total, count) {
  if (!count) return 0;
  return Math.round(total / count);
}

module.exports = {
  APP_TZ,
  MAX_SESSION_SECONDS,
  tzParts,
  dayKey,
  todayKey,
  dayBounds,
  tzOffsetMinutes,
  extractIntervals,
  clampToRange,
  mergeIntervals,
  netSecondsForOneDeveloper,
  activeDayKeys,
  splitIntervalsByDay,
  formatTime,
  toHours,
  avg,
};