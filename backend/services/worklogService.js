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
      // Calculate the time from when it started until now
      const diff = Math.floor(
        (serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000
      );

      log.totalTime += diff;

      // Close the last time block
      if (log.timeBlocks && log.timeBlocks.length > 0) {
        const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];
        // Check if the block is still open
        if (currentBlock && !currentBlock.endTime) {
          currentBlock.endTime = serverNow;
          currentBlock.duration = diff;
        }
      }

      // Stop the timer and flag it
      log.isRunning = false;
      log.startedAt = null;
      log.stoppedBySystem = true; // Mark as stopped by system

      await log.save();

      // ============================================================
      // ✅ Append "Closed by system" to the WorkDescription for feeds
      // (WorkDescription is only tracked per feed, not per ticket)
      // ============================================================
      if (logType === 'feed' && log.developerId && log.feedId) {
        await appendSystemCloseNote(log.developerId, log.feedId, today);
      }

      return log;
    });

    await Promise.all(updatePromises);
    console.log(`✅ Successfully stopped ${runningLogs.length} running ${logType} timers.`);
  };

  // Process both types of logs
  await processLogs(WorkLog, 'feed');
  await processLogs(TicketWorkLog, 'ticket');
};