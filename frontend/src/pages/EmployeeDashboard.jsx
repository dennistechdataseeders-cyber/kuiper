// frontend/src/pages/EmployeeDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  TrendingUp,
  Building2,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Plus,
  Eye,
  Send,
  X,
  Check,
  Activity,
  BarChart3,
  Coffee,
  Briefcase
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const EmployeeDashboard = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  // State
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMissedPunchModal, setShowMissedPunchModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('dashboard');

  // Leave form
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Casual',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    reason: ''
  });

  // Missed punch form
  const [punchForm, setPunchForm] = useState({
    date: '',
    type: 'in',
    expectedTime: '',
    reason: ''
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, attendanceRes, statsRes, balanceRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/today`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/monthly-stats`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/leave/balance`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/leave/history`, authHeader)
      ]);

      setProfile(profileRes.data.data);
      setTodayAttendance(attendanceRes.data.data);
      setMonthlyStats(statsRes.data.data);
      setLeaveBalance(balanceRes.data.data);
      setLeaveHistory(historyRes.data.data || []);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply for leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    setProcessing(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/employee/leave/apply`,
        leaveForm,
        authHeader
      );
      toast.success('Leave request submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({
        leaveType: 'Casual',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        reason: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error applying for leave:', error);
      toast.error(error.response?.data?.error || 'Failed to apply for leave');
    } finally {
      setProcessing(false);
    }
  };

  // Report missed punch
  const handleReportMissedPunch = async (e) => {
    e.preventDefault();
    if (!punchForm.date || !punchForm.expectedTime || !punchForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    setProcessing(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/employee/timesheet/missed-punch`,
        punchForm,
        authHeader
      );
      toast.success('Missed punch reported successfully!');
      setShowMissedPunchModal(false);
      setPunchForm({
        date: '',
        type: 'in',
        expectedTime: '',
        reason: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error reporting missed punch:', error);
      toast.error(error.response?.data?.error || 'Failed to report missed punch');
    } finally {
      setProcessing(false);
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getAttendanceStatusColor = (status) => {
    switch(status) {
      case 'on_time': return 'bg-emerald-100 text-emerald-700';
      case 'late': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'on_leave': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Employee Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Welcome back, {profile?.name || 'Employee'}!</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowLeaveModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <Plus size={16} />
              Apply Leave
            </button>
            <button
              onClick={() => setShowMissedPunchModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-sm"
            >
              <Clock size={16} />
              Missed Punch
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Activity size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Today's Status</p>
            <div className={`w-3 h-3 rounded-full ${
              todayAttendance?.status === 'on_time' ? 'bg-emerald-500' :
              todayAttendance?.status === 'late' ? 'bg-amber-500' :
              todayAttendance?.status === 'on_leave' ? 'bg-purple-500' :
              todayAttendance?.status === 'completed' ? 'bg-blue-500' :
              'bg-slate-300'
            }`}></div>
          </div>
          <p className="text-xl font-black text-slate-800">
            {todayAttendance?.statusMessage || 'Not Punched In'}
          </p>
          {todayAttendance?.punchInTime && (
            <p className="text-xs text-slate-500 mt-1">
              In: {formatTime(todayAttendance.punchInTime)}
              {todayAttendance?.punchOutTime && ` • Out: ${formatTime(todayAttendance.punchOutTime)}`}
            </p>
          )}
          {todayAttendance?.onLeave && (
            <p className="text-xs text-purple-600 mt-1 font-medium">✅ On Approved Leave</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monthly Stats</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-black text-emerald-600">{monthlyStats?.presentDays || 0}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase">Present</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600">{monthlyStats?.lateDays || 0}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase">Late</p>
            </div>
            <div>
              <p className="text-2xl font-black text-purple-600">{Math.ceil(monthlyStats?.leaveDays || 0)}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase">Leave</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Working Days: {monthlyStats?.workingDays || 0}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Leave Balance</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {leaveBalance?.balances && Object.entries(leaveBalance.balances).map(([type, balance]) => (
              <div key={type}>
                <p className="text-lg font-black text-slate-800">{balance}</p>
                <p className="text-[7px] font-black text-slate-400 uppercase">{type}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Total: {Object.values(leaveBalance?.balances || {}).reduce((a, b) => a + b, 0)} days remaining
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1 overflow-x-auto">
        <button
          onClick={() => setSelectedTab('dashboard')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            selectedTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <BarChart3 size={14} />
            Dashboard
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('leaves')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            selectedTab === 'leaves'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText size={14} />
            Leave History ({leaveHistory.length})
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('profile')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            selectedTab === 'profile'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <User size={14} />
            Profile
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-blue-600" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowLeaveModal(true)}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-all flex items-center gap-3"
              >
                <CalendarIcon size={18} className="text-blue-600" />
                <span className="font-bold text-blue-700">Apply for Leave</span>
                <ChevronRight size={16} className="ml-auto text-blue-400" />
              </button>
              <button
                onClick={() => setShowMissedPunchModal(true)}
                className="w-full p-4 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-all flex items-center gap-3"
              >
                <Clock size={18} className="text-purple-600" />
                <span className="font-bold text-purple-700">Report Missed Punch</span>
                <ChevronRight size={16} className="ml-auto text-purple-400" />
              </button>
            </div>
          </div>

          {/* Leave Balance Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Leave Balance Summary
            </h3>
            {leaveBalance?.balances && (
              <div className="space-y-3">
                {Object.entries(leaveBalance.balances).map(([type, balance]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-600">{type}</span>
                      <span className="font-bold text-slate-800">{balance}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          balance > 0 ? 'bg-emerald-500' : 'bg-red-400'
                        }`}
                        style={{
                          width: `${Math.min((balance / (leaveBalance.maxDays?.[type] || 1)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave History Tab */}
      {selectedTab === 'leaves' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {leaveHistory.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">No leave applications yet</p>
              <p className="text-xs text-slate-400 mt-1">Apply for leave to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaveHistory.map((leave) => (
                <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{leave.leaveType}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${getStatusColor(leave.status)}`}>
                          {leave.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        {leave.isHalfDay && ' (Half Day)'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{leave.reason}</p>
                      {leave.status === 'rejected' && leave.rejectionReason && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Rejected: {leave.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {formatDate(leave.appliedAt)}
                      </p>
                      {leave.status === 'approved' && (
                        <p className="text-xs text-emerald-600">
                          Approved by: {leave.approvedBy?.name || 'HR'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {selectedTab === 'profile' && profile && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-3xl font-black">
                {profile.name?.charAt(0) || '?'}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">{profile.name}</h2>
                <p className="text-sm text-slate-500">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black bg-blue-100 text-blue-700">
                    {profile.role}
                  </span>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black bg-slate-100 text-slate-700">
                    {profile.employeeCode}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Employee Code</p>
              <p className="font-bold text-slate-800">{profile.employeeCode || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Designation</p>
              <p className="font-bold text-slate-800">{profile.designation || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Department</p>
              <p className="font-bold text-slate-800">{profile.department || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Date of Joining</p>
              <p className="font-bold text-slate-800">{formatDate(profile.dateOfJoining)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Phone</p>
              <p className="font-bold text-slate-800">{profile.phoneNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Organization</p>
              <p className="font-bold text-slate-800">{profile.organization?.name || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leave Application Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Apply for Leave</h2>
                <p className="text-xs text-slate-500">Submit a leave request for approval</p>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Leave Type *
                </label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                >
                  {leaveBalance?.balances && Object.keys(leaveBalance.balances).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={leaveForm.isHalfDay}
                  onChange={(e) => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="halfDay" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Half Day
                </label>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Leave Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Missed Punch Modal */}
      {showMissedPunchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Report Missed Punch</h2>
                <p className="text-xs text-slate-500">Request a correction for a missed punch</p>
              </div>
              <button
                onClick={() => setShowMissedPunchModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReportMissedPunch} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={punchForm.date}
                  onChange={(e) => setPunchForm({ ...punchForm, date: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Type *
                </label>
                <select
                  required
                  value={punchForm.type}
                  onChange={(e) => setPunchForm({ ...punchForm, type: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                >
                  <option value="in">Punch In</option>
                  <option value="out">Punch Out</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Expected Time *
                </label>
                <input
                  type="time"
                  required
                  value={punchForm.expectedTime}
                  onChange={(e) => setPunchForm({ ...punchForm, expectedTime: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Why did you miss the punch?"
                  value={punchForm.reason}
                  onChange={(e) => setPunchForm({ ...punchForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;