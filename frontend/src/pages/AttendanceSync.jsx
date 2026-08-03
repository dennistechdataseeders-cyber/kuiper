// frontend/src/pages/AttendanceSync.jsx - REMOVED VIEW ATTENDANCE PART

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  RefreshCw,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Users,
  FileText,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  Mail,
  Building2,
  Phone,
  X
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const AttendanceSync = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  // State
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [syncResult, setSyncResult] = useState(null);
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // Fetch employee codes on load
  useEffect(() => {
    fetchEmployeeCodes();
  }, []);

  const fetchEmployeeCodes = async () => {
    try {
      console.log('📋 Fetching employee codes...');
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/attendance/employee-codes`,
        authHeader
      );
      console.log('📊 Employee codes response:', res.data);
      
      // Handle different response structures
      const data = res.data.data || res.data || [];
      setEmployeeCodes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      toast.error('Failed to load employee codes');
      setEmployeeCodes([]);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/hr/attendance/sync`,
        { fromDate, toDate },
        authHeader
      );
      setSyncResult(res.data.data);
      toast.success(`Synced ${res.data.data?.processed || 0} records`);
      // Refresh employee codes after sync
      fetchEmployeeCodes();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/hr/attendance/test-connection`,
        { fromDate, toDate },
        authHeader
      );
      setTestResult(res.data.data);
      toast.success('Connection test successful');
      setShowTest(true);
    } catch (error) {
      console.error('Test error:', error);
      toast.error(error.response?.data?.error || 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  // Filter employee codes by search term
  const filteredEmployees = employeeCodes.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate employee codes
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const currentEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Attendance Sync
            </h1>
            <p className="text-slate-500 mt-1">Sync attendance logs from device to HRMS</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={loading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
              Test Connection
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                setFromDate(weekAgo.toISOString().split('T')[0]);
                setToDate(today.toISOString().split('T')[0]);
              }}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                setFromDate(monthAgo.toISOString().split('T')[0]);
                setToDate(today.toISOString().split('T')[0]);
              }}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {showTest && testResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              Connection Test Result
            </h3>
            <button
              onClick={() => setShowTest(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[8px] font-black text-slate-400 uppercase">Total Logs</p>
              <p className="text-lg font-black text-slate-800">{testResult.totalLogs || 0}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[8px] font-black text-slate-400 uppercase">Unique Employees</p>
              <p className="text-lg font-black text-slate-800">{testResult.uniqueEmployees || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-[8px] font-black text-emerald-600 uppercase">Existing</p>
              <p className="text-lg font-black text-emerald-700">{testResult.existingEmployees || 0}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-[8px] font-black text-amber-600 uppercase">Missing</p>
              <p className="text-lg font-black text-amber-700">{testResult.missingEmployees?.length || 0}</p>
            </div>
          </div>
          {testResult.missingEmployees && testResult.missingEmployees.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
                <AlertCircle size={14} />
                Missing Employee Codes: {testResult.missingEmployees.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            Sync Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[8px] font-black text-slate-400 uppercase">Processed</p>
              <p className="text-lg font-black text-slate-800">{syncResult.processed || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-[8px] font-black text-emerald-600 uppercase">Created</p>
              <p className="text-lg font-black text-emerald-700">{syncResult.created || 0}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-[8px] font-black text-blue-600 uppercase">Updated</p>
              <p className="text-lg font-black text-blue-700">{syncResult.updated || 0}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-[8px] font-black text-red-600 uppercase">Errors</p>
              <p className="text-lg font-black text-red-700">{syncResult.errors?.length || 0}</p>
            </div>
          </div>
          {syncResult.errors && syncResult.errors.length > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto">
              {syncResult.errors.slice(0, 5).map((err, idx) => (
                <div key={idx} className="p-2 bg-red-50 rounded-lg border border-red-200 mb-1 text-xs text-red-700">
                  {err.employeeCode}: {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee List - Removed View Attendance button */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            Employee Directory ({employeeCodes.length})
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {currentEmployees.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={40} className="text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-500">No employees found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            currentEmployees.map((emp) => (
              <div key={emp._id || emp.employeeCode} className="p-4 hover:bg-slate-50/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {emp.name?.charAt(0) || emp.employeeCode?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{emp.name || 'Unknown'}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Code: {emp.employeeCode}</span>
                      <span>•</span>
                      <span>{emp.designation || 'No Designation'}</span>
                      <span>•</span>
                      <span>{emp.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
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
    </div>
  );
};

export default AttendanceSync;