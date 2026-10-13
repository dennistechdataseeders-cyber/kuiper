// backend/scripts/backfill-stoppedBySystem.js
//
// One-time migration: mark worklogs as stoppedBySystem when their last
// timeBlock was zeroed by the auto-stop cron at 23:55 IST.
//
// Run:
//   node scripts/backfill-stoppedBySystem.js            # dry run
//   node scripts/backfill-stoppedBySystem.js --apply    # write changes

require('dotenv').config();
const mongoose = require('mongoose');

const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');

const APPLY = process.argv.includes('--apply');

async function backfillCollection(Model, label) {
  console.log(`\n🔍 Scanning ${label}...`);

  // A system-stopped block has: endTime set, duration === 0,
  // AND the log was never explicitly stopped by the developer
  // (developer-stopped blocks always have duration > 0).
  //
  // We also require the log to NOT already have stoppedBySystem === true,
  // so the script is idempotent.
  const candidates = await Model.find({
    stoppedBySystem: { $ne: true },
    'timeBlocks.0': { $exists: true }        // at least one block
  });

  let touched = 0;
  let skipped = 0;

  for (const log of candidates) {
    const blocks = log.timeBlocks || [];
    if (blocks.length === 0) { skipped++; continue; }

    // Look at the LAST block — that's the one the cron would have closed.
    const last = blocks[blocks.length - 1];

    const wasZeroedBySystem =
      last &&
      last.startTime &&
      last.endTime &&
      Number(last.duration) === 0 &&
      // Sanity: a real dev-stopped session of 0 seconds is implausible.
      // The endTime and startTime must differ by more than a few seconds.
      (new Date(last.endTime).getTime() - new Date(last.startTime).getTime()) > 5000;

    if (!wasZeroedBySystem) { skipped++; continue; }

    console.log(
      `  ${log._id} (${log.date}) → last block ` +
      `${Math.round((new Date(last.endTime) - new Date(last.startTime)) / 60000)}m ` +
      `but duration=0 — marking stoppedBySystem=true`
    );

    if (APPLY) {
      log.stoppedBySystem = true;
      await log.save();
    }
    touched++;
  }

  console.log(`✅ ${label}: ${touched} ${APPLY ? 'updated' : 'would update'}, ${skipped} skipped`);
  return touched;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? '⚠️  APPLY MODE' : '🔍 DRY RUN (pass --apply to write)');

  const total1 = await backfillCollection(WorkLog, 'Feed WorkLogs');
  const total2 = await backfillCollection(TicketWorkLog, 'Ticket WorkLogs');

  console.log(`\n📊 TOTAL: ${total1 + total2} documents ${APPLY ? 'updated' : 'would update'}`);
  console.log('');

  if (!APPLY && (total1 + total2) > 0) {
    console.log('Re-run with --apply to persist.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});