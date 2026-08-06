// backend/services/attendanceSyncService.js
// UPDATED: Added IST timezone support for consistent "late" detection

const axios = require('axios');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const User = require('../models/User');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ============================================
// IST HELPER FUNCTIONS
// ============================================

/**
 * Convert a date to IST time string
 * @param {Date|string} date - The date to convert
 * @returns {Date|null} - Date object representing IST time
 */
const toISTDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const istStr = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istStr);
};

/**
 * Check if a punch time is late (after 10:45 AM IST)
 * @param {Date|string} punchTime - The punch time to check
 * @returns {boolean} - True if late, false otherwise
 */
const isLatePunch = (punchTime) => {
  if (!punchTime) return false;
  
  const istDate = toISTDate(punchTime);
  if (!istDate) return false;
  
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  
  // Office starts at 10:45 AM IST
  return hours > 10 || (hours === 10 && minutes > 45);
};

/**
 * Get late minutes for a punch
 * @param {Date|string} punchTime - The punch time to check
 * @returns {number} - Number of minutes late (0 if on time)
 */
const getLateMinutes = (punchTime) => {
  if (!punchTime) return 0;
  
  const istDate = toISTDate(punchTime);
  if (!istDate) return 0;
  
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const officeMinutes = 10 * 60 + 45; // 10:45 AM IST
  
  return Math.max(0, totalMinutes - officeMinutes);
};

/**
 * Get IST date string (YYYY-MM-DD) from a Date object
 * @param {Date|string} date - The date to convert
 * @returns {string|null} - IST date string or null
 */
const getISTDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Get today's date in IST as string (YYYY-MM-DD)
 * @returns {string} - Today's date in IST
 */
