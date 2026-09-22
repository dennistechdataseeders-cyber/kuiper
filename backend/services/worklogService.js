// backend/services/worklogService.js
const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');

/**
 * Stops all running worklogs (feed and ticket) for the current day.
 * This is intended to be called by a cron job at the end of the day.
 */
exports.stopAllRunningTimers = async () => {
  console.log('⏰ Running automatic end-of-day timer stop...');
  const today = new Date().toISOString().split('T')[0];
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
      const diff = Math.floor((serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000);

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

      return log.save();
    });

    await Promise.all(updatePromises);
    console.log(`✅ Successfully stopped ${runningLogs.length} running ${logType} timers.`);
  };

  // Process both types of logs
  await processLogs(WorkLog, 'feed');
  await processLogs(TicketWorkLog, 'ticket');
};