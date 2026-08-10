// frontend/src/pages/HrDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
  BarChart3,
  Fingerprint,
  X as XIcon
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HrDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
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

  // Employee list modal state
  const [showEmployeeListModal, setShowEmployeeListModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalEmployees, setModalEmployees] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const modalItemsPerPage = 10;

  // 🔥 NEW: Store present employees data for display on the card
  const [presentEmployees, setPresentEmployees] = useState([]);
  const [presentEmployeesLoaded, setPresentEmployeesLoaded] = useState(false);

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

  // frontend/src/pages/HrDashboard.jsx - Updated fetchData

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

    const statsData = statsRes.data.data;
    setStats({
      present: statsData.present || 0,
      absent: statsData.absent || 0,
      late: statsData.late || 0,
      onLeave: statsData.onLeave || 0,
      totalEmployees: statsData.totalEmployees || 0,
      pendingLeaves: statsData.pendingLeaves || 0,
      pendingCorrections: statsData.pendingCorrections || 0,
      attendanceRate: statsData.attendanceRate || 0
    });
    
    // 🔥 FIX: Set present employees directly from backend response
    setPresentEmployees(statsData.presentEmployees || []);
    setPresentEmployeesLoaded(true);
    
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

  // 🔥 NEW: Fetch only present employees for display
  const fetchPresentEmployees = async () => {
    try {
      setPresentEmployeesLoaded(false);
      const result = await fetchEmployeesByStatusInternal('present');
      setPresentEmployees(result || []);
      setPresentEmployeesLoaded(true);
    } catch (error) {
      console.error('Error fetching present employees:', error);
      setPresentEmployeesLoaded(true);
    }
  };

  // Internal function to fetch employees by status
  const fetchEmployeesByStatusInternal = async (status) => {
    try {
      // Get today's date in IST
      const now = new Date();
      const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const todayStr = istNow.toISOString().split('T')[0];
      
      // Get all employees (excluding Admin, HR, Client)
      const employeesRes = await axios.get(`${API_BASE_URL}/api/hr/employees`, authHeader);
      const employees = employeesRes.data.employees || [];
      
      if (employees.length === 0) {
        return [];
      }
      
      // Get approved leaves for today
      const leavesRes = await axios.get(`${API_BASE_URL}/api/hr/leave/all`, {
        ...authHeader,
        params: { status: 'approved' }
      }).catch(() => ({ data: { data: [] } }));
      const approvedLeaves = leavesRes.data.data || [];
      
      // Create a set of employee IDs on leave today
      const onLeaveIds = new Set();
      approvedLeaves.forEach(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr === todayStr) {
            onLeaveIds.add(leave.employeeId.toString());
            break;
          }
          current.setDate(current.getDate() + 1);
        }
      });
      
      // Process each employee
      const employeesWithStatus = await Promise.all(
        employees.map(async (emp) => {
          try {
            // Check if on leave first
            if (onLeaveIds.has(emp._id.toString())) {
              return { ...emp, status: 'leave' };
            }
            
            // Get punch logs for this employee (last 1 month)
            const res = await axios.get(
              `${API_BASE_URL}/api/hr/attendance/employee-timeline/${emp._id}?months=1`,
              authHeader
            );
            
            const days = res.data.data?.days || [];
            
            // Find today's record
            const todayRecord = days.find(d => {
              const dDate = d.date instanceof Date ? d.date.toISOString().split('T')[0] : d.date;
              return dDate === todayStr;
            });
            
            if (!todayRecord) {
              return { ...emp, status: 'absent' };
            }
            
            // Check if weekend
            if (todayRecord.isWeekend) {
              return { ...emp, status: 'weekend' };
            }
            
            // Get the status from the timeline
            let empStatus = todayRecord.status || '';
            
            // Map status to match HR Dashboard stats logic
            if (empStatus === 'on_time') {
              return { ...emp, status: 'present' };
            } else if (empStatus === 'late') {
              return { ...emp, status: 'late' };
            } else if (empStatus === 'leave') {
              return { ...emp, status: 'leave' };
            } else if (empStatus === 'absent') {
              return { ...emp, status: 'absent' };
            } else if (empStatus === 'partial') {
              if (todayRecord.isLate) {
                return { ...emp, status: 'late' };
              }
              return { ...emp, status: 'present' };
            }
            
            // Fallback: check punch times directly
            if (todayRecord.punchInUTC) {
              const punchDate = new Date(todayRecord.punchInUTC);
              const istPunchStr = punchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
              const istPunch = new Date(istPunchStr);
              const hours = istPunch.getHours();
              const minutes = istPunch.getMinutes();
              const isLate = hours > 10 || (hours === 10 && minutes > 45);
              
              if (isLate) {
                return { ...emp, status: 'late' };
              }
              return { ...emp, status: 'present' };
            }
            
            return { ...emp, status: 'absent' };
            
          } catch (err) {
            console.error(`Error fetching attendance for ${emp.name}:`, err.message);
            return { ...emp, status: 'absent' };
          }
        })
      );
      
      // Filter employees by the requested status
      if (status === 'present') {
        return employeesWithStatus.filter(e => e.status === 'present');
      } else if (status === 'absent') {
        return employeesWithStatus.filter(e => e.status === 'absent');
      } else if (status === 'late') {
        return employeesWithStatus.filter(e => e.status === 'late');
      } else if (status === 'onLeave') {
        return employeesWithStatus.filter(e => e.status === 'leave');
      }
      return [];
      
    } catch (error) {
      console.error('Error fetching employees by status:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      
      // 🔥 FIX: If this is the 'present' modal, also update the presentEmployees state
      if (type === 'present') {
        setPresentEmployees(employees || []);
        setPresentEmployeesLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employee list');
      setModalEmployees([]);
    } finally {
      setModalLoading(false);
    }
  };

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

  // Modal pagination
  const modalFilteredEmployees = modalEmployees.filter(emp =>
    emp.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
    emp.employeeCode?.toLowerCase().includes(modalSearchTerm.toLowerCase())
  );

  const modalTotalPages = Math.ceil(modalFilteredEmployees.length / modalItemsPerPage);
  const modalCurrentEmployees = modalFilteredEmployees.slice(
    (modalCurrentPage - 1) * modalItemsPerPage,
    modalCurrentPage * modalItemsPerPage
  );

  const getModalTitle = () => {
    switch(modalType) {
      case 'present': return 'Present Employees';
      case 'absent': return 'Absent Employees';
      case 'late': return 'Late Employees';
      case 'onLeave': return 'Employees on Leave';
      default: return 'Employees';
    }
  };

  const getModalColor = () => {
    switch(modalType) {
      case 'present': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'absent': return 'text-red-600 bg-red-50 border-red-200';
      case 'late': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'onLeave': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getStatusBadge = (type) => {
    switch(type) {
      case 'present': return 'bg-emerald-100 text-emerald-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-amber-100 text-amber-700';
      case 'onLeave': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

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

      {/* Stats Cards - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Employees - Navigate to Attendance Sync */}
        <div
          onClick={() => navigate('/hr/attendance-sync')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Employees</p>
              <p className="text-2xl font-black text-white">{stats.totalEmployees}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Click to view all employees
          </div>
        </div>

        {/* Present - Opens modal */}
        <div
          onClick={() => stats.present > 0 && openEmployeeListModal('present')}
          className={`bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm ${stats.present > 0 ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200' : 'opacity-70'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Present Today</p>
              <p className="text-2xl font-black text-white">{stats.present}</p>
              {/* 🔥 FIX: Show employee names on the card if available */}
              {presentEmployeesLoaded && presentEmployees.length > 0 && (
                <div className="mt-1 text-[10px] text-white/80 truncate max-w-[160px]">
                  {presentEmployees.slice(0, 3).map(e => e.name).join(', ')}
                  {presentEmployees.length > 3 && ` +${presentEmployees.length - 3} more`}
                </div>
              )}
              {presentEmployeesLoaded && presentEmployees.length === 0 && stats.present > 0 && (
                <div className="mt-1 text-[10px] text-white/60 italic">Loading names...</div>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <UserCheck size={18} className="text-white" />
            </div>
          </div>
          {stats.present > 0 && (
            <div className="mt-2 text-xs text-white/60">
              Click to view {stats.present} present employees
            </div>
          )}
          <div className="mt-1 text-xs text-white/60">
            {stats.attendanceRate}% attendance rate
          </div>
        </div>

        {/* Absent - Opens modal */}
        <div
          onClick={() => stats.absent > 0 && openEmployeeListModal('absent')}
          className={`bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 shadow-sm ${stats.absent > 0 ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200' : 'opacity-70'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Absent</p>
              <p className="text-2xl font-black text-white">{stats.absent}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <UserX size={18} className="text-white" />
            </div>
          </div>
          {stats.absent > 0 && (
            <div className="mt-2 text-xs text-white/60">
              Click to view absent employees
            </div>
          )}
        </div>

        {/* Late - Opens modal */}
        <div
          onClick={() => stats.late > 0 && openEmployeeListModal('late')}
          className={`bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm ${stats.late > 0 ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200' : 'opacity-70'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Late</p>
              <p className="text-2xl font-black text-white">{stats.late}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Clock size={18} className="text-white" />
            </div>
          </div>
          {stats.late > 0 && (
            <div className="mt-2 text-xs text-white/60">
              Click to view late employees
            </div>
          )}
        </div>

        {/* On Leave - Opens modal */}
        <div
          onClick={() => stats.onLeave > 0 && openEmployeeListModal('onLeave')}
          className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm ${stats.onLeave > 0 ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200' : 'opacity-70'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">On Leave</p>
              <p className="text-2xl font-black text-white">{stats.onLeave}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Calendar size={18} className="text-white" />
            </div>
          </div>
          {stats.onLeave > 0 && (
            <div className="mt-2 text-xs text-white/60">
              Click to view employees on leave
            </div>
          )}
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
                <div
                  onClick={() => navigate('/hr/attendance-sync')}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-all"
                >
                  <span className="text-sm font-medium text-slate-600">Total Employees</span>
                  <span className="text-lg font-black text-slate-800">{stats.totalEmployees}</span>
                </div>
                <div
                  onClick={() => stats.present > 0 && openEmployeeListModal('present')}
                  className={`flex justify-between items-center p-3 bg-emerald-50 rounded-lg ${stats.present > 0 ? 'cursor-pointer hover:bg-emerald-100 transition-all' : ''}`}
                >
                  <span className="text-sm font-medium text-emerald-700">Present (On time)</span>
                </div>
                <div
                  onClick={() => stats.absent > 0 && openEmployeeListModal('absent')}
                  className={`flex justify-between items-center p-3 bg-red-50 rounded-lg ${stats.absent > 0 ? 'cursor-pointer hover:bg-red-100 transition-all' : ''}`}
                >
                  <span className="text-sm font-medium text-red-700">Absent</span>
                  <span className="text-lg font-black text-red-700">{stats.absent}</span>
                </div>
                <div
                  onClick={() => stats.late > 0 && openEmployeeListModal('late')}
                  className={`flex justify-between items-center p-3 bg-amber-50 rounded-lg ${stats.late > 0 ? 'cursor-pointer hover:bg-amber-100 transition-all' : ''}`}
                >
                  <span className="text-sm font-medium text-amber-700">Present (Late)</span>
                </div>
                <div
                  onClick={() => stats.onLeave > 0 && openEmployeeListModal('onLeave')}
                  className={`flex justify-between items-center p-3 bg-purple-50 rounded-lg ${stats.onLeave > 0 ? 'cursor-pointer hover:bg-purple-100 transition-all' : ''}`}
                >
                  <span className="text-sm font-medium text-purple-700">On Leave</span>
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

                {/* Biometric Sync Button */}
                <button
                  onClick={() => navigate('/hr/attendance-sync')}
                  className="w-full p-4 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint size={18} className="text-indigo-600" />
                    <span className="font-bold text-indigo-700">Sync Biometric Attendance</span>
                  </div>
                  <span className="text-sm font-black text-indigo-600">📋</span>
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

      {/* Employee List Modal - Present/Absent/Late/On Leave */}
      {showEmployeeListModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${getModalColor()}`}>
                  {modalType === 'present' && <UserCheck size={20} />}
                  {modalType === 'absent' && <UserX size={20} />}
                  {modalType === 'late' && <Clock size={20} />}
                  {modalType === 'onLeave' && <Calendar size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{getModalTitle()}</h2>
                  <p className="text-xs text-slate-500">
                    {modalEmployees.length} employee{modalEmployees.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmployeeListModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-6">
              {/* Search */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or employee code..."
                  value={modalSearchTerm}
                  onChange={(e) => {
                    setModalSearchTerm(e.target.value);
                    setModalCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none text-sm focus:border-blue-400 bg-slate-50"
                />
              </div>

              {modalLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="text-blue-600 animate-spin" />
                </div>
              ) : modalEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Users size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No employees found</p>
                  <p className="text-xs text-slate-400 mt-1">No employees match this status</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {modalCurrentEmployees.map((emp) => (
                      <div key={emp._id} className="p-4 hover:bg-slate-50/60 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                            {emp.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {emp.employeeCode && (
                                <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                  {emp.employeeCode}
                                </span>
                              )}
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${getStatusBadge(modalType)}`}>
                                {modalType === 'present' ? 'Present' :
                                 modalType === 'absent' ? 'Absent' :
                                 modalType === 'late' ? 'Late' :
                                 modalType === 'onLeave' ? 'On Leave' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowEmployeeListModal(false);
                            // Navigate to employee attendance detail
                            navigate(`/hr/employee-attendance`, { state: { userId: emp._id } });
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all"
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {modalTotalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">
                        Page {modalCurrentPage} of {modalTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setModalCurrentPage(p => Math.max(1, p - 1))}
                          disabled={modalCurrentPage === 1}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          onClick={() => setModalCurrentPage(p => Math.min(modalTotalPages, p + 1))}
                          disabled={modalCurrentPage === modalTotalPages}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;