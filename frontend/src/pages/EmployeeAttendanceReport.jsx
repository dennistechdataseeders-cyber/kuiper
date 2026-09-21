// frontend/src/pages/EmployeeAttendanceReport.jsx

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Download,
  Calendar,
  Loader2,
  FileText,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ============================================================
// ✅ SHARED TIME HELPERS (Matches AttendanceCombined / Timeline)
// ============================================================

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +05:30
const OFFICE_START_MINUTES = 10 * 60 + 45; // 10:45 AM IST cutoff

/**
 * Formats a UTC date string into IST 24-hour time (e.g., "14:30") — for UI display.
 */
const formatTime = (dateString) => {
  if (!dateString) return '00:00';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '00:00';

    let total = date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MINUTES;
    total = ((total % 1440) + 1440) % 1440;

    const hours = Math.floor(total / 60);
    const minutes = String(total % 60).padStart(2, '0');

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } catch (e) {
    return '00:00';
  }
};

/**
 * ✅ FIXED: Returns an Excel time-of-day FRACTION (0..1).
 *   Example: 10:52:58 IST  →  (10*3600 + 52*60 + 58) / 86400 = 0.453449...
 *   Excel stores time as a fraction of a day, so this is what we want.
 *   Returns null if there is no time.
 */
const timeFractionIST = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    let totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MINUTES;
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = date.getUTCSeconds();

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds / 86400;
  } catch (e) {
    return null;
  }
};

/**
 * ✅ FIXED: Returns Excel time-of-day fraction for a duration given in hours.
 */
const durationFraction = (hours) => {
  if (!hours || hours <= 0) return null;
  const totalSeconds = Math.round(hours * 3600);
  return totalSeconds / 86400;
};

/**
 * ✅ FIXED: Returns Excel time-of-day fraction for a duration given in minutes.
 */
const minutesFraction = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  const totalSeconds = Math.round(minutes * 60);
  return totalSeconds / 86400;
};

/**
 * Calculates "Late By" in minutes based on IST cutoff.
 */
const getLateMinutes = (punchInUTC) => {
  if (!punchInUTC) return 0;
  try {
    const d = new Date(punchInUTC);
    if (isNaN(d.getTime())) return 0;

    let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
    total = ((total % 1440) + 1440) % 1440;

    if (total <= OFFICE_START_MINUTES) return 0;
    return total - OFFICE_START_MINUTES;
  } catch (e) {
    return 0;
  }
};

/**
 * Formats a number of minutes into "HH:MM" format.
 */
const formatMinutesToHHMM = (minutes) => {
  if (!minutes || minutes <= 0) return '00:00';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Formats a number of hours into "HH:MM" format.
 */
const formatHoursToHHMM = (hours) => {
  if (!hours || hours <= 0) return '00:00';
  const totalMinutes = Math.round(hours * 60);
  return formatMinutesToHHMM(totalMinutes);
};

const getStatusInfo = (status) => {
  switch (status) {
    case 'Present': return { code: 'P', color: 'bg-emerald-100 text-emerald-700' };
    case 'Late': return { code: 'P', color: 'bg-amber-100 text-amber-700' };
    case 'Absent': return { code: 'A', color: 'bg-rose-100 text-rose-700' };
    case 'Leave': return { code: 'L', color: 'bg-indigo-100 text-indigo-700' };
    case 'Weekend': return { code: 'WO', color: 'bg-slate-100 text-slate-500' };
    case 'Partial': return { code: '½P', color: 'bg-blue-100 text-blue-700' };
    default: return { code: '?', color: 'bg-slate-100 text-slate-700' };
  }
};

/**
 * ✅ Computes Working Days for a given month/year.
 *    Working Days = total days in month − Saturdays − Sundays − Leaves
 */
const getWorkingDays = (year, month, leaveCount = 0) => {
  const totalDays = new Date(year, month, 0).getDate();
  let weekendCount = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) weekendCount++;
  }
  return totalDays - weekendCount - (leaveCount || 0);
};

