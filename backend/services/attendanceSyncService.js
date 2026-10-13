// backend/services/attendanceSyncService.js
// Late-ness is evaluated once at write time via ShiftHistory and
// persisted on the punch log. No on-the-fly late computation.

const axios = require('axios');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const User = require('../models/User');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ✅ Shift-aware late evaluation
const { evaluateAndPersistLateness } = require('./shiftService');

// ============================================
// IST HELPERS
// ============================================
const toISTDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const istStr = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istStr);
};

const getISTDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const getTodayISTString = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const isTodayIST = (date) => {
  if (!date) return false;
  const dateStr = getISTDateString(date);
  const todayStr = getTodayISTString();
  return dateStr === todayStr;
};

class AttendanceSyncService {
  constructor() {
    this.baseUrl = process.env.BIOMETRIC_API_URL || 'http://103.170.149.84:2000';
    this.loginUrl = `${this.baseUrl}/api/Auth/Login`;
    this.deviceKey = process.env.BIOMETRIC_DEVICE_KEY || 'C2642CA867382C34';
    this.username = process.env.BIOMETRIC_USERNAME || 'biomax';
    this.password = process.env.BIOMETRIC_PASSWORD || 'biomax';
    this.token = null;
    this.tokenExpiry = null;
  }

  async getAuthToken() {
    try {
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 10 * 60 * 1000) {
        console.log('✅ Using cached token');
        return this.token;
      }

      console.log('🔑 Getting new auth token...');

      const payload = {
        Username: this.username,
        Password: this.password
      };

      const response = await axios.post(this.loginUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const loginData = response.data;

      const token =
        loginData.token ||
        loginData.Token ||
        loginData.accessToken ||
        loginData.AccessToken ||
        loginData.jwt ||
        loginData.JWT ||
        loginData.data?.token ||
        loginData.data?.Token;

      if (token && typeof token === 'string' && token.length > 10) {
        this.token = token;
        this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
        console.log('✅ Auth token obtained successfully');
        return token;
      } else {
        console.error('❌ No valid token in response:', loginData);
        throw new Error('No valid token in response');
      }
    } catch (error) {
      console.error('❌ Failed to get auth token:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data));
      }
      return null;
    }
  }

