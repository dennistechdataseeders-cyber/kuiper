// frontend/src/pages/EmployeeDashboard.jsx - UPDATED WITH IN/OUT STATUS CARD

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import Attendance from '../components/Attendance';
import EmployeeLeave from '../components/EmployeeLeave';
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
  LayoutDashboard,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  Wifi,
  WifiOff,
  Target,
  TrendingDown,
  CalendarDays,
  CheckCheck,
  Hourglass,
  LogIn,
  LogOut,
  UserCheck,
  UserX
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

const EmployeeDashboard = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');

  // Socket ref
  const socketRef = useRef(null);

  // State
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // UTC Time formatters
  const formatTimeUTC = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  const formatDateUTC = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toISOString().split('T')[0];
  };

  // WebSocket Setup
  useEffect(() => {
    if (!token || !userId) return;

    console.log('🔌 Setting up WebSocket for attendance updates...');
    
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log('🟢 Socket connected for attendance');
      setIsSocketConnected(true);
      socketRef.current.emit('join-attendance-room', userId);
      socketRef.current.emit('join-user-room', userId);
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
      setIsSocketConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.log('⚠️ Socket connection error:', error.message);
      setIsSocketConnected(false);
    });

    socketRef.current.on('attendance_updated', (data) => {
      console.log('📊 Attendance updated for user:', data);
      if (data.employeeId === userId || data.userId === userId) {
        fetchDashboardData();
        toast.success(`Attendance updated for ${data.name || 'you'}`, { 
          icon: '🔄',
          duration: 3000
        });
        setLastSyncTime(new Date());
      }
    });

    socketRef.current.on('attendance_sync_complete', (data) => {
      console.log('✅ Attendance sync complete:', data);
      setLastSyncTime(new Date());
      if (data.updatedUsers && data.updatedUsers > 0) {
        toast.success(`Attendance sync complete! ${data.updatedUsers} users updated`, {
          icon: '✅',
          duration: 3000
        });
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-attendance-room', userId);
        socketRef.current.disconnect();
      }
    };
  }, [token, userId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [profileRes, attendanceRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/today`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/monthly-stats?month=${attendanceMonth + 1}&year=${attendanceYear}`, authHeader)
      ]);

      console.log('📊 Today Attendance:', attendanceRes.data);
      console.log('📊 Monthly Stats:', statsRes.data);

      setProfile(profileRes.data.data);
      setTodayAttendance(attendanceRes.data.data);
      setMonthlyStats(statsRes.data.data);
      
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [attendanceMonth, attendanceYear]);

  // Calculate attendance rate
  const getAttendanceRate = () => {
    if (!monthlyStats) return { rate: 0, color: 'text-slate-500' };
    const worked = monthlyStats.presentDays || 0;
    const total = monthlyStats.workingDays || 1;
    const rate = Math.round((worked / total) * 100);
    let color = 'text-slate-500';
    if (rate >= 90) color = 'text-emerald-600';
    else if (rate >= 70) color = 'text-amber-600';
    else color = 'text-rose-600';
    return { rate, color };
  };

  // Calculate leave stats from monthly data
  const getLeaveStats = () => {
    if (!monthlyStats) {
      return { used: 0, remaining: 0, pending: 0, approved: 0 };
    }
    return {
      used: monthlyStats.leaveDays || 0,
      remaining: 12 - (monthlyStats.leaveDays || 0),
      pending: 0,
      approved: monthlyStats.leaveDays || 0
    };
  };

  // Determine IN/OUT status
  const getInOutStatus = () => {
    if (!todayAttendance) {
      return { 
        isIn: false, 
        label: 'No Data', 
        icon: <Clock size={24} />, 
        color: 'bg-slate-200 text-slate-600',
        borderColor: 'border-slate-300',
        time: '—'
      };
    }
    
    // If on leave, show as Out
    if (todayAttendance.status === 'on_leave') {
      return { 
        isIn: false, 
        label: 'On Leave', 
        icon: <CalendarIcon size={24} />, 
        color: 'bg-indigo-100 text-indigo-700',
        borderColor: 'border-indigo-300',
        time: '—'
      };
    }
    
    // If punched in (has punchInTime but no punchOutTime)
    if (todayAttendance.punchInTime && !todayAttendance.punchOutTime) {
      return { 
        isIn: true, 
        label: 'IN', 
        icon: <LogIn size={24} />, 
        color: 'bg-emerald-100 text-emerald-700',
        borderColor: 'border-emerald-300',
        time: formatTimeUTC(todayAttendance.punchInTime)
      };
    }
    
    // If punched out (has both punchInTime and punchOutTime)
    if (todayAttendance.punchInTime && todayAttendance.punchOutTime) {
      return { 
        isIn: false, 
        label: 'OUT', 
        icon: <LogOut size={24} />, 
        color: 'bg-rose-100 text-rose-700',
        borderColor: 'border-rose-300',
        time: formatTimeUTC(todayAttendance.punchOutTime)
      };
    }
    
    // Default: Not punched in
    return { 
      isIn: false, 
      label: 'OUT', 
      icon: <UserX size={24} />, 
      color: 'bg-slate-100 text-slate-600',
      borderColor: 'border-slate-300',
      time: '—'
    };
  };

  const attendanceRate = getAttendanceRate();
  const leaveStats = getLeaveStats();
  const inOutStatus = getInOutStatus();

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
    <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your attendance and leaves</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
              <span className="text-[10px] font-semibold text-slate-500">
                {isSocketConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* IN/OUT Status Card - Primary */}
        <div className={`rounded-xl p-5 border-2 shadow-md transition-all hover:shadow-lg ${inOutStatus.color} ${inOutStatus.borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {inOutStatus.isIn ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                ) : null}
                <p className={`text-3xl font-bold ${inOutStatus.isIn ? 'text-emerald-700' : ''}`}>
                  {inOutStatus.label}
                </p>
              </div>
             
             
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm bg-white/30 ${inOutStatus.isIn ? 'bg-emerald-500/20' : 'bg-slate-500/20'}`}>
              {inOutStatus.icon}
            </div>
          </div>
         
          {!inOutStatus.isIn && inOutStatus.label !== 'No Data' && inOutStatus.label !== 'On Leave' && (
            <div className="mt-3 flex items-center gap-2">
              <LogOut size={14} className="text-rose-600" />
              <span className="text-xs font-medium text-rose-700">Not Punched In</span>
            </div>
          )}
          {inOutStatus.label === 'On Leave' && (
            <div className="mt-3 flex items-center gap-2">
              <CalendarIcon size={14} className="text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">On Approved Leave</span>
            </div>
          )}
        </div>

        {/* Today's Stats Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg shadow-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Today's</p>
              <p className="text-2xl font-bold mt-1">
                {todayAttendance?.punchInTime ? 'Active' : 'Not In'}
              </p>
              {todayAttendance?.punchInTime && (
                <div className="flex items-center gap-4 mt-1 text-sm opacity-90">
                  <span>In: {formatTimeUTC(todayAttendance.punchInTime)}</span>
                </div>
              )}
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Clock size={24} className="text-white" />
            </div>
          </div>
          {!todayAttendance?.punchInTime && (
            <p className="text-xs opacity-80 mt-2">No attendance recorded today</p>
          )}
        </div>

        {/* Attendance Rate Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Attendance Rate</p>
              <p className={`text-2xl font-bold mt-1 ${attendanceRate.color}`}>
                {attendanceRate.rate}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {monthlyStats?.presentDays || 0} / {monthlyStats?.workingDays || 0} days
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Target size={24} className="text-emerald-600" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceRate.rate >= 90 ? 'bg-emerald-500' :
                attendanceRate.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${attendanceRate.rate}%` }}
            />
          </div>
        </div>

        {/* Used Leaves Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Used Leaves</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{leaveStats.used}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-amber-600 font-medium">{leaveStats.pending} pending</span>
                <span className="w-px h-3 bg-slate-200" />
                <span className="text-xs text-emerald-600 font-medium">{leaveStats.approved} approved</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <CalendarDays size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Remaining Leaves Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Remaining Balance</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{leaveStats.remaining}</p>
              <p className="text-xs text-slate-500 mt-1">days available</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <CheckCheck size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Attendance | Leave */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 mb-6 flex gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Clock size={18} />
          Attendance Overview
          {!todayAttendance?.punchInTime && (
            <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">No Data</span>
          )}
        </button>
        {/* <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'leave'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Calendar size={18} />
          Leave Management
        </button> */}
      </div>

      {/* ATTENDANCE TAB - Uses Attendance component */}
      {activeTab === 'attendance' && (
        <Attendance 
          userId={userId} 
          token={token} 
        />
      )}

      {/* LEAVE TAB - Uses separate EmployeeLeave component */}
      {activeTab === 'leave' && (
        <EmployeeLeave 
          userId={userId} 
          token={token} 
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;