// ============================================================

const EmployeeAttendanceReport = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees`, authHeader);
      if (res.data.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setReportData([]);
    try {
      const params = {
        employeeId: selectedEmployee,
        month: selectedMonth,
        year: selectedYear
      };

      const res = await axios.get(`${API_BASE_URL}/api/hr/attendance/employee-report`, {
        ...authHeader,
        params
      });

      if (res.data.success) {
        setReportData(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const groupedAndSummarizedData = useMemo(() => {
    if (!reportData || reportData.length === 0) {
      return [];
    }

    const groupedByEmployee = reportData.reduce((acc, row) => {
      const key = row.employeeId;
      if (!acc[key]) {
        acc[key] = {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          employeeCode: row.employeeCode,
          records: []
        };
      }
      acc[key].records.push(row);
      return acc;
    }, {});

    return Object.values(groupedByEmployee).map(employee => {
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLeave = 0;
      let totalLateMinutes = 0;
      let totalEffectiveHours = 0;

      const sortedRecords = employee.records.sort((a, b) => new Date(a.date) - new Date(b.date));

      sortedRecords.forEach(record => {
        switch (record.status) {
          case 'Present':
            totalPresent += 1;
            break;
          case 'Late':
            totalPresent += 1;
            totalLateMinutes += getLateMinutes(record.punchInUTC);
            break;
          case 'Partial':
            totalPresent += 0.5;
            totalAbsent += 0.5;
            break;
          case 'Absent':
            totalAbsent += 1;
            break;
          case 'Leave':
            totalLeave += 1;
            break;
          default:
            break;
        }
        if (record.status === 'Present' || record.status === 'Late' || record.status === 'Partial') {
          totalEffectiveHours += record.effectiveHours || 0;
        }
      });

      return {
        ...employee,
        records: sortedRecords,
        summary: {
          totalPresent,
          totalAbsent,
          totalLeave,
          totalDuration: formatHoursToHHMM(totalEffectiveHours),
          totalLateBy: formatMinutesToHHMM(totalLateMinutes),
        }
      };
    });
  }, [reportData]);

  // ============================================================
  // ✅ Excel export — uses Excel time FRACTIONS with hh:mm:ss format
  // ============================================================
  const exportToExcel = () => {
    if (groupedAndSummarizedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const monthName = monthNames[selectedMonth - 1];
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const period = `01-${monthName.substring(0, 3)}-${selectedYear} To ${lastDay}-${monthName.substring(0, 3)}-${selectedYear}`;
      const generatedOn = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Track which cells need time formatting.
      // Key: "row,col"  → applied after ws is built.
      const timeCellFormats = [];

      const wsData = [];

      // Title block
      wsData.push(['Techdataseeders']);
      wsData.push(['Work Duration Report']);
      wsData.push([period]);
      wsData.push([]);
      wsData.push([`Generated On: ${generatedOn}`]);
      wsData.push([]);

      groupedAndSummarizedData.forEach((employee) => {
        // Employee header block
        wsData.push(['Department:-', 'DefaultDepartment']);
        wsData.push([
          `Employee Code:- ${employee.employeeCode || 'N/A'}`,
          '',
          '',
          '',
          '',
          '',
          '',
          `Employee Name:- ${employee.employeeName}`
        ]);

        // ✅ NEW: Present Days / Working Days line
        //    Working Days = total days in month − Sat − Sun − Leaves
        const leaveCount = employee.summary.totalLeave || 0;
        const workingDays = getWorkingDays(selectedYear, selectedMonth, leaveCount);
        const presentDays = employee.summary.totalPresent;

        wsData.push([
          `Present Days / Working Days - ${presentDays} / ${workingDays}`
        ]);

        wsData.push([]);

        // ---- Header rows ----
        const dayHeaderRow = ['Day'];
        const dateHeaderRow = ['Days'];
        const weekdayHeaderRow = [''];

        employee.records.forEach((rec, idx) => {
          dayHeaderRow.push(`Day${idx + 1}`);
          dateHeaderRow.push(`${rec.date.split('-')[2]}-${monthName.substring(0, 3)}`);
          weekdayHeaderRow.push(rec.day ? rec.day.substring(0, 3) : '');
        });

        wsData.push(dayHeaderRow);
        wsData.push(dateHeaderRow);
        wsData.push(weekdayHeaderRow);

        // ---- In Time row ----
        const inTimeRow = ['In Time'];
        employee.records.forEach((rec, idx) => {
          const fraction = timeFractionIST(rec.punchInUTC);
          inTimeRow.push(fraction);
          if (fraction !== null) {
            timeCellFormats.push({
              row: wsData.length,
              col: idx + 1,
              format: 'hh:mm:ss'
            });
          }
        });
        wsData.push(inTimeRow);

        // ---- Out Time row ----
        const outTimeRow = ['Out Time'];
        employee.records.forEach((rec, idx) => {
          const fraction = timeFractionIST(rec.punchOutUTC);
          outTimeRow.push(fraction);
          if (fraction !== null) {
            timeCellFormats.push({
              row: wsData.length,
              col: idx + 1,
              format: 'hh:mm:ss'
            });
          }
        });
        wsData.push(outTimeRow);

        // ---- Late By row ----
        const lateByRow = ['Late By'];
        employee.records.forEach((rec, idx) => {
          const fraction = minutesFraction(getLateMinutes(rec.punchInUTC));
          lateByRow.push(fraction);
          if (fraction !== null) {
            timeCellFormats.push({
              row: wsData.length,
              col: idx + 1,
              format: 'hh:mm:ss'
            });
          }
        });
        wsData.push(lateByRow);

        // ---- Early By row (placeholder) ----
        const earlyByRow = ['Early By'];
        employee.records.forEach(() => {
          earlyByRow.push(null);
        });
        wsData.push(earlyByRow);

        // ---- T Duration row ----
        const tDurationRow = ['T Duration'];
        employee.records.forEach((rec, idx) => {
          const fraction = durationFraction(rec.effectiveHours);
          tDurationRow.push(fraction);
          if (fraction !== null) {
            timeCellFormats.push({
              row: wsData.length,
              col: idx + 1,
              format: 'hh:mm:ss'
            });
          }
        });
        wsData.push(tDurationRow);

        // ---- Status row ----
        const statusRow = ['Status'];
        employee.records.forEach(rec => {
          statusRow.push(getStatusInfo(rec.status).code);
        });
        wsData.push(statusRow);

        // Spacing between employees
        wsData.push([]);
        wsData.push([]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      const maxCols = Math.max(...wsData.map(row => row.length));
      ws['!cols'] = [];
      for (let i = 0; i < maxCols; i++) {
        ws['!cols'].push({ wch: i === 0 ? 14 : 10 });
      }

      // ✅ Apply the hh:mm:ss number format to the specific cells
      timeCellFormats.forEach(({ row, col, format }) => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          ws[cellRef].z = format;
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Work Duration Report');

      const filename = `Work_Duration_Report_${monthName}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Report exported successfully: ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Work Duration Report
            </h1>
            <p className="text-slate-500 mt-1">
              Generate and export a detailed monthly work report for employees
            </p>
          </div>
          <button
            onClick={exportToExcel}
            disabled={exporting || groupedAndSummarizedData.length === 0}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              <Users size={14} className="inline mr-1" />
              Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              <Calendar size={14} className="inline mr-1" />
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
            >
              {monthNames.map((name, index) => (
                <option key={index + 1} value={index + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>{year}</option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Report Display */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Loading report data...</p>
        </div>
      ) : groupedAndSummarizedData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500">No attendance data found</p>
          <p className="text-xs text-slate-400 mt-1">
            No employees have work records for the selected period.
          </p>
          <button
            onClick={fetchReport}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          >
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedAndSummarizedData.map(employee => (
            <div
              key={employee.employeeId}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Employee Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="text-center">
                  <h2 className="text-sm font-black uppercase text-slate-700">
                    Techdataseeders
                  </h2>
                  <p className="text-xs font-bold text-slate-600">Work Duration Report</p>
                  <p className="text-[10px] text-slate-500">
                    {`01-${monthNames[selectedMonth - 1].substring(0, 3)}-${selectedYear} To ${new Date(selectedYear, selectedMonth, 0).getDate()}-${monthNames[selectedMonth - 1].substring(0, 3)}-${selectedYear}`}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-3 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="font-black uppercase text-slate-400">Employee Code:</span>
                    <span className="font-bold text-slate-800">
                      {employee.employeeCode || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black uppercase text-slate-400">Employee Name:</span>
                    <span className="font-bold text-slate-800">{employee.employeeName}</span>
                  </div>
                </div>

                {/* ✅ NEW: Present Days / Working Days line in UI */}
                <div className="text-center mt-3 text-[10px] font-bold text-slate-600">
                  Present Days / Working Days - {employee.summary.totalPresent} /{' '}
                  {getWorkingDays(selectedYear, selectedMonth, employee.summary.totalLeave)}
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-black uppercase text-slate-400 tracking-wider sticky left-0 bg-slate-50 z-10">
                        Day
                      </th>
                      {employee.records.map((rec, index) => (
                        <th
                          key={`day-${index}`}
                          className="px-2 py-1.5 text-center font-black uppercase text-slate-400 tracking-wider min-w-[50px]"
                        >
                          Day{index + 1}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className="px-2 py-1.5 text-left font-black uppercase text-slate-400 tracking-wider sticky left-0 bg-slate-50 z-10">
                        Date
                      </th>
                      {employee.records.map(rec => (
                        <th
                          key={`date-${rec.date}`}
                          className="px-2 py-1.5 text-center font-bold text-slate-500"
                        >
                          {rec.date.split('-')[2]}-{monthNames[selectedMonth - 1].substring(0, 3)}
                        </th>
                      ))}
                    </tr>
                    {/* ✅ Weekday row in UI */}
                    <tr>
                      <th className="px-2 py-1.5 text-left font-black uppercase text-slate-400 tracking-wider sticky left-0 bg-slate-50 z-10">
                        
                      </th>
                      {employee.records.map(rec => (
                        <th
                          key={`weekday-${rec.date}`}
                          className="px-2 py-1.5 text-center font-bold text-slate-400 italic"
                        >
                          {rec.day ? rec.day.substring(0, 3) : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        In Time
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`in-${rec.date}`}
                          className="px-2 py-1.5 text-center font-mono text-slate-700"
                        >
                          {formatTime(rec.punchInUTC)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Out Time
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`out-${rec.date}`}
                          className="px-2 py-1.5 text-center font-mono text-slate-700"
                        >
                          {formatTime(rec.punchOutUTC)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Late By
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`late-${rec.date}`}
                          className="px-2 py-1.5 text-center font-mono text-amber-600"
                        >
                          {formatMinutesToHHMM(getLateMinutes(rec.punchInUTC))}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Early By
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`early-${rec.date}`}
                          className="px-2 py-1.5 text-center font-mono text-slate-400"
                        >
                          00:00
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        T Duration
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`tdur-${rec.date}`}
                          className="px-2 py-1.5 text-center font-bold font-mono text-slate-700"
                        >
                          {formatHoursToHHMM(rec.effectiveHours)}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Status
                      </td>
                      {employee.records.map(rec => {
                        const statusInfo = getStatusInfo(rec.status);
                        return (
                          <td
                            key={`status-${rec.date}`}
                            className="px-2 py-1.5 text-center"
                          >
                            <span
                              className={`inline-flex items-center justify-center w-6 h-5 rounded-md text-[9px] font-black ${statusInfo.color}`}
                            >
                              {statusInfo.code}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceReport;