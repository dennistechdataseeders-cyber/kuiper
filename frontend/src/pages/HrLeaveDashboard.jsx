// frontend/src/pages/HrLeaveDashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  X,
  Check,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Briefcase,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HrLeaveDashboard = () => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLeave, setExpandedLeave] = useState(null);
  const itemsPerPage = 10;

  const token = localStorage.getItem('token');
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leaves/pending`, authHeader),
        axios.get(`${API_BASE_URL}/api/leaves/all`, authHeader)
      ]);

      setPendingLeaves(pendingRes.data.data || []);
      setAllLeaves(allRes.data.data || []);
    } catch (error) {
      console.error('Error fetching leave data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (leaveId) => {
    setProcessing(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/leaves/${leaveId}/approve`, {}, authHeader);
      toast.success('Leave approved successfully!');
      setShowReviewModal(false);
      fetchData();
    } catch (error) {
      console.error('Error approving leave:', error);
      toast.error(error.response?.data?.error || 'Failed to approve leave');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (leaveId) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/leaves/${leaveId}/reject`,
        { rejectionReason: rejectionReason.trim() },
        authHeader
      );
      toast.success('Leave rejected');
      setShowReviewModal(false);
      setRejectionReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast.error(error.response?.data?.error || 'Failed to reject leave');
    } finally {
      setProcessing(false);
    }
  };

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

  const getLeaveTypeColor = (type) => {
    switch(type) {
      case 'Paid Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick Leave': return 'bg-red-100 text-red-700 border-red-200';
      case 'Casual Leave': return 'bg-green-100 text-green-700 border-green-200';
      case 'Unpaid Leave': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredLeaves = () => {
    const leaves = selectedTab === 'pending' ? pendingLeaves : allLeaves;
    let filtered = leaves;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(leave =>
        leave.employeeId?.name?.toLowerCase().includes(search) ||
        leave.employeeId?.email?.toLowerCase().includes(search) ||
        leave.leaveType?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all' && selectedTab !== 'pending') {
      filtered = filtered.filter(leave => leave.status === statusFilter);
    }

    return filtered;
  };

  const displayedLeaves = filteredLeaves();
  const totalPages = Math.ceil(displayedLeaves.length / itemsPerPage);
  const paginatedLeaves = displayedLeaves.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    pending: pendingLeaves.length,
    total: allLeaves.length,
    approved: allLeaves.filter(l => l.status === 'approved').length,
    rejected: allLeaves.filter(l => l.status === 'rejected').length
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

  return (
    <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Leave Management
            </h1>
            <p className="text-slate-500 text-sm mt-1">Review and manage employee leave requests</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white">
          <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Pending</p>
          <p className="text-2xl font-bold">{stats.pending}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Approved</p>
          <p className="text-2xl font-bold">{stats.approved}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Rejected</p>
          <p className="text-2xl font-bold">{stats.rejected}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1">
        <button
          onClick={() => { setSelectedTab('pending'); setCurrentPage(1); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            selectedTab === 'pending'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => { setSelectedTab('all'); setCurrentPage(1); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            selectedTab === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          All History
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
            />
          </div>
          {selectedTab === 'all' && (
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Leaves List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {paginatedLeaves.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No leave requests found</p>
            <p className="text-xs text-slate-400 mt-1">All caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedLeaves.map((leave) => {
              const isExpanded = expandedLeave === leave._id;
              const employee = leave.employeeId || {};

              return (
                <div key={leave._id} className="hover:bg-slate-50/50 transition-all">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedLeave(isExpanded ? null : leave._id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {employee.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">{employee.name || 'Unknown'}</span>
                            <span className="text-[10px] text-slate-500">{employee.employeeCode || ''}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${getLeaveTypeColor(leave.leaveType)}`}>
                              {leave.leaveType}
                            </span>
                            {getStatusBadge(leave.status)}
                            {leave.isHalfDay && (
                              <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Half Day</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {leave.status === 'pending' && selectedTab === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeave(leave);
                              setShowReviewModal(true);
                              setRejectionReason('');
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"
                          >
                            <Eye size={12} />
                            Review
                          </button>
                        )}
                        <div className="text-right text-[10px] text-slate-400">
                          <p>Applied: {formatDate(leave.appliedAt)}</p>
                          {leave.approvedAt && (
                            <p className="text-green-600">Approved: {formatDate(leave.approvedAt)}</p>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Details</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p><span className="text-slate-500">Name:</span> {employee.name || 'N/A'}</p>
                            <p><span className="text-slate-500">Email:</span> {employee.email || 'N/A'}</p>
                            <p><span className="text-slate-500">Role:</span> {employee.role || 'N/A'}</p>
                            <p><span className="text-slate-500">Department:</span> {employee.department || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Details</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p><span className="text-slate-500">Type:</span> {leave.leaveType}</p>
                            <p><span className="text-slate-500">From:</span> {formatDate(leave.startDate)}</p>
                            <p><span className="text-slate-500">To:</span> {formatDate(leave.endDate)}</p>
                            <p><span className="text-slate-500">Half Day:</span> {leave.isHalfDay ? 'Yes' : 'No'}</p>
                            <p><span className="text-slate-500">Days:</span> {Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason</p>
                          <p className="text-sm text-slate-700 mt-2">{leave.reason}</p>
                          {leave.status === 'rejected' && leave.rejectionReason && (
                            <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                              <p className="text-[10px] font-bold text-red-600 uppercase">Rejection Reason</p>
                              <p className="text-sm text-red-700">{leave.rejectionReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Review Modal */}
      {showReviewModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Review Leave Request</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedLeave.employeeId?.name || 'Unknown'} • {selectedLeave.leaveType}
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Employee</p>
                    <p className="font-bold text-slate-800">{selectedLeave.employeeId?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Leave Type</p>
                    <p className="font-bold text-slate-800">{selectedLeave.leaveType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">From</p>
                    <p className="font-bold text-slate-800">{formatDate(selectedLeave.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">To</p>
                    <p className="font-bold text-slate-800">{formatDate(selectedLeave.endDate)}</p>
                  </div>
                  {selectedLeave.isHalfDay && (
                    <div className="col-span-2">
                      <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">Half Day</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Reason</p>
                  <p className="text-sm text-slate-700 mt-1">{selectedLeave.reason}</p>
                </div>
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Rejection Reason (if rejecting)
                </label>
                <textarea
                  placeholder="Enter reason for rejection..."
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-red-400 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleReject(selectedLeave._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedLeave._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

export default HrLeaveDashboard;