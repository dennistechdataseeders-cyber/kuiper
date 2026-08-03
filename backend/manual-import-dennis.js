// backend/manual-import-dennis.js
const mongoose = require('mongoose');
require('dotenv').config();

async function manualImport() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const EmployeePunchLog = require('./models/EmployeePunchLog');
  const User = require('./models/User');

  // Find Dennis
  const dennis = await User.findOne({ email: 'dennis.techdataseeders@gmail.com' });
  if (!dennis) {
    console.log('❌ Dennis not found');
    process.exit();
  }

  // From your test output, Dennis (EmpCode: 3) has logs
  // Let's create a sample log for today
  const today = new Date();
  today.setHours(9, 0, 0, 0); // 9:00 AM punch in
  
  const todayOut = new Date(today);
  todayOut.setHours(17, 30, 0, 0); // 5:30 PM punch out
  
  // Check if already exists
  const existing = await EmployeePunchLog.findOne({
    employeeId: dennis._id,
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate())
  });

  if (existing) {
    console.log('⚠️ Log already exists for today');
    console.log(`   Punch In: ${existing.punchIn}`);
    console.log(`   Punch Out: ${existing.punchOut}`);
  } else {
    // Create new log
    const log = await EmployeePunchLog.create({
      employeeId: dennis._id,
      punchIn: today,
      punchOut: todayOut,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      isManualCorrection: true,
      correctionNote: 'Manual import for testing',
      createdBy: null
    });
    console.log('✅ Created new punch log:');
    console.log(`   Date: ${log.date.toISOString().split('T')[0]}`);
    console.log(`   Punch In: ${log.punchIn}`);
    console.log(`   Punch Out: ${log.punchOut}`);
  }

  // Show all logs for Dennis
  const allLogs = await EmployeePunchLog.find({ employeeId: dennis._id })
    .sort({ date: -1 });
  
  console.log(`\n📊 Total logs for Dennis: ${allLogs.length}`);
  allLogs.forEach(log => {
    console.log(`  ${log.date.toISOString().split('T')[0]}: In=${log.punchIn ? new Date(log.punchIn).toLocaleTimeString() : '❌'} Out=${log.punchOut ? new Date(log.punchOut).toLocaleTimeString() : '❌'}`);
  });

  process.exit();
}

manualImport();