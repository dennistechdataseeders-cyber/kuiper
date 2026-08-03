// backend/test-connection.js
const axios = require('axios');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 TESTING BIOMETRIC API CONNECTION');
  console.log('═'.repeat(50));
  
  // Read config from .env
  const baseUrl = process.env.BIOMETRIC_API_URL || 'http://103.170.149.84:2000';
  const username = process.env.BIOMETRIC_USERNAME || 'biomax';
  const password = process.env.BIOMETRIC_PASSWORD || 'biomax';
  const deviceKey = process.env.BIOMETRIC_DEVICE_KEY || 'C2642CA867382C34';

  console.log(`📋 Configuration:`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${'*'.repeat(password.length)}`);
  console.log(`   Device Key: ${deviceKey}`);
  console.log('═'.repeat(50));

  // Test 1: Basic network check
  console.log('\n📡 Test 1: Network connectivity...');
  try {
    const pingTest = await axios.get(`${baseUrl}`, { 
      timeout: 5000 
    }).catch(() => null);
    console.log(`   ✅ Server is reachable (status: ${pingTest?.status || 'unknown'})`);
  } catch (e) {
    console.log(`   ❌ Server not reachable: ${e.message}`);
    console.log(`   💡 Check if the URL is correct and the server is running`);
  }

  // Test 2: Login
  console.log('\n📡 Test 2: Authentication...');
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

    console.log(`   ✅ Login successful (status: ${loginRes.status})`);
    console.log(`   📥 Response keys:`, Object.keys(loginRes.data));
    
    // Find token in response
    const token = loginRes.data.Token || 
                  loginRes.data.token || 
                  loginRes.data.accessToken ||
                  loginRes.data.data?.Token ||
                  loginRes.data.data?.token;
    
    if (token) {
      console.log(`   ✅ Token obtained: ${token.substring(0, 20)}...`);
      
      // Test 3: Fetch logs
      console.log('\n📡 Test 3: Fetching attendance logs...');
      const today = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const fromDateStr = fromDate.toISOString().split('T')[0];
      
      console.log(`   📅 Date range: ${fromDateStr} to ${today}`);
      
      try {
        const logsRes = await axios.get(`${baseUrl}/api/DeviceLog/GetAllLogsByDate`, {
          params: {
            FromDate: fromDateStr,
            ToDate: today,
            DeviceKey: deviceKey
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        });
        
        console.log(`   ✅ Logs fetched successfully`);
        console.log(`   📊 Total logs: ${logsRes.data?.length || 0}`);
        
        if (logsRes.data && logsRes.data.length > 0) {
          console.log(`\n   📋 Sample log (first record):`);
          console.log(`   ${JSON.stringify(logsRes.data[0], null, 4)}`);
          
          // Show unique employee codes
          const codes = [...new Set(logsRes.data.map(l => l.EmpCode || l.employeeCode).filter(Boolean))];
          console.log(`\n   👥 Employee codes found: ${codes.join(', ')}`);
        } else {
          console.log(`   ⚠️ No logs found. Try a different date range.`);
        }
        
      } catch (logError) {
        console.log(`   ❌ Failed to fetch logs:`);
        console.log(`   ${logError.message}`);
        if (logError.response) {
          console.log(`   Status: ${logError.response.status}`);
          console.log(`   Data:`, logError.response.data);
        }
      }
      
    } else {
      console.log(`   ❌ No token found in response`);
      console.log(`   📥 Full response:`, JSON.stringify(loginRes.data, null, 2));
    }
    
  } catch (loginError) {
    console.log(`   ❌ Login failed:`);
    console.log(`   ${loginError.message}`);
    if (loginError.response) {
      console.log(`   Status: ${loginError.response.status}`);
      console.log(`   Data:`, loginError.response.data);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Test complete');
}

testConnection();