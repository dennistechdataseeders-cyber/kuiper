// backend/sync-dennis-fixed.js
const mongoose = require('mongoose');
require('dotenv').config();
const axios = require('axios');

async function syncDennisFixed() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const EmployeePunchLog = require('./models/EmployeePunchLog');
  const User = require('./models/User');

  // Find Dennis
  const dennis = await User.findOne({ email: 'dennis.techdataseeders@gmail.com' });
  if (!dennis) {
    console.log('❌ Dennis not found');
    process.exit();
  }

  console.log(`👤 Syncing for: ${dennis.name} (EmpCode: ${dennis.employeeCode})`);
  console.log('═'.repeat(50));

  // Fetch logs from biometric API
  const baseUrl = process.env.BIOMETRIC_API_URL || 'http://103.170.149.84:2000';
  const username = process.env.BIOMETRIC_USERNAME || 'biomax';
  const password = process.env.BIOMETRIC_PASSWORD || 'biomax';
  const deviceKey = process.env.BIOMETRIC_DEVICE_KEY || 'C2642CA867382C34';

  // Login
  console.log('📡 Logging in...');
  const loginRes = await axios.post(`${baseUrl}/api/Auth/Login`, {
    Username: username,
    Password: password
  });
  const token = loginRes.data.Token;
  console.log('✅ Login successful');

  // Fetch logs - last 30 days
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = today.toISOString().split('T')[0];

  console.log(`📡 Fetching logs from ${fromStr} to ${toStr}...`);
  const logsRes = await axios.get(`${baseUrl}/api/DeviceLog/GetAllLogsByDate`, {
    params: {
      FromDate: fromStr,
      ToDate: toStr,
      DeviceKey: deviceKey
    },
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Filter for Dennis
  const dennisLogs = logsRes.data.filter(log => String(log.EmpCode) === String(dennis.employeeCode));
  console.log(`📊 Found ${dennisLogs.length} logs for Dennis`);

  if (dennisLogs.length === 0) {
    console.log('❌ No logs found. Check if Dennis has punched in recently.');
    console.log(`   Available codes: ${[...new Set(logsRes.data.map(l => l.EmpCode))].join(', ')}`);
    process.exit();
  }

  // Group logs by date
  const logsByDate = {};
  dennisLogs.forEach(log => {
    const date = new Date(log.IOTime);
    const dateStr = date.toISOString().split('T')[0];
    if (!logsByDate[dateStr]) {
      logsByDate[dateStr] = [];
    }
    logsByDate[dateStr].push(log);
  });

  console.log(`\n📋 Logs by date:`);
  Object.keys(logsByDate).sort().forEach(date => {
    const dayLogs = logsByDate[date];
    const ins = dayLogs.filter(l => l.IOMode?.toLowerCase() === 'in').length;
    const outs = dayLogs.filter(l => l.IOMode?.toLowerCase() === 'out').length;
    console.log(`  ${date}: ${dayLogs.length} logs (${ins} in, ${outs} out)`);
  });

  // Process each day
  let created = 0;
  let updated = 0;

  for (const [dateStr, dayLogs] of Object.entries(logsByDate)) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    // Find earliest IN and latest OUT
    const inLogs = dayLogs.filter(l => l.IOMode?.toLowerCase() === 'in');
    const outLogs = dayLogs.filter(l => l.IOMode?.toLowerCase() === 'out');

    let punchIn = null;
    let punchOut = null;

    if (inLogs.length > 0) {
      // Earliest IN
      punchIn = new Date(Math.min(...inLogs.map(l => new Date(l.IOTime).getTime())));
    }

    if (outLogs.length > 0) {
      // Latest OUT
      punchOut = new Date(Math.max(...outLogs.map(l => new Date(l.IOTime).getTime())));
    }

    // If no IN but has OUT, use the earliest OUT as IN
    if (!punchIn && outLogs.length > 0) {
      punchIn = new Date(Math.min(...outLogs.map(l => new Date(l.IOTime).getTime())));
    }

    // If no OUT but has IN, use the latest IN as OUT
    if (!punchOut && inLogs.length > 0) {
      punchOut = new Date(Math.max(...inLogs.map(l => new Date(l.IOTime).getTime())));
    }

    // Check if log exists
    const existing = await EmployeePunchLog.findOne({
      employeeId: dennis._id,
      date: date
    });

    if (existing) {
      // Update existing
      if (punchIn) existing.punchIn = punchIn;
      if (punchOut) existing.punchOut = punchOut;
      existing.isManualCorrection = false;
      existing.correctionNote = `Synced from device: ${dayLogs[0].DeviceName || 'Unknown'}`;
      await existing.save();
      updated++;
      console.log(`✅ Updated ${dateStr}: In=${punchIn?.toLocaleTimeString() || '❌'} Out=${punchOut?.toLocaleTimeString() || '❌'}`);
    } else {
      // Create new
      await EmployeePunchLog.create({
        employeeId: dennis._id,
        punchIn: punchIn,
        punchOut: punchOut,
        date: date,
        isManualCorrection: false,
        correctionNote: `Synced from device: ${dayLogs[0].DeviceName || 'Unknown'}`,
        createdBy: null
      });
      created++;
      console.log(`✅ Created ${dateStr}: In=${punchIn?.toLocaleTimeString() || '❌'} Out=${punchOut?.toLocaleTimeString() || '❌'}`);
    }
  }

  console.log(`\n✅ Sync complete! Created: ${created}, Updated: ${updated}`);

  // Show final results
  const finalLogs = await EmployeePunchLog.find({ employeeId: dennis._id })
    .sort({ date: -1 });

  console.log(`\n📊 Total logs for Dennis: ${finalLogs.length}`);
  finalLogs.forEach(log => {
    const dateStr = log.date.toISOString().split('T')[0];
    const inStr = log.punchIn ? new Date(log.punchIn).toLocaleTimeString() : '❌';
    const outStr = log.punchOut ? new Date(log.punchOut).toLocaleTimeString() : '❌';
    console.log(`  ${dateStr}: In=${inStr} Out=${outStr}`);
  });

  process.exit();
}

syncDennisFixed();