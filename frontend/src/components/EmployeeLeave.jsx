// frontend/src/components/EmployeeLeave.jsx - UPDATED FOR NEW LEAVE BUCKET SYSTEM

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
  Info,
  TrendingUp,
  TrendingDown,
  Minus
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
  
  // ✅ PROBATION STATE
  const [probationStatus, setProbationStatus] = useState(null);
  const [fetchingProbation, setFetchingProbation] = useState(false);
  
  // Leave Stats
  const [leaveStats, setLeaveStats] = useState({
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    usedLeaves: 0,
    remainingLeaves: 0,
    monthlyUsed: 0,
    monthlyRemaining: 4,
    monthlyLimit: 4
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
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
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

  // ✅ NEW: Check leave balance with bucket system
  const checkLeaveBalance = (leaveType, startDate, endDate, isHalfDay) => {
    if (!startDate) return { isValid: true, message: '', requiredDays: 0, availableBalance: 0 };
    
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
        availableBalance: '∞'
      };
    }
    
    // Paid Leave - check bucket balance
    const balance = leaveBalance?.balances?.['Paid Leave'] || 0;
    
    // Check if there's enough balance
    if (balance < requiredDays) {
      return { 
        isValid: false, 
        message: `Insufficient Paid Leave balance. Available: ${balance}, Required: ${requiredDays}`,
        requiredDays: requiredDays,
        availableBalance: balance
      };
    }
    
    // Check monthly limit (4 days max)
    const monthlyRemaining = leaveBalance?.remainingThisMonth || 0;
    if (requiredDays > monthlyRemaining) {
      return {
        isValid: false,
        message: `You've taken ${leaveBalance?.leavesTakenThisMonth || 0} days this month. Maximum allowed is 4 days. Remaining: ${monthlyRemaining} days.`,
        requiredDays: requiredDays,
        availableBalance: balance
      };
    }
    
    return { 
      isValid: true, 
      message: `Sufficient balance: ${balance} days available. ${monthlyRemaining} days remaining this month.`,
      requiredDays: requiredDays,
      availableBalance: balance
    };
  };

  // ✅ Get available leave types (filtered for probation)
  const getAvailableLeaveTypes = () => {
    // Always show Paid Leave and Unpaid Leave
    const allTypes = ['Paid Leave', 'Unpaid Leave'];
    
    // If on probation, only allow Unpaid Leave
    if (probationStatus?.isProbationary) {
      return ['Unpaid Leave'];
    }
    
    return allTypes;
  };

  // Validate form before submission - ✅ WITH PROBATION AND MONTHLY LIMIT CHECK
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
    
    // ✅ PROBATION CHECK - Only Unpaid Leave allowed during probation
    if (probationStatus?.isProbationary && leaveType !== 'Unpaid Leave') {
      toast.error('⚠️ You are on probation. Only Unpaid Leave is available.');
      return false;
    }
    
    // Check leave balance
    const isHalfDay = leaveDuration === 'half';
    const balanceCheckResult = checkLeaveBalance(leaveType, startDate, isHalfDay ? startDate : endDate, isHalfDay);
    
    if (!balanceCheckResult.isValid) {
      toast.error(balanceCheckResult.message);
      setBalanceCheck({
        isValid: false,
        message: balanceCheckResult.message,
        requiredDays: balanceCheckResult.requiredDays,
        availableBalance: balanceCheckResult.availableBalance
      });
      return false;
    }
    
    setBalanceCheck({
      isValid: true,
      message: '',
      requiredDays: 0,
      availableBalance: 0
    });
    return true;
  };

  // ✅ UPDATED: Fetch leave data from new bucket system
  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const [balanceRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leave-bucket/bucket/summary`, authHeader),
        axios.get(`${API_BASE_URL}/api/leaves/history?${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`, authHeader)
      ]);

      const bucketData = balanceRes.data.data;
      
      // Set leave balance with new structure
      setLeaveBalance({
      balances: {
        'Paid Leave': bucketData.totalBalance || 0,
        'Unpaid Leave': '∞'
      },
      maxLimits: {
        'Paid Leave': null,
        'Unpaid Leave': null
      },
      monthlyLimit: bucketData.monthlyLimit || 4,
      leavesTakenThisMonth: bucketData.leavesTakenThisMonth || 0,
      remainingThisMonth: bucketData.remainingThisMonth || 4,
      financialYear: bucketData.financialYear || { start: '', end: '' },
      monthlyUsage: bucketData.monthlyUsage || [],
      yearlyUsage: bucketData.yearlyUsage || []
    })
      
      setLeaveHistory(historyRes.data.data || []);
      
      const leaves = historyRes.data.data || [];
      const usedLeaves = leaves.filter(l => l.status === 'approved').length;
      const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
      const rejectedLeaves = leaves.filter(l => l.status === 'rejected').length;
      
      setLeaveStats({
        totalLeaves: leaves.length,
        pendingLeaves: pendingLeaves,
        approvedLeaves: usedLeaves,
        rejectedLeaves: rejectedLeaves,
        usedLeaves: usedLeaves,
        remainingLeaves: bucketData.totalBalance || 0,
        monthlyUsed: bucketData.leavesTakenThisMonth || 0,
        monthlyRemaining: bucketData.remainingThisMonth || 4,
        monthlyLimit: bucketData.monthlyLimit || 4
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
    fetchProbationStatus();
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
        `${API_BASE_URL}/api/leave-bucket/apply`,
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
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getLeaveTypeColor = (type) => {
    switch(type) {
      case 'Paid Leave': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Unpaid Leave': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const totalPages = Math.ceil(leaveHistory.length / itemsPerPage);
  const paginatedHistory = leaveHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ✅ PROBATION BANNER COMPONENT
  const ProbationBanner = () => {
    if (!probationStatus?.isProbationary) return null;
    
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-amber-100 rounded-lg flex-shrink-0">
            <AlertCircle size={22} className="text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-amber-900">⚠️ Probation Period</p>
            <p className="text-sm text-amber-800 mt-1">
              You are currently on probation until <strong>{new Date(probationStatus.endDate).toLocaleDateString()}</strong>.
              {probationStatus.daysRemaining > 0 && ` (${probationStatus.daysRemaining} days remaining)`}
            </p>
            <p className="text-sm text-amber-800 mt-1">
              During probation, you can only apply for <strong>Unpaid Leave</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  };

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

  // Get available leave types (filtered for probation)
  const availableLeaveTypes = getAvailableLeaveTypes();

  // Check if any leave types are available
  const hasAvailableLeaveTypes = availableLeaveTypes.length > 0;

  return (
    <div className="space-y-5">
      {/* ✅ PROBATION BANNER - Shown at top if on probation */}
      <ProbationBanner />

      {/* Leave Balance Cards - NEW BUCKET SYSTEM */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-3">Leave Balances</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Paid Leave Card */}
          <div className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow ${probationStatus?.isProbationary ? 'opacity-60 border-slate-300' : 'border-blue-300'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid Leave</p>
              {probationStatus?.isProbationary && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  Locked 🔒
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mt-2">
              <p className={`text-3xl font-black ${probationStatus?.isProbationary ? 'text-slate-400' : 'text-slate-900'}`}>
                {leaveBalance?.balances?.['Paid Leave'] || 0}
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-1">Accrued 1.5 days/month</p>
          </div>

          {/* Unpaid Leave Card */}
          <div className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-shadow ${probationStatus?.isProbationary ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-300'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unpaid Leave</p>
              {probationStatus?.isProbationary && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Available
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black text-slate-900">∞</p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-1">No limit</p>
            {probationStatus?.isProbationary && (
              <p className="text-[9px] font-semibold text-amber-700 mt-1">✓ Only leave available during probation</p>
            )}
          </div>

          {/* Monthly Usage Card */}
          <div className="bg-white rounded-xl border-2 border-slate-300 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month</p>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black text-amber-700">
                {leaveStats.monthlyUsed || 0}
              </p>
              <p className="text-base font-semibold text-slate-500 mb-0.5">/ {leaveStats.monthlyLimit}</p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  leaveStats.monthlyUsed >= leaveStats.monthlyLimit ? 'bg-red-500' : 
                  leaveStats.monthlyUsed >= leaveStats.monthlyLimit * 0.75 ? 'bg-amber-500' : 
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((leaveStats.monthlyUsed / leaveStats.monthlyLimit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-1.5">
              {leaveStats.monthlyRemaining} days remaining
            </p>
          </div>

          {/* Financial Year Card */}
          <div className="bg-white rounded-xl border-2 border-slate-300 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Year</p>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold text-slate-900">
                {leaveBalance?.financialYear?.start || 'N/A'} - {leaveBalance?.financialYear?.end || 'N/A'}
              </p>
              <p className="text-[10px] font-medium text-slate-500 mt-1">April–March</p>
              <p className="text-[10px] font-semibold text-slate-700 mt-1">
                Used: {leaveStats.usedLeaves || 0} days
              </p>
            </div>
          </div>
        </div>
        
        {/* ✅ Probation info note */}
        {probationStatus?.isProbationary && (
          <div className="mt-3 text-center">
            <p className="text-xs font-medium text-amber-700 flex items-center justify-center gap-1.5">
              <Info size={14} />
              During probation, only <strong>Unpaid Leave</strong> is available
            </p>
          </div>
        )}
      </div>

      {/* Leave History Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-slate-50"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span>Total: {leaveHistory.length}</span>
            <span className="w-px h-4 bg-slate-300" />
            <span className="text-emerald-700">✓ {leaveStats.approvedLeaves}</span>
            <span className="w-px h-4 bg-slate-300" />
            <span className="text-amber-700">⏳ {leaveStats.pendingLeaves}</span>
            <span className="w-px h-4 bg-slate-300" />
            <span className="text-rose-700">✕ {leaveStats.rejectedLeaves}</span>
          </div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm flex-shrink-0"
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
              <FileText size={28} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No leave applications yet</p>
            <p className="text-xs text-slate-500 mt-1">Apply for leave to get started</p>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
            >
              Apply for Leave
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedHistory.map((leave) => (
              <div key={leave._id} className="p-4 hover:bg-slate-50/70 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getLeaveTypeColor(leave.leaveType)}`}>
                        {leave.leaveType}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(leave.status)}`}>
                        {leave.status.toUpperCase()}
                      </span>
                      {leave.isHalfDay && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">
                          {leave.halfDayType === 'first' ? 'First Half' : 'Second Half'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1.5">
                      {formatDate(leave.startDate)} {leave.isHalfDay ? `(${leave.halfDayType === 'first' ? 'First Half' : 'Second Half'})` : `- ${formatDate(leave.endDate)}`}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{leave.reason}</p>
                    {leave.status === 'rejected' && leave.rejectionReason && (
                      <p className="text-xs font-medium text-rose-600 mt-1">
                        Rejected: {leave.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-500">
                      {formatDate(leave.appliedAt)}
                    </p>
                    {leave.status === 'approved' && leave.approvedBy && (
                      <p className="text-xs font-bold text-emerald-700 mt-0.5">
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
          <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leave Application Modal - WITH PROBATION RESTRICTIONS AND MONTHLY LIMIT */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-black text-slate-900">Apply for Leave</h2>
                <p className="text-sm text-slate-600 mt-0.5">Submit a leave request for approval</p>
                {/* ✅ Show probation status in modal */}
                {probationStatus?.isProbationary && (
                  <p className="text-xs font-semibold text-amber-700 mt-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Probation: Only Unpaid Leave available
                  </p>
                )}
                {/* Show monthly limit info */}
                <p className="text-[11px] font-medium text-slate-500 mt-1">
                  Monthly limit: {leaveStats.monthlyUsed}/{leaveStats.monthlyLimit} used • {leaveStats.monthlyRemaining} remaining
                </p>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={18} className="text-slate-700" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-5 space-y-5">
              {/* Leave Type - FILTERED FOR PROBATION */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Leave Type *
                </label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-300 outline-none text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  {!hasAvailableLeaveTypes ? (
                    <option value="">No leave types available</option>
                  ) : (
                    availableLeaveTypes.map((type) => {
                      const balance = leaveBalance?.balances?.[type] || 0;
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
                  <p className="text-xs font-medium text-amber-700 mt-1.5 flex items-center gap-1">
                    <Info size={14} />
                    Only Unpaid Leave is available during probation
                  </p>
                )}
              </div>

              {/* Leave Duration - Full Day or Half Day */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Leave Duration *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveDuration: 'full' })}
                    className={`py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                      leaveForm.leaveDuration === 'full'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    Full Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leaveDuration: 'half' })}
                    className={`py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                      leaveForm.leaveDuration === 'half'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    Half Day
                  </button>
                </div>
              </div>

              {/* Half Day Type - First Half or Second Half (only shown when half day is selected) */}
              {leaveForm.leaveDuration === 'half' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                    Half Day Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'first' })}
                      className={`py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                        leaveForm.halfDayType === 'first'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      First Half
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, halfDayType: 'second' })}
                      className={`py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                        leaveForm.halfDayType === 'second'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
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
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                    {leaveForm.leaveDuration === 'full' ? 'From Date *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-300 outline-none text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                {leaveForm.leaveDuration === 'full' && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                      To Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full p-3 bg-slate-50 rounded-lg border border-slate-300 outline-none text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Balance Validation Display - UPDATED FOR BUCKET SYSTEM */}
              {leaveForm.startDate && (
                <div className={`p-3.5 rounded-lg border-2 ${
                  balanceCheck.isValid 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-rose-50 border-rose-300'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {balanceCheck.isValid ? (
                      <Check size={18} className="text-emerald-700 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="text-rose-700 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-bold ${
                        balanceCheck.isValid ? 'text-emerald-800' : 'text-rose-800'
                      }`}>
                        {balanceCheck.isValid 
                          ? `✓ ${balanceCheck.message || 'Leave balance is sufficient'}`
                          : balanceCheck.message
                        }
                      </p>
                      <p className="text-xs font-medium text-slate-600 mt-1">
                        {leaveForm.leaveType === 'Unpaid Leave' 
                          ? 'Unlimited leave available' 
                          : `Available: ${balanceCheck.availableBalance} days • Required: ${balanceCheck.requiredDays} days`
                        }
                      </p>
                      {leaveForm.leaveType === 'Paid Leave' && (
                        <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                          Monthly remaining: {leaveStats.monthlyRemaining} days
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Leave Balance Info */}
              {leaveForm.leaveType !== 'Unpaid Leave' && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Info size={16} className="text-blue-700 flex-shrink-0" />
                  <p className="text-xs font-medium text-blue-800">
                    You have <strong>{getSelectedBalance()}</strong> Paid Leave days remaining.
                    {leaveForm.leaveDuration === 'full' && leaveForm.startDate && leaveForm.endDate && (
                      <> This request requires <strong>{calculateDays(leaveForm.startDate, leaveForm.endDate)}</strong> days.</>
                    )}
                    {leaveForm.leaveDuration === 'half' && (
                      <> This request requires <strong>0.5</strong> days.</>
                    )}
                    <br />
                    <span className="text-[11px] text-blue-700">
                      Monthly remaining: {leaveStats.monthlyRemaining} days
                    </span>
                  </p>
                </div>
              )}

              {leaveForm.leaveType === 'Unpaid Leave' && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${probationStatus?.isProbationary ? 'bg-amber-50 border-amber-300' : 'bg-indigo-50 border-indigo-200'}`}>
                  <Info size={16} className={probationStatus?.isProbationary ? 'text-amber-700' : 'text-indigo-700'} />
                  <p className={`text-xs font-medium ${probationStatus?.isProbationary ? 'text-amber-800' : 'text-indigo-800'}`}>
                    {probationStatus?.isProbationary 
                      ? '✅ Unpaid Leave is available during probation with no limit.'
                      : 'Unpaid Leave has no limit. You can take as many unpaid days as needed.'
                    }
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-300 outline-none text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none placeholder:text-slate-400"
                />
              </div>

              {/* ✅ Probation warning on submit button */}
              {probationStatus?.isProbationary && leaveForm.leaveType !== 'Unpaid Leave' && (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-300 text-center">
                  <p className="text-xs font-bold text-rose-700">
                    ⚠️ Please select Unpaid Leave during probation
                  </p>
                </div>
              )}

              {/* Monthly limit warning */}
              {leaveForm.leaveType === 'Paid Leave' && leaveStats.monthlyRemaining <= 0 && (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-300 text-center">
                  <p className="text-xs font-bold text-rose-700">
                    ⚠️ You have reached the monthly limit of {leaveStats.monthlyLimit} days
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={processing || (!balanceCheck.isValid && leaveForm.leaveType !== 'Unpaid Leave') || (leaveForm.leaveType === 'Paid Leave' && leaveStats.monthlyRemaining <= 0)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {processing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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