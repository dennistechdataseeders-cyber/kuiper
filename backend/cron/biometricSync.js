// backend/cron/biometricSync.js
const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const User = require('../models/User');

// ✅ FIX: Load environment variables with correct path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class BiometricSyncService {
  constructor() {
    this.baseUrl = process.env.BIOMETRIC_API_URL;
    this.username = process.env.BIOMETRIC_USERNAME;
    this.password = process.env.BIOMETRIC_PASSWORD;
    this.deviceKey = process.env.BIOMETRIC_DEVICE_KEY;
    this.token = null;
    this.tokenExpiry = null;
    this.isRunning = false;
    this.dbConnected = false;
  }

  async connectDB() {
    if (this.dbConnected) return;

    try {
      const MONGO_URI = process.env.MONGO_URI;
      if (!MONGO_URI) {
        throw new Error('MONGO_URI not found in environment variables');
      }

      console.log('🔄 Connecting to MongoDB...');

      // Use the same connection options as server.js
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
      });

      this.dbConnected = true;
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async getAuthToken() {
    try {
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 10 * 60 * 1000) {
        return this.token;
      }

      console.log('🔑 Getting new auth token...');
      const response = await axios.post(`${this.baseUrl}/api/Auth/Login`, {
        Username: this.username,
        Password: this.password
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const token = response.data.Token || response.data.token;
      if (token) {
        this.token = token;
        this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
        console.log('✅ Auth token obtained');
        return token;
      }
      throw new Error('No token in response');
    } catch (error) {
      console.error('❌ Failed to get auth token:', error.message);
      return null;
    }
  }

  async fetchAttendanceLogs(fromDate, toDate) {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No valid token');

      const response = await axios.get(`${this.baseUrl}/api/DeviceLog/GetAllLogsByDate`, {
        params: {
          FromDate: fromDate,
          ToDate: toDate,
          DeviceKey: this.deviceKey
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch logs:', error.message);
      return [];
    }
  }

  getDateStringFromPunch(punchTime) {
    if (!punchTime) return null;
    return punchTime.split('T')[0];
  }

  createDateFromString(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  buildSessionsFromDayLogs(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) {
      return {
        sessions: [],
        punchIn: null,
        punchOut: null,
        logCount: 0,
        sessionCount: 0
      };
    }

    const sortedLogs = [...dayLogs].sort((a, b) => {
      const tA = new Date(a.IOTime || a.LogDate || a.date).getTime();
      const tB = new Date(b.IOTime || b.LogDate || b.date).getTime();
      return tA - tB;
    });

    const sessions = [];
    let currentSession = null;

    for (const log of sortedLogs) {
      const logTime = new Date(log.IOTime || log.LogDate || log.date);
      const direction = (log.IOMode || log.PunchDirection || log.mode || '').toString().toLowerCase();

      if (direction === 'in' || direction === '1') {
        if (currentSession) {
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          console.log(`⚠️ Consecutive IN without OUT: closing previous session at ${logTime.toISOString()}`);
        }
        currentSession = { punchIn: logTime, punchOut: null };
      } else if (direction === 'out' || direction === '2') {
        if (currentSession) {
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          currentSession = null;
        } else {
          console.log(`⚠️ Orphan OUT log detected: creating session at ${logTime.toISOString()}`);
          sessions.push({ punchIn: logTime, punchOut: logTime });
        }
      } else {
        if (!currentSession) {
          currentSession = { punchIn: logTime, punchOut: null };
        } else {
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          currentSession = null;
        }
      }
    }

    if (currentSession) {
      sessions.push(currentSession);
    }

    const firstIn = sessions.length > 0 ? sessions[0].punchIn : null;
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const lastOut = lastSession ? lastSession.punchOut : null;

    if (sessions.length > 1) {
      console.log(`📊 Built ${sessions.length} sessions from ${sortedLogs.length} logs`);
    }

    return {
      sessions,
      punchIn: firstIn,
      punchOut: lastOut,
      logCount: sortedLogs.length,
      sessionCount: sessions.length
    };
  }

  async syncAttendance() {
    if (this.isRunning) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 Starting biometric sync at ${new Date().toISOString()}`);

    try {
      // ✅ FIX: Ensure database connection is established
      await this.connectDB();

      // Get all active users with employee codes
      const users = await User.find({
        employeeCode: { $ne: null, $ne: '' },
        isActive: true
      });

      if (users.length === 0) {
        console.log('⚠️ No users with employee codes found');
        this.isRunning = false;
        return;
      }

      console.log(`👤 Found ${users.length} users with employee codes`);

      // Build employee code map
      const userMap = {};
      users.forEach(u => {
        userMap[String(u.employeeCode)] = u;
      });

      const today = new Date();
      const fromDate = new Date('2026-06-11');
      const toStr = today.toISOString().split('T')[0];
      const fromStr = fromDate.toISOString().split('T')[0];

      console.log(`📡 Fetching logs from ${fromStr} to ${toStr}...`);
      const logs = await this.fetchAttendanceLogs(fromStr, toStr);

      if (!logs || logs.length === 0) {
        console.log('⚠️ No logs found');
        this.isRunning = false;
        return;
      }

      console.log(`📊 Found ${logs.length} total logs`);

      // Group logs by employee code
      const logsByEmployee = {};
      let unmatchedLogs = 0;

      logs.forEach(log => {
        const empCode = String(log.EmpCode || log.employeeCode);
        if (!empCode) {
          unmatchedLogs++;
          return;
        }

        if (!userMap[empCode]) {
          if (!logsByEmployee[`_unmatched_${empCode}`]) {
            logsByEmployee[`_unmatched_${empCode}`] = [];
          }
          logsByEmployee[`_unmatched_${empCode}`].push(log);
          return;
        }

        if (!logsByEmployee[empCode]) {
          logsByEmployee[empCode] = [];
        }
        logsByEmployee[empCode].push(log);
      });

      // Log unmatched codes for debugging
      const unmatchedCodes = Object.keys(logsByEmployee).filter(k => k.startsWith('_unmatched_'));
      if (unmatchedCodes.length > 0) {
        console.log(`⚠️ Found ${unmatchedLogs} logs for unknown employee codes:`,
          unmatchedCodes.map(k => k.replace('_unmatched_', '')));
      }

      console.log(`👥 Processing ${Object.keys(logsByEmployee).filter(k => !k.startsWith('_unmatched_')).length} employees`);

      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      // Process each employee's logs
      for (const [empCode, employeeLogs] of Object.entries(logsByEmployee)) {
        if (empCode.startsWith('_unmatched_')) continue;

        const user = userMap[empCode];
        if (!user) continue;

        const logsByDate = {};
        employeeLogs.forEach(log => {
          const punchTime = log.IOTime || log.LogDate;
          if (!punchTime) return;
          const dateStr = this.getDateStringFromPunch(punchTime);
          if (!dateStr) return;

          if (!logsByDate[dateStr]) {
            logsByDate[dateStr] = [];
          }
          logsByDate[dateStr].push(log);
        });

        for (const [dateStr, dayLogs] of Object.entries(logsByDate)) {
          const date = this.createDateFromString(dateStr);
          if (!date) continue;

          const { sessions, punchIn, punchOut, logCount, sessionCount } =
            this.buildSessionsFromDayLogs(dayLogs);

          if (sessions.length === 0) continue;

          // Check if record exists for this date
          const existing = await EmployeePunchLog.findOne({
            employeeId: user._id,
            date: date
          });

          const note = `Auto-synced: ${sessionCount} sessions from ${logCount} logs`;

          if (existing) {
            existing.sessions = sessions;
            existing.punchIn = punchIn;
            existing.punchOut = punchOut;
            existing.isManualCorrection = false;
            existing.correctionNote = note;
            await existing.save();
            totalUpdated++;

            if (sessionCount > 1) {
              console.log(`🔄 Updated ${user.name} (${empCode}) for ${dateStr} (${sessionCount} sessions, ${logCount} logs)`);
            } else {
              console.log(`🔄 Updated ${user.name} (${empCode}) for ${dateStr} (1 session, ${logCount} logs)`);
            }
          } else {
            await EmployeePunchLog.create({
              employeeId: user._id,
              date: date,
              sessions: sessions,
              punchIn: punchIn,
              punchOut: punchOut,
              isManualCorrection: false,
              correctionNote: note,
              createdBy: null
            });
            totalCreated++;

            if (sessionCount > 1) {
              console.log(`✅ Created ${user.name} (${empCode}) for ${dateStr} (${sessionCount} sessions, ${logCount} logs)`);
            } else {
              console.log(`✅ Created ${user.name} (${empCode}) for ${dateStr} (1 session, ${logCount} logs)`);
            }
          }
        }
      }

      console.log(`✅ Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);

    } catch (error) {
      console.error('❌ Sync error:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } finally {
      this.isRunning = false;
    }
  }
}

// Create singleton instance
const syncService = new BiometricSyncService();

// ✅ FIX: Connect to database before starting cron
async function initialize() {
  try {
    console.log('🚀 Initializing Biometric Sync Service...');
    await syncService.connectDB();

    console.log('✅ Biometric Sync Service initialized successfully');
    console.log('⏰ Biometric sync scheduled every 15 minutes');

    // Run initial sync after 30 seconds
    setTimeout(() => {
      console.log('🚀 Running initial biometric sync...');
      syncService.syncAttendance();
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to initialize Biometric Sync Service:', error.message);
    process.exit(1);
  }
}

// Schedule sync every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('⏰ Running scheduled biometric sync...');
  await syncService.syncAttendance();
}, {
  timezone: "Asia/Kolkata"
});

// Start the service
initialize();

module.exports = syncService;