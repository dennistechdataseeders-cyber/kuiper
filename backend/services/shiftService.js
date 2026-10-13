// backend/services/shiftService.js
const ShiftHistory = require('../models/ShiftHistory');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const User = require('../models/User');

const IST_OFFSET_MINUTES  = 5 * 60 + 30; // +05:30
const LATE_BUFFER_MINUTES = 15;

/**
 * IST date string YYYY-MM-DD for a given instant.
 */
function getISTDateString(date = new Date()) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Convert {hour, minute, ampm} into minutes-of-day IST.
 * e.g. 10:30 AM -> 630, 12:30 PM -> 750
 */
function toShiftStartMinutes(hour, minute, ampm) {
  let h = Number(hour);
  const m = Number(minute) || 0;
  const ap = (ampm || 'AM').toUpperCase();

  if (!Number.isFinite(h) || h < 1 || h > 12) h = 10;

  let h24 = h % 12;
  if (ap === 'PM') h24 += 12;

  return h24 * 60 + m;
}

/**
 * Which shift (minutes-of-day IST) was active for this user on this IST date?
 * Falls back to the user's current shift if no history exists.
 */
async function getShiftStartMinutesForDate(userId, istDateStr) {
  const row = await ShiftHistory.findOne({
    userId,
    effectiveFrom: { $lte: istDateStr },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: istDateStr } }
    ]
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  if (row) return row.shiftStartMinutes;

  // Fallback: current user shift
  const user = await User.findById(userId).select('shiftHour shiftMinute shiftAmPm');
  if (!user) return null;

  return toShiftStartMinutes(user.shiftHour, user.shiftMinute, user.shiftAmPm);
}

/**
 * Evaluate whether a punch-in instant is late against a given shift.
 * Returns { isLate, lateMinutes, punchMinutesIST, cutoffMinutesIST }.
 */
function evaluateLateness(punchInUTC, shiftStartMinutes) {
  if (!punchInUTC || shiftStartMinutes == null) {
    return {
      isLate: false,
      lateMinutes: 0,
      punchMinutesIST: null,
      cutoffMinutesIST: null
    };
  }

  const d = new Date(punchInUTC);
  if (isNaN(d.getTime())) {
    return {
      isLate: false,
      lateMinutes: 0,
      punchMinutesIST: null,
      cutoffMinutesIST: null
    };
  }

  let punchMinutes =
    d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  punchMinutes = ((punchMinutes % 1440) + 1440) % 1440;

  const cutoff = shiftStartMinutes + LATE_BUFFER_MINUTES;
  const isLate = punchMinutes > cutoff;
  const lateMinutes = isLate ? punchMinutes - cutoff : 0;

  return {
    isLate,
    lateMinutes,
    punchMinutesIST: punchMinutes,
    cutoffMinutesIST: cutoff
  };
}

/**
 * Ensure a user has exactly one open ShiftHistory row reflecting their
 * current shift. Used on user creation and by the backfill script.
 */
async function ensureInitialShiftHistory(userId, opts = {}) {
  const existingOpen = await ShiftHistory.findOne({
    userId,
    effectiveTo: null
  });
  if (existingOpen) return existingOpen;

  const user = await User.findById(userId).select(
    'shiftHour shiftMinute shiftAmPm dateOfJoining'
  );
  if (!user) return null;

  const shiftStartMinutes = toShiftStartMinutes(
    user.shiftHour,
    user.shiftMinute,
    user.shiftAmPm
  );

  const effectiveFrom =
    opts.effectiveFrom ||
    (user.dateOfJoining
      ? getISTDateString(user.dateOfJoining)
      : '1970-01-01');

  return ShiftHistory.create({
    userId,
    shiftStartMinutes,
    shiftHour:   user.shiftHour,
    shiftMinute: user.shiftMinute,
    shiftAmPm:   user.shiftAmPm,
    effectiveFrom,
    effectiveTo: null,
    changedBy: opts.changedBy || null,
    note: opts.note || 'Initial shift record'
  });
}

/**
 * Record a shift change:
 *   - closes the currently open row with effectiveTo = yesterday (IST)
 *   - opens a new row with effectiveFrom = today (IST)
 * No-op if the new shift equals the currently-active shift.
 */
async function recordShiftChange(userId, newShift, changedBy = null, note = '') {
  const { hour, minute, ampm } = newShift;
  const newMinutes = toShiftStartMinutes(hour, minute, ampm);

  const openRow = await ShiftHistory.findOne({ userId, effectiveTo: null });

  // First-ever history row
  if (!openRow) {
    return ensureInitialShiftHistory(userId, {
      changedBy,
      note: note || 'Initial shift record'
    });
  }

  if (openRow.shiftStartMinutes === newMinutes) {
    return openRow; // no change
  }

  const todayIST = getISTDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIST = getISTDateString(yesterday);

  // Close the old row
  openRow.effectiveTo =
    yesterdayIST < openRow.effectiveFrom
      ? openRow.effectiveFrom
      : yesterdayIST;
  await openRow.save();

  // Open a new row starting today
  return ShiftHistory.create({
    userId,
    shiftStartMinutes: newMinutes,
    shiftHour:   Number(hour),
    shiftMinute: Number(minute) || 0,
    shiftAmPm:   (ampm || 'AM').toUpperCase(),
    effectiveFrom: todayIST,
    effectiveTo:   null,
    changedBy,
    note
  });
}

/**
 * Re-evaluate late-ness for a punch log and persist the result.
 * Idempotent — safe to call multiple times.
 */
async function evaluateAndPersistLateness(punchLog) {
  if (!punchLog || !punchLog.punchIn) return punchLog;

  const istDate = getISTDateString(punchLog.punchIn);
  const shiftStart = await getShiftStartMinutesForDate(
    punchLog.employeeId,
    istDate
  );

  const { isLate, lateMinutes } = evaluateLateness(
    punchLog.punchIn,
    shiftStart
  );

  punchLog.shiftStartMinutesUsed = shiftStart;
  punchLog.isLate               = isLate;
  punchLog.lateMinutes          = lateMinutes;
  punchLog.lateEvaluatedAt      = new Date();

  await punchLog.save();
  return punchLog;
}

module.exports = {
  IST_OFFSET_MINUTES,
  LATE_BUFFER_MINUTES,
  getISTDateString,
  toShiftStartMinutes,
  getShiftStartMinutesForDate,
  evaluateLateness,
  ensureInitialShiftHistory,
  recordShiftChange,
  evaluateAndPersistLateness
};