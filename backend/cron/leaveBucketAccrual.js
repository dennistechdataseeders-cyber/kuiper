// backend/cron/leaveBucketAccrual.js
const cron = require('node-cron');
const leaveBucketService = require('../services/leaveBucketService');

/**
 * Schedule: Run at 12:00 AM IST on the 1st of every month
 * This ensures leaves are accrued at the start of each month
 */
cron.schedule('0 0 1 * *', async () => {
  console.log('⏰ Running monthly leave accrual cron job...');
  const startTime = Date.now();
  
  try {
    // First, check if this is April 1st (financial year reset)
    const istDate = leaveBucketService.getISTDate();
    const month = istDate.getMonth();
    const day = istDate.getDate();
    
    if (month === 3 && day === 1) {
      // It's April 1st - send financial year report before reset
      console.log('📊 April 1st - Sending financial year report...');
      await leaveBucketService.sendFinancialYearReport();
      
      // Reset for new financial year
      console.log('🔄 Resetting for new financial year...');
      await leaveBucketService.resetFinancialYear();
    }
    
    // Accrue monthly leaves
    const result = await leaveBucketService.accrueMonthlyLeaves();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Monthly leave accrual completed in ${duration}s: ${result.accruedCount} employees`);
    
  } catch (error) {
    console.error('❌ Monthly leave accrual failed:', error.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log('⏰ Monthly leave accrual cron job scheduled (1st of every month at 12:00 AM IST)');

// Also run once on startup (after 30 seconds) to ensure initial state
setTimeout(async () => {
  try {
    console.log('🚀 Running initial leave accrual check...');
    await leaveBucketService.accrueMonthlyLeaves();
  } catch (error) {
    console.error('❌ Initial leave accrual check failed:', error.message);
  }
}, 30000);

module.exports = { leaveBucketService };    