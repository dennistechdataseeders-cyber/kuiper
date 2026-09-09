// backend/scripts/force-accrue.js
const mongoose = require('mongoose');
require('dotenv').config();
const leaveBucketService = require('./services/leaveBucketService');

async function forceAccrue() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Force accrual even if it's not the 1st of the month
    const result = await leaveBucketService.accrueMonthlyLeaves();
    console.log('✅ Accrual result:', result);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

forceAccrue();