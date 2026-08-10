// frontend/src/pages/AttendanceSync.jsx
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
  X,
  ChevronDown,
  ChevronUp,
  Filter
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
      case 'Project Manager': return 'bg-cyan-100 text-cyan-700';
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

      {/* Employee List - Enhanced with Search and Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h3 className="text-sm font-black text-slate-700">
                Employee Directory
              </h3>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {filteredEmployees.length}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, code, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-slate-50 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-blue-400 bg-slate-50 appearance-none cursor-pointer transition-all"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-blue-400 bg-slate-50 cursor-pointer transition-all"
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
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || roleFilter !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Active Filters:</span>
              {roleFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[8px] font-bold">
                  Role: {roleFilter}
                  <button onClick={() => setRoleFilter('ALL')} className="hover:text-blue-900">
                    <X size={10} />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[8px] font-bold">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-slate-900">
                    <X size={10} />
                  </button>
                </span>
              )}
              <span className="text-[8px] text-slate-400 ml-auto">
                {filteredEmployees.length} result{filteredEmployees.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Employee List */}
        <div className="divide-y divide-slate-100">
          {currentEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
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
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
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
                      <p className="font-bold text-slate-800 truncate">{emp.name || 'Unknown'}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black ${getRoleColor(emp.role)}`}>
                        {emp.role || 'N/A'}
                      </span>
                      {emp.designation && (
                        <span className="text-[9px] text-slate-500 font-medium">{emp.designation}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="font-mono font-bold text-slate-600">Code: {emp.employeeCode || 'N/A'}</span>
                      </span>
                      {emp.email && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{emp.email}</span>
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
            <div className="text-[10px] font-bold text-slate-400">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
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
                    return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">…</span>;
                  }
                  
                  if (pageNum === totalPages && i < 6 && currentPage < totalPages - 3 && totalPages > 7) {
                    return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">…</span>;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
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
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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