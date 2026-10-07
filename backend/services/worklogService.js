// backend/services/worklogService.js
const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const WorkDescription = require('../models/WorkDescription');

// ------------------------------------------------------------------
// HELPER: Append "Closed by system" to today's WorkDescription
// ------------------------------------------------------------------
/**
 * Appends a system-closure note to the existing WorkDescription entry
 * for the given developer/feed/date. If no description exists yet, one
 * is created with just the system note.
 *
 * @param {ObjectId} developerId - Developer whose description to update
 * @param {ObjectId} feedId      - Feed the description belongs to
 * @param {string}   date        - YYYY-MM-DD string (server date)
 * @param {string}   note        - The note to append (default "Closed by system")
 */
async function appendSystemCloseNote(developerId, feedId, date, note = 'Closed by system') {
  try {
    if (!developerId || !feedId || !date) return;

    const existing = await WorkDescription.findOne({
      developer: developerId,
      feed: feedId,
      date: date
    });

    if (existing) {
      // Avoid duplicating the note if the cron runs more than once
      if (!existing.description || !existing.description.includes(note)) {
        existing.description = `${existing.description || ''}\n\n${note}`;
        await existing.save();
        console.log(`   📝 Appended "${note}" to WorkDescription for feed ${feedId}`);
      }
    } else {
      // No description yet — create one with just the system note
      await WorkDescription.create({
        developer: developerId,
        feed: feedId,
        description: note,
        date: date
      });
      console.log(`   📝 Created WorkDescription with "${note}" for feed ${feedId}`);
    }
  } catch (err) {
    console.error(`   ⚠️ Failed to append system-close note for feed ${feedId}:`, err.message);
  }
}

// ------------------------------------------------------------------
// HELPER: Compute today's date in IST as YYYY-MM-DD
// (matches how the rest of your code stores `date`)
// ------------------------------------------------------------------
function getISTDateString() {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Stops all running worklogs (feed and ticket) for the current day.
 * This is intended to be called by a cron job at the end of the day.
 *
 * For every timer it stops, it also appends "Closed by system" to the
 * matching WorkDescription entry so the developer's daily log reflects
 * that the closure was performed by the system, not the user.
 */
exports.stopAllRunningTimers = async () => {
  console.log('⏰ Running automatic end-of-day timer stop...');

  const today = getISTDateString();
  const serverNow = new Date();

  const processLogs = async (Model, logType) => {
    // Find all running logs for today
    const runningLogs = await Model.find({
      date: today,
      isRunning: true,
      startedAt: { $ne: null }
    });

    if (runningLogs.length === 0) {
      console.log(`✅ No running ${logType} timers found.`);
      return;
    }

    console.log(`🔍 Found ${runningLogs.length} running ${logType} timers to stop.`);

    const updatePromises = runningLogs.map(async (log) => {
      // ============================================================
      // ✅ FIX: Do NOT add the elapsed time from startedAt to now.
      //
      // A timer that is still "running" at 23:55 means the developer
      // started it and never stopped it. We cannot know when they
      // actually finished working, so we treat the open session as
      // abandoned and give it 0 seconds.
      //
      // Only PREVIOUSLY CLOSED timeBlocks (which already have a real
      // endTime) contribute to the total. Their durations were already
      // added to totalTime when the timer was paused/stopped.
      // ============================================================

      if (log.timeBlocks && log.timeBlocks.length > 0) {
        const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];

        if (currentBlock && !currentBlock.endTime) {
          // Close the block WITHOUT adding its duration to totalTime.
          // The block still gets an endTime for audit purposes, but
          // its duration is set to 0 so it never counts as work.
          currentBlock.endTime = serverNow;
          currentBlock.duration = 0;
        }
      }

      // Stop the timer and flag it. NOTE: totalTime is intentionally
      // NOT incremented here — the open session contributed nothing.
      log.isRunning = false;
      log.startedAt = null;
      log.stoppedBySystem = true;

      await log.save();

      // Append "Closed by system" note for feed descriptions
      if (logType === 'feed' && log.developerId && log.feedId) {
        await appendSystemCloseNote(log.developerId, log.feedId, today);
      }

      return log;
    });

    await Promise.all(updatePromises);
    console.log(`✅ Successfully stopped ${runningLogs.length} running ${logType} timers.`);
  };

  await processLogs(WorkLog, 'feed');
  await processLogs(TicketWorkLog, 'ticket');
};