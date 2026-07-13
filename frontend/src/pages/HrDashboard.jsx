// frontend/src/pages/HrDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Building2,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Check,
  X,
  UserPlus,
  Settings,
  Bell,
  Activity,
  BarChart3
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HrDashboard = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    totalEmployees: 0,
    pendingLeaves: 0,
    pendingCorrections: 0,
    attendanceRate: 0
  });

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedCorrection, setSelectedCorrection] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Auth headers
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, leavesRes, correctionsRes, typesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/hr/dashboard/stats`, authHeader),
        axios.get(`${API_BASE_URL}/api/hr/leave/pending`, authHeader),
        axios.get(`${API_BASE_URL}/api/hr/attendance/corrections`, authHeader),
        axios.get(`${API_BASE_URL}/api/hr/leave-types`, authHeader)
      ]);

      setStats(statsRes.data.data);
      setPendingLeaves(leavesRes.data.data || []);
      setPendingCorrections(correctionsRes.data.data || []);
      setLeaveTypes(typesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching HR data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Approve leave
  const handleApproveLeave = async (leaveId) => {
    setProcessing(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/hr/leave/${leaveId}/approve`,
        {},
        authHeader
      );
      toast.success('Leave approved successfully!');
      setShowLeaveModal(false);
      fetchData();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast.error(error.response?.data?.error || 'Failed to approve leave');
    } finally {
      setProcessing(false);
    }
  };

  // Reject leave
  const handleRejectLeave = async (leaveId) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/hr/leave/${leaveId}/reject`,
        { rejectionReason: rejectionReason.trim() },
        authHeader
      );
      toast.success('Leave rejected');
      setShowLeaveModal(false);
      setRejectionReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast.error(error.response?.data?.error || 'Failed to reject leave');
    } finally {
      setProcessing(false);
    }
  };

  // Approve correction
  const handleApproveCorrection = async (correctionId) => {
    setProcessing(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/hr/attendance/correction/${correctionId}`,
        { action: 'approve' },
        authHeader
      );
      toast.success('Correction approved!');
      setShowCorrectionModal(false);
      fetchData();
    } catch (error) {
      console.error('Error approving correction:', error);
      toast.error('Failed to approve correction');
    } finally {
      setProcessing(false);
    }
  };

  // Reject correction
  const handleRejectCorrection = async (correctionId) => {
    setProcessing(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/hr/attendance/correction/${correctionId}`,
        { action: 'reject' },
        authHeader
      );
      toast.success('Correction rejected');
      setShowCorrectionModal(false);
      fetchData();
    } catch (error) {
      console.error('Error rejecting correction:', error);
      toast.error('Failed to reject correction');
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

  // Filter functions
  const filteredLeaves = pendingLeaves.filter(leave =>
    leave.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leave.leaveType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCorrections = pendingCorrections.filter(correction =>
    correction.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalLeavePages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const totalCorrectionPages = Math.ceil(filteredCorrections.length / itemsPerPage);
  const currentLeaves = filteredLeaves.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const currentCorrections = filteredCorrections.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading HR Dashboard...</p>
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
              HR Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Manage employee attendance, leaves, and corrections</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase">Live</span>
            </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Present Today</p>
              <p className="text-2xl font-black text-white">{stats.present}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <UserCheck size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            {stats.attendanceRate}% attendance rate
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Absent</p>
              <p className="text-2xl font-black text-white">{stats.absent}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <UserX size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Pending Leaves</p>
              <p className="text-2xl font-black text-white">{stats.pendingLeaves}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Corrections</p>
              <p className="text-2xl font-black text-white">{stats.pendingCorrections}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Clock size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1">
        <button
          onClick={() => setSelectedTab('dashboard')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
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
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            selectedTab === 'leaves'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText size={14} />
            Pending Leaves ({stats.pendingLeaves})
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('corrections')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            selectedTab === 'corrections'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock size={14} />
            Corrections ({stats.pendingCorrections})
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('settings')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            selectedTab === 'settings'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Settings size={14} />
            Leave Types
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Dashboard Tab */}
        {selectedTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                Today's Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Total Employees</span>
                  <span className="text-lg font-black text-slate-800">{stats.totalEmployees}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">Present</span>
                  <span className="text-lg font-black text-green-700">{stats.present}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium text-red-700">Absent</span>
                  <span className="text-lg font-black text-red-700">{stats.absent}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm font-medium text-amber-700">Late</span>
                  <span className="text-lg font-black text-amber-700">{stats.late}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium text-purple-700">On Leave</span>
                  <span className="text-lg font-black text-purple-700">{stats.onLeave}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-blue-600" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedTab('leaves')}
                  className="w-full p-4 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-amber-600" />
                    <span className="font-bold text-amber-700">Review Pending Leaves</span>
                  </div>
                  <span className="text-sm font-black text-amber-600">{stats.pendingLeaves}</span>
                </button>
                <button
                  onClick={() => setSelectedTab('corrections')}
                  className="w-full p-4 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-purple-600" />
                    <span className="font-bold text-purple-700">Review Corrections</span>
                  </div>
                  <span className="text-sm font-black text-purple-600">{stats.pendingCorrections}</span>
                </button>
                <button
                  onClick={() => setSelectedTab('settings')}
                  className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={18} className="text-blue-600" />
                    <span className="font-bold text-blue-700">Manage Leave Types</span>
                  </div>
                  <span className="text-sm font-black text-blue-600">{leaveTypes.length}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leaves Tab */}
        {selectedTab === 'leaves' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by employee or leave type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {filteredLeaves.length} pending
                </span>
              </div>
            </div>

            {currentLeaves.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">No pending leave requests</p>
                <p className="text-xs text-slate-400 mt-1">All leave requests have been processed</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentLeaves.map((leave) => (
                  <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                          {leave.employeeId?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{leave.employeeId?.name}</p>
                          <p className="text-xs text-slate-500">
                            {leave.leaveType} • {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                            {leave.isHalfDay && ' (Half Day)'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{leave.reason}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLeave(leave);
                          setShowLeaveModal(true);
                          setRejectionReason('');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"
                      >
                        <Eye size={12} />
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalLeavePages > 1 && (
              <div className="p-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalLeavePages}
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
                    onClick={() => setCurrentPage(p => Math.min(totalLeavePages, p + 1))}
                    disabled={currentPage === totalLeavePages}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Corrections Tab */}
        {selectedTab === 'corrections' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {filteredCorrections.length} pending
                </span>
              </div>
            </div>

            {currentCorrections.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">No pending corrections</p>
                <p className="text-xs text-slate-400 mt-1">All correction requests have been processed</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentCorrections.map((correction) => (
                  <div key={correction._id} className="p-4 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                          {correction.employeeId?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{correction.employeeId?.name}</p>
                          <p className="text-xs text-slate-500">
                            {correction.type === 'in' ? 'Punch In' : 'Punch Out'} • {formatDate(correction.date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Expected: {formatTime(correction.expectedTime)}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">Reason: {correction.reason}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCorrection(correction);
                          setShowCorrectionModal(true);
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all flex items-center gap-1"
                      >
                        <Eye size={12} />
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalCorrectionPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalCorrectionPages}
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
                    onClick={() => setCurrentPage(p => Math.min(totalCorrectionPages, p + 1))}
                    disabled={currentPage === totalCorrectionPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab - Leave Types */}
        {selectedTab === 'settings' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <Settings size={16} className="text-blue-600" />
                Leave Types Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-1">Manage leave types and their maximum days</p>
            </div>

            <div className="divide-y divide-slate-100">
              {leaveTypes.map((type) => (
                <div key={type._id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">{type.name}</span>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                        {type.code}
                      </span>
                      {type.isActive ? (
                        <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-[8px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-500">
                        Max Days: <span className="font-bold text-slate-700">{type.maxDays}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        Approval Required: <span className="font-bold text-slate-700">{type.requiresApproval ? 'Yes' : 'No'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leave Review Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Review Leave Request</h2>
                <p className="text-xs text-slate-500 mt-1">
                  #{selectedLeave._id.slice(-6)}
                </p>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                    {selectedLeave.employeeId?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{selectedLeave.employeeId?.name}</p>
                    <p className="text-xs text-slate-500">{selectedLeave.employeeId?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Leave Type</p>
                    <p className="font-bold text-slate-700">{selectedLeave.leaveType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">From</p>
                    <p className="font-bold text-slate-700">{formatDate(selectedLeave.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">To</p>
                    <p className="font-bold text-slate-700">{formatDate(selectedLeave.endDate)}</p>
                  </div>
                </div>
                {selectedLeave.isHalfDay && (
                  <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg inline-block">
                    Half Day
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Reason</p>
                  <p className="text-sm text-slate-700 mt-1">{selectedLeave.reason}</p>
                </div>
              </div>

              {/* Rejection Reason Input */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Rejection Reason (if rejecting)
                </label>
                <textarea
                  placeholder="Enter reason for rejection..."
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-red-400 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleRejectLeave(selectedLeave._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleApproveLeave(selectedLeave._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correction Review Modal */}
      {showCorrectionModal && selectedCorrection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Review Correction Request</h2>
                <p className="text-xs text-slate-500 mt-1">
                  #{selectedCorrection._id.slice(-6)}
                </p>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">
                    {selectedCorrection.employeeId?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{selectedCorrection.employeeId?.name}</p>
                    <p className="text-xs text-slate-500">{selectedCorrection.employeeId?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Type</p>
                    <p className="font-bold text-slate-700">
                      {selectedCorrection.type === 'in' ? 'Punch In' : 'Punch Out'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Date</p>
                    <p className="font-bold text-slate-700">{formatDate(selectedCorrection.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Expected Time</p>
                    <p className="font-bold text-slate-700">{formatTime(selectedCorrection.expectedTime)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Reason</p>
                  <p className="text-sm text-slate-700 mt-1">{selectedCorrection.reason}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleRejectCorrection(selectedCorrection._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleApproveCorrection(selectedCorrection._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;