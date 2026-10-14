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
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ============================================================
// ✅ SHARED TIME HELPERS (Matches AttendanceCombined / Timeline)
// ============================================================

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +05:30

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

const durationFraction = (hours) => {
  if (!hours || hours <= 0) return null;
  const totalSeconds = Math.round(hours * 3600);
  return totalSeconds / 86400;
};

const minutesFraction = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  const totalSeconds = Math.round(minutes * 60);
  return totalSeconds / 86400;
};

/**
 * ✅ Shift-based lateness (Option B — ShiftHistory)
 * Reads the persisted `lateMinutes` field from the API response.
 */
const getRecordLateMinutes = (rec) => {
  if (!rec) return 0;
  const v = Number(rec.lateMinutes);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const formatMinutesToHHMM = (minutes) => {
  if (!minutes || minutes <= 0) return '00:00';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

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
    case 'Holiday': return { code: 'H', color: 'bg-red-100 text-red-700' };
    default: return { code: '?', color: 'bg-slate-100 text-slate-700' };
  }
};

const getDayColumnClass = (rec) => {
  if (!rec) return '';
  if (rec.holiday) return 'bg-red-100 text-red-800';
  return '';
};

const getWorkingDays = (year, month, leaveCount = 0) => {
  const totalDays = new Date(year, month, 0).getDate();
  let weekendCount = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) weekendCount++;
  }
  return totalDays - weekendCount - (leaveCount || 0);
};

const countDailyBreaks = (rec) => {
  if (!rec) return 0;

  if (rec.isWeekend) return 0;
  if (
    rec.status === 'Weekend' ||
    rec.status === 'Leave' ||
    rec.status === 'Absent' ||
    rec.status === 'Holiday'
  ) {
    return 0;
  }

  const sessions = Array.isArray(rec.sessions) ? rec.sessions : [];
  if (sessions.length <= 1) return 0;

  return sessions.length - 1;
};

