// frontend/src/pages/AttendanceSync.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  X,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const AttendanceSync = () => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // Get unique roles for filter
  const getUniqueRoles = () => {
    const roles = new Set();
    employeeCodes.forEach(emp => {
      if (emp.role) roles.add(emp.role);
    });
    return ['ALL', ...Array.from(roles)];
  };

  // Fetch employee codes on load
  useEffect(() => {
    fetchEmployeeCodes();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

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
      
      // ✅ FILTER OUT CLIENT ROLE USERS
      const filteredEmployees = Array.isArray(data) 
        ? data.filter(emp => emp.role !== 'Client')
        : [];
      
      console.log(`✅ Filtered out Client roles. ${filteredEmployees.length} employees remaining`);
      setEmployeeCodes(filteredEmployees);
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

  // Filter employee codes by search term and role
  const filteredEmployees = employeeCodes.filter(emp => {
    // Extra safety filter - exclude Client
    if (emp.role === 'Client') return false;
    
    // Role filter
    if (roleFilter !== 'ALL' && emp.role !== roleFilter) return false;
    
    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      return (
        emp.name?.toLowerCase().includes(search) ||
        emp.employeeCode?.toLowerCase().includes(search) ||
        emp.email?.toLowerCase().includes(search) ||
        emp.designation?.toLowerCase().includes(search) ||
        emp.department?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  // Paginate employee codes
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Get role badge color
  const getRoleColor = (role) => {
    switch(role) {
      case 'Admin': return 'bg-purple-100 text-purple-700';
      case 'Developer': return 'bg-blue-100 text-blue-700';
      case 'Sales': return 'bg-emerald-100 text-emerald-700';
      case 'Sales Manager': return 'bg-orange-100 text-orange-700';
      case 'Project Manager':
      case 'Project Coordinator': return 'bg-cyan-100 text-cyan-700';
      case 'HR': return 'bg-pink-100 text-pink-700';
      case 'Finance': return 'bg-green-100 text-green-700';
      case 'Team Lead': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="page bg-slate-50">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="page-title">
              Attendance Sync
            </h1>
            <p className="text-sm text-slate-500 mt-1">Sync attendance logs from device to HRMS</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleTestConnection}
              disabled={loading}
              className="btn btn-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
              Test Connection
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card mb-4 sm:mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="label block mb-1.5">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input bg-slate-50"
            />
          </div>
          <div>
            <label className="label block mb-1.5">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input bg-slate-50"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                setFromDate(weekAgo.toISOString().split('T')[0]);
                setToDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-md bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              className="btn btn-md bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {showTest && testResult && (
        <div className="card mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              Connection Test Result
            </h3>
            <button
              onClick={() => setShowTest(false)}
              className="btn-icon text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Logs</p>
              <p className="text-lg font-bold text-slate-800">{testResult.totalLogs || 0}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-semibold text-slate-400 uppercase">Unique Employees</p>
              <p className="text-lg font-bold text-slate-800">{testResult.uniqueEmployees || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs font-semibold text-emerald-600 uppercase">Existing</p>
              <p className="text-lg font-bold text-emerald-700">{testResult.existingEmployees || 0}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs font-semibold text-amber-600 uppercase">Missing</p>
              <p className="text-lg font-bold text-amber-700">{testResult.missingEmployees?.length || 0}</p>
            </div>
          </div>
          {testResult.missingEmployees && testResult.missingEmployees.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                Missing Employee Codes: {testResult.missingEmployees.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className="card mb-4 sm:mb-6">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            Sync Results
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-semibold text-slate-400 uppercase">Processed</p>
              <p className="text-lg font-bold text-slate-800">{syncResult.processed || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs font-semibold text-emerald-600 uppercase">Created</p>
              <p className="text-lg font-bold text-emerald-700">{syncResult.created || 0}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-600 uppercase">Updated</p>
              <p className="text-lg font-bold text-blue-700">{syncResult.updated || 0}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs font-semibold text-red-600 uppercase">Errors</p>
              <p className="text-lg font-bold text-red-700">{syncResult.errors?.length || 0}</p>
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

      {/* Employee List - Enhanced with Search and Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h3 className="section-title">
                Employee Directory
              </h3>
              <span className="badge rounded-full text-slate-400 bg-slate-100">
                {filteredEmployees.length}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap gap-2 w-full lg:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, code, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9 bg-slate-50"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="btn-icon absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 right-0 md:right-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Role Filter */}
              <div className="relative min-w-[140px]">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="input pl-9 pr-8 bg-slate-50 appearance-none cursor-pointer"
                >
                  {getUniqueRoles().map(role => (
                    <option key={role} value={role}>
                      {role === 'ALL' ? 'All Roles' : role}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Items Per Page */}
              <div className="relative min-w-[100px]">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="input bg-slate-50 cursor-pointer"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(searchTerm || roleFilter !== 'ALL') && (
                <button
                  onClick={clearFilters}
                  className="btn btn-md bg-red-50 text-red-600 hover:bg-red-100"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || roleFilter !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Active Filters:</span>
              {roleFilter !== 'ALL' && (
                <span className="badge rounded-full bg-blue-100 text-blue-700">
                  Role: {roleFilter}
                  <button onClick={() => setRoleFilter('ALL')} className="btn-icon hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="badge rounded-full bg-slate-100 text-slate-700">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="btn-icon hover:text-slate-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {filteredEmployees.length} result{filteredEmployees.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Employee List */}
        <div className="divide-y divide-slate-100">
          {currentEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4 shrink-0">
                <Users size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">No employees found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || roleFilter !== 'ALL' 
                  ? 'Try adjusting your filters' 
                  : 'No employees with employee codes found'}
              </p>
              {(searchTerm || roleFilter !== 'ALL') && (
                <button
                  onClick={clearFilters}
                  className="btn btn-md mt-3 bg-blue-600 text-white hover:bg-blue-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            currentEmployees.map((emp) => (
              <div key={emp._id || emp.employeeCode} className="p-4 hover:bg-slate-50/60 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {emp.name?.charAt(0) || emp.employeeCode?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800 min-w-0 break-words">{emp.name || 'Unknown'}</p>
                      <span className={`badge rounded-full ${getRoleColor(emp.role)}`}>
                        {emp.role || 'N/A'}
                      </span>
                      {emp.designation && (
                        <span className="text-xs text-slate-500 font-medium">{emp.designation}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="font-mono font-bold text-slate-600">Code: {emp.employeeCode || 'N/A'}</span>
                      </span>
                      {emp.email && (
                        <>
                          <span>•</span>
                          <span className="min-w-0 break-words md:truncate md:max-w-[200px]">{emp.email}</span>
                        </>
                      )}
                      {emp.department && emp.department !== 'Other' && (
                        <>
                          <span>•</span>
                          <span>{emp.department}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs font-semibold text-slate-400">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex flex-wrap justify-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                    if (i === 6) pageNum = totalPages;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                    if (i === 0) pageNum = 1;
                    if (i === 6) pageNum = totalPages;
                  }
                  
                  if (pageNum === 1 && i > 0 && currentPage > 4 && totalPages > 7) {
                    return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">…</span>;
                  }
                  
                  if (pageNum === totalPages && i < 6 && currentPage < totalPages - 3 && totalPages > 7) {
                    return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">…</span>;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`btn-icon ${
                        currentPage === pageNum
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
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