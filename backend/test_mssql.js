// test_mssql.js
const sql = require('mssql');

// Your local PC's IP (replace with your public IP or local IP)
// const LOCAL_PC_IP = '171.61.164.45'; 
const LOCAL_PC_IP = '192.168.1.100';  
const config = {
    user: 'sa',
    password: '123456',
    server: LOCAL_PC_IP,  // Use IP instead of hostname
    database: 'dmps',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        port: 1433
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

async function testConnection() {
    try {
        console.log('🔗 Testing MSSQL connection...');
        console.log(`📡 Server: ${config.server}`);
        console.log(`📡 Database: ${config.database}`);
        
        const pool = await sql.connect(config);
        console.log('✅ Connected successfully!');
        
        const result = await pool.request().query('SELECT COUNT(*) as count FROM DeviceLogs');
        console.log(`📊 Total logs: ${result.recordset[0].count}`);
        
        // Get last 5 logs
        const logs = await pool.request().query('SELECT TOP 5 * FROM DeviceLogs ORDER BY IOTime DESC');
        console.log('\n📋 Last 5 logs:');
        logs.recordset.forEach(log => {
            console.log(`   ${log.IOTime} - User: ${log.UserId} - ${log.IOMode}`);
        });
        
        await pool.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('   Make sure:');
        console.error('   1. Your local PC is running');
        console.error('   2. SQL Server is running');
        console.error('   3. Firewall allows port 1433');
        console.error('   4. You allowed remote connections in SQL Server');
    }
}

testConnection();