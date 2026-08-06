// // backend/cron/biometricSync.js
// const cron = require('node-cron');
// const axios = require('axios');
// const mongoose = require('mongoose');
// const EmployeePunchLog = require('../models/EmployeePunchLog');
// const User = require('../models/User');

// class BiometricSyncService {
//   constructor() {
//     this.baseUrl = process.env.BIOMETRIC_API_URL ;
//     this.username = process.env.BIOMETRIC_USERNAME ;
//     this.password = process.env.BIOMETRIC_PASSWORD ;
//     this.deviceKey = process.env.BIOMETRIC_DEVICE_KEY ;
//     this.token = null;
//     this.tokenExpiry = null;
//     this.isRunning = false;
//   }

//   async getAuthToken() {
//     try {
//       if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 10 * 60 * 1000) {
//         return this.token;
//       }

//       console.log('🔑 Getting new auth token...');
//       const response = await axios.post(`${this.baseUrl}/api/Auth/Login`, {
//         Username: this.username,
//         Password: this.password
//       }, {
//         headers: { 'Content-Type': 'application/json' },      
//         timeout: 10000
//       });

//       const token = response.data.Token || response.data.token;
//       if (token) {
//         this.token = token;
//         this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
//         console.log('✅ Auth token obtained');
//         return token;
//       }
//       throw new Error('No token in response');
//     } catch (error) {
//       console.error('❌ Failed to get auth token:', error.message);
//       return null;
//     }
//   }

//   async fetchAttendanceLogs(fromDate, toDate) {
//     try {
//       const token = await this.getAuthToken();
//       if (!token) throw new Error('No valid token');

//       const response = await axios.get(`${this.baseUrl}/api/DeviceLog/GetAllLogsByDate`, {
//         params: {
//           FromDate: fromDate,
//           ToDate: toDate,
//           DeviceKey: this.deviceKey
//         },
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         },
//         timeout: 30000
//       });

//       return response.data || [];
//     } catch (error) {
//       console.error('❌ Failed to fetch logs:', error.message);
//       return [];
//     }
//   }

//   /**
//    * Get the date string directly from the API timestamp
//    * WITHOUT any timezone conversion
//    */
//   getDateStringFromPunch(punchTime) {
//     // "2026-07-31T11:19:37.000Z" -> "2026-07-31"
//     if (!punchTime) return null;
//     return punchTime.split('T')[0];
//   }

//   /**
//    * Create a date at midnight UTC using the date string
//    * This ensures the stored date matches the API date
//    */
//   createDateFromString(dateStr) {
//     if (!dateStr) return null;
//     // "2026-07-31" -> Date at 2026-07-31 00:00:00 UTC
//     return new Date(dateStr + 'T00:00:00.000Z');
//   }

//   /**
//    * Processes raw daily logs into chronologically paired session objects.
//    * Handles missing OUT punches, consecutive INs, and open trailing sessions.
//    * 
//    * @param {Array} dayLogs - Array of raw log objects for a single day
//    * @returns {Object} - { sessions, punchIn, punchOut, logCount, sessionCount }
//    */
//   buildSessionsFromDayLogs(dayLogs) {
//     if (!dayLogs || dayLogs.length === 0) {
//       return {
//         sessions: [],
//         punchIn: null,
//         punchOut: null,
//         logCount: 0,
//         sessionCount: 0
//       };
//     }

//     // Sort logs chronologically
//     const sortedLogs = [...dayLogs].sort((a, b) => {
//       const tA = new Date(a.IOTime || a.LogDate || a.date).getTime();
//       const tB = new Date(b.IOTime || b.LogDate || b.date).getTime();
//       return tA - tB;
//     });

//     const sessions = [];
//     let currentSession = null;

//     for (const log of sortedLogs) {
//       const logTime = new Date(log.IOTime || log.LogDate || log.date);
//       const direction = (log.IOMode || log.PunchDirection || log.mode || '').toString().toLowerCase();

