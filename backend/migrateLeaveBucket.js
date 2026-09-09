// backend/scripts/migrateLeaveBucket.js
// Run this script to migrate existing leave data to the new bucket system
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const LeaveApplication = require('./models/LeaveApplication');
const LeaveBucket = require('./models/LeaveBucket');
const leaveBucketService = require('./services/leaveBucketService');

async function migrateLeaveBucket() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 Migrating leave data to bucket system...');
    
    // Get all active employees (excluding Admins, HR, Clients)
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    });
    
    let created = 0;
    let updated = 0;
    
    for (const employee of employees) {
      console.log(`\n📊 Processing ${employee.name} (${employee.email})`);
      
      // Get or create bucket
      const bucket = await leaveBucketService.getOrCreateBucket(employee._id);
      
      // Get all approved leaves for this employee
      const approvedLeaves = await LeaveApplication.find({
        employeeId: employee._id,
        status: 'approved',
        deductedFromBucket: false
      });
      
      console.log(`   Found ${approvedLeaves.length} approved leaves to process`);
      
      let totalDeductions = 0;
      
      // Process each approved leave
      for (const leave of approvedLeaves) {
        const days = leave.isHalfDay ? 0.5 : leaveBucketService.calculateDays(leave.startDate, leave.endDate);
        
        // Check if leave type is Paid Leave
        if (leave.leaveType === 'Paid Leave') {
          totalDeductions += days;
          
          // Mark as deducted
          leave.deductedFromBucket = true;
          await leave.save();
        }
      }
      
      // Set initial balance (18 days - used days)
      if (totalDeductions > 0) {
        const initialBalance = 18 - totalDeductions;
        bucket.totalBalance = Math.max(0, initialBalance);
        console.log(`   Setting initial balance: ${bucket.totalBalance} (18 - ${totalDeductions})`);
      } else {
        bucket.totalBalance = 18;
        console.log(`   Setting initial balance: 18 days`);
      }
      
      // Set financial year
      const istDate = leaveBucketService.getISTDate();
      const financialYear = leaveBucketService.getFinancialYear(istDate);
      bucket.financialYearStart = new Date(financialYear.startYear, 3, 1);
      bucket.financialYearEnd = new Date(financialYear.endYear, 2, 31);
      
      await bucket.save();
      updated++;
      
      console.log(`   ✅ Bucket updated: ${bucket.totalBalance} days remaining`);
    }
    
    console.log(`\n✅ Migration complete: ${created} buckets created, ${updated} buckets updated`);
    
    // Show summary
    const allBuckets = await LeaveBucket.find().populate('employeeId', 'name');
    console.log('\n📊 Bucket Summary:');
    allBuckets.forEach(b => {
      console.log(`   ${b.employeeId?.name || 'Unknown'}: ${b.totalBalance} days`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateLeaveBucket();