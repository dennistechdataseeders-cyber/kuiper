// backend/services/mssqlBiometricService.js
const sql = require('mssql');

// MSSQL Configuration
const config = {
    user: 'sa',
    password: '123456', 
    server: 'DESKTOP-IJ75FG8\\SQLEXPRESS',  
    database: 'dmpss',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
    },
    port: 1433,
    connectionTimeout: 30000,
    requestTimeout: 30000,
};

class MSSQLBiometricService {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    /**
     * Connect to MSSQL database
     */
    async connect() {
        try {
            if (this.isConnected && this.pool) {
                return this.pool;
            }

            console.log('🔗 Connecting to MSSQL Biometric Database...');
            this.pool = await sql.connect(config);
            this.isConnected = true;
            console.log('✅ Connected to MSSQL Biometric Database');
            return this.pool;
        } catch (error) {
            console.error('❌ MSSQL Connection Error:', error.message);
            throw error;
        }
    }

    /**
     * Get device logs by date range
     */
    async getDeviceLogs(fromDate, toDate, deviceKey = null) {
        try {
            await this.connect();
            
            let query = `
                SELECT 
                    Id,
                    DeviceKey,
                    UserId,
                    IOTime,
                    IOMode,
                    SystemIOMode,
                    VerifyMode,
                    WorkCode,
                    CreatedOn,
                    IsSync
                FROM DeviceLogs
                WHERE CAST(IOTime AS DATE) BETWEEN @fromDate AND @toDate
            `;
            
            const params = {
                fromDate: fromDate,
                toDate: toDate
            };

            if (deviceKey) {
                query += ` AND DeviceKey = @deviceKey`;
                params.deviceKey = deviceKey;
            }

            query += ` ORDER BY IOTime DESC`;

            const request = this.pool.request();
            
            // Add parameters
            request.input('fromDate', sql.Date, new Date(fromDate));
            request.input('toDate', sql.Date, new Date(toDate));
            if (deviceKey) {
                request.input('deviceKey', sql.VarChar, deviceKey);
            }

            const result = await request.query(query);
            
            console.log(`📊 Fetched ${result.recordset.length} logs from MSSQL`);
            return result.recordset;

        } catch (error) {
            console.error('❌ Error fetching device logs:', error.message);
            throw error;
        }
    }

    /**
     * Get employee codes from logs
     */
    async getEmployeeCodes(fromDate, toDate) {
        try {
            await this.connect();
            
            const query = `
                SELECT DISTINCT UserId as EmployeeCode
                FROM DeviceLogs
                WHERE CAST(IOTime AS DATE) BETWEEN @fromDate AND @toDate
                ORDER BY UserId
            `;

            const request = this.pool.request();
            request.input('fromDate', sql.Date, new Date(fromDate));
            request.input('toDate', sql.Date, new Date(toDate));

            const result = await request.query(query);
            return result.recordset.map(row => row.EmployeeCode);
            
        } catch (error) {
            console.error('❌ Error fetching employee codes:', error.message);
            throw error;
        }
    }

    /**
     * Get today's attendance for a specific employee
     */
    async getEmployeeTodayAttendance(employeeCode) {
        try {
            await this.connect();
            
            const today = new Date().toISOString().split('T')[0];
            
            const query = `
                SELECT 
                    UserId,
                    IOTime,
                    IOMode,
                    DeviceKey,
                    VerifyMode
                FROM DeviceLogs
                WHERE UserId = @employeeCode
                AND CAST(IOTime AS DATE) = @today
                ORDER BY IOTime
            `;

            const request = this.pool.request();
            request.input('employeeCode', sql.Int, parseInt(employeeCode));
            request.input('today', sql.Date, new Date(today));

            const result = await request.query(query);
            
            // Process logs into sessions
            return this.processLogsToSessions(result.recordset);
            
        } catch (error) {
            console.error('❌ Error fetching employee attendance:', error.message);
            throw error;
        }
    }

    /**
     * Process raw logs into sessions (IN/OUT pairs)
     */
    processLogsToSessions(logs) {
        if (!logs || logs.length === 0) {
            return { sessions: [], punchIn: null, punchOut: null };
        }

        const sessions = [];
        let currentSession = null;

        logs.forEach(log => {
            const time = new Date(log.IOTime);
            const mode = log.IOMode?.toLowerCase() || '';

            if (mode === 'in' || mode === '1') {
                if (currentSession) {
                    sessions.push(currentSession);
                }
                currentSession = { punchIn: time, punchOut: null };
            } else if (mode === 'out' || mode === '2') {
                if (currentSession) {
                    currentSession.punchOut = time;
                    sessions.push(currentSession);
                    currentSession = null;
                } else {
                    sessions.push({ punchIn: time, punchOut: time });
                }
            }
        });

        if (currentSession) {
            sessions.push(currentSession);
        }

        const punchIn = sessions.length > 0 ? sessions[0].punchIn : null;
        const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
        const punchOut = lastSession ? lastSession.punchOut : null;

        return { sessions, punchIn, punchOut };
    }