  async fetchAttendanceLogs(fromDate, toDate) {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('Failed to authenticate with biometric API');

      const url = `${this.baseUrl}/api/DeviceLog/GetAllLogsByDate`;
      const params = {
        FromDate: fromDate,
        ToDate: toDate,
        DeviceKey: this.deviceKey
      };

      const response = await axios.get(url, {
        params: params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} attendance records`);

        if (response.data.length > 0) {
          console.log('📋 Sample log keys:', Object.keys(response.data[0]));
        }

        try {
          const logsDir = path.join(__dirname, '../logs');
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }
          const logFile = path.join(logsDir, `attendance_logs_${fromDate}_${toDate}.json`);
          fs.writeFileSync(logFile, JSON.stringify(response.data, null, 2));
        } catch (fileError) {
          console.log('⚠️ Could not save logs to file:', fileError.message);
        }

        return response.data;
      } else {
        console.warn('⚠️ Unexpected response format:', typeof response.data);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching attendance logs:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
      }
      return [];
    }
  }

  async getDeviceEmployeeCodes(fromDate, toDate) {
    try {
      const logs = await this.fetchAttendanceLogs(fromDate, toDate);
      if (!logs || !Array.isArray(logs)) return [];

      const codes = new Set();
      logs.forEach(log => {
        const code = log.EmpCode || log.employeeCode;
        if (code !== undefined && code !== null && code !== '') {
          codes.add(String(code));
        }
      });

      console.log(`📋 Found ${codes.size} unique employee codes from device`);
      return Array.from(codes);
    } catch (error) {
      console.error('❌ Error getting device employee codes:', error.message);
      return [];
    }
  }

  async syncAttendanceLogs(fromDate, toDate) {
    try {
      console.log(`🔄 Starting attendance sync from ${fromDate} to ${toDate}...`);

      const logs = await this.fetchAttendanceLogs(fromDate, toDate);

      if (!logs || logs.length === 0) {
        return {
          success: true,
          message: 'No logs found for the specified date range',
          processed: 0,
          created: 0,
          updated: 0,
          errors: []
        };
      }

      console.log(`📊 Processing ${logs.length} logs...`);

      const allUsers = await User.find({
        employeeCode: { $ne: null, $ne: '' }
      }).select('_id employeeCode name');

      const userMap = {};
      allUsers.forEach(u => {
        userMap[String(u.employeeCode)] = u;
      });

      console.log(`👥 Found ${Object.keys(userMap).length} users with employee codes in system`);

      const logsByEmployee = {};
      let unmatchedLogs = 0;

      logs.forEach(log => {
        const employeeCode = log.EmpCode || log.employeeCode;
        if (!employeeCode) {
          unmatchedLogs++;
          return;
        }

        const codeStr = String(employeeCode);
        if (!logsByEmployee[codeStr]) {
          logsByEmployee[codeStr] = [];
        }
        logsByEmployee[codeStr].push(log);
      });

      const foundCodes = Object.keys(logsByEmployee);

      const matchedCodes = [];
      const unmatchedCodes = [];
      foundCodes.forEach(code => {
        if (userMap[code]) {
          matchedCodes.push(code);
        } else {
          unmatchedCodes.push(code);
        }
      });

      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: [],
        matchedCodes: matchedCodes,
        unmatchedCodes: unmatchedCodes,
        unmatchedLogs: unmatchedLogs
      };

      for (const [employeeCode, employeeLogs] of Object.entries(logsByEmployee)) {
        const user = userMap[employeeCode];
        if (!user) continue;

        const sortedLogs = [...employeeLogs].sort((a, b) => {
          const aTime = new Date(a.IOTime || a.LogDate).getTime();
          const bTime = new Date(b.IOTime || b.LogDate).getTime();
          return aTime - bTime;
        });

        for (const log of sortedLogs) {
          try {
            const result = await this.processLogEntry(user._id, log);
            results.processed++;
            if (result.created) results.created++;
            if (result.updated) results.updated++;
          } catch (logError) {
            console.error(`Error processing log for ${employeeCode}:`, logError.message);
            results.errors.push({
              employeeCode,
              logDate: log.IOTime || log.LogDate,
              error: logError.message
            });
          }
        }
      }

      console.log(`✅ Sync complete: ${results.processed} processed, ${results.created} created, ${results.updated} updated`);

      return {
        success: true,
        message: `Synced ${results.processed} attendance records`,
        ...results
      };
    } catch (error) {
      console.error('❌ Error syncing attendance logs:', error.message);
      throw error;
    }
  }

  /**
   * Process a single log entry.
   * ✅ After the punch is persisted, evaluate late-ness via ShiftHistory
   *    and store it on the log record.
   */
  async processLogEntry(userId, log) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    const logDateStr = log.IOTime || log.LogDate;
    if (!logDateStr) throw new Error('No date found in log entry');

    const logDate = new Date(logDateStr);
    if (isNaN(logDate.getTime())) throw new Error(`Invalid date format: ${logDateStr}`);

    const istDateStr = getISTDateString(logDate);
    if (!istDateStr) throw new Error(`Failed to convert date to IST: ${logDateStr}`);

    const [year, month, day] = istDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    const punchDirection = (log.IOMode || log.PunchDirection || '').toString().trim().toLowerCase();
    const isPunchIn = punchDirection === 'in' || punchDirection === '1' || punchDirection === '';
    const isPunchOut = punchDirection === 'out' || punchDirection === '2';

    let result = { created: false, updated: false };
    let touchedLog = null;

    try {
      if (isPunchIn) {
        let existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date
        });

        if (existingLog) {
          if (!existingLog.punchIn || logDate < existingLog.punchIn) {
            existingLog.punchIn = logDate;
            await existingLog.save();
            result.updated = true;
          }
          touchedLog = existingLog;
        } else {
          const punchOutOnly = await EmployeePunchLog.findOne({
            employeeId: userId,
            date: date,
            punchIn: null,
            punchOut: { $ne: null }
          });

          if (punchOutOnly) {
            punchOutOnly.punchIn = logDate;
            await punchOutOnly.save();
            result.updated = true;
            touchedLog = punchOutOnly;
          } else {
            touchedLog = await EmployeePunchLog.create({
              employeeId: userId,
              punchIn: logDate,
              punchOut: null,
              date: date,
              isManualCorrection: false,
              correctionNote: `Auto-synced from device: ${log.DeviceName || log.SerialNumber || 'Unknown device'}`,
              createdBy: null
            });
            result.created = true;
          }
        }
      } else if (isPunchOut) {
        let existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date
        });

        if (existingLog) {
          if (!existingLog.punchOut || logDate > existingLog.punchOut) {
            existingLog.punchOut = logDate;
            await existingLog.save();
            result.updated = true;
          }
          touchedLog = existingLog;
        } else {
          touchedLog = await EmployeePunchLog.create({
            employeeId: userId,
            punchIn: null,
            punchOut: logDate,
            date: date,
            isManualCorrection: false,
            correctionNote: `Auto-synced from device: ${log.DeviceName || log.SerialNumber || 'Unknown device'}`,
            createdBy: null
          });
          result.created = true;
        }
      }

      // ✅ Shift-aware late evaluation
      if (touchedLog && touchedLog.punchIn) {
        try {
          await evaluateAndPersistLateness(touchedLog);
        } catch (lateErr) {
          console.error(
            `⚠️ Failed to evaluate lateness for log ${touchedLog._id}:`,
            lateErr.message
          );
        }
      }
    } catch (error) {
      console.error('Error in processLogEntry:', error);
      throw error;
    }

    return result;
  }

  async testConnection(fromDate, toDate) {
    try {
      console.log('🔍 Testing connection to biometric API...');

      const logs = await this.fetchAttendanceLogs(fromDate, toDate);

      if (logs && logs.length > 0) {
        const employeeCodes = [
          ...new Set(logs.map(l => String(l.EmpCode || l.employeeCode)).filter(Boolean))
        ];

        const existingEmployees = await User.find({
          employeeCode: { $in: employeeCodes }
        }).select('employeeCode name email');

        const existingCodes = new Set(existingEmployees.map(e => String(e.employeeCode)));
        const missingCodes = employeeCodes.filter(code => !existingCodes.has(code));

        const sampleLogs = logs.slice(0, 5).map(log => {
          const logTime = log.IOTime || log.LogDate;
          const istTime = logTime ? toISTDate(logTime) : null;

          return {
            EmpCode: log.EmpCode || log.employeeCode,
            UserName: log.UserName || log.userName,
            IOTime: log.IOTime || log.LogDate,
            IOTimeIST: istTime ? istTime.toISOString() : null,
            IOMode: log.IOMode || log.PunchDirection,
            DeviceName: log.DeviceName || log.SerialNumber
          };
        });

        return {
          success: true,
          message: 'Connection test successful',
          data: {
            totalLogs: logs.length,
            uniqueEmployees: employeeCodes.length,
            existingEmployees: existingEmployees.length,
            missingEmployees: missingCodes,
            sampleLogs: sampleLogs,
            employeeCodes: employeeCodes
          }
        };
      } else {
        return {
          success: false,
          message: 'No logs found for the specified date range',
          data: null
        };
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Connection test failed',
        data: null
      };
    }
  }

  async getEmployeeAttendance(employeeCode, fromDate, toDate) {
    try {
      const user = await User.findOne({ employeeCode });
      if (!user) return { success: false, message: 'Employee not found', data: null };

      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);

      const punchLogs = await EmployeePunchLog.find({
        employeeId: user._id,
        date: { $gte: fromDateObj, $lte: toDateObj }
      }).sort({ date: 1 });

      const start = new Date(fromDate);
      const end = new Date(toDate);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const days = [];
      let workingDays = 0;
      let presentDays = 0;
      let lateDays = 0;
      let totalHours = 0;

      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateStr = getISTDateString(current);

        if (!isWeekend && dateStr) {
          workingDays++;
          const dayLogs = punchLogs.filter(p => {
            const pDate = getISTDateString(p.date);
            return pDate === dateStr;
          });

          const punchIn = dayLogs.find(p => p.punchIn);
          const punchOut = dayLogs.find(p => p.punchOut);

          let status = 'absent';
          let hoursWorked = 0;
          let isLate = false;
          let lateMinutes = 0;

          if (punchIn && punchOut) {
            status = 'present';
            presentDays++;
            hoursWorked = (punchOut.punchOut - punchIn.punchIn) / (1000 * 60 * 60);
            totalHours += hoursWorked;

            isLate = punchIn.isLate === true;
            lateMinutes = punchIn.lateMinutes || 0;
            if (isLate) lateDays++;
          } else if (punchIn) {
            status = 'partial';
            isLate = punchIn.isLate === true;
            lateMinutes = punchIn.lateMinutes || 0;
            if (isLate) lateDays++;
          }

          days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            status,
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            punchIn: punchIn?.punchIn || null,
            punchOut: punchOut?.punchOut || null,
            isLate: isLate,
            lateMinutes: lateMinutes,
            shiftStartMinutesUsed: punchIn?.shiftStartMinutesUsed ?? null
          });
        }
        current.setDate(current.getDate() + 1);
      }

      return {
        success: true,
        data: {
          employee: {
            name: user.name,
            employeeCode: user.employeeCode,
            email: user.email,
            designation: user.designation || 'N/A',
            department: user.department || 'N/A'
          },
          summary: {
            workingDays: workingDays,
            present: presentDays,
            absent: workingDays - presentDays,
            late: lateDays,
            totalHours: Math.round(totalHours * 100) / 100,
            averageHours: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0
          },
          days: days
        }
      };
    } catch (error) {
      console.error('❌ Error getting employee attendance:', error);
      return { success: false, message: error.message, data: null };
    }
  }

  async getEmployeeTodayAttendance(employeeCode) {
    try {
      const user = await User.findOne({ employeeCode });
      if (!user) return { success: false, message: 'Employee not found', data: null };

      const todayStr = getTodayISTString();
      const [year, month, day] = todayStr.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      const punchLog = await EmployeePunchLog.findOne({
        employeeId: user._id,
        date: { $gte: start, $lte: end }
      });

      let status = 'absent';
      let statusMessage = 'Not Punched In';
      let punchInTime = null;
      let punchOutTime = null;
      let isLate = false;
      let lateMinutes = 0;

      if (punchLog) {
        punchInTime = punchLog.punchIn;
        punchOutTime = punchLog.punchOut;

        if (punchLog.punchIn) {
          isLate = punchLog.isLate === true;
          lateMinutes = punchLog.lateMinutes || 0;

          if (isLate) {
            status = 'late';
            statusMessage = 'Punched In (Late)';
          } else {
            status = 'on_time';
            statusMessage = 'Punched In (On Time)';
          }
        }

        if (punchLog.punchOut) {
          status = 'completed';
          statusMessage = 'Shift Completed';
        } else if (punchLog.punchIn) {
          statusMessage = 'Working (Punched In)';
        }
      }

      return {
        success: true,
        data: {
          employee: {
            name: user.name,
            employeeCode: user.employeeCode,
            email: user.email
          },
          date: todayStr,
          status,
          statusMessage,
          punchInTime,
          punchOutTime,
          isLate,
          lateMinutes,
          shiftStartMinutesUsed: punchLog?.shiftStartMinutesUsed ?? null
        }
      };
    } catch (error) {
      console.error('❌ Error getting today attendance:', error);
      return { success: false, message: error.message, data: null };
    }
  }
}

module.exports = new AttendanceSyncService();