// backend/check-dennis-attendance.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkDennisAttendance() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const EmployeePunchLog = require('./models/EmployeePunchLog');
  const User = require('./models/User');

  // Find Dennis
  const dennis = await User.findOne({ email: 'dennis.techdataseeders@gmail.com' });
  if (!dennis) {
    console.log('❌ Dennis not found');
    process.exit();
  }
  
  console.log(`👤 Dennis: ${dennis.name} (${dennis.employeeCode})`);
  console.log(`📧 Email: ${dennis.email}`);
  console.log(`🆔 ID: ${dennis._id}`);
  console.log('═'.repeat(50));

  // Check if he has punch logs
  const logs = await EmployeePunchLog.find({ 
    employeeId: dennis._id 
  }).sort({ date: -1 }).limit(10);

  console.log(`\n📊 Found ${logs.length} punch logs for Dennis:`);
  console.log('═'.repeat(50));

  if (logs.length === 0) {
    console.log('❌ No punch logs found in database');
    console.log('\n💡 Run the sync endpoint to fetch logs from biometric device');
  } else {
    logs.forEach((log, i) => {
      console.log(`\n📋 Log ${i + 1}:`);
      console.log(`   Date: ${log.date.toISOString().split('T')[0]}`);
      console.log(`   Punch In: ${log.punchIn ? new Date(log.punchIn).toLocaleTimeString() : '❌'}`);
      console.log(`   Punch Out: ${log.punchOut ? new Date(log.punchOut).toLocaleTimeString() : '❌'}`);
      console.log(`   Manual Correction: ${log.isManualCorrection ? '✅ Yes' : 'No'}`);
      console.log(`   Note: ${log.correctionNote || 'N/A'}`);
    });
  }

  process.exit();
}

checkDennisAttendance();