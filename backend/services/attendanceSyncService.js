// backend/services/attendanceSyncService.js
const axios = require('axios');
const EmployeePunchLog = require('../models/EmployeePunchLog');
const User = require('../models/User');
const mongoose = require('mongoose');

class AttendanceSyncService {
  constructor() {
    // Use the correct API URL with the proper API key
    this.apiBaseUrl = process.env.ATTENDANCE_API_URL || 'http://103.170.149.84:82/api/v2/WebAPI';
    // The API key from the URL: 2609
    this.apiKey = process.env.ATTENDANCE_API_KEY || '2609';
  }

  /**
   * Fetch attendance logs from the third-party API
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of attendance logs
   */
  async fetchAttendanceLogs(fromDate, toDate) {
    try {
      const url = `${this.apiBaseUrl}/GetDeviceLogs`;
      const params = {
        APIKey: this.apiKey,
        FromDate: fromDate,
        ToDate: toDate
      };

      console.log(`📡 Fetching attendance logs from ${fromDate} to ${toDate}...`);
      console.log(`🔗 URL: ${url}`);
      console.log(`📋 Params:`, params);

      const response = await axios.get(url, { 
        params,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if response is valid
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} attendance records`);
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
      if (error.code === 'ECONNABORTED') {
        console.error('   Request timed out after 30 seconds');
      }
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  /**
   * Process and sync attendance logs to the database
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @returns {Promise<Object>} - Sync results
   */
  async syncAttendanceLogs(fromDate, toDate) {
    try {
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

      // 2. Group logs by employee code
      const logsByEmployee = this.groupLogsByEmployee(logs);
      
      // 3. Process each employee's logs
      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: []
      };

      for (const [employeeCode, employeeLogs] of Object.entries(logsByEmployee)) {
        try {
          // Find the user by employee code
          const user = await User.findOne({ employeeCode });
          
          if (!user) {
            console.warn(`⚠️ User not found for employee code: ${employeeCode}`);
            results.errors.push({
              employeeCode,
              error: 'User not found',
              logs: employeeLogs.length
            });
            continue;
          }

          // Validate user._id is a valid ObjectId
          if (!mongoose.Types.ObjectId.isValid(user._id)) {
            console.error(`❌ Invalid user ID for employee: ${employeeCode}`, user._id);
            results.errors.push({
              employeeCode,
              error: 'Invalid user ID',
              logs: employeeLogs.length
            });
            continue;
          }

          // Process each log for this employee
          for (const log of employeeLogs) {
            try {
              const result = await this.processLogEntry(user._id, log);
              results.processed++;
              if (result.created) results.created++;
              if (result.updated) results.updated++;
            } catch (logError) {
              console.error(`Error processing log for ${employeeCode}:`, logError.message);
              results.errors.push({
                employeeCode,
                logDate: log.LogDate,
                error: logError.message
              });
            }
          }
        } catch (err) {
          console.error(`Error processing employee ${employeeCode}:`, err.message);
          results.errors.push({
            employeeCode,
            error: err.message
          });
        }
      }

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
   * Group logs by employee code
   * @param {Array} logs - Array of attendance logs
   * @returns {Object} - Grouped logs by employee code
   */
  groupLogsByEmployee(logs) {
    const grouped = {};
    
    logs.forEach(log => {
      const code = log.EmployeeCode || log.employeeCode;
      if (!code) return;
      
      if (!grouped[code]) {
        grouped[code] = [];
      }
      grouped[code].push(log);
    });
    
    return grouped;
  }

  /**
   * Process a single log entry
   * @param {string} userId - User ID
   * @param {Object} log - Attendance log entry
   * @returns {Promise<Object>} - Process result
   */
  async processLogEntry(userId, log) {
    // Validate userId is a valid ObjectId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // Parse the log date
    const logDate = new Date(log.LogDate);
    const dateStr = logDate.toISOString().split('T')[0];
    
    // Normalize date to start of day
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    
    // Determine if it's a punch in or out
    const isPunchIn = log.PunchDirection?.toLowerCase() === 'in';
    const isPunchOut = log.PunchDirection?.toLowerCase() === 'out';
    
    let result = { created: false, updated: false };

    try {
      if (isPunchIn) {
        // Check if we already have a punch-in for this day
        const existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date,
          punchIn: { $ne: null }
        });

        if (existingLog) {
          // Update the existing punch-in time (if later)
          if (logDate > existingLog.punchIn) {
            existingLog.punchIn = logDate;
            await existingLog.save();
            result.updated = true;
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
          } else {
            // Create new punch log
            await EmployeePunchLog.create({
              employeeId: userId,
              punchIn: logDate,
              punchOut: null,
              date: date,
              isManualCorrection: false,
              correctionNote: `Auto-synced from device: ${log.SerialNumber || 'Unknown device'}`,
              createdBy: null
            });
            result.created = true;
          }
        }
      } else if (isPunchOut) {
        // Find the punch-in for this day
        const existingLog = await EmployeePunchLog.findOne({
          employeeId: userId,
          date: date,
          punchOut: null
        });

        if (existingLog) {
          // Update the existing log with punch-out time
          existingLog.punchOut = logDate;
          await existingLog.save();
          result.updated = true;
        } else {
          // Check if there's a log with just punch-in for this day
          const punchInOnly = await EmployeePunchLog.findOne({
            employeeId: userId,
            date: date,
            punchIn: { $ne: null },
            punchOut: null
          });

          if (punchInOnly) {
            // Update the existing log with punch-out
            punchInOnly.punchOut = logDate;
            await punchInOnly.save();
            result.updated = true;
          } else {
            // Create a new log with just punch-out
            await EmployeePunchLog.create({
              employeeId: userId,
              punchIn: null,
              punchOut: logDate,
              date: date,
              isManualCorrection: false,
              correctionNote: `Auto-synced from device: ${log.SerialNumber || 'Unknown device'}`,
              createdBy: null
            });
            result.created = true;
          }
        }
      }
    } catch (error) {
      console.error('Error in processLogEntry:', error);
      throw error;
    }

    return result;
  }

  /**
   * Get attendance summary for an employee
   * @param {string} userId - User ID (must be a valid ObjectId)
   * @param {string} startDate - YYYY-MM-DD format
   * @param {string} endDate - YYYY-MM-DD format
   * @returns {Promise<Object>} - Attendance summary
   */
  async getEmployeeAttendanceSummary(userId, startDate, endDate) {
    try {
      // Validate userId
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId: ${userId}`);
      }

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
        onLeave: 0,
        totalHours: 0,
        averageHours: 0,
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
          const punchIn = dayLogs.find(l => l.punchIn);
          const punchOut = dayLogs.find(l => l.punchOut);
          
          let status = 'absent';
          let hoursWorked = 0;
          
          if (punchIn && punchOut) {
            status = 'present';
            hoursWorked = (punchOut.punchOut - punchIn.punchIn) / (1000 * 60 * 60);
            summary.totalHours += hoursWorked;
            summary.present++;
            
            // Check for late arrival (after 10:00 AM)
            const punchInHour = new Date(punchIn.punchIn).getHours();
            if (punchInHour >= 10) {
              summary.late++;
            }
          } else if (punchIn) {
            status = 'partial';
          }
          
          summary.days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            status,
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            punchIn: punchIn?.punchIn || null,
            punchOut: punchOut?.punchOut || null
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      summary.absent = workingDays - summary.present;
      summary.averageHours = summary.present > 0 
        ? Math.round((summary.totalHours / summary.present) * 100) / 100 
        : 0;

      return summary;
    } catch (error) {
      console.error('Error getting attendance summary:', error);
      throw error;
    }
  }

  /**
   * Get employee by employee code
   * @param {string} employeeCode - Employee code
   * @returns {Promise<Object>} - User object
   */
  async getEmployeeByCode(employeeCode) {
    return await User.findOne({ employeeCode });
  }

  /**
   * Map employee codes to user IDs
   * @param {Array} employeeCodes - Array of employee codes
   * @returns {Promise<Object>} - Mapping of employee code to user ID
   */
  async mapEmployeeCodesToUserIds(employeeCodes) {
    const users = await User.find({
      employeeCode: { $in: employeeCodes }
    });
    
    const mapping = {};
    users.forEach(u => {
      mapping[u.employeeCode] = u._id;
    });
    
    return mapping;
  }

  /**
   * Test connection to the API
   * @param {string} fromDate - YYYY-MM-DD format
   * @param {string} toDate - YYYY-MM-DD format
   * @returns {Promise<Object>} - Test results
   */
  async testConnection(fromDate, toDate) {
    try {
      const logs = await this.fetchAttendanceLogs(fromDate, toDate);
      
      if (logs && logs.length > 0) {
        // Get unique employee codes
        const employeeCodes = [...new Set(logs.map(l => l.EmployeeCode || l.employeeCode).filter(Boolean))];
        
        // Check which employees exist in the system
        const existingEmployees = await User.find({
          employeeCode: { $in: employeeCodes }
        }).select('employeeCode name email');
        
        const existingCodes = new Set(existingEmployees.map(e => e.employeeCode));
        const missingCodes = employeeCodes.filter(code => !existingCodes.has(code));
        
        return {
          success: true,
          message: 'Connection test successful',
          data: {
            totalLogs: logs.length,
            uniqueEmployees: employeeCodes.length,
            existingEmployees: existingEmployees.length,
            missingEmployees: missingCodes,
            sampleLogs: logs.slice(0, 5)
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
}

module.exports = new AttendanceSyncService();