// backend/scripts/backfillShiftsAndLate.js
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const ShiftHistory = require('../models/ShiftHistory');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const {
  getISTDateString,
  toShiftStartMinutes,
  evaluateLateness
} = require('../services/shiftService');

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? '⚠️  APPLY MODE' : '🔍 DRY RUN');

  const users = await User.find({
    role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
  }).select('_id name shiftHour shiftMinute shiftAmPm dateOfJoining');

  let historyCreated = 0;
  let logsUpdated = 0;

  for (const u of users) {
    // 1. Ensure at least one ShiftHistory row exists
    const hasOpen = await ShiftHistory.findOne({ userId: u._id, effectiveTo: null });
    if (!hasOpen) {
      const shiftStartMinutes = toShiftStartMinutes(u.shiftHour, u.shiftMinute, u.shiftAmPm);
      const effectiveFrom = u.dateOfJoining
        ? getISTDateString(u.dateOfJoining)
        : '1970-01-01';

      console.log(`  + history for ${u.name} (from ${effectiveFrom}, shift ${shiftStartMinutes}m)`);

      if (APPLY) {
        await ShiftHistory.create({
          userId: u._id,
          shiftStartMinutes,
          shiftHour: u.shiftHour,
          shiftMinute: u.shiftMinute,
          shiftAmPm: u.shiftAmPm,
          effectiveFrom,
          effectiveTo: null,
          note: 'Backfill: initial shift'
        });
      }
      historyCreated++;
    }
  }

  // 2. Backfill isLate/lateMinutes on every punch log
  const cursor = EmployeePunchLog.find({ punchIn: { $ne: null } }).cursor();

  for await (const log of cursor) {
    const istDate = getISTDateString(log.punchIn);

    const row = await ShiftHistory.findOne({
      userId: log.employeeId,
      effectiveFrom: { $lte: istDate },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: istDate } }]
    }).sort({ effectiveFrom: -1 }).lean();

    const shiftStartMinutes = row?.shiftStartMinutes ?? 630; // default 10:30 AM
    const { isLate, lateMinutes } = evaluateLateness(log.punchIn, shiftStartMinutes);

    if (log.shiftStartMinutesUsed !== shiftStartMinutes ||
        log.isLate !== isLate ||
        log.lateMinutes !== lateMinutes) {

      if (APPLY) {
        log.shiftStartMinutesUsed = shiftStartMinutes;
        log.isLate = isLate;
        log.lateMinutes = lateMinutes;
        log.lateEvaluatedAt = new Date();
        await log.save();
      }
      logsUpdated++;
    }
  }

  console.log(`\nDone. History rows created: ${historyCreated}. Logs updated: ${logsUpdated}.`);
  if (!APPLY && (historyCreated || logsUpdated)) {
    console.log('Re-run with --apply to persist.');
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });