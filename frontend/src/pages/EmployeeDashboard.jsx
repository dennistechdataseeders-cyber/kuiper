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
  Briefcase,
  UsersRound,
  UserCog,
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  List,
  Grid,
  Award,
  Ban,
  Eye as EyeIcon,
  LayoutDashboard
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
  const [activeTab, setActiveTab] = useState('leave'); // 'leave' or 'attendance'
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Leave Stats
  const [leaveStats, setLeaveStats] = useState({
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    usedLeaves: 0,
    remainingLeaves: 0
  });

  // Leave form
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Paid Leave',
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
        axios.get(`${API_BASE_URL}/api/leaves/balance`, authHeader),
        axios.get(`${API_BASE_URL}/api/leaves/history?${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`, authHeader)
      ]);

      setProfile(profileRes.data.data);
      setTodayAttendance(attendanceRes.data.data);
      setMonthlyStats(statsRes.data.data);
      setLeaveBalance(balanceRes.data.data);
      setLeaveHistory(historyRes.data.data || []);
      
      // Calculate leave stats
      const leaves = historyRes.data.data || [];
      const totalBalance = Object.values(balanceRes.data.data.balances || {}).reduce((a, b) => a + b, 0);
      const usedLeaves = leaves.filter(l => l.status === 'approved').length;
      
      setLeaveStats({
        totalLeaves: leaves.length,
        pendingLeaves: leaves.filter(l => l.status === 'pending').length,
        approvedLeaves: leaves.filter(l => l.status === 'approved').length,
        rejectedLeaves: leaves.filter(l => l.status === 'rejected').length,
        usedLeaves: usedLeaves,
        remainingLeaves: totalBalance
      });
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  // Apply for leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    if (end < start) {
      toast.error('End date cannot be before start date');
      return;
    }

    if (leaveForm.leaveType !== 'Unpaid Leave') {
      const balance = leaveBalance?.balances?.[leaveForm.leaveType] || 0;
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const daysToDeduct = leaveForm.isHalfDay ? 0.5 : daysDiff;
      
      if (balance < daysToDeduct) {
        toast.error(`Insufficient ${leaveForm.leaveType} balance. Available: ${balance}, Required: ${daysToDeduct}`);
        return;
      }
    }

    setProcessing(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/leaves/apply`,
        leaveForm,
        authHeader
      );
      toast.success('Leave request submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({
        leaveType: 'Paid Leave',
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

  const getLeaveTypeColor = (type) => {
    switch(type) {
      case 'Paid Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick Leave': return 'bg-red-100 text-red-700 border-red-200';
      case 'Casual Leave': return 'bg-green-100 text-green-700 border-green-200';
      case 'Unpaid Leave': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Pagination
  const totalPages = Math.ceil(leaveHistory.length / itemsPerPage);
  const paginatedHistory = leaveHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
              People Ops
            </h1>
            <p className="text-slate-500 mt-1">Manage your leave and attendance</p>
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
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Today's Status</p>
          <p className="text-lg font-bold truncate">
            {todayAttendance?.statusMessage || 'Not Punched In'}
          </p>
          {todayAttendance?.punchInTime && (
            <p className="text-[10px] opacity-80 mt-1">
              In: {formatTime(todayAttendance.punchInTime)}
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Used Leaves</p>
          <p className="text-2xl font-bold">{leaveStats.usedLeaves}</p>
          <p className="text-[10px] opacity-80 mt-1">
            {leaveStats.pendingLeaves} pending
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Remaining</p>
          <p className="text-2xl font-bold">{leaveStats.remainingLeaves}</p>
          <p className="text-[10px] opacity-80 mt-1">days available</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Working Days</p>
          <p className="text-2xl font-bold">{monthlyStats?.workingDays || 0}</p>
          <p className="text-[10px] opacity-80 mt-1">this month</p>
        </div>
      </div>

      {/* Tabs: Leave | Attendance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1">
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-3 rounded-lg text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'leave'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Calendar size={18} />
          Leave
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-3 rounded-lg text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Clock size={18} />
          Attendance
          <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">Soon</span>
        </button>
      </div>

      {/* LEAVE TAB */}
      {activeTab === 'leave' && (
        <>
          {/* Leave Balance Cards */}
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {leaveBalance?.balances && Object.entries(leaveBalance.balances).map(([type, balance]) => {
                const maxDays = leaveBalance.maxLimits?.[type];
                return (
                  <div key={type} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{type}</p>
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-2xl font-bold text-slate-800">{balance}</p>
                      {maxDays !== null && (
                        <p className="text-xs text-slate-400 mb-0.5">/ {maxDays}</p>
                      )}
                    </div>
                    {maxDays !== null && maxDays > 0 && (
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${balance === 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min((balance / maxDays) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                    {maxDays === null && (
                      <p className="text-[8px] text-slate-400 mt-1">Unlimited</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave History Filters */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Total: {leaveHistory.length}</span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="text-emerald-600">Approved: {leaveStats.approvedLeaves}</span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="text-amber-600">Pending: {leaveStats.pendingLeaves}</span>
              </div>
            </div>
          </div>

          {/* Leave History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {paginatedHistory.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <FileText size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">No leave applications yet</p>
                <p className="text-xs text-slate-400 mt-1">Apply for leave to get started</p>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  Apply for Leave
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedHistory.map((leave) => (
                  <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${getLeaveTypeColor(leave.leaveType)}`}>
                            {leave.leaveType}
                          </span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${getStatusColor(leave.status)}`}>
                            {leave.status.toUpperCase()}
                          </span>
                          {leave.isHalfDay && (
                            <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Half Day</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{leave.reason}</p>
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
                        {leave.status === 'approved' && leave.approvedBy && (
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
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
              <Clock size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Attendance Coming Soon</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              We're working on bringing you a complete attendance tracking system. 
              This feature will include punch in/out, attendance history, and more.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-1">
                <CheckCircle size={14} className="text-emerald-500" />
                <span>Punch In/Out</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={14} className="text-blue-500" />
                <span>Monthly View</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-purple-500" />
                <span>Statistics</span>
              </div>
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
                    <option key={type} value={type}>
                      {type} ({leaveBalance.balances[type] || 0} days available)
                    </option>
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