const getTodayISTString = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Check if a date is today in IST
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if today, false otherwise
 */
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

  /**
   * Get authentication token from biometric API
   */
  async getAuthToken() {
    try {
      // Check if token is still valid (10 min buffer)
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 10 * 60 * 1000) {
        console.log('✅ Using cached token');
        return this.token;
      }

      console.log('🔑 Getting new auth token...');
      
      const payload = {
        Username: this.username,
        Password: this.password
      };

      console.log(`📡 POST ${this.loginUrl}`);
      console.log(`📋 Payload:`, { Username: this.username, Password: '******' });

      const response = await axios.post(this.loginUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log(`📥 Response status: ${response.status}`);
      
      const loginData = response.data;
      console.log('📥 Login response keys:', Object.keys(loginData));

      // Try multiple possible token field names
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
        console.log(`📝 Token: ${token.substring(0, 20)}...`);
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

  /**
   * Fetch attendance logs from the device API
   * Matches the Python script exactly
   */
  async fetchAttendanceLogs(fromDate, toDate) {
    try {
      // First, get the auth token
      const token = await this.getAuthToken();
      
      if (!token) {
        throw new Error('Failed to authenticate with biometric API');
      }

      const url = `${this.baseUrl}/api/DeviceLog/GetAllLogsByDate`;
      const params = {
        FromDate: fromDate,
        ToDate: toDate,
        DeviceKey: this.deviceKey
      };

      console.log(`📡 Fetching attendance logs from ${fromDate} to ${toDate}...`);
      console.log(`🔗 URL: ${url}`);
      console.log(`📋 Params:`, params);

      const response = await axios.get(url, {
        params: params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`📥 Response status: ${response.status}`);
      
      // Check if response is valid
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} attendance records`);
        
        // Log sample of what we received
        if (response.data.length > 0) {
          console.log('📋 Sample log keys:', Object.keys(response.data[0]));
          console.log('📋 Sample log:', JSON.stringify(response.data[0], null, 2));
        }
        
        // Save logs to file for debugging
        try {
          const logsDir = path.join(__dirname, '../logs');
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }
          const logFile = path.join(logsDir, `attendance_logs_${fromDate}_${toDate}.json`);
          fs.writeFileSync(logFile, JSON.stringify(response.data, null, 2));
          console.log(`💾 Saved logs to ${logFile}`);
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
        console.error('   Data:', JSON.stringify(error.response.data));
      }
      return [];
    }
  }

  /**
   * Get all employee codes from the biometric device
   */
  async getDeviceEmployeeCodes(fromDate, toDate) {
    try {
      const logs = await this.fetchAttendanceLogs(fromDate, toDate);
      
      if (!logs || !Array.isArray(logs)) {
        return [];
      }
      
      // Use EmpCode field (matches the Python script)
      const codes = new Set();
      logs.forEach(log => {
        const code = log.EmpCode || log.employeeCode;
        if (code !== undefined && code !== null && code !== '') {
          codes.add(String(code));
        }
      });
      
      console.log(`📋 Found ${codes.size} unique employee codes from device`);
      console.log('📋 Codes:', Array.from(codes));
      
      return Array.from(codes);
    } catch (error) {
      console.error('❌ Error getting device employee codes:', error.message);
      return [];
    }
  }

  /**
   * Process and sync attendance logs to the database
   */
  async syncAttendanceLogs(fromDate, toDate) {
    try {
      console.log(`🔄 Starting attendance sync from ${fromDate} to ${toDate}...`);
      
      // 1. Fetch logs from API
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

      // 2. Get all users with employee codes for faster lookup
      const allUsers = await User.find({ 
        employeeCode: { $ne: null, $ne: '' } 
      }).select('_id employeeCode name');
      
      const userMap = {};
      allUsers.forEach(u => {
        userMap[String(u.employeeCode)] = u;
      });
      
      console.log(`👥 Found ${Object.keys(userMap).length} users with employee codes in system`);

      // 3. Group logs by employee code (using EmpCode field)
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
      
      console.log(`📊 Logs by employee: ${Object.keys(logsByEmployee).length} employees`);
      console.log(`⚠️ Logs without employee code: ${unmatchedLogs}`);
      
      // Log the employee codes found
      const foundCodes = Object.keys(logsByEmployee);
      console.log('📋 Employee codes found in logs:', foundCodes);
      
      // Check which codes exist in the system
      const matchedCodes = [];
      const unmatchedCodes = [];
      foundCodes.forEach(code => {
        if (userMap[code]) {
          matchedCodes.push(code);
        } else {
          unmatchedCodes.push(code);
        }
      });
      console.log(`✅ Matched codes: ${matchedCodes.length}`, matchedCodes);
      console.log(`❌ Unmatched codes: ${unmatchedCodes.length}`, unmatchedCodes);

      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: [],
        matchedCodes: matchedCodes,
        unmatchedCodes: unmatchedCodes,
        unmatchedLogs: unmatchedLogs
      };

      // 4. Process each employee's logs
      for (const [employeeCode, employeeLogs] of Object.entries(logsByEmployee)) {
        const user = userMap[employeeCode];
        if (!user) {
          // Skip logs for users that don't exist in the system
          continue;
        }

        // Sort this employee's logs chronologically before processing
        const sortedLogs = [...employeeLogs].sort((a, b) => {
          const aTime = new Date(a.IOTime || a.LogDate).getTime();
          const bTime = new Date(b.IOTime || b.LogDate).getTime();
          return aTime - bTime;
        });

        console.log(`👤 Processing ${sortedLogs.length} logs for ${user.name} (${employeeCode})`);

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
   * Process a single log entry
   * UPDATED: Now stores session data with IST-corrected timestamps
   */
  async processLogEntry(userId, log) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // Parse the log date - using IOTime field (matches Python script)
    const logDateStr = log.IOTime || log.LogDate;
    if (!logDateStr) {
      throw new Error('No date found in log entry');
    }
    
    const logDate = new Date(logDateStr);
    if (isNaN(logDate.getTime())) {
      throw new Error(`Invalid date format: ${logDateStr}`);
    }
    
    // Get date in IST for consistent date grouping
    const istDateStr = getISTDateString(logDate);
    if (!istDateStr) {
      throw new Error(`Failed to convert date to IST: ${logDateStr}`);
    }
    
    // Parse IST date string to UTC midnight for database storage
    const [year, month, day] = istDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    
    // Determine if it's a punch in or out - using IOMode field
    const punchDirection = (log.IOMode || log.PunchDirection || '').toString().trim().toLowerCase();
    const isPunchIn = punchDirection === 'in' || punchDirection === '1' || punchDirection === '';
    const isPunchOut = punchDirection === 'out' || punchDirection === '2';
    
    let result = { created: false, updated: false };

    try {
      if (isPunchIn) {
        // Check if we already have a punch-in for this day
        let existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date
        });

        if (existingLog) {
          // Keep the EARLIEST in-punch of the day as the official "punch-in"
          if (!existingLog.punchIn || logDate < existingLog.punchIn) {
            existingLog.punchIn = logDate;
            await existingLog.save();
            result.updated = true;
            console.log(`🔄 Updated punch-in for user ${userId} on ${istDateStr}`);
          }
        } else {
          // Check if there's a log with just punch-out for this day
          const punchOutOnly = await EmployeePunchLog.findOne({
            employeeId: userId,
            date: date,
            punchIn: null,
            punchOut: { $ne: null }
          });

          if (punchOutOnly) {
            // Update the existing log with punch-in
            punchOutOnly.punchIn = logDate;
            await punchOutOnly.save();
            result.updated = true;
            console.log(`🔄 Updated punch-in for user ${userId} on ${istDateStr}`);
          } else {
            // Create new log with punch-in only
            await EmployeePunchLog.create({
              employeeId: userId,
              punchIn: logDate,
              punchOut: null,
              date: date,
              isManualCorrection: false,
              correctionNote: `Auto-synced from device: ${log.DeviceName || log.SerialNumber || 'Unknown device'}`,
              createdBy: null
            });
            result.created = true;
            console.log(`✅ Created punch-in for user ${userId} on ${istDateStr}`);
          }
        }
      } else if (isPunchOut) {
        // Find existing log for this day
        let existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date
        });

        if (existingLog) {
          // Keep the LATEST out-punch of the day as the official "punch-out"
          if (!existingLog.punchOut || logDate > existingLog.punchOut) {
            existingLog.punchOut = logDate;
            await existingLog.save();
            result.updated = true;
            console.log(`🔄 Updated punch-out for user ${userId} on ${istDateStr}`);
          }
        } else {
          // Create new log with punch-out only
          await EmployeePunchLog.create({
            employeeId: userId,
            punchIn: null,
            punchOut: logDate,
            date: date,
            isManualCorrection: false,
            correctionNote: `Auto-synced from device: ${log.DeviceName || log.SerialNumber || 'Unknown device'}`,
            createdBy: null
          });
          result.created = true;
          console.log(`✅ Created punch-out for user ${userId} on ${istDateStr}`);
        }
      }
    } catch (error) {
      console.error('Error in processLogEntry:', error);
      throw error;
    }

    return result;
  }

  /**
   * Test connection to biometric API
   * UPDATED: Returns IST-corrected sample logs
   */
  async testConnection(fromDate, toDate) {
    try {
      console.log('🔍 Testing connection to biometric API...');
      
      const logs = await this.fetchAttendanceLogs(fromDate, toDate);
      
      if (logs && logs.length > 0) {
        // Get unique employee codes
        const employeeCodes = [...new Set(logs.map(l => String(l.EmpCode || l.employeeCode)).filter(Boolean))];
        
        // Check which employees exist in the system
        const existingEmployees = await User.find({
          employeeCode: { $in: employeeCodes }
        }).select('employeeCode name email');
        
        const existingCodes = new Set(existingEmployees.map(e => String(e.employeeCode)));
        const missingCodes = employeeCodes.filter(code => !existingCodes.has(code));

        // Get sample logs with IST-corrected times
        const sampleLogs = logs.slice(0, 5).map(log => {
          const logTime = log.IOTime || log.LogDate;
          const istTime = logTime ? toISTDate(logTime) : null;
          const isLate = istTime ? isLatePunch(logTime) : false;
          
          return {
            EmpCode: log.EmpCode || log.employeeCode,
            UserName: log.UserName || log.userName,
            IOTime: log.IOTime || log.LogDate,
            IOTimeIST: istTime ? istTime.toISOString() : null,
            IOMode: log.IOMode || log.PunchDirection,
            DeviceName: log.DeviceName || log.SerialNumber,
            isLate: isLate,
            lateMinutes: isLate ? getLateMinutes(logTime) : 0
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

  /**
   * Get employee attendance summary
   * UPDATED: Uses IST for date calculations and late detection
   */
  async getEmployeeAttendance(employeeCode, fromDate, toDate) {
    try {
      const user = await User.findOne({ employeeCode });
      
      if (!user) {
        return {
          success: false,
          message: 'Employee not found',
          data: null
        };
      }

      // Convert dates to UTC for database query
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);
      
      const punchLogs = await EmployeePunchLog.find({
        employeeId: user._id,
        date: {
          $gte: fromDateObj,
          $lte: toDateObj
        }
      }).sort({ date: 1 });

      // Build attendance summary using IST dates
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
            
            // ✅ FIX: Use IST for late detection
            isLate = isLatePunch(punchIn.punchIn);
            lateMinutes = getLateMinutes(punchIn.punchIn);
            if (isLate) {
              lateDays++;
            }
          } else if (punchIn) {
            status = 'partial';
            // Check if partial punch is late
            isLate = isLatePunch(punchIn.punchIn);
            lateMinutes = getLateMinutes(punchIn.punchIn);
            if (isLate) {
              lateDays++;
            }
          }
          
          days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            status,
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            punchIn: punchIn?.punchIn || null,
            punchOut: punchOut?.punchOut || null,
            isLate: isLate,
            lateMinutes: lateMinutes
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
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  /**
   * Get today's attendance for an employee
   * UPDATED: Uses IST for date and late detection
   */
  async getEmployeeTodayAttendance(employeeCode) {
    try {
      const user = await User.findOne({ employeeCode });
      
      if (!user) {
        return {
          success: false,
          message: 'Employee not found',
          data: null
        };
      }

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
          // ✅ FIX: Use IST for late check
          isLate = isLatePunch(punchLog.punchIn);
          lateMinutes = getLateMinutes(punchLog.punchIn);
          
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
          lateMinutes
        }
      };
    } catch (error) {
      console.error('❌ Error getting today attendance:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }
}

module.exports = new AttendanceSyncService();