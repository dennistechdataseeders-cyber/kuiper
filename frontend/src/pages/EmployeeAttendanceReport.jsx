// frontend/src/pages/EmployeeAttendanceReport.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Download,
  Calendar,
  Loader2,
  Search,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Mail,
  Building2,
  X,
  XCircle,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const EmployeeAttendanceReport = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  // State
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState(null);
  const itemsPerPage = 20;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch employees on load
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (employees.length > 0) {
      fetchReport();
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees`, authHeader);
      if (res.data.success) {
        // Employees already exclude Clients from the backend
        setEmployees(res.data.employees);
        if (res.data.employees.length > 0 && selectedEmployee === 'all') {
          setSelectedEmployee('all');
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
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
        setSummary(res.data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (reportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      // Prepare data for Excel
      const excelData = reportData.map(row => ({
        'Employee': row.employeeName,
        'Employee Code': row.employeeCode,
        'Email': row.employeeEmail,
        'Date': row.date,
        'Day': row.day,
        'Status': row.status,
        'In': row.punchIn,
        'Out': row.punchOut,
        'Effective (h)': row.effectiveHours,
        'Gross (h)': row.grossHours,
        'Arrival': row.arrival
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Employee
        { wch: 15 }, // Employee Code
        { wch: 25 }, // Email
        { wch: 12 }, // Date
        { wch: 10 }, // Day
        { wch: 10 }, // Status
        { wch: 10 }, // In
        { wch: 10 }, // Out
        { wch: 12 }, // Effective
        { wch: 12 }, // Gross
        { wch: 12 }  // Arrival
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

      // Generate filename
      const employeeName = selectedEmployee === 'all' 
        ? 'All_Employees' 
        : employees.find(e => e._id === selectedEmployee)?.name || 'Employee';
      const monthName = monthNames[selectedMonth - 1];
      const filename = `Attendance_Report_${employeeName}_${monthName}_${selectedYear}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success(`Report exported successfully: ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Filter report data by search term
  const filteredData = reportData.filter(row =>
    row.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.date?.includes(searchTerm)
  );

  // Paginate data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'Present': return 'bg-emerald-100 text-emerald-700';
      case 'Late': return 'bg-amber-100 text-amber-700';
      case 'Absent': return 'bg-rose-100 text-rose-700';
      case 'Leave': return 'bg-indigo-100 text-indigo-700';
      case 'Weekend': return 'bg-slate-100 text-slate-500';
      case 'Partial': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch(status) {
      case 'Present': return <CheckCircle size={12} className="text-emerald-600" />;
      case 'Late': return <AlertCircle size={12} className="text-amber-600" />;
      case 'Absent': return <XCircle size={12} className="text-rose-600" />;
      case 'Leave': return <Calendar size={12} className="text-indigo-600" />;
      case 'Weekend': return <Calendar size={12} className="text-slate-400" />;
      case 'Partial': return <Clock size={12} className="text-amber-600" />;
      default: return <FileText size={12} className="text-slate-400" />;
    }
  };

  // Calculate statistics
  const stats = {
    total: reportData.length,
    present: reportData.filter(r => r.status === 'Present').length,
    late: reportData.filter(r => r.status === 'Late').length,
    absent: reportData.filter(r => r.status === 'Absent').length,
    leave: reportData.filter(r => r.status === 'Leave').length,
    weekend: reportData.filter(r => r.status === 'Weekend').length,
    partial: reportData.filter(r => r.status === 'Partial').length
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Employee Attendance Report
            </h1>
            <p className="text-slate-500 mt-1">Generate and export attendance reports for all employees</p>
          </div>
          <button
            onClick={exportToExcel}
            disabled={exporting || reportData.length === 0}
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
          {/* Employee Filter */}
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

          {/* Month Filter */}
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

          {/* Year Filter */}
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

      {/* Search */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name, code, or date..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Loading report data...</p>
        </div>
      ) : reportData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500">No attendance data found</p>
          <p className="text-xs text-slate-400 mt-1">
            {selectedEmployee === 'all' 
              ? 'No employees have attendance records for this period' 
              : 'This employee has no attendance records for this period'}
          </p>
          <button
            onClick={fetchReport}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          >
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Employee</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Code</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Date</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Day</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">In</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Out</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Eff</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Gross</th>
                  <th className="px-3 py-3 text-left text-[8px] font-black uppercase text-slate-400 tracking-wider">Arrival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                          {row.employeeName?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">
                          {row.employeeName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-slate-500">{row.employeeCode}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium text-slate-700">{row.date}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500">{row.day}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold ${getStatusColor(row.status)}`}>
                        {getStatusIcon(row.status)}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-slate-700">{row.punchIn}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-slate-700">{row.punchOut}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold text-emerald-700">{row.effectiveHours}h</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium text-slate-700">{row.grossHours}h</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${row.arrival.includes('late') ? 'text-amber-600' : row.arrival === 'On Time' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {row.arrival}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-slate-600 flex items-center px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceReport;