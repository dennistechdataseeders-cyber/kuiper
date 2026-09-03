// backend/services/biometricAttendanceService.js
const axios = require('axios');
const User = require('../models/User');
const EmployeePunchLog = require('../models/EmployeePunchLog');

class BiometricAttendanceService {
  constructor() {
    this.baseUrl = process.env.BIOMETRIC_API_URL || 'http://192.168.1.100:81/api';
    this.username = process.env.BIOMETRIC_USERNAME || 'biomax';
    this.password = process.env.BIOMETRIC_PASSWORD || 'biomax';
    this.deviceKey = process.env.BIOMETRIC_DEVICE_KEY || 'C2642CA867382C34';
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Login to biometric API and get token
   * @returns {Promise<string>} - JWT token
   */
  async login() {
    try {
      console.log('🔐 Logging into biometric API...');
      
      const response = await axios.post(`${this.baseUrl}/Auth/Login`, {
        Username: this.username,
        Password: this.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.Token) {
        this.token = response.data.Token;
        // Token expires in 24 hours, set expiry to 23 hours to be safe
        this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
        console.log('✅ Biometric API login successful');
        return this.token;
      } else {
        throw new Error('No token received from biometric API');
      }
    } catch (error) {
      console.error('❌ Biometric API login failed:', error.message);
      throw new Error(`Biometric API login failed: ${error.message}`);
    }
  }

  /**
   * Get valid token (login if needed)
   * @returns {Promise<string>} - Valid JWT token
   */
  async getValidToken() {
    const now = Date.now();
    if (!this.token || !this.tokenExpiry || now >= this.tokenExpiry) {
      await this.login();
    }
    return this.token;
  }

  /**
   * Get attendance logs for a date range
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @param {string} deviceKey - Optional device key (defaults to configured)
   * @returns {Promise<Array>} - Array of attendance logs
   */
  async getAttendanceLogs(fromDate, toDate, deviceKey = null) {
    try {
      const token = await this.getValidToken();
      const device = deviceKey || this.deviceKey;
      
      console.log(`📡 Fetching attendance logs from ${fromDate} to ${toDate} for device ${device}`);
      
      const url = `${this.baseUrl}/DeviceLog/GetAllLogsByDate`;
      const response = await axios.get(url, {
        params: {
          FromDate: fromDate,
          ToDate: toDate,
          DeviceKey: device
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const logs = response.data || [];
      console.log(`✅ Received ${logs.length} attendance logs`);
      return logs;
    } catch (error) {
      console.error('❌ Failed to fetch attendance logs:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  /**
   * Get the date string directly from the API timestamp
   * WITHOUT any timezone conversion
   */
  getDateStringFromPunch(punchTime) {
    if (!punchTime) return null;
    return punchTime.split('T')[0];
  }

  /**
   * Create a date at midnight UTC using the date string
   * This ensures the stored date matches the API date
   */
  createDateFromString(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  /**
   * Processes raw daily logs into chronologically paired session objects.
   * Handles missing OUT punches, consecutive INs, and open trailing sessions.
   * 
   * @param {Array} dayLogs - Array of raw log objects for a single day
   * @returns {Object} - { sessions, punchIn, punchOut, logCount, sessionCount }
   */
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

    // Sort logs chronologically
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
        // Punch IN
        if (currentSession) {
          // Consecutive IN without an intermediate OUT: close previous session at this timestamp
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          console.log(`⚠️ Consecutive IN without OUT: closing previous session at ${logTime.toISOString()}`);
        }
        currentSession = { punchIn: logTime, punchOut: null };
      } else if (direction === 'out' || direction === '2') {
        // Punch OUT
        if (currentSession) {
          // Normal case: close the current session
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          currentSession = null;
        } else {
          // Orphan OUT log: create a closed session starting at this punchOut
          console.log(`⚠️ Orphan OUT log detected: creating session at ${logTime.toISOString()}`);
          sessions.push({ punchIn: logTime, punchOut: logTime });
        }
      } else {
        // Fallback for logs without explicit IOMode
        if (!currentSession) {
          currentSession = { punchIn: logTime, punchOut: null };
        } else {
          currentSession.punchOut = logTime;
          sessions.push(currentSession);
          currentSession = null;
        }
      }
    }

    // Trailing open session (active shift / missing final OUT)
    if (currentSession) {
      sessions.push(currentSession);
    }

    // Derive first IN and last OUT from sessions
    const firstIn = sessions.length > 0 ? sessions[0].punchIn : null;
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const lastOut = lastSession ? lastSession.punchOut : null;

    return {
      sessions,
      punchIn: firstIn,
      punchOut: lastOut,
      logCount: sortedLogs.length,
      sessionCount: sessions.length
    };
  }

  /**
   * Sync attendance logs to the database with full session support
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @returns {Promise<Object>} - Sync results
   */
  async syncAttendanceLogs(fromDate, toDate) {
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: [],
      logs: [],
      sessionStats: {
        totalSessions: 0,
        multiSessionDays: 0,
        singleSessionDays: 0
      }
    };

    try {
      // Fetch logs from biometric API
      const logs = await this.getAttendanceLogs(fromDate, toDate);
      
      if (!logs || logs.length === 0) {
        return {
          ...results,
          message: 'No logs found for the specified date range'
        };
      }

      // Group logs by employee code
      const logsByEmployee = {};
      logs.forEach(log => {
        const empCode = log.EmpCode || log.empCode;
        if (!empCode) return;
        
        if (!logsByEmployee[empCode]) {
          logsByEmployee[empCode] = [];
        }
        logsByEmployee[empCode].push(log);
      });

      // Process each employee's logs
      for (const [empCode, employeeLogs] of Object.entries(logsByEmployee)) {
        try {
          // Find the user by employee code
          const user = await User.findOne({ employeeCode: empCode });
          
          if (!user) {
            console.warn(`⚠️ User not found for employee code: ${empCode}`);
            results.errors.push({
              employeeCode: empCode,
              error: 'User not found',
              logs: employeeLogs.length
            });
            continue;
          }

          // Group logs by date
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

          // Process each day's logs
          for (const [dateStr, dayLogs] of Object.entries(logsByDate)) {
            try {
              const date = this.createDateFromString(dateStr);
              if (!date) continue;

              // Build sessions from day logs
              const { 
                sessions, 
                punchIn, 
                punchOut, 
                logCount, 
                sessionCount 
              } = this.buildSessionsFromDayLogs(dayLogs);

              if (sessions.length === 0) continue;

              // Update session stats
              results.sessionStats.totalSessions += sessionCount;
              if (sessionCount > 1) {
                results.sessionStats.multiSessionDays++;
              } else {
                results.sessionStats.singleSessionDays++;
              }

              // Check if a log already exists for this day
              const existingLog = await EmployeePunchLog.findOne({
                employeeId: user._id,
                date: date
              });

              const note = `Auto-synced: ${sessionCount} sessions from ${logCount} logs`;

              if (existingLog) {
                // Update existing log with sessions
                existingLog.sessions = sessions;
                existingLog.punchIn = punchIn;
                existingLog.punchOut = punchOut;
                existingLog.isManualCorrection = false;
                existingLog.correctionNote = note;
                await existingLog.save();
                results.updated++;
                results.processed++;
                
                results.logs.push({
                  employeeCode: empCode,
                  userName: user.name,
                  date: dateStr,
                  action: 'updated',
                  sessionCount: sessionCount,
                  logCount: logCount
                });
              } else {
                // Create new log with sessions
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
                results.created++;
                results.processed++;
                
                results.logs.push({
                  employeeCode: empCode,
                  userName: user.name,
                  date: dateStr,
                  action: 'created',
                  sessionCount: sessionCount,
                  logCount: logCount
                });
              }
            } catch (dayError) {
              console.error(`Error processing day ${dateStr} for ${empCode}:`, dayError.message);
              results.errors.push({
                employeeCode: empCode,
                date: dateStr,
                error: dayError.message
              });
            }
          }
        } catch (err) {
          console.error(`Error processing employee ${empCode}:`, err.message);
          results.errors.push({
            employeeCode: empCode,
            error: err.message
          });
        }
      }

      console.log(`📊 Session Stats: ${results.sessionStats.totalSessions} total sessions, ${results.sessionStats.multiSessionDays} multi-session days, ${results.sessionStats.singleSessionDays} single-session days`);

      return {
        ...results,
        message: `Processed ${results.processed} attendance records with ${results.sessionStats.totalSessions} sessions`
      };
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Get attendance summary for an employee (UPDATED with session support)
   * @param {string} userId - User ID
   * @param {string} startDate - YYYY-MM-DD format
   * @param {string} endDate - YYYY-MM-DD format
   * @returns {Promise<Object>} - Attendance summary
   */
  async getEmployeeAttendanceSummary(userId, startDate, endDate) {
    try {
      const logs = await EmployeePunchLog.find({
        employeeId: userId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).sort({ date: 1 });

      const summary = {
        totalDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        totalEffectiveHours: 0,
        totalGrossHours: 0,
        averageEffectiveHours: 0,
        averageGrossHours: 0,
        days: []
      };

      // Calculate working days (weekdays only)
      const start = new Date(startDate);
      const end = new Date(endDate);
      let workingDays = 0;
      const current = new Date(start);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      summary.totalDays = workingDays;

      // Process logs by date
      const logsByDate = {};
      logs.forEach(log => {
        const dateStr = log.date.toISOString().split('T')[0];
        if (!logsByDate[dateStr]) {
          logsByDate[dateStr] = [];
        }
        logsByDate[dateStr].push(log);
      });

      // Calculate daily stats
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isWeekend) {
          const dayLogs = logsByDate[dateStr] || [];
          const dayLog = dayLogs[0]; // There should only be one per day due to unique constraint
          
          let status = 'absent';
          let effectiveHours = 0;
          let grossHours = 0;
          let punchIn = null;
          let punchOut = null;
          let sessions = [];
          
          if (dayLog) {
            // Use sessions if available
            if (dayLog.sessions && dayLog.sessions.length > 0) {
              sessions = dayLog.sessions;
              let firstIn = null;
              let lastOut = null;
              
              // Calculate effective hours (sum of all completed sessions)
              for (const session of sessions) {
                if (session.punchIn) {
                  if (!firstIn || session.punchIn < firstIn) firstIn = session.punchIn;
                  if (session.punchOut) {
                    effectiveHours += (session.punchOut - session.punchIn) / (1000 * 60 * 60);
                    if (!lastOut || session.punchOut > lastOut) lastOut = session.punchOut;
                  }
                }
              }
              
              if (firstIn && lastOut) {
                grossHours = (lastOut - firstIn) / (1000 * 60 * 60);
              } else if (sessions.length === 1 && sessions[0].punchIn) {
                grossHours = effectiveHours;
              }
              
              if (sessions.length > 0 && sessions[0].punchIn) {
                punchIn = sessions[0].punchIn;
                if (sessions[sessions.length - 1].punchOut) {
                  punchOut = sessions[sessions.length - 1].punchOut;
                }
              }
            } else if (dayLog.punchIn) {
              // Fallback for legacy data (no sessions)
              punchIn = dayLog.punchIn;
              punchOut = dayLog.punchOut;
              if (punchIn && punchOut) {
                effectiveHours = (punchOut - punchIn) / (1000 * 60 * 60);
                grossHours = effectiveHours;
                sessions = [{ punchIn, punchOut }];
              }
            }
            
            if (effectiveHours > 0) {
              status = 'present';
              summary.present++;
              summary.totalEffectiveHours += effectiveHours;
              summary.totalGrossHours += grossHours;
              
              // Check for late arrival (after 10:45 AM UTC)
              if (punchIn) {
                const punchInHour = new Date(punchIn).getUTCHours();
                const punchInMinute = new Date(punchIn).getUTCMinutes();
                if (punchInHour > 10 || (punchInHour === 10 && punchInMinute > 45)) {
                  summary.late++;
                }
              }
            } else if (punchIn) {
              status = 'partial';
            }
          }
          
          summary.days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            status,
            effectiveHours: Math.round(effectiveHours * 100) / 100,
            grossHours: Math.round(grossHours * 100) / 100,
            punchIn: punchIn || null,
            punchOut: punchOut || null,
            sessions: sessions
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      summary.absent = workingDays - summary.present;
      summary.averageEffectiveHours = summary.present > 0 
        ? Math.round((summary.totalEffectiveHours / summary.present) * 100) / 100 
        : 0;
      summary.averageGrossHours = summary.present > 0 
        ? Math.round((summary.totalGrossHours / summary.present) * 100) / 100 
        : 0;

      return summary;
    } catch (error) {
      console.error('Error getting attendance summary:', error);
      throw error;
    }
  }

  /**
   * Get all employee codes from the biometric system
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of employee codes
   */
  async getBiometricEmployeeCodes(fromDate, toDate) {
    try {
      const logs = await this.getAttendanceLogs(fromDate, toDate);
      const codes = [...new Set(logs.map(l => l.EmpCode || l.empCode).filter(Boolean))];
      return codes;
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      throw error;
    }
  }

  /**
   * Test connection to biometric API
   * @returns {Promise<Object>} - Test results
   */
  async testConnection() {
    try {
      const token = await this.getValidToken();
      const today = new Date().toISOString().split('T')[0];
      
      // Try to fetch logs for today
      const logs = await this.getAttendanceLogs(today, today);
      
      return {
        success: true,
        message: 'Connection successful',
        tokenValid: !!token,
        logCount: logs.length,
        sampleLogs: logs.slice(0, 5)
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        tokenValid: false
      };
    }
  }
}

module.exports = new BiometricAttendanceService();