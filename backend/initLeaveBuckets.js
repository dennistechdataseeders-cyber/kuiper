// backend/scripts/initLeaveBuckets.js
// Run this once to create leave buckets for all employees
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const LeaveBucket = require('./models/LeaveBucket');
const leaveBucketService = require('./services/leaveBucketService');

async function initLeaveBuckets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 Initializing leave buckets for all employees...');
    
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    });
    
    let created = 0;
    let existing = 0;
    
    for (const employee of employees) {
      const existingBucket = await LeaveBucket.findOne({ employeeId: employee._id });
      if (existingBucket) {
        existing++;
        continue;
      }
      
      const bucket = new LeaveBucket({
        employeeId: employee._id,
        totalBalance: 18, // Start with 18 days (1.5 * 12)
        leavesTakenThisMonth: 0,
        leavesTakenThisYear: 0,
        lastAccrualMonth: -1,
        lastAccrualYear: -1,
        monthlyUsage: [],
        yearlyUsage: [{
          year: new Date().getFullYear(),
          leavesTaken: 0,
          leavesAccrued: 18
        }]
      });
      
      // Set financial year
      const istDate = leaveBucketService.getISTDate();
      const financialYear = leaveBucketService.getFinancialYear(istDate);
      bucket.financialYearStart = new Date(financialYear.startYear, 3, 1);
      bucket.financialYearEnd = new Date(financialYear.endYear, 2, 31);
      
      await bucket.save();
      created++;
      console.log(`✅ Created bucket for ${employee.name}`);
    }
    
    console.log(`\n📊 Summary: ${created} buckets created, ${existing} already existed`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

initLeaveBuckets();