//       if (direction === 'in' || direction === '1') {
//         // Punch IN
//         if (currentSession) {
//           // Consecutive IN without an intermediate OUT: close previous session at this timestamp
//           // This handles cases where someone punches IN twice without punching OUT
//           currentSession.punchOut = logTime;
//           sessions.push(currentSession);
//           // Log a warning for data quality
//           console.log(`⚠️ Consecutive IN without OUT: closing previous session at ${logTime.toISOString()}`);
//         }
//         currentSession = { punchIn: logTime, punchOut: null };
//       } else if (direction === 'out' || direction === '2') {
//         // Punch OUT
//         if (currentSession) {
//           // Normal case: close the current session
//           currentSession.punchOut = logTime;
//           sessions.push(currentSession);
//           currentSession = null;
//         } else {
//           // Orphan OUT log: create a closed session starting at this punchOut
//           // This handles cases where someone punches OUT without a matching IN
//           console.log(`⚠️ Orphan OUT log detected: creating session at ${logTime.toISOString()}`);
//           sessions.push({ punchIn: logTime, punchOut: logTime });
//         }
//       } else {
//         // Fallback for logs without explicit IOMode
//         // Treat as alternating: if no current session, start one; otherwise close it
//         if (!currentSession) {
//           currentSession = { punchIn: logTime, punchOut: null };
//         } else {
//           currentSession.punchOut = logTime;
//           sessions.push(currentSession);
//           currentSession = null;
//         }
//       }
//     }

//     // Trailing open session (active shift / missing final OUT)
//     if (currentSession) {
//       // Keep as open session (punchOut: null)
//       sessions.push(currentSession);
//     }

//     // Derive first IN and last OUT from sessions
//     const firstIn = sessions.length > 0 ? sessions[0].punchIn : null;
//     const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
//     const lastOut = lastSession ? lastSession.punchOut : null;

//     // Log session breakdown for debugging
//     if (sessions.length > 1) {
//       console.log(`📊 Built ${sessions.length} sessions from ${sortedLogs.length} logs`);
//       sessions.forEach((s, i) => {
//         const inStr = s.punchIn ? s.punchIn.toISOString() : 'null';
//         const outStr = s.punchOut ? s.punchOut.toISOString() : 'OPEN';
//         console.log(`   Session ${i + 1}: ${inStr} → ${outStr}`);
//       });
//     }

//     return {
//       sessions,
//       punchIn: firstIn,
//       punchOut: lastOut,
//       logCount: sortedLogs.length,
//       sessionCount: sessions.length
//     };
//   }

//   /**
//    * Check if a record already has sessions (for backward compatibility)
//    */
//   async hasSessions(employeeId, date) {
//     const existing = await EmployeePunchLog.findOne({
//       employeeId,
//       date
//     });
//     return existing && existing.sessions && existing.sessions.length > 0;
//   }

//   async syncAttendance() {
//     if (this.isRunning) {
//       console.log('⏳ Sync already in progress, skipping...');
//       return;
//     }

//     this.isRunning = true;
//     console.log(`🔄 Starting biometric sync at ${new Date().toISOString()}`);

//     try {
//       // Get all active users with employee codes
//       const users = await User.find({
//         employeeCode: { $ne: null, $ne: '' },
//         isActive: true
//       });

//       if (users.length === 0) {
//         console.log('⚠️ No users with employee codes found');
//         this.isRunning = false;
//         return;
//       }

//       console.log(`👤 Found ${users.length} users with employee codes`);

//       // Build employee code map
//       const userMap = {};
//       users.forEach(u => {
//         userMap[String(u.employeeCode)] = u;
//       });

//       const today = new Date();
//       const fromDate = new Date('2026-06-11');
//       const toStr = today.toISOString().split('T')[0];
//       const fromStr = fromDate.toISOString().split('T')[0];

//       console.log(`📡 Fetching logs from ${fromStr} to ${toStr}...`);
//       const logs = await this.fetchAttendanceLogs(fromStr, toStr);

//       if (!logs || logs.length === 0) {
//         console.log('⚠️ No logs found');
//         this.isRunning = false;
//         return;
//       }

//       console.log(`📊 Found ${logs.length} total logs`);

//       // Group logs by employee code
//       const logsByEmployee = {};
//       let unmatchedLogs = 0;
      
//       logs.forEach(log => {
//         const empCode = String(log.EmpCode || log.employeeCode);
//         if (!empCode) {
//           unmatchedLogs++;
//           return;
//         }
        
//         if (!userMap[empCode]) {
//           // Log user not found but still track for debugging
//           if (!logsByEmployee[`_unmatched_${empCode}`]) {
//             logsByEmployee[`_unmatched_${empCode}`] = [];
//           }
//           logsByEmployee[`_unmatched_${empCode}`].push(log);
//           return;
//         }
        
