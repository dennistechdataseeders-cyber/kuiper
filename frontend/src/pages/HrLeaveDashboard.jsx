// frontend/src/pages/HrLeaveDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Check,
  Clock,
  Eye,
  Loader2,
  X,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  Mail,
  User as UserIcon,
  Briefcase,
  Building2,
  Phone,
  CalendarDays,
  Hash,
  AlertCircle,
  Pencil,
  Save,
  Edit,
  Plus,
  Minus,
  Users
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HrLeaveDashboard = () => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [selectedTab, setSelectedTab] = useState('pending'); // 'pending' | 'all' | 'editLeaves'
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLeave, setExpandedLeave] = useState(null);
  const itemsPerPage = 10;

  // ============================================
  // Edit Paid Leaves State
  // Items are shaped as { employee: {...}, summary: {...} }
  // as returned by GET /api/leave-bucket/employees/buckets
  // ============================================
  const [employeesForEdit, setEmployeesForEdit] = useState([]);
  const [employeesForEditLoading, setEmployeesForEditLoading] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [editLeaveCurrentPage, setEditLeaveCurrentPage] = useState(1);
  const editLeaveItemsPerPage = 10;

  const [showEditLeaveModal, setShowEditLeaveModal] = useState(false);
  const [selectedEditEmployee, setSelectedEditEmployee] = useState(null); // { employee, summary }
  const [editLeaveBalance, setEditLeaveBalance] = useState(0);
  const [editLeaveReason, setEditLeaveReason] = useState('');
  const [editLeaveSubmitting, setEditLeaveSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // ============================================
  // FIXED: Read the real Paid Leave balance from the LeaveBucket summary,
  // not the legacy User.leaveBalances field (which the new accrual system
  // never writes to).
  // ============================================
  const getPaidLeaveBalance = (item) => {
    return item?.summary?.totalBalance ?? 0;
  };

  // ============================================
  // Fetch pending + all leaves
  // ============================================
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

  // ============================================
  // Fetch all employees for the Edit Paid Leaves tab
  // ============================================
  const fetchAllEmployeesForEdit = async () => {
    setEmployeesForEditLoading(true);
    try {
      // Returns [{ employee: {...}, summary: { totalBalance, ... } }, ...]
      const res = await axios.get(
        `${API_BASE_URL}/api/leave-bucket/employees/buckets`,
        authHeader
      );
      setEmployeesForEdit(res.data.data || []);
    } catch (error) {
      console.error('Error fetching employees for edit:', error);
      toast.error('Failed to load employees');
    } finally {
      setEmployeesForEditLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTab === 'editLeaves') {
      fetchAllEmployeesForEdit();
    }
  }, [selectedTab]);

  // ============================================
  // Approve / Reject
  // ============================================
  const handleApprove = async (leaveId) => {
    setProcessing(true);
    try {
      // Uses the leave-bucket system so the real bucket balance is deducted
      await axios.patch(
        `${API_BASE_URL}/api/leave-bucket/${leaveId}/approve`,
        {},
        authHeader
      );
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
        `${API_BASE_URL}/api/leave-bucket/${leaveId}/reject`,
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

  // ============================================
  // Edit Paid Leaves: Open modal
  // ============================================
  const openEditLeaveModal = (item) => {
    setSelectedEditEmployee(item); // { employee, summary }
    setEditLeaveBalance(getPaidLeaveBalance(item));
    setEditLeaveReason('');
    setShowEditLeaveModal(true);
  };

  // ============================================
  // Edit Paid Leaves: Submit adjustment
  // Sends the target balance directly — no more delta math
  // ============================================
  const handleEditLeaveSubmit = async (e) => {
    e.preventDefault();
    if (editLeaveBalance < 0) {
      toast.error('Leave balance cannot be negative');
      return;
    }
    if (!editLeaveReason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }
    setEditLeaveSubmitting(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/leave-bucket/employee/${selectedEditEmployee.employee._id}/adjust`,
        { newBalance: editLeaveBalance, reason: editLeaveReason.trim() },
        authHeader
      );
      toast.success(
        `Paid Leave balance updated for ${selectedEditEmployee.employee.name}`
      );
      setShowEditLeaveModal(false);
      setSelectedEditEmployee(null);
      setEditLeaveBalance(0);
      setEditLeaveReason('');
      fetchAllEmployeesForEdit();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update leave balance');
    } finally {
      setEditLeaveSubmitting(false);
    }
  };

  // ============================================
  // Formatting helpers
  // ============================================
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
            <Check size={12} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
            <X size={12} /> Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold">
            <Clock size={12} /> Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  const getLeaveTypeColor = (type) => {
    switch (type) {
      case 'Paid Leave':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick Leave':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Casual Leave':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Unpaid Leave':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // ============================================
  // Filtering (Pending / All)
  // ============================================
  const filteredLeaves = () => {
    const leaves = selectedTab === 'pending' ? pendingLeaves : allLeaves;
    let filtered = leaves;

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((leave) => {
        const emp = leave.employeeId || {};
        return (
          emp.name?.toLowerCase().includes(search) ||
          emp.email?.toLowerCase().includes(search) ||
          emp.employeeCode?.toLowerCase().includes(search) ||
          leave.leaveType?.toLowerCase().includes(search)
        );
      });
    }

    if (statusFilter !== 'all' && selectedTab !== 'pending') {
      filtered = filtered.filter((leave) => leave.status === statusFilter);
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter((leave) => {
        const d = new Date(leave.startDate);
        if (isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return key === monthFilter;
      });
    }

    return filtered;
  };

  const displayedLeaves = filteredLeaves();
  const totalPages = Math.ceil(displayedLeaves.length / itemsPerPage);
  const paginatedLeaves = displayedLeaves.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const monthOptions = useMemo(() => {
    const set = new Set();
    const source = selectedTab === 'pending' ? pendingLeaves : allLeaves;
    source.forEach((leave) => {
      const d = new Date(leave.startDate);
      if (isNaN(d.getTime())) return;
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort().reverse();
  }, [allLeaves, pendingLeaves, selectedTab]);

  const stats = {
    pending: pendingLeaves.length,
    total: allLeaves.length,
    approved: allLeaves.filter((l) => l.status === 'approved').length,
    rejected: allLeaves.filter((l) => l.status === 'rejected').length
  };

  const hasActiveFilters =
    searchTerm || monthFilter !== 'all' || statusFilter !== 'all';

  const computeDays = (leave) => {
    if (!leave.startDate || !leave.endDate) return 0;
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  };

  // ============================================
  // Filter edit employees — items are { employee, summary }
  // ============================================
  const filteredEditEmployees = employeesForEdit.filter((item) => {
    const search = employeeSearchTerm.toLowerCase().trim();
    const emp = item?.employee;
    if (!search) return true;
    return (
      emp?.name?.toLowerCase().includes(search) ||
      emp?.email?.toLowerCase().includes(search) ||
      emp?.employeeCode?.toLowerCase().includes(search)
    );
  });

  const editTotalPages = Math.ceil(
    filteredEditEmployees.length / editLeaveItemsPerPage
  );
  const editCurrentEmployees = filteredEditEmployees.slice(
    (editLeaveCurrentPage - 1) * editLeaveItemsPerPage,
    editLeaveCurrentPage * editLeaveItemsPerPage
  );

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-slate-50 flex items-center justify-center ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading leave data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Leave Management
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Review and manage employee leave requests
            </p>
          </div>
          <button
            onClick={() => {
              if (selectedTab === 'editLeaves') {
                fetchAllEmployeesForEdit();
              } else {
                fetchData();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Combined Header Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
        {/* Row 1: Stats cards only */}
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Pending — RED */}
            <div className="bg-red-500 rounded-lg px-4 py-3 flex flex-col items-center justify-center shadow-sm text-center">
              <span className="text-2xl font-bold text-white leading-none">
                {stats.pending}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1 leading-none">
                Pending
              </span>
            </div>

            {/* Approved — BLUE */}
            <div className="bg-blue-600 rounded-lg px-4 py-3 flex flex-col items-center justify-center shadow-sm text-center">
              <span className="text-2xl font-bold text-white leading-none">
                {stats.approved}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1 leading-none">
                Approved
              </span>
            </div>

            {/* Rejected — BLUE */}
            <div className="bg-blue-600 rounded-lg px-4 py-3 flex flex-col items-center justify-center shadow-sm text-center">
              <span className="text-2xl font-bold text-white leading-none">
                {stats.rejected}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1 leading-none">
                Rejected
              </span>
            </div>

            {/* Total — BLUE */}
            <div className="bg-blue-600 rounded-lg px-4 py-3 flex flex-col items-center justify-center shadow-sm text-center">
              <span className="text-2xl font-bold text-white leading-none">
                {stats.total}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1 leading-none">
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Toggle button BELOW the stats cards */}
      <div className="px-4 pb-4 border-t border-slate-100 pt-3">
  <div className="flex items-center bg-slate-100 rounded-lg p-1 w-full gap-1">
    <button
      onClick={() => {
        setSelectedTab('pending');
        setCurrentPage(1);
        setSearchTerm('');
        setMonthFilter('all');
        setStatusFilter('all');
      }}
      className={`flex-1 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap text-center ${
        selectedTab === 'pending'
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      Pending ({stats.pending})
    </button>
    <button
      onClick={() => {
        setSelectedTab('all');
        setCurrentPage(1);
        setSearchTerm('');
        setMonthFilter('all');
        setStatusFilter('all');
      }}
      className={`flex-1 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap text-center ${
        selectedTab === 'all'
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      All History
    </button>
    <button
      onClick={() => {
        setSelectedTab('editLeaves');
        setEditLeaveCurrentPage(1);
        setEmployeeSearchTerm('');
      }}
      className={`flex-1 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
        selectedTab === 'editLeaves'
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Pencil size={12} />
      Edit Paid Leaves
    </button>
  </div>
</div>

        {/* Row 3: Filters (only for pending / all tabs) */}
        {(selectedTab === 'pending' || selectedTab === 'all') && (
          <div className="flex flex-col md:flex-row gap-3 p-4 border-t border-slate-100">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by employee name, email or code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-xs focus:border-blue-400 bg-slate-50"
              />
            </div>

            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg outline-none text-xs focus:border-blue-400 bg-slate-50 appearance-none cursor-pointer"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split('-');
                  const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(
                    'en-IN',
                    { month: 'short', year: 'numeric' }
                  );
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedTab === 'all' && (
              <div className="relative">
                <Filter
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg outline-none text-xs focus:border-blue-400 bg-slate-50 appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setMonthFilter('all');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-all text-xs font-medium flex items-center gap-1.5"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* EDIT PAID LEAVES TAB                          */}
      {/* ============================================ */}
     {/* ============================================ */}
{/* EDIT PAID LEAVES TAB                          */}
{/* ============================================ */}
{selectedTab === 'editLeaves' && (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    {/* Header */}
    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <Pencil size={16} className="text-blue-700" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight">
            Edit Paid Leave Balances
          </h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
            {filteredEditEmployees.length} employee
            {filteredEditEmployees.length !== 1 ? 's' : ''} available for adjustment
          </p>
        </div>
      </div>
      <button
        onClick={() => {
          setEmployeeSearchTerm('');
          setEditLeaveCurrentPage(1);
          fetchAllEmployeesForEdit();
        }}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
      >
        <RefreshCw size={12} /> Refresh
      </button>
    </div>

    <div className="p-4">
      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          type="text"
          placeholder="Search by name, email, or employee code..."
          value={employeeSearchTerm}
          onChange={(e) => {
            setEmployeeSearchTerm(e.target.value);
            setEditLeaveCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-slate-50 transition-all"
        />
      </div>

      {employeesForEditLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500 mt-3">
            Loading employees...
          </p>
        </div>
      ) : editCurrentEmployees.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-slate-400" />
          </div>
          <p className="text-sm font-black text-slate-700">No employees found</p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Try adjusting your search query
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Employee
                </th>
                <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Code
                </th>
                <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Role
                </th>
                <th className="px-5 py-3.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Paid Leave
                </th>
                <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {editCurrentEmployees.map((item, idx) => {
                const emp = item.employee;
                const balance = getPaidLeaveBalance(item);

                // Balance color coding
                const balanceColor =
                  balance === 0
                    ? 'text-rose-600 bg-rose-50 border-rose-200'
                    : balance < 3
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

                return (
                  <tr
                    key={emp._id}
                    className={`transition-all hover:bg-blue-50/40 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-sm flex-shrink-0">
                          {emp.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {emp.name || 'Unknown'}
                          </p>
                          <p className="text-[11px] font-medium text-slate-600 truncate max-w-[200px]">
                            {emp.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-black font-mono text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        <Hash size={10} className="text-slate-500" />
                        {emp.employeeCode || 'N/A'}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          emp.role === 'Developer'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : emp.role === 'Team Lead'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            : emp.role === 'Sales'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : emp.role === 'Project Manager'
                            ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {emp.role || 'N/A'}
                      </span>
                      {emp.isProbationary && (
                        <span className="ml-2 inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          Probation
                        </span>
                      )}
                    </td>

                    {/* Paid Leave Balance */}
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-baseline gap-1 px-3 py-1.5 rounded-lg border-2 font-black ${balanceColor}`}
                      >
                        <span className="text-lg leading-none">{balance}</span>
                        <span className="text-[10px] font-bold opacity-80">
                          {balance === 1 ? 'day' : 'days'}
                        </span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openEditLeaveModal(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-md"
                      >
                        <Edit size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {editTotalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <span className="text-[11px] font-bold text-slate-600">
            Showing{' '}
            <span className="text-slate-900">
              {(editLeaveCurrentPage - 1) * editLeaveItemsPerPage + 1}
            </span>{' '}
            to{' '}
            <span className="text-slate-900">
              {Math.min(
                editLeaveCurrentPage * editLeaveItemsPerPage,
                filteredEditEmployees.length
              )}
            </span>{' '}
            of{' '}
            <span className="text-slate-900">{filteredEditEmployees.length}</span>
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setEditLeaveCurrentPage((p) => Math.max(1, p - 1))}
              disabled={editLeaveCurrentPage === 1}
              className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() =>
                setEditLeaveCurrentPage((p) => Math.min(editTotalPages, p + 1))
              }
              disabled={editLeaveCurrentPage === editTotalPages}
              className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}

      {/* ============================================ */}
      {/* PENDING / ALL LEAVES LIST                     */}
      {/* ============================================ */}
      {(selectedTab === 'pending' || selectedTab === 'all') && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {paginatedLeaves.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                No leave requests found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'All caught up!'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedLeaves.map((leave) => {
                const isExpanded = expandedLeave === leave._id;
                const employee = leave.employeeId || {};
                const days = computeDays(leave);

                return (
                  <div
                    key={leave._id}
                    className="hover:bg-slate-50/50 transition-all"
                  >
                    {/* Collapsed header row */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedLeave(isExpanded ? null : leave._id)
                      }
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {employee.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-800">
                                {employee.name || 'Unknown'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {employee.employeeCode || ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${getLeaveTypeColor(
                                  leave.leaveType
                                )}`}
                              >
                                {leave.leaveType}
                              </span>
                              {getStatusBadge(leave.status)}
                              {leave.isHalfDay && (
                                <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                  Half Day
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(leave.startDate)} -{' '}
                              {formatDate(leave.endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {leave.status === 'pending' &&
                            selectedTab === 'pending' && (
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
                              <p className="text-green-600">
                                Approved: {formatDate(leave.approvedAt)}
                              </p>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-3 border-t border-slate-100 bg-slate-50/40">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Card 1: Employee Details */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                                <UserIcon size={12} className="text-blue-600" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Employee Details
                              </p>
                            </div>
                            <div className="space-y-2.5">
                              <DetailRow
                                icon={<UserIcon size={12} />}
                                label="Full Name"
                                value={employee.name || 'N/A'}
                              />
                              <DetailRow
                                icon={<Mail size={12} />}
                                label="Email"
                                value={employee.email || 'N/A'}
                                breakAll
                              />
                              <DetailRow
                                icon={<Briefcase size={12} />}
                                label="Role"
                                value={employee.role || 'N/A'}
                              />
                            
                            </div>
                          </div>

                          {/* Card 2: Leave Details */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                                <CalendarDays
                                  size={12}
                                  className="text-blue-600"
                                />
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Leave Details
                              </p>
                            </div>
                            <div className="space-y-2.5">
                              <DetailRow
                                label="Leave Type"
                                value={
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${getLeaveTypeColor(
                                      leave.leaveType
                                    )}`}
                                  >
                                    {leave.leaveType}
                                  </span>
                                }
                              />
                              <DetailRow
                                label="From Date"
                                value={formatDate(leave.startDate)}
                              />
                              <DetailRow
                                label="To Date"
                                value={formatDate(leave.endDate)}
                              />
                              <DetailRow
                                label="Total Days"
                                value={`${days} day${days !== 1 ? 's' : ''}`}
                              />
                              <DetailRow
                                label="Half Day"
                                value={
                                  leave.isHalfDay ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                      Yes{' '}
                                      {leave.halfDayType
                                        ? `(${leave.halfDayType})`
                                        : ''}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-500">
                                      No
                                    </span>
                                  )
                                }
                              />
                              <DetailRow
                                label="Applied On"
                                value={formatDateTime(leave.appliedAt)}
                              />
                            </div>
                          </div>

                          {/* Card 3: Reason & Timeline */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                                <FileText size={12} className="text-blue-600" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Reason
                              </p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {leave.reason || 'No reason provided'}
                              </p>
                            </div>

                            {leave.status === 'rejected' &&
                              leave.rejectionReason && (
                                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <AlertCircle
                                      size={12}
                                      className="text-red-600"
                                    />
                                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                                      Rejection Reason
                                    </p>
                                  </div>
                                  <p className="text-xs text-red-700 leading-relaxed">
                                    {leave.rejectionReason}
                                  </p>
                                </div>
                              )}

                            {leave.status === 'approved' && leave.approvedAt && (
                              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Check size={12} className="text-green-600" />
                                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                                    Approved On
                                  </p>
                                </div>
                                <p className="text-xs text-green-700 font-medium">
                                  {formatDateTime(leave.approvedAt)}
                                </p>
                                {leave.approvedBy && (
                                  <p className="text-[10px] text-green-600 mt-0.5">
                                    By: {leave.approvedBy.name || 'HR'}
                                  </p>
                                )}
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
                Page {currentPage} of {totalPages} • {displayedLeaves.length}{' '}
                total
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
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

      {/* ============================================ */}
      {/* Review Modal (Pending leaves)                 */}
      {/* ============================================ */}
      {showReviewModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Review Leave Request
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedLeave.employeeId?.name || 'Unknown'} •{' '}
                  {selectedLeave.leaveType}
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Employee
                    </p>
                    <p className="font-bold text-slate-800">
                      {selectedLeave.employeeId?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Leave Type
                    </p>
                    <p className="font-bold text-slate-800">
                      {selectedLeave.leaveType}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      From
                    </p>
                    <p className="font-bold text-slate-800">
                      {formatDate(selectedLeave.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      To
                    </p>
                    <p className="font-bold text-slate-800">
                      {formatDate(selectedLeave.endDate)}
                    </p>
                  </div>
                  {selectedLeave.isHalfDay && (
                    <div className="col-span-2">
                      <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                        Half Day{' '}
                        {selectedLeave.halfDayType
                          ? `(${selectedLeave.halfDayType})`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Reason
                  </p>
                  <p className="text-sm text-slate-700 mt-1">
                    {selectedLeave.reason}
                  </p>
                </div>
              </div>

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
                  {processing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <X size={14} />
                  )}
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedLeave._id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Edit Paid Leave Modal                         */}
      {/* ============================================ */}
      {showEditLeaveModal && selectedEditEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[350] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Pencil size={20} className="text-blue-600" /> Edit Paid Leave
                  Balance
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedEditEmployee.employee.name} •{' '}
                  {selectedEditEmployee.employee.employeeCode || 'No code'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditLeaveModal(false);
                  setSelectedEditEmployee(null);
                  setEditLeaveBalance(0);
                  setEditLeaveReason('');
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditLeaveSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-blue-600" />
                  <p className="text-[10px] font-bold text-slate-700">
                    Current Balance
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-blue-600">
                    {getPaidLeaveBalance(selectedEditEmployee)}
                  </span>
                  <span className="text-sm text-slate-500">days</span>
                </div>
                {selectedEditEmployee.employee.isProbationary && (
                  <p className="text-[9px] text-amber-600 font-bold mt-2 flex items-center gap-1">
                    <AlertCircle size={11} /> On probation — can only use
                    Unpaid Leave, but the Paid Leave balance still accrues/can
                    be adjusted.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                  New Balance (days) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={editLeaveBalance}
                    onChange={(e) =>
                      setEditLeaveBalance(parseFloat(e.target.value) || 0)
                    }
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-bold text-sm text-slate-700 focus:border-blue-400 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditLeaveBalance(
                          Math.max(0, editLeaveBalance - 0.5)
                        )
                      }
                      className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditLeaveBalance(editLeaveBalance + 0.5)
                      }
                      className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[7px] text-slate-400 mt-1">
                  Half-day increments (0.5 days). Set below current balance to
                  penalize, above to reward.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                  Reason for Change *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g., Reward for extra hours worked, Penalty for unapproved absence, Carry forward balance, etc."
                  value={editLeaveReason}
                  onChange={(e) => setEditLeaveReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm text-slate-700 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditLeaveModal(false);
                    setSelectedEditEmployee(null);
                    setEditLeaveBalance(0);
                    setEditLeaveReason('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLeaveSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editLeaveSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Balance
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- Helper: DetailRow ---------------- */
const DetailRow = ({ icon, label, value, breakAll = false }) => (
  <div className="flex items-start gap-2">
    {icon && (
      <div className="w-4 h-4 mt-0.5 flex items-center justify-center text-slate-400 shrink-0">
        {icon}
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <div
        className={`text-xs font-semibold text-slate-800 leading-snug ${
          breakAll ? 'break-all' : 'break-words'
        }`}
      >
        {value}
      </div>
    </div>
  </div>
);

export default HrLeaveDashboard;