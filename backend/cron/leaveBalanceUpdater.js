// backend/cron/leaveBalanceUpdater.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running leave balance update...');
    try {
        // Get all users with leave balances
        const users = await User.find({});
        let updatedCount = 0;
        
        for (const user of users) {
            // Check if balances need annual grant
            await user.grantAnnualLeaves();
            // Update monthly accruals
            await user.updateLeaveBalances();
            updatedCount++;
        }
        
        console.log(`✅ Updated leave balances for ${updatedCount} users`);
    } catch (error) {
        console.error('❌ Error updating leave balances:', error);
    }
}, {
    timezone: "Asia/Kolkata"
});

console.log('⏰ Leave balance updater scheduled (daily at midnight IST)');