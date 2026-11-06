// backend/cron/feedGitSync.js
const cron = require('node-cron');
const { syncAllFeeds } = require('../services/feedGitSyncService');

// Every day at 2:00 AM IST
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Daily feed Git sync started...');
  const start = Date.now();
  try {
    const result = await syncAllFeeds();
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Feed Git sync done in ${secs}s: ${result.updated} updated, ${result.failed} failed`);
  } catch (err) {
    console.error('❌ Daily feed Git sync failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// One-time backfill 60s after server start: only feeds that were never synced,
// so existing feeds get their date without waiting for the next daily run.
setTimeout(async () => {
  try {
    const result = await syncAllFeeds({ onlyNeverSynced: true });
    console.log(`🚀 Feed Git backfill: ${result.updated} updated, ${result.failed} failed`);
  } catch (err) {
    console.error('❌ Feed Git backfill failed:', err.message);
  }
}, 60000);

console.log('⏰ Feed Git sync scheduled (daily, 2:00 AM IST)');