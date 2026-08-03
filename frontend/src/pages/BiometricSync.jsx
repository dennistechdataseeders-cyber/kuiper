// frontend/src/pages/BiometricSync.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Fingerprint,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  Eye
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const BiometricSync = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [syncResult, setSyncResult] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [employeeMapping, setEmployeeMapping] = useState(null);
  const [activeTab, setActiveTab] = useState('sync');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState(null);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const handleSync = async () => {
    setLoading(true);
    setSyncResult(null);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/hr/biometric/sync`,
        { fromDate, toDate },
        authHeader
      );
      setSyncResult(res.data.data);
      toast.success(res.data.message || 'Sync completed successfully');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.response?.data?.error || 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/biometric/test`,
        authHeader
      );
      setTestResult(res.data.data);
      toast.success(res.data.message || 'Connection test successful');
    } catch (error) {
      console.error('Test error:', error);
      toast.error(error.response?.data?.error || 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMapEmployees = async () => {
    setLoading(true);
    setEmployeeMapping(null);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/hr/biometric/map-employees`,
        { fromDate, toDate },
        authHeader
      );
      setEmployeeMapping(res.data.data);
      toast.success('Employee mapping completed');
    } catch (error) {
      console.error('Mapping error:', error);
      toast.error(error.response?.data?.error || 'Mapping failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeAttendance = async (empCode) => {
    setLoading(true);
    setEmployeeAttendance(null);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/biometric/employee/${empCode}`,
        {
          ...authHeader,
          params: { fromDate, toDate }
        }
      );
      setEmployeeAttendance(res.data.data);
      setSelectedEmployee(empCode);
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to fetch employee attendance');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'partial': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'present': return <CheckCircle size={14} className="text-emerald-600" />;
      case 'partial': return <AlertCircle size={14} className="text-amber-600" />;
      case 'absent': return <XCircle size={14} className="text-red-600" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl">
            <Fingerprint size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Biometric Attendance Sync
            </h1>
            <p className="text-slate-500 mt-1">Sync attendance logs from biometric device</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1">
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'sync'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <RefreshCw size={14} />
            Sync
          </div>
        </button>
        <button
          onClick={() => setActiveTab('mapping')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'mapping'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users size={14} />
            Employee Mapping
          </div>
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'test'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle size={14} />
            Test Connection
          </div>
        </button>
      </div>

      {/* Sync Tab */}
      {activeTab === 'sync' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-indigo-400"
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
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-indigo-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSync}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Sync Attendance
              </button>
            </div>
          </div>

          {/* Sync Results */}
          {syncResult && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                Sync Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Processed</p>
                  <p className="text-lg font-black text-slate-800">{syncResult.processed || 0}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-[8px] font-black text-emerald-600 uppercase">Created</p>
                  <p className="text-lg font-black text-emerald-700">{syncResult.created || 0}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-[8px] font-black text-blue-600 uppercase">Updated</p>
                  <p className="text-lg font-black text-blue-700">{syncResult.updated || 0}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-[8px] font-black text-red-600 uppercase">Errors</p>
                  <p className="text-lg font-black text-red-700">{syncResult.errors?.length || 0}</p>
                </div>
              </div>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-4 max-h-32 overflow-y-auto">
                  {syncResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx} className="p-2 bg-red-50 rounded-lg border border-red-200 mb-1 text-xs text-red-700">
                      {err.employeeCode}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mapping Tab */}
      {activeTab === 'mapping' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-6">
            <button
              onClick={handleMapEmployees}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              Map Employee Codes
            </button>
            <p className="text-[10px] text-slate-400 mt-2">
              This will fetch all employee codes from biometric system and show their mapping status
            </p>
          </div>

          {employeeMapping && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Biometric Codes</p>
                  <p className="text-lg font-black text-slate-800">{employeeMapping.totalBiometricCodes || 0}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-[8px] font-black text-emerald-600 uppercase">Mapped Users</p>
                  <p className="text-lg font-black text-emerald-700">{employeeMapping.mappedCount || 0}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-[8px] font-black text-amber-600 uppercase">Missing Codes</p>
                  <p className="text-lg font-black text-amber-700">{employeeMapping.missingCount || 0}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-[8px] font-black text-red-600 uppercase">Unassigned Users</p>
                  <p className="text-lg font-black text-red-700">{employeeMapping.unassignedUsers || 0}</p>
                </div>
              </div>

              {employeeMapping.missingCodes && employeeMapping.missingCodes.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="text-sm font-black text-amber-700 mb-2">Missing Employee Codes</h4>
                  <div className="flex flex-wrap gap-2">
                    {employeeMapping.missingCodes.map((code, idx) => (
                      <button
                        key={idx}
                        onClick={() => fetchEmployeeAttendance(code)}
                        className="px-3 py-1.5 bg-white rounded-lg border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1"
                      >
                        {code}
                        <Eye size={12} className="text-amber-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {employeeMapping.usersWithoutCode && employeeMapping.usersWithoutCode.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="text-sm font-black text-red-700 mb-2">Users Without Employee Code</h4>
                  <div className="flex flex-wrap gap-2">
                    {employeeMapping.usersWithoutCode.map((user, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded-lg border border-red-200 text-xs font-bold text-red-700">
                        {user.name} ({user.role})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {employeeMapping.mappedUsers && employeeMapping.mappedUsers.length > 0 && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <h4 className="text-sm font-black text-emerald-700 mb-2">Mapped Users</h4>
                  <div className="flex flex-wrap gap-2">
                    {employeeMapping.mappedUsers.map((user, idx) => (
                      <button
                        key={idx}
                        onClick={() => fetchEmployeeAttendance(user.employeeCode)}
                        className="px-3 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1"
                      >
                        {user.name} ({user.employeeCode})
                        <Eye size={12} className="text-emerald-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Tab */}
      {activeTab === 'test' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <button
            onClick={handleTest}
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Test Biometric Connection
          </button>

          {testResult && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                Connection Test Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Status</p>
                  <p className="text-sm font-black text-emerald-600">✅ Connected</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Total Logs</p>
                  <p className="text-lg font-black text-slate-800">{testResult.logCount || 0}</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Token Valid</p>
                  <p className="text-sm font-black text-emerald-600">
                    {testResult.tokenValid ? '✅ Valid' : '❌ Invalid'}
                  </p>
                </div>
              </div>
              {testResult.sampleLogs && testResult.sampleLogs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Sample Logs</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {testResult.sampleLogs.map((log, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center gap-2">
                        <span className="font-bold">{log.UserName}</span>
                        <span className="text-slate-500">{log.EmpCode}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          log.IOMode === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {log.IOMode}
                        </span>
                        <span className="text-slate-400">{new Date(log.IOTime).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Employee Attendance Modal */}
      {employeeAttendance && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-black text-slate-800">Employee Attendance</h2>
                <p className="text-sm text-slate-500">
                  {employeeAttendance.employee.name} ({employeeAttendance.employee.employeeCode})
                </p>
              </div>
              <button
                onClick={() => {
                  setEmployeeAttendance(null);
                  setSelectedEmployee(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-[8px] font-black text-emerald-600 uppercase">Present</p>
                  <p className="text-2xl font-black text-emerald-700">{employeeAttendance.summary.present}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-[8px] font-black text-red-600 uppercase">Absent</p>
                  <p className="text-2xl font-black text-red-700">{employeeAttendance.summary.absent}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-[8px] font-black text-amber-600 uppercase">Late</p>
                  <p className="text-2xl font-black text-amber-700">{employeeAttendance.summary.late}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-[8px] font-black text-blue-600 uppercase">Total Hours</p>
                  <p className="text-2xl font-black text-blue-700">{employeeAttendance.summary.totalHours.toFixed(1)}h</p>
                </div>
              </div>

              {/* Daily Logs Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Date</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Day</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Hours</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Punch In</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Punch Out</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeAttendance.days.map((day, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                        <td className="px-4 py-2 text-xs font-medium text-slate-700">{day.date}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{day.dayName}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black ${getStatusBadge(day.status)}`}>
                            {getStatusIcon(day.status)}
                            {day.status.charAt(0).toUpperCase() + day.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-700">{day.hoursWorked || '-'}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {day.punchIn ? new Date(day.punchIn).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {day.punchOut ? new Date(day.punchOut).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {day.logCount || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiometricSync;