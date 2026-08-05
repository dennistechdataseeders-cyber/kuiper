// backend/check-biometric-employee-codes.js
const axios = require('axios');
require('dotenv').config();

async function checkBiometricEmployeeCodes() {
  console.log('🔍 CHECKING BIOMETRIC API - AVAILABLE EMPLOYEE CODES');
  console.log('═'.repeat(60));

  // Read config from .env
  const baseUrl = process.env.BIOMETRIC_API_URL ;
  const username = process.env.BIOMETRIC_USERNAME ;
  const password = process.env.BIOMETRIC_PASSWORD ;
  const deviceKey = process.env.BIOMETRIC_DEVICE_KEY ;

  console.log(`📋 Configuration:`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`   Username: ${username}`);
  console.log(`   Device Key: ${deviceKey}`);
  console.log('═'.repeat(60));

  let token = null;

  // ============================================
  // STEP 1: Login to get token
  // ============================================
  console.log('\n📡 STEP 1: Authenticating with biometric API...');
  
  try {
    const loginRes = await axios.post(`${baseUrl}/api/Auth/Login`, {
      Username: username,
      Password: password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    token = loginRes.data.Token || loginRes.data.token;
    
    if (!token) {
      console.error('❌ No token received in login response');
      console.log('📥 Response:', JSON.stringify(loginRes.data, null, 2));
      process.exit(1);
    }

    console.log('✅ Authentication successful');
    console.log(`   Token: ${token.substring(0, 30)}...`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Login failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }

  // ============================================
  // STEP 2: Fetch logs to get employee codes
  // ============================================
  console.log('\n📡 STEP 2: Fetching attendance logs...');

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 90); // Last 90 days to get more codes

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = today.toISOString().split('T')[0];

  console.log(`   Date range: ${fromStr} to ${toStr}`);

  try {
    const logsRes = await axios.get(`${baseUrl}/api/DeviceLog/GetAllLogsByDate`, {
      params: {
        FromDate: fromStr,
        ToDate: toStr,
        DeviceKey: deviceKey
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const logs = logsRes.data || [];
    console.log(`✅ Fetched ${logs.length} total logs`);

    if (logs.length === 0) {
      console.log('\n⚠️ No logs found for the selected date range');
      console.log('💡 Try increasing the date range or check if the device has data');
      process.exit(0);
    }

    // ============================================
    // STEP 3: Extract and analyze employee codes
    // ============================================
    console.log('\n📊 STEP 3: Analyzing employee codes...');

    // Map to store employee code data
    const employeeMap = new Map();

    logs.forEach(log => {
      const empCode = log.EmpCode || log.employeeCode;
      if (!empCode) return;

      const codeStr = String(empCode).trim();
      
      if (!employeeMap.has(codeStr)) {
        employeeMap.set(codeStr, {
          code: codeStr,
          userName: log.UserName || log.userName || 'Unknown',
          logCount: 0,
          firstSeen: log.IOTime || log.LogDate || log.date,
          lastSeen: log.IOTime || log.LogDate || log.date,
          deviceName: log.DeviceName || log.SerialNumber || 'Unknown',
          punchModes: new Set()
        });
      }

      const entry = employeeMap.get(codeStr);
      entry.logCount++;
      
      // Track punch modes (IN/OUT)
      const mode = log.IOMode || log.PunchDirection || 'unknown';
      entry.punchModes.add(mode);

      // Update last seen if newer
      const logTime = log.IOTime || log.LogDate || log.date;
      if (logTime && (!entry.lastSeen || new Date(logTime) > new Date(entry.lastSeen))) {
        entry.lastSeen = logTime;
      }
    });

    // Convert to array and sort by code
    const employees = Array.from(employeeMap.values())
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    // ============================================
    // STEP 4: Display results
    // ============================================
    console.log('\n📋 EMPLOYEE CODES SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total unique employee codes: ${employees.length}`);
    console.log(`   Total logs processed: ${logs.length}`);
    console.log('═'.repeat(60));

    console.log('\n📋 DETAILED LIST OF EMPLOYEE CODES:');
    console.log('─'.repeat(60));
    
    // Create a formatted table
    console.log('│ Code │ User Name │ Logs │ First Seen │ Last Seen │');
    console.log('─'.repeat(60));

    employees.forEach(emp => {
      const code = emp.code.padEnd(10);
      const name = (emp.userName || 'Unknown').substring(0, 15).padEnd(15);
      const logCount = String(emp.logCount).padEnd(5);
      const firstSeen = emp.firstSeen ? new Date(emp.firstSeen).toISOString().split('T')[0] : 'N/A';
      const lastSeen = emp.lastSeen ? new Date(emp.lastSeen).toISOString().split('T')[0] : 'N/A';
      
      console.log(`│ ${code} │ ${name} │ ${logCount} │ ${firstSeen} │ ${lastSeen} │`);
    });

    console.log('─'.repeat(60));

    // ============================================
    // STEP 5: Check against database users
    // ============================================
    console.log('\n📡 STEP 4: Checking against database users...');
    
    try {
      const mongoose = require('mongoose');
      const User = require('./models/User');
      
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');

      const dbUsers = await User.find({ 
        employeeCode: { $ne: null, $ne: '' } 
      }).select('name email employeeCode role');

      console.log(`\n📊 Database users with employee codes: ${dbUsers.length}`);

      // Create a map of database employee codes
      const dbCodeMap = new Map();
      dbUsers.forEach(user => {
        if (user.employeeCode) {
          dbCodeMap.set(String(user.employeeCode).trim(), user);
        }
      });

      // Check which biometric codes exist in database
      console.log('\n🔍 Matching biometric codes with database users:');
      console.log('─'.repeat(60));
      console.log('│ Code │ DB User │ Status │ Role │');
      console.log('─'.repeat(60));

      const matchedCodes = [];
      const unmatchedCodes = [];

      employees.forEach(emp => {
        const dbUser = dbCodeMap.get(emp.code);
        if (dbUser) {
          matchedCodes.push(emp.code);
          const name = dbUser.name.substring(0, 20).padEnd(20);
          console.log(`│ ${emp.code.padEnd(10)} │ ${name} │ ✅ MATCHED │ ${dbUser.role || 'N/A'} │`);
        } else {
          unmatchedCodes.push(emp.code);
          console.log(`│ ${emp.code.padEnd(10)} │ ${'—'.padEnd(20)} │ ❌ MISSING │ — │`);
        }
      });

      console.log('─'.repeat(60));

      console.log('\n📊 SUMMARY:');
      console.log(`   ✅ Matched codes: ${matchedCodes.length}`);
      console.log(`   ❌ Unmatched codes: ${unmatchedCodes.length}`);

      if (unmatchedCodes.length > 0) {
        console.log('\n⚠️ UNMATCHED CODES:');
        console.log(`   ${unmatchedCodes.join(', ')}`);
        console.log('\n💡 These codes exist in the biometric device but not in your database.');
        console.log('   To add them, create users with these employee codes.');
      }

      // Show database users without biometric logs
      console.log('\n🔍 Database users WITHOUT biometric logs:');
      console.log('─'.repeat(60));
      
      const dbCodesSet = new Set(dbUsers.map(u => String(u.employeeCode).trim()));
      const biometricCodesSet = new Set(employees.map(e => e.code));
      
      const usersWithoutBiometric = dbUsers.filter(user => {
        const code = String(user.employeeCode).trim();
        return !biometricCodesSet.has(code);
      });

      if (usersWithoutBiometric.length > 0) {
        console.log(`   ${usersWithoutBiometric.length} users found without biometric logs:`);
        usersWithoutBiometric.forEach(user => {
          console.log(`   ❌ ${user.name} (${user.email}) - Code: ${user.employeeCode} - Role: ${user.role}`);
        });
      } else {
        console.log('   ✅ All database users have biometric logs!');
      }

      console.log('═'.repeat(60));

      await mongoose.disconnect();

    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
    }

    // ============================================
    // STEP 6: Additional stats
    // ============================================
    console.log('\n📊 ADDITIONAL STATISTICS:');
    console.log('═'.repeat(60));
    
    // Most active employee
    const mostActive = employees.reduce((a, b) => a.logCount > b.logCount ? a : b);
    console.log(`   Most active employee: ${mostActive.code} (${mostActive.userName}) - ${mostActive.logCount} logs`);
    
    // Punch mode statistics
    let totalIn = 0;
    let totalOut = 0;
    let totalUnknown = 0;
    
    logs.forEach(log => {
      const mode = log.IOMode || log.PunchDirection || 'unknown';
      const modeStr = String(mode).toLowerCase();
      if (modeStr === 'in' || modeStr === '1') totalIn++;
      else if (modeStr === 'out' || modeStr === '2') totalOut++;
      else totalUnknown++;
    });

    console.log(`   Total IN punches: ${totalIn}`);
    console.log(`   Total OUT punches: ${totalOut}`);
    console.log(`   Unknown punches: ${totalUnknown}`);
    
    console.log('\n✅ Scan complete!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error fetching logs:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
checkBiometricEmployeeCodes();