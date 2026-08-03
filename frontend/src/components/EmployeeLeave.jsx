// frontend/src/components/EmployeeLeave.jsx - UPDATED WITH PROPER LEAVE VALIDATIONS

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Send,
  X,
  Check,
  Filter,
  FileText,
  Clock,
  AlertCircle,
  CalendarDays,
  CheckCheck,
  Info
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const EmployeeLeave = ({ userId, token }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [balanceCheck, setBalanceCheck] = useState({
    isValid: true,
    message: '',
    requiredDays: 0,
    availableBalance: 0
  });
  
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
    leaveDuration: 'full', // 'full' or 'half'
    halfDayType: 'first', // 'first' or 'second'
    startDate: '',
    endDate: '',
    reason: ''
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate days between two dates
  const calculateDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    // Add 1 to include both start and end dates
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Check leave balance
  const checkLeaveBalance = (leaveType, startDate, endDate, isHalfDay) => {
    if (!startDate) return { isValid: true, message: '', requiredDays: 0, availableBalance: 0 };
    
    const balance = leaveBalance?.balances?.[leaveType] || 0;
    let requiredDays = 0;
    
    if (isHalfDay) {
      requiredDays = 0.5;
    } else {
      const end = endDate || startDate;
      requiredDays = calculateDays(startDate, end);
    }
    
    // Unpaid Leave - infinite
    if (leaveType === 'Unpaid Leave') {
      return { 
        isValid: true, 
        message: 'Unpaid Leave has no limit', 
        requiredDays: requiredDays,
        availableBalance: '∞' // Infinite
      };
    }
    
    // Paid, Sick, Casual Leave - check balance
    if (balance < requiredDays) {
      return { 
        isValid: false, 
        message: `Insufficient ${leaveType} balance. Available: ${balance}, Required: ${requiredDays}`,
        requiredDays: requiredDays,
        availableBalance: balance
      };
    }
    
    return { 
      isValid: true, 
      message: `Sufficient balance: ${balance} days available`,
      requiredDays: requiredDays,
      availableBalance: balance
    };
  };

  // Validate form before submission
  const validateLeaveForm = () => {
    const { leaveType, leaveDuration, halfDayType, startDate, endDate, reason } = leaveForm;
    
    // Check if all required fields are filled
    if (leaveDuration === 'full') {
      if (!startDate || !endDate) {
        toast.error('Please select both start and end dates');
        return false;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        toast.error('End date cannot be before start date');
        return false;
      }
    } else {
      if (!startDate) {
        toast.error('Please select a date');
        return false;
      }
    }
    
    if (!reason.trim()) {
      toast.error('Please enter a reason');
      return false;
    }
    
    // Check leave balance
    const isHalfDay = leaveDuration === 'half';
    const balanceCheckResult = checkLeaveBalance(leaveType, startDate, isHalfDay ? startDate : endDate, isHalfDay);
    
    if (!balanceCheckResult.isValid) {
      if (leaveType !== 'Unpaid Leave') {
        toast.error(balanceCheckResult.message);
        setBalanceCheck({
          isValid: false,
          message: balanceCheckResult.message,
          requiredDays: balanceCheckResult.requiredDays,
          availableBalance: balanceCheckResult.availableBalance
        });
        return false;
      }
    }
    
    setBalanceCheck({
      isValid: true,
      message: '',
      requiredDays: 0,
      availableBalance: 0
    });
    return true;
  };

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const [balanceRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leaves/balance`, authHeader),
        axios.get(`${API_BASE_URL}/api/leaves/history?${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`, authHeader)
      ]);

      setLeaveBalance(balanceRes.data.data);
      setLeaveHistory(historyRes.data.data || []);
      
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
      console.error('Error fetching leave data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [statusFilter]);

  // Update balance check when form changes
  useEffect(() => {
    if (leaveForm.startDate && leaveForm.leaveType) {
      const isHalfDay = leaveForm.leaveDuration === 'half';
      const endDate = isHalfDay ? leaveForm.startDate : leaveForm.endDate;
      const result = checkLeaveBalance(leaveForm.leaveType, leaveForm.startDate, endDate, isHalfDay);
      setBalanceCheck(result);
    }
  }, [leaveForm.startDate, leaveForm.endDate, leaveForm.leaveType, leaveForm.leaveDuration]);

  // Apply for leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    
    if (!validateLeaveForm()) {
      return;
    }

    setProcessing(true);
    try {
      // Prepare payload based on leave duration
      const isHalfDay = leaveForm.leaveDuration === 'half';
      const payload = {
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: isHalfDay ? leaveForm.startDate : leaveForm.endDate,
        isHalfDay: isHalfDay,
        halfDayType: isHalfDay ? leaveForm.halfDayType : undefined,
        reason: leaveForm.reason
      };

      await axios.post(
        `${API_BASE_URL}/api/leaves/apply`,
        payload,
        authHeader
      );
      toast.success('Leave request submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({
        leaveType: 'Paid Leave',
        leaveDuration: 'full',
        halfDayType: 'first',
        startDate: '',
        endDate: '',
        reason: ''
      });
      setBalanceCheck({
        isValid: true,
        message: '',
        requiredDays: 0,
        availableBalance: 0
      });
      fetchLeaveData();
    } catch (error) {
      console.error('Error applying for leave:', error);
      toast.error(error.response?.data?.error || 'Failed to apply for leave');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getLeaveTypeColor = (type) => {
    switch(type) {
      case 'Paid Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick Leave': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Casual Leave': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Unpaid Leave': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const totalPages = Math.ceil(leaveHistory.length / itemsPerPage);
  const paginatedHistory = leaveHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="text-blue-600 animate-spin" />
      </div>
    );
  }

  // Get the balance for the selected leave type
  const getSelectedBalance = () => {
    if (!leaveBalance) return 0;
    return leaveBalance.balances?.[leaveForm.leaveType] || 0;
  };

  return (
    <div className="space-y-6">
      {/* Leave Balance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Leave Balances</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {leaveBalance?.balances && Object.entries(leaveBalance.balances).map(([type, balance]) => {
            const maxDays = leaveBalance.maxLimits?.[type];
            const isUnlimited = maxDays === null;
            const percentage = maxDays && maxDays > 0 ? Math.min((balance / maxDays) * 100, 100) : 0;
            return (
              <div key={type} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{type}</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className="text-2xl font-bold text-slate-800">
                    {isUnlimited ? '∞' : balance}
                  </p>
                  {!isUnlimited && maxDays !== null && (
                    <p className="text-xs text-slate-400 mb-0.5">/ {maxDays}</p>
                  )}
                </div>
                {!isUnlimited && maxDays !== null && maxDays > 0 && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        balance === 0 ? 'bg-rose-500' : 
                        percentage < 30 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
                {isUnlimited && (
                  <p className="text-[10px] text-slate-400 mt-1">Unlimited</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave History Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-slate-50"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="font-medium">Total: {leaveHistory.length}</span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-emerald-600 font-medium">✓ {leaveStats.approvedLeaves}</span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-amber-600 font-medium">⏳ {leaveStats.pendingLeaves}</span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-rose-600 font-medium">✕ {leaveStats.rejectedLeaves}</span>
          </div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm flex-shrink-0"
          >
            <Plus size={16} />
            Apply Leave
          </button>
        </div>
      </div>

      {/* Leave History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {paginatedHistory.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No leave applications yet</p>
            <p className="text-xs text-slate-400 mt-1">Apply for leave to get started</p>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              Apply for Leave
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedHistory.map((leave) => (
              <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getLeaveTypeColor(leave.leaveType)}`}>
                        {leave.leaveType}
                      </span>
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusColor(leave.status)}`}>
                        {leave.status.toUpperCase()}
                      </span>
                      {leave.isHalfDay && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {leave.halfDayType === 'first' ? 'First Half' : 'Second Half'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(leave.startDate)} {leave.isHalfDay ? `(${leave.halfDayType === 'first' ? 'First Half' : 'Second Half'})` : `- ${formatDate(leave.endDate)}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{leave.reason}</p>
                    {leave.status === 'rejected' && leave.rejectionReason && (
                      <p className="text-xs text-rose-500 mt-0.5">
                        Rejected: {leave.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">
                      {formatDate(leave.appliedAt)}
                    </p>
                    {leave.status === 'approved' && leave.approvedBy && (
                      <p className="text-xs text-emerald-600 font-medium">
                        ✓ {leave.approvedBy?.name || 'HR'}
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
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leave Application Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Apply for Leave</h2>
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
              {/* Leave Type */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Leave Type *
                </label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  {leaveBalance?.balances && Object.keys(leaveBalance.balances).map((type) => (
                    <option key={type} value={type}>
                      {type} ({leaveBalance.balances[type] || 0} days available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Duration - Full Day or Half Day */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Leave Duration *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveDuration: 'full' })}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition-all border-2 ${
                      leaveForm.leaveDuration === 'full'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Full Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveDuration: 'half' })}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition-all border-2 ${
                      leaveForm.leaveDuration === 'half'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Half Day
                  </button>
                </div>
              </div>

              {/* Half Day Type - First Half or Second Half (only shown when half day is selected) */}
              {leaveForm.leaveDuration === 'half' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Half Day Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'first' })}
                      className={`py-2.5 rounded-lg font-semibold text-sm transition-all border-2 ${
                        leaveForm.halfDayType === 'first'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      First Half
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'second' })}
                      className={`py-2.5 rounded-lg font-semibold text-sm transition-all border-2 ${
                        leaveForm.halfDayType === 'second'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      Second Half
                    </button>
                  </div>
                </div>
              )}

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                    {leaveForm.leaveDuration === 'full' ? 'From Date *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                {leaveForm.leaveDuration === 'full' && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                      To Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Balance Validation Display */}
              {leaveForm.startDate && (
                <div className={`p-3 rounded-lg border ${
                  balanceCheck.isValid 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {balanceCheck.isValid ? (
                      <Check size={16} className="text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-600 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-xs font-semibold ${
                        balanceCheck.isValid ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {balanceCheck.isValid 
                          ? `✓ ${balanceCheck.message || 'Leave balance is sufficient'}`
                          : balanceCheck.message
                        }
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {leaveForm.leaveType === 'Unpaid Leave' 
                          ? 'Unlimited leave available' 
                          : `Available: ${balanceCheck.availableBalance} days • Required: ${balanceCheck.requiredDays} days`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Leave Balance Info */}
              {leaveForm.leaveType !== 'Unpaid Leave' && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Info size={14} className="text-blue-600" />
                  <p className="text-[10px] text-blue-700">
                    You have <strong>{getSelectedBalance()}</strong> {leaveForm.leaveType} days remaining.
                    {leaveForm.leaveDuration === 'full' && leaveForm.startDate && leaveForm.endDate && (
                      <> This request requires <strong>{calculateDays(leaveForm.startDate, leaveForm.endDate)}</strong> days.</>
                    )}
                    {leaveForm.leaveDuration === 'half' && (
                      <> This request requires <strong>0.5</strong> days.</>
                    )}
                  </p>
                </div>
              )}

              {leaveForm.leaveType === 'Unpaid Leave' && (
                <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Info size={14} className="text-indigo-600" />
                  <p className="text-[10px] text-indigo-700">
                    Unpaid Leave has <strong>no limit</strong>. You can take as many unpaid days as needed.
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={processing || (!balanceCheck.isValid && leaveForm.leaveType !== 'Unpaid Leave')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Leave Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLeave;