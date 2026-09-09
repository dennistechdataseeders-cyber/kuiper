// frontend/src/pages/HrDashboard.jsx - WITH EDIT PAID LEAVES TAB (FIXED, wired to LeaveBucket)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import {
  Users, UserCheck, UserX, Clock, Calendar, FileText, CheckCircle, XCircle,
  AlertCircle, TrendingUp, Building2, Search, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Loader2, Eye, Check, X, UserPlus, Settings,
  Bell, Activity, BarChart3, X as XIcon, UserCog, CalendarDays, Info,
  RefreshCw, Pencil, Save, User as UserIcon, Mail, Phone, Briefcase,
  Clock as ClockIcon, Hash, Edit, Plus, Minus
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HrDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, onLeave: 0, totalEmployees: 0, pendingLeaves: 0, pendingCorrections: 0, attendanceRate: 0 });
  const [showEmployeeListModal, setShowEmployeeListModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalEmployees, setModalEmployees] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const modalItemsPerPage = 10;
  const [presentEmployees, setPresentEmployees] = useState([]);
  const [presentEmployeesLoaded, setPresentEmployeesLoaded] = useState(false);
  const [absentEmployees, setAbsentEmployees] = useState([]);
  const [absentEmployeesLoaded, setAbsentEmployeesLoaded] = useState(false);
  const [lateEmployees, setLateEmployees] = useState([]);
  const [lateEmployeesLoaded, setLateEmployeesLoaded] = useState(false);
  const [onLeaveEmployeesList, setOnLeaveEmployeesList] = useState([]);
  const [onLeaveEmployeesLoaded, setOnLeaveEmployeesLoaded] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
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

  // Probation State
  const [probationEmployees, setProbationEmployees] = useState([]);
  const [loadingProbation, setLoadingProbation] = useState(false);
  const [showProbationModal, setShowProbationModal] = useState(false);
  const [selectedProbationEmployee, setSelectedProbationEmployee] = useState(null);
  const [probationForm, setProbationForm] = useState({ isProbationary: false, probationEndDate: '', probationMonths: 3 });
  const [submittingProbation, setSubmittingProbation] = useState(false);

  // Edit Paid Leaves State
  // NOTE: employeesForEdit now holds items shaped like { employee: {...}, summary: {...} }
  // as returned by GET /api/leave-bucket/employees/buckets
  const [showEditLeaveModal, setShowEditLeaveModal] = useState(false);
  const [selectedEditEmployee, setSelectedEditEmployee] = useState(null); // { employee, summary }
  const [editLeaveBalance, setEditLeaveBalance] = useState(0);
  const [editLeaveReason, setEditLeaveReason] = useState('');
  const [editLeaveSubmitting, setEditLeaveSubmitting] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeesForEdit, setEmployeesForEdit] = useState([]);
  const [employeesForEditLoading, setEmployeesForEditLoading] = useState(false);
  const [editLeaveCurrentPage, setEditLeaveCurrentPage] = useState(1);
  const editLeaveItemsPerPage = 10;

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // ✅ FIXED: Read the real Paid Leave balance from the LeaveBucket summary,
  // not the legacy User.leaveBalances field (which the new accrual system never writes to).
  const getPaidLeaveBalance = (item) => {
    return item?.summary?.totalBalance ?? 0;
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, leavesRes, correctionsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/hr/dashboard/stats`, authHeader),
        // ✅ FIXED: pull pending leaves from the leave-bucket system so "Approve" below
        // actually deducts from the real bucket instead of the dead legacy field.
        axios.get(`${API_BASE_URL}/api/leave-bucket/pending`, authHeader),
        axios.get(`${API_BASE_URL}/api/hr/attendance/corrections`, authHeader)
      ]);
      const statsData = statsRes.data.data;
      setStats({
        present: statsData.present || 0, absent: statsData.absent || 0, late: statsData.late || 0,
        onLeave: statsData.onLeave || 0, totalEmployees: statsData.totalEmployees || 0,
        pendingLeaves: statsData.pendingLeaves || 0, pendingCorrections: statsData.pendingCorrections || 0,
        attendanceRate: statsData.attendanceRate || 0
      });
      setPendingLeaves(leavesRes.data.data || []);
      setPendingCorrections(correctionsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching HR data:', error);
      toast.error('Failed to load dashboard data');
    } finally { setLoading(false); }
  };

  // Fetch employees by status
  const fetchEmployeesByStatusInternal = async (status) => {
    try {
      const now = new Date();
      const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const todayStr = istNow.toISOString().split('T')[0];
      const employeesRes = await axios.get(`${API_BASE_URL}/api/hr/employees`, authHeader);
      const employees = employeesRes.data.employees || [];
      if (employees.length === 0) return [];

      // This just reads LeaveApplication status/dates (shared collection regardless of
      // which system approved it), so it's fine to leave on the /api/hr/leave path.
      const leavesRes = await axios.get(`${API_BASE_URL}/api/hr/leave/all`, { ...authHeader, params: { status: 'approved' } }).catch(() => ({ data: { data: [] } }));
      const onLeaveIds = new Set();
      (leavesRes.data.data || []).forEach(leave => {
        const start = new Date(leave.startDate), end = new Date(leave.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.toISOString().split('T')[0] === todayStr) { onLeaveIds.add(leave.employeeId.toString()); break; }
        }
      });

      const employeesWithStatus = await Promise.all(employees.map(async (emp) => {
        if (onLeaveIds.has(emp._id.toString())) return { ...emp, status: 'leave' };
        try {
          const res = await axios.get(`${API_BASE_URL}/api/hr/attendance/employee-timeline/${emp._id}?months=1`, authHeader);
          const todayRecord = (res.data.data?.days || []).find(d => (d.date instanceof Date ? d.date.toISOString().split('T')[0] : d.date) === todayStr);
          if (!todayRecord) return { ...emp, status: 'absent' };
          if (todayRecord.isWeekend) return { ...emp, status: 'weekend' };
          let empStatus = todayRecord.status || '';
          if (empStatus === 'on_time') return { ...emp, status: 'present' };
          if (empStatus === 'late' || empStatus === 'partial' && todayRecord.isLate) return { ...emp, status: 'late' };
          if (empStatus === 'leave') return { ...emp, status: 'leave' };
          if (empStatus === 'absent') return { ...emp, status: 'absent' };
          if (todayRecord.punchInUTC) {
            const punchDate = new Date(todayRecord.punchInUTC);
            const istPunch = new Date(punchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const isLate = istPunch.getHours() > 10 || (istPunch.getHours() === 10 && istPunch.getMinutes() > 45);
            return { ...emp, status: isLate ? 'late' : 'present' };
          }
          return { ...emp, status: 'absent' };
        } catch { return { ...emp, status: 'absent' }; }
      }));

      const filterMap = { present: 'present', absent: 'absent', late: 'late', onLeave: 'leave' };
      return employeesWithStatus.filter(e => e.status === filterMap[status]);
    } catch (error) { console.error('Error fetching employees by status:', error); return []; }
  };

  // Fetch overview lists
  const fetchOverviewLists = async () => {
    setPresentEmployeesLoaded(false); setAbsentEmployeesLoaded(false); setLateEmployeesLoaded(false); setOnLeaveEmployeesLoaded(false);
    try {
      const [presentList, absentList, lateList, onLeaveList] = await Promise.all([
        fetchEmployeesByStatusInternal('present'), fetchEmployeesByStatusInternal('absent'),
        fetchEmployeesByStatusInternal('late'), fetchEmployeesByStatusInternal('onLeave')
      ]);
      setPresentEmployees(presentList || []);
      setAbsentEmployees(absentList || []);
      setLateEmployees(lateList || []);
      setOnLeaveEmployeesList(onLeaveList || []);
    } catch (error) { console.error('Error fetching overview lists:', error); }
    finally { setPresentEmployeesLoaded(true); setAbsentEmployeesLoaded(true); setLateEmployeesLoaded(true); setOnLeaveEmployeesLoaded(true); }
  };

  // Probation functions
  const fetchProbationEmployees = async () => {
    setLoadingProbation(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees/probation`, authHeader);
      if (res.data.success) setProbationEmployees(res.data.data);
    } catch (error) { console.error('Error fetching probation employees:', error); toast.error('Failed to load probation data'); }
    finally { setLoadingProbation(false); }
  };

  const handleProbationUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProbationEmployee) return;
    setSubmittingProbation(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/hr/employees/${selectedProbationEmployee._id}/probation`, {
        isProbationary: probationForm.isProbationary,
        probationEndDate: probationForm.isProbationary ? probationForm.probationEndDate : null
      }, authHeader);
      toast.success(`Probation status updated for ${selectedProbationEmployee.name}`);
      setShowProbationModal(false);
      setSelectedProbationEmployee(null);
      fetchProbationEmployees();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to update probation status'); }
    finally { setSubmittingProbation(false); }
  };

  const handleCompleteProbation = async (employee) => {
    if (!window.confirm(`Complete probation for ${employee.name}?`)) return;
    try {
      await axios.post(`${API_BASE_URL}/api/hr/employees/${employee._id}/complete-probation`, {}, authHeader);
      toast.success(`${employee.name} probation completed successfully!`);
      fetchProbationEmployees();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to complete probation'); }
  };

  const openProbationModal = (employee) => {
    setSelectedProbationEmployee(employee);
    setProbationForm({
      isProbationary: employee.isProbationary || false,
      probationEndDate: employee.probationEndDate ? new Date(employee.probationEndDate).toISOString().split('T')[0] : '',
      probationMonths: 3
    });
    setShowProbationModal(true);
  };

  const calculateProbationEndDate = (joiningDate, months = 3) => {
    if (!joiningDate) return '';
    const date = new Date(joiningDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  // ============================================
  // Edit Paid Leaves functions — now wired to the real LeaveBucket system
  // ============================================
  const fetchAllEmployeesForEdit = async () => {
    setEmployeesForEditLoading(true);
    try {
      // ✅ FIXED: was /api/hr/employees (reads dead User.leaveBalances field, always 0).
      // This returns [{ employee: {...}, summary: { totalBalance, ... } }, ...]
      const res = await axios.get(`${API_BASE_URL}/api/leave-bucket/employees/buckets`, authHeader);
      setEmployeesForEdit(res.data.data || []);
    } catch (error) { console.error('Error fetching employees for edit:', error); toast.error('Failed to load employees'); }
    finally { setEmployeesForEditLoading(false); }
  };

  const openEditLeaveModal = (item) => {
    setSelectedEditEmployee(item); // { employee, summary }
    setEditLeaveBalance(getPaidLeaveBalance(item));
    setEditLeaveReason('');
    setShowEditLeaveModal(true);
  };

  const handleEditLeaveSubmit = async (e) => {
    e.preventDefault();
    if (editLeaveBalance < 0) { toast.error('Leave balance cannot be negative'); return; }
    if (!editLeaveReason.trim()) { toast.error('Please provide a reason for the change'); return; }
    setEditLeaveSubmitting(true);
    try {
      // ✅ FIXED: send the target balance directly — no more delta math, no more
      // ambiguous "set" semantics that silently corrupted the balance. And this
      // writes to LeaveBucket.totalBalance, the field employees actually see/use.
      await axios.patch(
        `${API_BASE_URL}/api/leave-bucket/employee/${selectedEditEmployee.employee._id}/adjust`,
        { newBalance: editLeaveBalance, reason: editLeaveReason.trim() },
        authHeader
      );
      toast.success(`Paid Leave balance updated for ${selectedEditEmployee.employee.name}`);
      setShowEditLeaveModal(false);
      setSelectedEditEmployee(null);
      setEditLeaveBalance(0);
      setEditLeaveReason('');
      fetchAllEmployeesForEdit();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to update leave balance'); }
    finally { setEditLeaveSubmitting(false); }
  };

  // Leave actions
  const handleApproveLeave = async (leaveId) => {
    setProcessing(true);
    try {
      // ✅ FIXED: was /api/hr/leave/:id/approve (deducted from dead User.leaveBalances).
      await axios.patch(`${API_BASE_URL}/api/leave-bucket/${leaveId}/approve`, {}, authHeader);
      toast.success('Leave approved successfully!');
      setShowLeaveModal(false);
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to approve leave'); }
    finally { setProcessing(false); }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!rejectionReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setProcessing(true);
    try {
      // ✅ FIXED: was /api/hr/leave/:id/reject
      await axios.patch(`${API_BASE_URL}/api/leave-bucket/${leaveId}/reject`, { rejectionReason: rejectionReason.trim() }, authHeader);
      toast.success('Leave rejected');
      setShowLeaveModal(false);
      setRejectionReason('');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to reject leave'); }
    finally { setProcessing(false); }
  };

  const handleApproveCorrection = async (correctionId) => {
    setProcessing(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/hr/attendance/correction/${correctionId}`, { action: 'approve' }, authHeader);
      toast.success('Correction approved!');
      setShowCorrectionModal(false);
      fetchData();
    } catch (error) { toast.error('Failed to approve correction'); }
    finally { setProcessing(false); }
  };

  const handleRejectCorrection = async (correctionId) => {
    setProcessing(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/hr/attendance/correction/${correctionId}`, { action: 'reject' }, authHeader);
      toast.success('Correction rejected');
      setShowCorrectionModal(false);
      fetchData();
    } catch (error) { toast.error('Failed to reject correction'); }
    finally { setProcessing(false); }
  };

  // Format helpers
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Filter functions
  const filteredLeaves = pendingLeaves.filter(l => l.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.leaveType?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCorrections = pendingCorrections.filter(c => c.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalLeavePages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const totalCorrectionPages = Math.ceil(filteredCorrections.length / itemsPerPage);
  const currentLeaves = filteredLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const currentCorrections = filteredCorrections.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const modalFilteredEmployees = modalEmployees.filter(e => e.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) || e.email?.toLowerCase().includes(modalSearchTerm.toLowerCase()) || e.employeeCode?.toLowerCase().includes(modalSearchTerm.toLowerCase()));
  const modalTotalPages = Math.ceil(modalFilteredEmployees.length / modalItemsPerPage);
  const modalCurrentEmployees = modalFilteredEmployees.slice((modalCurrentPage - 1) * modalItemsPerPage, modalCurrentPage * modalItemsPerPage);

  const getModalTitle = () => ({ present: 'Present Employees', absent: 'Absent Employees', late: 'Late Employees', onLeave: 'Employees on Leave' }[modalType] || 'Employees');
  const getModalColor = () => ({ present: 'text-emerald-600 bg-emerald-50 border-emerald-200', absent: 'text-red-600 bg-red-50 border-red-200', late: 'text-amber-600 bg-amber-50 border-amber-200', onLeave: 'text-purple-600 bg-purple-50 border-purple-200' }[modalType] || 'text-blue-600 bg-blue-50 border-blue-200');
  const getStatusBadge = (type) => ({ present: 'bg-emerald-100 text-emerald-700', absent: 'bg-red-100 text-red-700', late: 'bg-amber-100 text-amber-700', onLeave: 'bg-purple-100 text-purple-700' }[type] || 'bg-slate-100 text-slate-700');

  const getProbationStatusDisplay = (employee) => {
    if (!employee.isProbationary) return { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> };
    if (!employee.probationEndDate) return { label: 'On Probation', color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> };
    const now = new Date();
    return new Date(employee.probationEndDate) <= now
      ? { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> }
      : { label: 'On Probation', color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> };
  };

  const getDaysRemaining = (employee) => {
    if (!employee.isProbationary || !employee.probationEndDate) return null;
    const diff = new Date(employee.probationEndDate) - new Date();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  // Filter edit employees — items are now { employee, summary }
  const filteredEditEmployees = employeesForEdit.filter(item => {
    const search = employeeSearchTerm.toLowerCase().trim();
    const emp = item?.employee;
    if (!search) return true;
    return (
      emp?.name?.toLowerCase().includes(search) ||
      emp?.email?.toLowerCase().includes(search) ||
      emp?.employeeCode?.toLowerCase().includes(search)
    );
  });
  const editTotalPages = Math.ceil(filteredEditEmployees.length / editLeaveItemsPerPage);
  const editCurrentEmployees = filteredEditEmployees.slice((editLeaveCurrentPage - 1) * editLeaveItemsPerPage, editLeaveCurrentPage * editLeaveItemsPerPage);

  // Open employee list modal
  const openEmployeeListModal = async (type) => {
    setModalType(type);
    setModalSearchTerm('');
    setModalCurrentPage(1);
    setShowEmployeeListModal(true);
    setModalLoading(true);
    try {
      const employees = await fetchEmployeesByStatusInternal(type);
      setModalEmployees(employees || []);
      if (type === 'present') { setPresentEmployees(employees || []); setPresentEmployeesLoaded(true); }
    } catch (error) { console.error('Error fetching employees:', error); toast.error('Failed to load employee list'); setModalEmployees([]); }
    finally { setModalLoading(false); }
  };

  useEffect(() => {
    fetchData();
    fetchOverviewLists();
    fetchProbationEmployees();
    fetchAllEmployeesForEdit();
  }, []);

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

  const presentCount = presentEmployeesLoaded ? presentEmployees.length : stats.present;
  const absentCount = absentEmployeesLoaded ? absentEmployees.length : stats.absent;
  const lateCount = lateEmployeesLoaded ? lateEmployees.length : stats.late;
  const onLeaveCount = onLeaveEmployeesLoaded ? onLeaveEmployeesList.length : stats.onLeave;

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">HR Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage employee attendance, leaves, and corrections</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-500 uppercase">Live</span>
            </div>
            <div className="sticky top-12 w-auto bg-white rounded-xl border border-slate-200 shadow-lg p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Attendance</span>
                  <span className="text-base font-black text-blue-600">{stats.attendanceRate}%</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2"><Users size={15} className="text-blue-600" /><div><span className="text-[10px] font-bold text-blue-700 block leading-none">Total</span><span className="text-sm font-black text-blue-700 block leading-tight">{stats.totalEmployees}</span></div></div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2"><UserCheck size={15} className="text-emerald-600" /><div><span className="text-[10px] font-bold text-emerald-700 block leading-none">Present</span><span className="text-sm font-black text-emerald-700 block leading-tight">{presentCount}</span></div></div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2"><Clock size={15} className="text-amber-600" /><div><span className="text-[10px] font-bold text-amber-700 block leading-none">Late</span><span className="text-sm font-black text-amber-700 block leading-tight">{lateCount}</span></div></div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2"><UserX size={15} className="text-red-600" /><div><span className="text-[10px] font-bold text-red-700 block leading-none">Absent</span><span className="text-sm font-black text-red-700 block leading-tight">{absentCount}</span></div></div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2"><Calendar size={15} className="text-purple-600" /><div><span className="text-[10px] font-bold text-purple-700 block leading-none">On Leave</span><span className="text-sm font-black text-purple-700 block leading-tight">{onLeaveCount}</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1 overflow-x-auto">
        {[
          { id: 'dashboard', icon: <BarChart3 size={14} />, label: 'Dashboard' },
          { id: 'leaves', icon: <FileText size={14} />, label: `Pending Leaves (${stats.pendingLeaves})` },
          { id: 'corrections', icon: <Clock size={14} />, label: `Corrections (${stats.pendingCorrections})` },
          { id: 'editLeaves', icon: <Pencil size={14} />, label: 'Edit Paid Leaves' },
          { id: 'probation', icon: <UserCog size={14} />, label: `Probation (${probationEmployees.filter(e => e.isProbationary).length})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => { setSelectedTab(tab.id); if (tab.id === 'probation') fetchProbationEmployees(); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center justify-center gap-2 ${selectedTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {selectedTab === 'dashboard' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2"><Users size={16} className="text-blue-600" /> Today's Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'present', label: 'Present (On time)', color: 'emerald', count: presentCount, data: presentEmployees, loaded: presentEmployeesLoaded },
              { key: 'late', label: 'Present (Late)', color: 'amber', count: lateCount, data: lateEmployees, loaded: lateEmployeesLoaded },
              { key: 'absent', label: 'Absent', color: 'red', count: absentCount, data: absentEmployees, loaded: absentEmployeesLoaded },
              { key: 'onLeave', label: 'On Leave', color: 'purple', count: onLeaveCount, data: onLeaveEmployeesList, loaded: onLeaveEmployeesLoaded }
            ].map(({ key, label, color, count, data, loaded }) => (
              <div key={key} className={`border border-${color}-200 rounded-xl overflow-hidden`}>
                <div className={`flex items-center justify-between px-3 py-2.5 bg-${color}-50 border-b border-${color}-200`}>
                  <div className="flex items-center gap-1.5">
                    {key === 'present' && <UserCheck size={14} className={`text-${color}-600`} />}
                    {key === 'late' && <Clock size={14} className={`text-${color}-600`} />}
                    {key === 'absent' && <UserX size={14} className={`text-${color}-600`} />}
                    {key === 'onLeave' && <Calendar size={14} className={`text-${color}-600`} />}
                    <span className={`text-xs font-black text-${color}-700`}>{label}</span>
                  </div>
                  <span className={`text-sm font-black text-${color}-700`}>{count}</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {!loaded ? <div className="flex justify-center py-6"><Loader2 size={18} className={`text-${color}-500 animate-spin`} /></div>
                    : data.length === 0 ? <p className="text-center text-[11px] text-slate-400 py-6">No employees</p>
                    : data.map(emp => <div key={emp._id} className="px-3 py-2 text-xs text-slate-700 truncate">{emp.name}</div>)}
                </div>
              </div>
            ))}
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
                <input type="text" placeholder="Search by employee or leave type..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400" />
              </div>
              <span className="text-xs font-bold text-slate-500">{filteredLeaves.length} pending</span>
            </div>
          </div>
          {currentLeaves.length === 0 ? (
            <div className="p-12 text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><CheckCircle size={28} className="text-slate-300" /></div><p className="text-sm font-bold text-slate-500">No pending leave requests</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {currentLeaves.map(leave => (
                <div key={leave._id} className="p-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">{leave.employeeId?.name?.charAt(0) || '?'}</div>
                      <div><p className="font-bold text-slate-800">{leave.employeeId?.name}</p><p className="text-xs text-slate-500">{leave.leaveType} • {formatDate(leave.startDate)} - {formatDate(leave.endDate)}{leave.isHalfDay && ' (Half Day)'}</p><p className="text-xs text-slate-400 mt-0.5">{leave.reason}</p></div>
                    </div>
                    <button onClick={() => { setSelectedLeave(leave); setShowLeaveModal(true); setRejectionReason(''); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"><Eye size={12} /> Review</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalLeavePages > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">Page {currentPage} of {totalLeavePages}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalLeavePages, p + 1))} disabled={currentPage === totalLeavePages} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
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
              <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search by employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400" /></div>
              <span className="text-xs font-bold text-slate-500">{filteredCorrections.length} pending</span>
            </div>
          </div>
          {currentCorrections.length === 0 ? (
            <div className="p-12 text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><CheckCircle size={28} className="text-slate-300" /></div><p className="text-sm font-bold text-slate-500">No pending corrections</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {currentCorrections.map(correction => (
                <div key={correction._id} className="p-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">{correction.employeeId?.name?.charAt(0) || '?'}</div>
                      <div><p className="font-bold text-slate-800">{correction.employeeId?.name}</p><p className="text-xs text-slate-500">{correction.type === 'in' ? 'Punch In' : 'Punch Out'} • {formatDate(correction.date)}</p><p className="text-xs text-slate-500">Expected: {formatTime(correction.expectedTime)}</p><p className="text-xs text-slate-400 mt-0.5">Reason: {correction.reason}</p></div>
                    </div>
                    <button onClick={() => { setSelectedCorrection(correction); setShowCorrectionModal(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all flex items-center gap-1"><Eye size={12} /> Review</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalCorrectionPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">Page {currentPage} of {totalCorrectionPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalCorrectionPages, p + 1))} disabled={currentPage === totalCorrectionPages} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Paid Leaves Tab - now backed by the real LeaveBucket data */}
      {selectedTab === 'editLeaves' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Pencil size={18} className="text-blue-600" />
              <h3 className="text-sm font-black text-slate-700">Edit Paid Leave Balances</h3>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredEditEmployees.length} employees</span>
            </div>
            <button onClick={() => { setEmployeeSearchTerm(''); setEditLeaveCurrentPage(1); fetchAllEmployeesForEdit(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all"><RefreshCw size={14} /> Refresh</button>
          </div>
          <div className="p-4">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search by name, email, or employee code..." value={employeeSearchTerm} onChange={(e) => { setEmployeeSearchTerm(e.target.value); setEditLeaveCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm focus:border-blue-400 bg-slate-50" />
            </div>
            {employeesForEditLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={32} className="text-blue-600 animate-spin" /></div>
            ) : editCurrentEmployees.length === 0 ? (
              <div className="text-center py-12 text-slate-400"><Users size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm font-medium">No employees found</p><p className="text-xs mt-1">Try adjusting your search</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr><th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-500">Employee</th><th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-500">Code</th><th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-500">Role</th><th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-500">Paid Leave</th><th className="px-4 py-2.5 text-right text-[9px] font-black uppercase text-slate-500">Action</th></tr>
                  </thead>
                  <tbody>
                    {editCurrentEmployees.map(item => {
                      const emp = item.employee;
                      const balance = getPaidLeaveBalance(item);
                      return (
                        <tr key={emp._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{emp.name?.charAt(0)}</div>
                              <div><p className="text-sm font-bold text-slate-800">{emp.name}</p><p className="text-[10px] text-slate-500 truncate max-w-[150px]">{emp.email}</p></div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-xs font-mono text-slate-500">{emp.employeeCode || 'N/A'}</span></td>
                          <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black ${emp.role === 'Developer' ? 'bg-blue-100 text-blue-700' : emp.role === 'Team Lead' ? 'bg-indigo-100 text-indigo-700' : emp.role === 'Sales' ? 'bg-emerald-100 text-emerald-700' : emp.role === 'Project Manager' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-700'}`}>{emp.role || 'N/A'}</span></td>
                          <td className="px-4 py-3"><span className="text-sm font-bold text-blue-600">{balance}</span><span className="text-[9px] text-slate-400 ml-1">days</span>{emp.isProbationary && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-100 text-amber-700">Probation</span>}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEditLeaveModal(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all"><Edit size={12} /> Edit Balance</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {editTotalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <span className="text-[9px] text-slate-400">Showing {((editLeaveCurrentPage - 1) * editLeaveItemsPerPage) + 1} to {Math.min(editLeaveCurrentPage * editLeaveItemsPerPage, filteredEditEmployees.length)} of {filteredEditEmployees.length}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditLeaveCurrentPage(p => Math.max(1, p - 1))} disabled={editLeaveCurrentPage === 1} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <button onClick={() => setEditLeaveCurrentPage(p => Math.min(editTotalPages, p + 1))} disabled={editLeaveCurrentPage === editTotalPages} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Probation Tab */}
      {selectedTab === 'probation' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2"><UserCog size={18} className="text-blue-600" /><h3 className="text-sm font-black text-slate-700">Probation Management</h3><span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{probationEmployees.filter(e => e.isProbationary).length} on probation</span></div>
            <button onClick={() => { fetchProbationEmployees(); toast.success('Probation data refreshed'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all"><RefreshCw size={14} /> Refresh</button>
          </div>
          {loadingProbation ? (
            <div className="flex justify-center py-12"><Loader2 size={32} className="text-blue-600 animate-spin" /></div>
          ) : probationEmployees.length === 0 ? (
            <div className="p-12 text-center text-slate-400"><UserCog size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm font-medium">No employees found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Employee</th><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Code</th><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Joining Date</th><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Probation Status</th><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Days Remaining</th><th className="px-4 py-3 text-right text-[10px] font-bold uppercase text-slate-500">Actions</th></tr>
                </thead>
                <tbody>
                  {probationEmployees.map(emp => {
                    const status = getProbationStatusDisplay(emp);
                    const daysRemaining = getDaysRemaining(emp);
                    return (
                      <tr key={emp._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{emp.name?.charAt(0)}</div><span className="text-sm font-bold text-slate-800">{emp.name}</span></div></td>
                        <td className="px-4 py-3"><span className="text-xs font-mono text-slate-500">{emp.employeeCode || 'N/A'}</span></td>
                        <td className="px-4 py-3"><span className="text-xs text-slate-600">{emp.dateOfJoining ? formatDate(emp.dateOfJoining) : 'N/A'}</span></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${status.color}`}>{status.icon} {status.label}</span>{emp.isProbationary && emp.probationEndDate && <span className="text-[8px] text-slate-400 block mt-0.5">Ends: {formatDate(emp.probationEndDate)}</span>}</td>
                        <td className="px-4 py-3">{emp.isProbationary ? <span className={`text-xs font-bold ${daysRemaining !== null && daysRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{daysRemaining !== null ? `${daysRemaining} days` : 'N/A'}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {emp.isProbationary ? (
                              <><button onClick={() => handleCompleteProbation(emp)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all">Complete</button><button onClick={() => openProbationModal(emp)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all">Edit</button></>
                            ) : (
                              <button onClick={() => openProbationModal(emp)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 transition-all">Start Probation</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leave Review Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div><h2 className="text-xl font-black text-slate-800">Review Leave Request</h2><p className="text-xs text-slate-500 mt-1">#{selectedLeave._id.slice(-6)}</p></div>
              <button onClick={() => setShowLeaveModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">{selectedLeave.employeeId?.name?.charAt(0) || '?'}</div><div><p className="font-bold text-slate-800">{selectedLeave.employeeId?.name}</p><p className="text-xs text-slate-500">{selectedLeave.employeeId?.email}</p></div></div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Leave Type</p><p className="font-bold text-slate-700">{selectedLeave.leaveType}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Status</p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">Pending</span></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">From</p><p className="font-bold text-slate-700">{formatDate(selectedLeave.startDate)}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">To</p><p className="font-bold text-slate-700">{formatDate(selectedLeave.endDate)}</p></div>
                </div>
                {selectedLeave.isHalfDay && <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg inline-block">Half Day</div>}
                <div className="mt-3 pt-3 border-t border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase">Reason</p><p className="text-sm text-slate-700 mt-1">{selectedLeave.reason}</p></div>
              </div>
              <div><label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Rejection Reason (if rejecting)</label><textarea placeholder="Enter reason for rejection..." rows={2} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-red-400 transition-colors" /></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => handleRejectLeave(selectedLeave._id)} disabled={processing} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">{processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject</button>
                <button onClick={() => handleApproveLeave(selectedLeave._id)} disabled={processing} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">{processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correction Review Modal */}
      {showCorrectionModal && selectedCorrection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><div><h2 className="text-xl font-black text-slate-800">Review Correction Request</h2><p className="text-xs text-slate-500 mt-1">#{selectedCorrection._id.slice(-6)}</p></div><button onClick={() => setShowCorrectionModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X size={16} /></button></div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">{selectedCorrection.employeeId?.name?.charAt(0) || '?'}</div><div><p className="font-bold text-slate-800">{selectedCorrection.employeeId?.name}</p><p className="text-xs text-slate-500">{selectedCorrection.employeeId?.email}</p></div></div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Type</p><p className="font-bold text-slate-700">{selectedCorrection.type === 'in' ? 'Punch In' : 'Punch Out'}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Date</p><p className="font-bold text-slate-700">{formatDate(selectedCorrection.date)}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Expected Time</p><p className="font-bold text-slate-700">{formatTime(selectedCorrection.expectedTime)}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Status</p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">Pending</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase">Reason</p><p className="text-sm text-slate-700 mt-1">{selectedCorrection.reason}</p></div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => handleRejectCorrection(selectedCorrection._id)} disabled={processing} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">{processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject</button>
                <button onClick={() => handleApproveCorrection(selectedCorrection._id)} disabled={processing} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">{processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee List Modal */}
      {showEmployeeListModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3"><div className={`p-2 rounded-xl ${getModalColor()}`}>{modalType === 'present' && <UserCheck size={20} />}{modalType === 'absent' && <UserX size={20} />}{modalType === 'late' && <Clock size={20} />}{modalType === 'onLeave' && <Calendar size={20} />}</div><div><h2 className="text-xl font-black text-slate-800">{getModalTitle()}</h2><p className="text-xs text-slate-500">{modalEmployees.length} employee{modalEmployees.length !== 1 ? 's' : ''}</p></div></div>
              <button onClick={() => setShowEmployeeListModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><XIcon size={16} /></button>
            </div>
            <div className="p-6">
              <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search by name, email, or employee code..." value={modalSearchTerm} onChange={(e) => { setModalSearchTerm(e.target.value); setModalCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm focus:border-blue-400 bg-slate-50" /></div>
              {modalLoading ? <div className="flex justify-center py-12"><Loader2 size={32} className="text-blue-600 animate-spin" /></div> : modalEmployees.length === 0 ? <div className="text-center py-12"><div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Users size={28} className="text-slate-300" /></div><p className="text-sm font-bold text-slate-500">No employees found</p></div> : (
                <>
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {modalCurrentEmployees.map(emp => (
                      <div key={emp._id} className="p-4 hover:bg-slate-50/60 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">{emp.name?.charAt(0) || '?'}</div>
                          <div><p className="font-bold text-slate-800">{emp.name}</p><p className="text-xs text-slate-500">{emp.email}</p><div className="flex items-center gap-2 mt-0.5">{emp.employeeCode && <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{emp.employeeCode}</span>}<span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${getStatusBadge(modalType)}`}>{modalType === 'present' ? 'Present' : modalType === 'absent' ? 'Absent' : modalType === 'late' ? 'Late' : modalType === 'onLeave' ? 'On Leave' : ''}</span></div></div>
                        </div>
                        <button onClick={() => { setShowEmployeeListModal(false); navigate(`/hr/employee-attendance`, { state: { userId: emp._id } }); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all">View Details</button>
                      </div>
                    ))}
                  </div>
                  {modalTotalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">Page {modalCurrentPage} of {modalTotalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setModalCurrentPage(p => Math.max(1, p - 1))} disabled={modalCurrentPage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all"><ChevronLeft size={14} /></button>
                        <button onClick={() => setModalCurrentPage(p => Math.min(modalTotalPages, p + 1))} disabled={modalCurrentPage === modalTotalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Probation Modal */}
      {showProbationModal && selectedProbationEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center"><div><h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><UserCog size={20} className="text-blue-600" /> Manage Probation</h2><p className="text-xs text-slate-500">{selectedProbationEmployee.name} • {selectedProbationEmployee.employeeCode || 'No code'}</p></div><button onClick={() => { setShowProbationModal(false); setSelectedProbationEmployee(null); }} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X size={16} /></button></div>
            <form onSubmit={handleProbationUpdate} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-2 mb-2"><Info size={16} className="text-blue-600" /><p className="text-[10px] font-bold text-slate-700">Current Status</p></div><div className="flex items-center gap-2">{selectedProbationEmployee.isProbationary ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><Clock size={12} /> On Probation</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle size={12} /> Completed</span>}{selectedProbationEmployee.isProbationary && selectedProbationEmployee.probationEndDate && <span className="text-[9px] text-slate-500">Ends: {formatDate(selectedProbationEmployee.probationEndDate)}</span>}</div>{selectedProbationEmployee.dateOfJoining && <p className="text-[9px] text-slate-400 mt-2">Joined: {formatDate(selectedProbationEmployee.dateOfJoining)}</p>}</div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200"><input type="checkbox" id="isProbationary" checked={probationForm.isProbationary} onChange={(e) => { const checked = e.target.checked; setProbationForm(prev => ({ ...prev, isProbationary: checked, probationEndDate: checked ? calculateProbationEndDate(selectedProbationEmployee.dateOfJoining, prev.probationMonths) : '' })); }} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><label htmlFor="isProbationary" className="text-sm font-semibold text-slate-700 cursor-pointer">Employee is on probation</label></div>
              {probationForm.isProbationary && (
                <div><label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Probation End Date *</label><input type="date" required value={probationForm.probationEndDate} onChange={(e) => setProbationForm({ ...probationForm, probationEndDate: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400 transition-all" /><div className="flex gap-2 mt-2"><button type="button" onClick={() => { const date = calculateProbationEndDate(selectedProbationEmployee.dateOfJoining, 3); setProbationForm(prev => ({ ...prev, probationEndDate: date, probationMonths: 3 })); }} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all">3 Months</button><button type="button" onClick={() => { const date = calculateProbationEndDate(selectedProbationEmployee.dateOfJoining, 6); setProbationForm(prev => ({ ...prev, probationEndDate: date, probationMonths: 6 })); }} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all">6 Months</button></div><p className="text-[8px] text-slate-400 mt-1">Based on joining date: {selectedProbationEmployee.dateOfJoining ? formatDate(selectedProbationEmployee.dateOfJoining) : 'Not set'}</p></div>
              )}
              {!probationForm.isProbationary && <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200"><p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1.5"><CheckCircle size={14} /> Probation will be marked as completed</p></div>}
              <button type="submit" disabled={submittingProbation} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">{submittingProbation ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> Update Probation Status</>}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Paid Leave Modal */}
      {showEditLeaveModal && selectedEditEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[350] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div><h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Pencil size={20} className="text-blue-600" /> Edit Paid Leave Balance</h2><p className="text-xs text-slate-500">{selectedEditEmployee.employee.name} • {selectedEditEmployee.employee.employeeCode || 'No code'}</p></div>
              <button onClick={() => { setShowEditLeaveModal(false); setSelectedEditEmployee(null); setEditLeaveBalance(0); setEditLeaveReason(''); }} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleEditLeaveSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-2 mb-2"><Info size={16} className="text-blue-600" /><p className="text-[10px] font-bold text-slate-700">Current Balance</p></div><div className="flex items-center gap-2"><span className="text-2xl font-black text-blue-600">{getPaidLeaveBalance(selectedEditEmployee)}</span><span className="text-sm text-slate-500">days</span></div>
                {selectedEditEmployee.employee.isProbationary && (
                  <p className="text-[9px] text-amber-600 font-bold mt-2 flex items-center gap-1"><AlertCircle size={11} /> On probation — can only use Unpaid Leave, but the Paid Leave balance still accrues/can be adjusted.</p>
                )}
              </div>
              <div><label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">New Balance (days) *</label><div className="relative"><input type="number" step="0.5" min="0" required value={editLeaveBalance} onChange={(e) => setEditLeaveBalance(parseFloat(e.target.value) || 0)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-bold text-sm text-slate-700 focus:border-blue-400 transition-all" /><div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1"><button type="button" onClick={() => setEditLeaveBalance(Math.max(0, editLeaveBalance - 0.5))} className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"><Minus size={12} /></button><button type="button" onClick={() => setEditLeaveBalance(editLeaveBalance + 0.5)} className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"><Plus size={12} /></button></div></div><p className="text-[7px] text-slate-400 mt-1">Half-day increments (0.5 days). Set below current balance to penalize, above to reward.</p></div>
              <div><label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">Reason for Change *</label><textarea required rows={2} placeholder="e.g., Reward for extra hours worked, Penalty for unapproved absence, Carry forward balance, etc." value={editLeaveReason} onChange={(e) => setEditLeaveReason(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm text-slate-700 focus:border-blue-400 transition-all resize-none" /></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowEditLeaveModal(false); setSelectedEditEmployee(null); setEditLeaveBalance(0); setEditLeaveReason(''); }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" disabled={editLeaveSubmitting} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{editLeaveSubmitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Balance</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;