//         if (!logsByEmployee[empCode]) {
//           logsByEmployee[empCode] = [];
//         }
//         logsByEmployee[empCode].push(log);
//       });

//       // Log unmatched codes for debugging
//       const unmatchedCodes = Object.keys(logsByEmployee).filter(k => k.startsWith('_unmatched_'));
//       if (unmatchedCodes.length > 0) {
//         console.log(`⚠️ Found ${unmatchedLogs} logs for unknown employee codes:`, 
//           unmatchedCodes.map(k => k.replace('_unmatched_', '')));
//       }

//       console.log(`👥 Processing ${Object.keys(logsByEmployee).filter(k => !k.startsWith('_unmatched_')).length} employees`);

//       let totalCreated = 0;
//       let totalUpdated = 0;
//       let totalSkipped = 0;

//       // Process each employee's logs
//       for (const [empCode, employeeLogs] of Object.entries(logsByEmployee)) {
//         // Skip unmatched codes
//         if (empCode.startsWith('_unmatched_')) continue;
        
//         const user = userMap[empCode];
//         if (!user) continue;

//         // Group logs by date using the date string from the API
//         const logsByDate = {};
//         employeeLogs.forEach(log => {
//           const punchTime = log.IOTime || log.LogDate;
//           if (!punchTime) return;
//           const dateStr = this.getDateStringFromPunch(punchTime);
//           if (!dateStr) return;
          
//           if (!logsByDate[dateStr]) {
//             logsByDate[dateStr] = [];
//           }
//           logsByDate[dateStr].push(log);
//         });

//         for (const [dateStr, dayLogs] of Object.entries(logsByDate)) {
//           const date = this.createDateFromString(dateStr);
//           if (!date) continue;

//           // Pair raw daily logs into discrete sessions
//           const { 
//             sessions, 
//             punchIn, 
//             punchOut, 
//             logCount, 
//             sessionCount 
//           } = this.buildSessionsFromDayLogs(dayLogs);

//           if (sessions.length === 0) continue;

//           // Check if record exists for this date
//           const existing = await EmployeePunchLog.findOne({
//             employeeId: user._id,
//             date: date
//           });

//           const note = `Auto-synced: ${sessionCount} sessions from ${logCount} logs`;

//           if (existing) {
//             // Update existing record with sessions
//             existing.sessions = sessions;
//             existing.punchIn = punchIn;
//             existing.punchOut = punchOut;
//             existing.isManualCorrection = false;
//             existing.correctionNote = note;
//             await existing.save();
//             totalUpdated++;
            
//             if (sessionCount > 1) {
//               console.log(`🔄 Updated ${user.name} (${empCode}) for ${dateStr} (${sessionCount} sessions, ${logCount} logs)`);
//             } else {
//               console.log(`🔄 Updated ${user.name} (${empCode}) for ${dateStr} (1 session, ${logCount} logs)`);
//             }
//           } else {
//             // Create new record with sessions
//             await EmployeePunchLog.create({
//               employeeId: user._id,
//               date: date,
//               sessions: sessions,
//               punchIn: punchIn,
//               punchOut: punchOut,
//               isManualCorrection: false,
//               correctionNote: note,
//               createdBy: null
//             });
//             totalCreated++;
            
//             if (sessionCount > 1) {
//               console.log(`✅ Created ${user.name} (${empCode}) for ${dateStr} (${sessionCount} sessions, ${logCount} logs)`);
//             } else {
//               console.log(`✅ Created ${user.name} (${empCode}) for ${dateStr} (1 session, ${logCount} logs)`);
//             }
//           }
//         }
//       }

//       console.log(`✅ Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);

//     } catch (error) {
//       console.error('❌ Sync error:', error.message);
//       if (error.stack) {
//         console.error('Stack trace:', error.stack);
//       }
//     } finally {
//       this.isRunning = false;
//     }
//   }
// }

// const syncService = new BiometricSyncService();

// // Schedule sync every 15 minutes
// cron.schedule('*/5 * * * *', async () => {
//   console.log('⏰ Running scheduled biometric sync...');
//   await syncService.syncAttendance();
// }, {
//   timezone: "Asia/Kolkata"
// });

// console.log('⏰ Biometric sync scheduled every 15 minutes');

// // Run initial sync after 30 seconds
// setTimeout(() => {
//   console.log('🚀 Running initial biometric sync...');
//   syncService.syncAttendance();
// }, 5000);

// module.exports = syncService;