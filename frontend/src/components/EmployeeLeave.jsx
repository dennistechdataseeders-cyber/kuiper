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
import ApplyLeaveModal from './ApplyLeaveModal';

const EmployeeLeave = ({ userId, token }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
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
      case 'Paid + Unpaid': return 'bg-violet-100 text-violet-800 border-violet-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // pieces of one request (same requestGroupId) are shown as a single entry
  const groupedHistory = (() => {
    const out = [];
    const byGroup = new Map();
    leaveHistory.forEach((l) => {
      if (!l.requestGroupId) { out.push(l); return; }
      let g = byGroup.get(l.requestGroupId);
      if (!g) {
        g = { ...l, _id: l.requestGroupId, isGroup: true, pieces: [] };
        byGroup.set(l.requestGroupId, g);
        out.push(g);
      }
      g.pieces.push(l);
    });
    byGroup.forEach((g) => {
      g.pieces.sort((x, y) => new Date(x.startDate) - new Date(y.startDate));
      const statuses = [...new Set(g.pieces.map((p) => p.status))];
      g.status = statuses.length === 1 ? statuses[0] : statuses.includes('pending') ? 'pending' : 'approved';
      g.startDate = g.groupSummary?.fromDate || g.pieces[0].startDate;
      g.endDate = g.groupSummary?.toDate || g.pieces[g.pieces.length - 1].endDate;
      const paid = g.groupSummary?.paidDays ?? 0;
      const unpaid = g.groupSummary?.unpaidDays ?? 0;
      g.leaveType = paid && unpaid ? 'Paid + Unpaid' : paid ? 'Paid Leave' : 'Unpaid Leave';
      g.isHalfDay = false;
    });
    return out;
  })();

  const totalPages = Math.ceil(groupedHistory.length / itemsPerPage);
  const paginatedHistory = groupedHistory.slice(
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
                      {leave.isGroup && leave.groupSummary && (
                        <span className="ml-2 text-xs font-bold text-slate-500">
                          · {leave.groupSummary.totalDays} day(s)
                          {leave.groupSummary.paidDays ? ` · ${leave.groupSummary.paidDays} paid` : ''}
                          {leave.groupSummary.unpaidDays ? ` · ${leave.groupSummary.unpaidDays} unpaid` : ''}
                        </span>
                      )}
                    </p>
                    {leave.isGroup && leave.pieces.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {leave.pieces.map((p) => (
                          <span key={p._id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${p.leaveType === 'Paid Leave' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                            {new Date(p.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            {!p.isHalfDay && new Date(p.endDate).getTime() !== new Date(p.startDate).getTime() ? `–${new Date(p.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                            {p.isHalfDay ? (p.halfDayType === 'first' ? ' ½ (1st)' : ' ½ (2nd)') : ''}
                            {' · '}{p.leaveType === 'Paid Leave' ? 'Paid' : 'Unpaid'}
                          </span>
                        ))}
                      </div>
                    )}
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

      {/* One-shot leave request: paid first, rest unpaid, half days, monthly limit — all in one go */}
      <ApplyLeaveModal
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onSubmitted={fetchLeaveData}
        authHeader={authHeader}
      />
    </div>
  );
};

export default EmployeeLeave;