// ============================================================
// ✅ Excel Color Constants (match frontend)
// ============================================================
const COLOR = {
  lateFill:    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }, // amber-200 / yellow
  lateFont:    { color: { argb: 'FF78350F' }, bold: true },                         // amber-900
  holidayFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, // red-100
  holidayFont: { color: { argb: 'FF991B1B' }, bold: true },                         // red-800
  headerFill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }, // slate-100
  headerFont:  { bold: true, color: { argb: 'FF64748B' } },                         // slate-500
  labelFont:   { bold: true, color: { argb: 'FF475569' } },                         // slate-600
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

  // ============================================================
  // Group + summarize
  // ============================================================
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
      let totalGrossHours = 0;
      let totalBreakMinutes = 0;
      let totalBreaksCount = 0;
      let breakDaysCount = 0;

      const sortedRecords = employee.records.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      sortedRecords.forEach(record => {
        switch (record.status) {
          case 'Present':
            totalPresent += 1;
            break;
          case 'Late':
            totalPresent += 1;
            totalLateMinutes += getRecordLateMinutes(record);
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

        if (
          record.status === 'Present' ||
          record.status === 'Late' ||
          record.status === 'Partial'
        ) {
          const eff = record.effectiveHours || 0;
          const gross = record.grossHours || 0;

          totalEffectiveHours += eff;
          totalGrossHours += gross;

          const breakMin = Math.max(0, (gross - eff) * 60);
          if (breakMin > 0.5) {
            totalBreakMinutes += breakMin;
          }

          const dailyBreaks = countDailyBreaks(record);
          if (dailyBreaks > 0) {
            totalBreaksCount += dailyBreaks;
            breakDaysCount += 1;
          }
        }
      });

      const avgBreaksPerDay =
        breakDaysCount > 0 ? totalBreaksCount / breakDaysCount : 0;

      return {
        ...employee,
        records: sortedRecords,
        summary: {
          totalPresent,
          totalAbsent,
          totalLeave,
          totalDuration: formatHoursToHHMM(totalEffectiveHours),
          totalGrossDuration: formatHoursToHHMM(totalGrossHours),
          totalLateBy: formatMinutesToHHMM(totalLateMinutes),
          totalBreaksCount,
          breakDaysCount,
          avgBreaksPerDay: Number(avgBreaksPerDay.toFixed(2)),
          totalBreakMinutes,
          totalBreakFormatted: formatMinutesToHHMM(totalBreakMinutes),
        }
      };
    });
  }, [reportData]);

  // ============================================================
  // Excel export (ExcelJS — supports cell fills/fonts/formatting)
  //
  // Color rules (match the frontend):
  //   - Late day  → yellow fill on the "In Time" cell
  //   - Holiday   → red fill on the entire day column (all rows)
  //                 and "—" instead of a value
  // ============================================================
  const exportToExcel = async () => {
    if (groupedAndSummarizedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      // Lazy-load heavy deps so they don't bloat the main bundle
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Work Duration Report', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 0 }],
      });

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

      // Track the widest row we ever write so we can size columns at the end
      let maxColsUsed = 1;
      const trackCols = (count) => {
        if (count > maxColsUsed) maxColsUsed = count;
      };

      // ---------- Title block ----------
      ws.addRow(['Techdataseeders']);
      ws.addRow(['Work Duration Report']);
      ws.addRow([period]);
      ws.addRow([]);
      ws.addRow([`Generated On: ${generatedOn}`]);
      ws.addRow([]);
      trackCols(1);

      // ---------- Per employee ----------
      for (const employee of groupedAndSummarizedData) {
        // ----- Header block -----
        ws.addRow(['Department:-', 'DefaultDepartment']);

        const codeNameRow = ws.addRow([
          `Employee Code:- ${employee.employeeCode || 'N/A'}`,
          '', '', '', '', '', '',
          `Employee Name:- ${employee.employeeName}`
        ]);
        trackCols(8);

        const leaveCount = employee.summary.totalLeave || 0;
        const workingDays = getWorkingDays(selectedYear, selectedMonth, leaveCount);
        const presentDays = employee.summary.totalPresent;

        ws.addRow([`Present Days / Working Days - ${presentDays} / ${workingDays}`]);
        ws.addRow([
          `Total Breaks: ${employee.summary.totalBreaksCount} session(s) across ${employee.summary.breakDaysCount} day(s)  |  Total Break Time: ${employee.summary.totalBreakFormatted}  |  Avg Breaks/Day: ${employee.summary.avgBreaksPerDay}`
        ]);
        ws.addRow([]);

        // ----- Day / Date / Weekday header rows -----
        const dayHeaderRow     = ['Day'];
        const dateHeaderRow    = ['Days'];
        const weekdayHeaderRow = [''];

        employee.records.forEach((rec, idx) => {
          dayHeaderRow.push(`Day${idx + 1}`);
          dateHeaderRow.push(`${rec.date.split('-')[2]}-${monthName.substring(0, 3)}`);
          weekdayHeaderRow.push(rec.day ? rec.day.substring(0, 3) : '');
        });

        const rDay  = ws.addRow(dayHeaderRow);
        const rDate = ws.addRow(dateHeaderRow);
        const rWeek = ws.addRow(weekdayHeaderRow);
        trackCols(dayHeaderRow.length);

        // Style those 3 header rows: gray header, red for holiday columns
        [rDay, rDate, rWeek].forEach((row) => {
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber === 1) return; // skip label column
            const rec = employee.records[colNumber - 2];
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (rec?.holiday) {
              cell.fill = COLOR.holidayFill;
              cell.font = COLOR.holidayFont;
            } else {
              cell.fill = COLOR.headerFill;
              cell.font = COLOR.headerFont;
            }
          });
        });

        // Helper to write a data row with per-record styling
        const writeRow = (label, cells, opts = {}) => {
          const row = ws.addRow([label, ...cells]);
          trackCols(row.cellCount);

          // Style label cell
          row.getCell(1).font = COLOR.labelFont;
          row.getCell(1).alignment = { vertical: 'middle' };

          employee.records.forEach((rec, idx) => {
            const cell = row.getCell(idx + 2);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };

            if (rec.holiday) {
              cell.fill = COLOR.holidayFill;
              cell.font = COLOR.holidayFont;
              return;
            }

            // per-row extra styling (like numFmt)
            if (opts.numFmt) cell.numFmt = opts.numFmt;
            if (opts.font) cell.font = opts.font;

            // Late highlight only on the In Time column
            if (opts.highlightLate && rec.isLate) {
              cell.fill = COLOR.lateFill;
              cell.font = COLOR.lateFont;
            }
          });

          return row;
        };

        // ----- In Time -----
        writeRow(
          'In Time',
          employee.records.map((rec) =>
            rec.holiday ? '—' : timeFractionIST(rec.punchInUTC)
          ),
          { numFmt: 'hh:mm:ss', highlightLate: true }
        );

        // ----- Out Time -----
        writeRow(
          'Out Time',
          employee.records.map((rec) =>
            rec.holiday ? '—' : timeFractionIST(rec.punchOutUTC)
          ),
          { numFmt: 'hh:mm:ss' }
        );

        // ----- Late By -----
        writeRow(
          'Late By',
          employee.records.map((rec) =>
            rec.holiday ? '—' : minutesFraction(getRecordLateMinutes(rec))
          ),
          { numFmt: 'hh:mm' }
        );

        // ----- Early By (placeholder) -----
        writeRow(
          'Early By',
          employee.records.map((rec) => (rec.holiday ? '—' : null)),
          { numFmt: 'hh:mm' }
        );

        // ----- T Duration -----
        writeRow(
          'T Duration',
          employee.records.map((rec) =>
            rec.holiday ? '—' : durationFraction(rec.effectiveHours)
          ),
          { numFmt: 'hh:mm' }
        );

        // ----- Gross Duration -----
        writeRow(
          'Gross Duration',
          employee.records.map((rec) =>
            rec.holiday ? '—' : durationFraction(rec.grossHours)
          ),
          { numFmt: 'hh:mm' }
        );

        // ----- Breaks count -----
        writeRow(
          'Breaks',
          employee.records.map((rec) =>
            rec.holiday ? '—' : countDailyBreaks(rec)
          ),
          { numFmt: '0' }
        );

        // ----- Break Duration -----
        writeRow(
          'Break Duration',
          employee.records.map((rec) => {
            if (rec.holiday) return '—';
            const eff = rec.effectiveHours || 0;
            const gross = rec.grossHours || 0;
            return durationFraction(Math.max(0, gross - eff));
          }),
          { numFmt: 'hh:mm' }
        );

        // ----- Status -----
        writeRow(
          'Status',
          employee.records.map((rec) =>
            rec.holiday ? 'H' : getStatusInfo(rec.status).code
          ),
          {}
        );

        // Spacing between employees
        ws.addRow([]);
        ws.addRow([]);
      }

      // ---------- Column widths ----------
      // Column A = labels + header info; columns B..N = per-day cells
      ws.getColumn(1).width = 24;
      for (let i = 2; i <= maxColsUsed; i++) {
        ws.getColumn(i).width = 11;
      }

      // ---------- Save ----------
      const buffer = await wb.xlsx.writeBuffer();
      const filename = `Work_Duration_Report_${monthName}_${selectedYear}.xlsx`;
      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        filename
      );

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
                          className={`px-2 py-1.5 text-center font-black uppercase tracking-wider min-w-[50px] ${
                            rec.holiday ? 'bg-red-100 text-red-700' : 'text-slate-400'
                          }`}
                          title={rec.holiday ? rec.holidayName : undefined}
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
                          className={`px-2 py-1.5 text-center font-bold ${
                            rec.holiday ? 'bg-red-100 text-red-700' : 'text-slate-500'
                          }`}
                          title={rec.holiday ? rec.holidayName : undefined}
                        >
                          {rec.date.split('-')[2]}-{monthNames[selectedMonth - 1].substring(0, 3)}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className="px-2 py-1.5 text-left font-black uppercase text-slate-400 tracking-wider sticky left-0 bg-slate-50 z-10">
                        
                      </th>
                      {employee.records.map(rec => (
                        <th
                          key={`weekday-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-bold italic ${
                            rec.holiday ? 'bg-red-100 text-red-700' : 'text-slate-400'
                          }`}
                          title={rec.holiday ? rec.holidayName : undefined}
                        >
                          {rec.day ? rec.day.substring(0, 3) : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* In Time */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        In Time
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`in-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-mono ${
                            rec.holiday
                              ? 'bg-red-100 text-red-800'
                              : rec.isLate
                              ? 'bg-amber-200 text-amber-900 font-bold'
                              : 'text-slate-700'
                          }`}
                          title={
                            rec.holiday
                              ? rec.holidayName
                              : rec.isLate
                              ? `Late by ${rec.lateMinutes} min (shift: ${rec.shiftStartMinutesUsed}m)`
                              : undefined
                          }
                        >
                          {rec.holiday ? '—' : formatTime(rec.punchInUTC)}
                        </td>
                      ))}
                    </tr>

                    {/* Out Time */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Out Time
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`out-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-mono ${getDayColumnClass(rec)} ${
                            rec.holiday ? '' : 'text-slate-700'
                          }`}
                        >
                          {rec.holiday ? '—' : formatTime(rec.punchOutUTC)}
                        </td>
                      ))}
                    </tr>

                    {/* Late By */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Late By
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`late-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-mono ${getDayColumnClass(rec)} ${
                            rec.holiday ? '' : 'text-amber-600'
                          }`}
                        >
                          {rec.holiday ? '—' : formatMinutesToHHMM(getRecordLateMinutes(rec))}
                        </td>
                      ))}
                    </tr>

                    {/* Early By */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Early By
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`early-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-mono ${getDayColumnClass(rec)} ${
                            rec.holiday ? '' : 'text-slate-400'
                          }`}
                        >
                          {rec.holiday ? '—' : '00:00'}
                        </td>
                      ))}
                    </tr>

                    {/* T Duration */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        T Duration
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`tdur-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-bold font-mono ${getDayColumnClass(rec)} ${
                            rec.holiday ? '' : 'text-slate-700'
                          }`}
                        >
                          {rec.holiday ? '—' : formatHoursToHHMM(rec.effectiveHours)}
                        </td>
                      ))}
                    </tr>

                    {/* Gross Duration */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Gross Duration
                      </td>
                      {employee.records.map(rec => (
                        <td
                          key={`gdur-${rec.date}`}
                          className={`px-2 py-1.5 text-center font-bold font-mono ${getDayColumnClass(rec)} ${
                            rec.holiday ? '' : 'text-slate-700'
                          }`}
                        >
                          {rec.holiday ? '—' : formatHoursToHHMM(rec.grossHours)}
                        </td>
                      ))}
                    </tr>

                    {/* Breaks */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Breaks
                      </td>
                      {employee.records.map(rec => {
                        const dailyBreaks = countDailyBreaks(rec);
                        return (
                          <td
                            key={`brk-${rec.date}`}
                            className={`px-2 py-1.5 text-center ${getDayColumnClass(rec)}`}
                          >
                            {rec.holiday ? (
                              '—'
                            ) : (
                              <span
                                className={`inline-flex items-center justify-center min-w-[24px] h-5 rounded-md text-[9px] font-black ${
                                  dailyBreaks === 0
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {dailyBreaks}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Break Duration */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Break Duration
                      </td>
                      {employee.records.map(rec => {
                        const eff = rec.effectiveHours || 0;
                        const gross = rec.grossHours || 0;
                        const breakHours = Math.max(0, gross - eff);
                        return (
                          <td
                            key={`bdur-${rec.date}`}
                            className={`px-2 py-1.5 text-center font-bold font-mono ${getDayColumnClass(rec)} ${
                              rec.holiday ? '' : 'text-slate-500'
                            }`}
                          >
                            {rec.holiday ? '—' : formatHoursToHHMM(breakHours)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Status */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-2 py-1.5 font-bold text-slate-600 sticky left-0 bg-white z-10">
                        Status
                      </td>
                      {employee.records.map(rec => {
                        const statusInfo = getStatusInfo(rec.status);
                        return (
                          <td
                            key={`status-${rec.date}`}
                            className={`px-2 py-1.5 text-center ${getDayColumnClass(rec)}`}
                          >
                            <span
                              className={`inline-flex items-center justify-center w-6 h-5 rounded-md text-[9px] font-black ${statusInfo.color}`}
                              title={rec.holiday ? rec.holidayName : undefined}
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