    /**
     * Sync attendance from MSSQL to MongoDB
     */
    async syncAttendanceToMongoDB(fromDate, toDate) {
        try {
            console.log(`🔄 Syncing attendance from ${fromDate} to ${toDate}`);
            
            // Get logs from MSSQL
            const logs = await this.getDeviceLogs(fromDate, toDate);
            
            if (!logs || logs.length === 0) {
                return {
                    success: true,
                    message: 'No logs found in MSSQL',
                    processed: 0,
                    synced: 0
                };
            }

            // Group logs by UserId
            const logsByEmployee = {};
            logs.forEach(log => {
                const userId = log.UserId;
                if (!logsByEmployee[userId]) {
                    logsByEmployee[userId] = [];
                }
                logsByEmployee[userId].push(log);
            });

            const User = require('../models/User');
            const EmployeePunchLog = require('../models/EmployeePunchLog');

            let syncedCount = 0;
            let processedCount = 0;

            // Process each employee's logs
            for (const [employeeCode, employeeLogs] of Object.entries(logsByEmployee)) {
                try {
                    // Find user by employee code
                    const user = await User.findOne({ employeeCode: employeeCode });
                    
                    if (!user) {
                        console.log(`⚠️ User not found for employee code: ${employeeCode}`);
                        continue;
                    }

                    // Group logs by date
                    const logsByDate = {};
                    employeeLogs.forEach(log => {
                        const dateStr = new Date(log.IOTime).toISOString().split('T')[0];
                        if (!logsByDate[dateStr]) {
                            logsByDate[dateStr] = [];
                        }
                        logsByDate[dateStr].push(log);
                    });

                    // Process each day's logs
                    for (const [dateStr, dayLogs] of Object.entries(logsByDate)) {
                        const date = new Date(dateStr + 'T00:00:00.000Z');
                        const processed = this.processLogsToSessions(dayLogs);
                        
                        // Save to MongoDB
                        const existing = await EmployeePunchLog.findOne({
                            employeeId: user._id,
                            date: date
                        });

                        if (existing) {
                            // Update existing
                            existing.sessions = processed.sessions;
                            existing.punchIn = processed.punchIn;
                            existing.punchOut = processed.punchOut;
                            existing.isManualCorrection = false;
                            existing.correctionNote = `Synced from MSSQL on ${new Date().toISOString()}`;
                            await existing.save();
                        } else {
                            // Create new
                            await EmployeePunchLog.create({
                                employeeId: user._id,
                                date: date,
                                sessions: processed.sessions,
                                punchIn: processed.punchIn,
                                punchOut: processed.punchOut,
                                isManualCorrection: false,
                                correctionNote: `Synced from MSSQL on ${new Date().toISOString()}`
                            });
                            syncedCount++;
                        }
                        processedCount++;
                    }
                } catch (err) {
                    console.error(`Error processing employee ${employeeCode}:`, err.message);
                }
            }

            return {
                success: true,
                message: `Synced ${syncedCount} records from MSSQL to MongoDB`,
                processed: processedCount,
                synced: syncedCount
            };

        } catch (error) {
            console.error('❌ Sync error:', error.message);
            throw error;
        }
    }

    /**
     * Test connection to MSSQL
     */
    async testConnection() {
        try {
            await this.connect();
            
            const query = `
                SELECT TOP 1 * FROM DeviceLogs
            `;
            const result = await this.pool.request().query(query);
            
            return {
                success: true,
                message: 'MSSQL Connection successful',
                sampleLogs: result.recordset.slice(0, 5),
                totalLogs: await this.getLogCount()
            };
        } catch (error) {
            return {
                success: false,
                message: `MSSQL Connection failed: ${error.message}`
            };
        }
    }

    /**
     * Get total log count
     */
    async getLogCount() {
        try {
            await this.connect();
            const result = await this.pool.request().query('SELECT COUNT(*) as count FROM DeviceLogs');
            return result.recordset[0].count;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Close connection
     */
    async close() {
        if (this.pool) {
            await this.pool.close();
            this.isConnected = false;
            console.log('🔌 MSSQL connection closed');
        }
    }
}

module.exports = new MSSQLBiometricService();