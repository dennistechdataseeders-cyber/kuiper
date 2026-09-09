// frontend/src/pages/EmployeeLeaveDashboard.jsx - WITH PROBATION SUPPORT

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Send,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  FileText,
  User,
  Briefcase,
  TrendingUp,
  Award,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock as ClockIcon,
  Ban,
  Check,
  List,
  Grid,
  RefreshCw,
  Info
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const EmployeeLeaveDashboard = () => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState({});
  const [maxLimits, setMaxLimits] = useState({});
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ PROBATION STATE
  const [probationStatus, setProbationStatus] = useState(null);
  const [fetchingProbation, setFetchingProbation] = useState(false);

  // Leave form state
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Paid Leave',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayType: 'first',
    reason: ''
  });

  const token = localStorage.getItem('token');
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // ✅ Fetch probation status
  const fetchProbationStatus = async () => {
    setFetchingProbation(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader);
      if (res.data.success && res.data.data) {
        const profile = res.data.data;
        if (profile.probationStatus) {
          setProbationStatus(profile.probationStatus);
        } else {
          const isProbationary = profile.isProbationary || false;
          const probationEndDate = profile.probationEndDate || null;
          
          if (isProbationary && probationEndDate) {
            const now = new Date();
            const endDate = new Date(probationEndDate);
            const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            
            setProbationStatus({
              isProbationary: true,
              status: 'On probation',
              daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
              endDate: endDate
            });
          } else {
            setProbationStatus({
              isProbationary: false,
              status: 'Not on probation',
              daysRemaining: 0,
              endDate: null
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching probation status:', error);
      setProbationStatus({
        isProbationary: false,
        status: 'Not on probation',
        daysRemaining: 0,
        endDate: null
      });
    } finally {
      setFetchingProbation(false);
    }
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [balanceRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leaves/balance`, authHeader),
        axios.get(`${API_BASE_URL}/api/leaves/history?year=${selectedYear}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`, authHeader)
      ]);

      setBalances(balanceRes.data.data.balances);
      setMaxLimits(balanceRes.data.data.maxLimits);
      setLeaveHistory(historyRes.data.data || []);
    } catch (error) {
      console.error('Error fetching leave data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Get available leave types (filtered for probation)
  const getAvailableLeaveTypes = () => {
    const allTypes = Object.keys(balances);
    
    // If on probation, only allow Unpaid Leave
    if (probationStatus?.isProbationary) {
      return allTypes.filter(type => type === 'Unpaid Leave');
    }
    
    return allTypes;
  };

  useEffect(() => {
    fetchData();
    fetchProbationStatus();
  }, [selectedYear, statusFilter]);

  // Apply for leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate date range
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    if (end < start) {
      toast.error('End date cannot be before start date');
      return;
    }

    // ✅ PROBATION CHECK - Only Unpaid Leave allowed during probation
    if (probationStatus?.isProbationary && leaveForm.leaveType !== 'Unpaid Leave') {
      toast.error('⚠️ You are on probation. Only Unpaid Leave is available.');
      return;
    }

    // Check if leave type has balance (except Unpaid Leave)
    if (leaveForm.leaveType !== 'Unpaid Leave') {
      const balance = balances[leaveForm.leaveType] || 0;
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const daysToDeduct = leaveForm.isHalfDay ? 0.5 : daysDiff;
      
      if (balance < daysToDeduct) {
        toast.error(`Insufficient ${leaveForm.leaveType} balance. Available: ${balance}, Required: ${daysToDeduct}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...leaveForm,
        halfDayType: leaveForm.isHalfDay ? leaveForm.halfDayType : undefined
      };
      await axios.post(`${API_BASE_URL}/api/leaves/apply`, payload, authHeader);
      toast.success('Leave request submitted successfully!');
      setShowApplyModal(false);
      setLeaveForm({
        leaveType: 'Paid Leave',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDayType: 'first',
        reason: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error applying for leave:', error);
      toast.error(error.response?.data?.error || 'Failed to apply for leave');
    } finally {
      setSubmitting(false);
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

  // Get status badge
  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold"><Check size={12} /> Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold"><X size={12} /> Rejected</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold"><Clock size={12} /> Pending</span>;
      default:
        return <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-bold">{status}</span>;
    }
  };

  // Get leave type color
  const getLeaveTypeColor = (type) => {
    switch(type) {
      case 'Paid Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick Leave': return 'bg-red-100 text-red-700 border-red-200';
      case 'Casual Leave': return 'bg-green-100 text-green-700 border-green-200';
      case 'Unpaid Leave': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Calculate total balance
  const totalBalance = Object.values(balances).reduce((a, b) => a + b, 0);

  // Pagination
  const totalPages = Math.ceil(leaveHistory.length / itemsPerPage);
  const paginatedHistory = leaveHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Years for filter
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }

  // ✅ PROBATION BANNER COMPONENT
  const ProbationBanner = () => {
    if (!probationStatus?.isProbationary) return null;
    
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">⚠️ Probation Period</p>
            <p className="text-sm text-amber-700">
              You are on probation until <strong>{probationStatus.endDate ? new Date(probationStatus.endDate).toLocaleDateString() : 'N/A'}</strong>.
              {probationStatus.daysRemaining > 0 && ` (${probationStatus.daysRemaining} days remaining)`}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              During probation, you can only apply for <strong>Unpaid Leave</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading leave data...</p>
        </div>
      </div>
    );
  }

  // Get available leave types (filtered for probation)
  const availableLeaveTypes = getAvailableLeaveTypes();

  return (
    <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* ✅ PROBATION BANNER */}
      <ProbationBanner />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Leave Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Apply for leave and track your balance</p>
          {probationStatus?.isProbationary && (
            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
              <Info size={12} />
              Probation: Only Unpaid Leave available
            </p>
          )}
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
        >
          <Plus size={18} />
          Apply Leave
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {Object.entries(balances).map(([type, balance]) => {
          const isUnlimited = type === 'Unpaid Leave';
          const isOnlyAvailable = probationStatus?.isProbationary && isUnlimited;
          
          return (
            <div key={type} className={`bg-white rounded-xl border p-4 shadow-sm ${isOnlyAvailable ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{type}</p>
                {maxLimits[type] !== null && (
                  <span className="text-[9px] font-bold text-slate-400">/ {maxLimits[type]}</span>
                )}
                {isOnlyAvailable && (
                  <span className="text-[7px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full">
                    Available
                  </span>
                )}
                {probationStatus?.isProbationary && !isUnlimited && (
                  <span className="text-[7px] font-bold bg-slate-100 text-slate-400 px-1 py-0.5 rounded-full">
                    🔒 Locked
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-slate-800">
                  {isUnlimited ? '∞' : balance}
                </p>
                {maxLimits[type] !== null && (
                  <p className="text-sm text-slate-400 mb-0.5">days</p>
                )}
              </div>
              {maxLimits[type] !== null && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${balance === 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((balance / maxLimits[type]) * 100, 100)}%` }}
                  />
                </div>
              )}
              {probationStatus?.isProbationary && isUnlimited && (
                <p className="text-[7px] text-amber-600 mt-1">✓ Only leave available during probation</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Total Balance */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Total Balance</p>
            <p className="text-2xl font-bold">{totalBalance} days</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase opacity-80">Available</p>
              <p className="text-lg font-bold">{totalBalance} days</p>
            </div>
          </div>
        </div>
        {probationStatus?.isProbationary && (
          <div className="mt-2 text-[10px] text-white/80 bg-white/10 rounded-lg px-3 py-1.5">
            ⚠️ On probation: Only Unpaid Leave can be applied
          </div>
        )}
      </div>

      {/* Filters */}
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
          <div className="relative">
            <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              title="List View"
            >
              <List size={16} className={viewMode === 'list' ? 'text-blue-600' : 'text-slate-400'} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              title="Calendar View"
            >
              <Grid size={16} className={viewMode === 'calendar' ? 'text-blue-600' : 'text-slate-400'} />
            </button>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Leave History - List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {paginatedHistory.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No leave applications found</p>
              <p className="text-xs text-slate-400 mt-1">Apply for leave to see your history</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedHistory.map((leave) => (
                <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${getLeaveTypeColor(leave.leaveType)}`}>
                        <Calendar size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{leave.leaveType}</span>
                          {getStatusBadge(leave.status)}
                          {leave.isHalfDay && (
                            <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                              {leave.halfDayType === 'first' ? 'First Half' : leave.halfDayType === 'second' ? 'Second Half' : 'Half Day'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{leave.reason}</p>
                        {leave.status === 'rejected' && leave.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1">Rejected: {leave.rejectionReason}</p>
                        )}
                        {leave.status === 'approved' && leave.approvedBy && (
                          <p className="text-xs text-green-600 mt-1">
                            Approved by: {leave.approvedBy?.name || 'HR'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>Applied: {formatDate(leave.appliedAt)}</p>
                      {leave.approvedAt && (
                        <p className="text-green-600">Approved: {formatDate(leave.approvedAt)}</p>
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
      )}

      {/* Calendar View - Simplified for now */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button className="p-2 rounded-lg hover:bg-slate-100">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-bold text-slate-800">Calendar View</h3>
            <button className="p-2 rounded-lg hover:bg-slate-100">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 font-bold text-slate-500">{day}</div>
            ))}
            {[...Array(35)].map((_, i) => (
              <div key={i} className="aspect-square p-1 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span className="text-sm text-slate-600">{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">Click on a date to see leave details</p>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Apply for Leave</h2>
                <p className="text-xs text-slate-500 mt-0.5">Submit a leave request for approval</p>
                {probationStatus?.isProbationary && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Probation: Only Unpaid Leave available
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Leave Type *
                </label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400"
                >
                  {availableLeaveTypes.length === 0 ? (
                    <option value="">No leave types available</option>
                  ) : (
                    availableLeaveTypes.map((type) => {
                      const balance = balances[type] || 0;
                      const isUnlimited = type === 'Unpaid Leave';
                      return (
                        <option key={type} value={type}>
                          {type} ({isUnlimited ? '∞' : balance} days available)
                          {probationStatus?.isProbationary && type === 'Unpaid Leave' && ' ✓'}
                        </option>
                      );
                    })
                  )}
                </select>
                {probationStatus?.isProbationary && (
                  <p className="text-[9px] text-amber-600 mt-1 flex items-center gap-1">
                    <Info size={12} />
                    Only Unpaid Leave is available during probation
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400"
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

              {leaveForm.isHalfDay && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Half Day Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'first' })}
                      className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all ${
                        leaveForm.halfDayType === 'first'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      First Half
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'second' })}
                      className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all ${
                        leaveForm.halfDayType === 'second'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      Second Half
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400 resize-none"
                />
              </div>

              {probationStatus?.isProbationary && leaveForm.leaveType !== 'Unpaid Leave' && (
                <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-center">
                  <p className="text-[10px] text-rose-600 font-medium">
                    ⚠️ Please select Unpaid Leave during probation
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Leave Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLeaveDashboard;