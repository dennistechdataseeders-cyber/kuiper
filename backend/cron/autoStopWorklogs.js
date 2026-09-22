// backend/cron/autoStopWorklogs.js
const cron = require('node-cron');
const worklogService = require('../services/worklogService');

// Run at 4:01 PM IST (16:01) every day
cron.schedule('55 23 * * *', async () => {
  console.log('⏰ Cron job: Auto-stopping running worklogs...');
  try {
    await worklogService.stopAllRunningTimers();
  } catch (error) {
    console.error('❌ Cron job failed to stop worklogs:', error);
  }
}, {
  timezone: "Asia/Kolkata" // Match the timezone of your other cron jobs
});

console.log('⏰ Auto-stop worklogs cron job scheduled (daily at 4:01 PM IST)');