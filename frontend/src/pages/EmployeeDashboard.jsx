// frontend/src/pages/EmployeeDashboard.jsx - WITH HOLIDAY TAB (FIXED)

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
  UserX,
  MapPin,
  Clock as ClockIcon,
  CalendarDays as HolidayIcon,
  Info,
  Globe
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

  // ============================================
  // HOLIDAY STATE
  // ============================================
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [selectedHolidayMonth, setSelectedHolidayMonth] = useState(new Date().getMonth() + 1);
  const [selectedHolidayYear, setSelectedHolidayYear] = useState(new Date().getFullYear());
  const [holidaySearchTerm, setHolidaySearchTerm] = useState('');
  const [holidayStats, setHolidayStats] = useState({
    total: 0,
    upcoming: 0,
    optional: 0
  });

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phoneNumber: '',
    department: '',
    designation: '',
    dateOfJoining: '',
    dateOfBirth: '',
    contactNumber: '',
    emergencyContact: '',
    address: '',
    shiftHour: 9,
    shiftMinute: 0,
    shiftAmPm: 'AM'
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

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

  // ============================================
  // FETCH HOLIDAYS - FIXED
  // ============================================
  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      // Fetch ALL holidays, filter client-side
      const res = await axios.get(
        `${API_BASE_URL}/api/holidays`,
        authHeader
      );
      
      if (res.data.success) {
        let holidayData = res.data.data || [];
        
        // Filter by month/year client-side
        holidayData = holidayData.filter(holiday => {
          const date = new Date(holiday.date);
          return date.getMonth() === (selectedHolidayMonth - 1) && 
                 date.getFullYear() === selectedHolidayYear;
        });
        
        // Sort by date
        holidayData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setHolidays(holidayData);
        calculateHolidayStats(holidayData);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  };

  const calculateHolidayStats = (holidayData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const total = holidayData.length;
    const optional = holidayData.filter(h => h.isOptional).length;
    const upcoming = holidayData.filter(h => new Date(h.date) >= today).length;
    
    setHolidayStats({ total, optional, upcoming });
  };

  // WebSocket Setup
  useEffect(() => {
    if (!token || !userId) return;

    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      setIsSocketConnected(true);
      socketRef.current.emit('join-attendance-room', userId);
      socketRef.current.emit('join-user-room', userId);
    });

    socketRef.current.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.log('⚠️ Socket connection error:', error.message);
      setIsSocketConnected(false);
    });

    socketRef.current.on('attendance_updated', (data) => {
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
      setLastSyncTime(new Date());
      if (data.updatedUsers && data.updatedUsers > 0) {
        toast.success(`Attendance sync complete! ${data.updatedUsers} users updated`, {
          icon: '✅',
          duration: 3000
        });
      }
    });

    socketRef.current.on('holiday_updated', (data) => {
      console.log('📅 Holiday updated:', data);
      if (activeTab === 'holidays') {
        fetchHolidays();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-attendance-room', userId);
        socketRef.current.disconnect();
      }
    };
  }, [token, userId]);

  // Fetch holidays when tab changes to holidays or month/year changes
  useEffect(() => {
    if (activeTab === 'holidays') {
      fetchHolidays();
    }
  }, [activeTab, selectedHolidayMonth, selectedHolidayYear]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [profileRes, attendanceRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/today`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/monthly-stats?month=${attendanceMonth + 1}&year=${attendanceYear}`, authHeader)
      ]);

      setProfile(profileRes.data.data);
      setTodayAttendance(attendanceRes.data.data);
      setMonthlyStats(statsRes.data.data);
      
      const profileData = profileRes.data.data;
      setProfileForm({
        name: profileData.name || '',
        phoneNumber: profileData.phoneNumber || '',
        department: profileData.department || '',
        designation: profileData.designation || '',
        dateOfJoining: profileData.dateOfJoining ? new Date(profileData.dateOfJoining).toISOString().split('T')[0] : '',
        dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] : '',
        contactNumber: profileData.contactNumber || '',
        emergencyContact: profileData.emergencyContact || '',
        address: profileData.address || '',
        shiftHour: profileData.shiftHour || 9,
        shiftMinute: profileData.shiftMinute || 0,
        shiftAmPm: profileData.shiftAmPm || 'AM'
      });
      
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

  // Save profile
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload = {
        name: profileForm.name,
        phoneNumber: profileForm.phoneNumber,
        department: profileForm.department,
        designation: profileForm.designation,
        dateOfJoining: profileForm.dateOfJoining || null,
        dateOfBirth: profileForm.dateOfBirth || null,
        contactNumber: profileForm.contactNumber,
        emergencyContact: profileForm.emergencyContact,
        address: profileForm.address,
        shiftHour: parseInt(profileForm.shiftHour) || 9,
        shiftMinute: parseInt(profileForm.shiftMinute) || 0,
        shiftAmPm: profileForm.shiftAmPm || 'AM'
      };

      await axios.put(`${API_BASE_URL}/api/employee/profile`, payload, authHeader);
      toast.success('Profile updated successfully!');
      setIsEditingProfile(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

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
    
    return { 
      isIn: false, 
      label: 'OUT', 
      icon: <UserX size={24} />, 
      color: 'bg-slate-100 text-slate-600',
      borderColor: 'border-slate-300',
      time: '—'
    };
  };

  const canEditEmployeeProfile = () => {
    return !['Super Admin', 'Admin', 'Client'].includes(userRole);
  };

  const getFormattedShiftTime = (hour, minute, ampm) => {
    const h = String(hour || 9).padStart(2, '0');
    const m = String(minute || 0).padStart(2, '0');
    const a = ampm || 'AM';
    return `${h}:${m} ${a}`;
  };

  // ============================================
  // HOLIDAY HELPERS
  // ============================================
  const getWeekdayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const isPastHoliday = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    return date < today;
  };

  const isTodayHoliday = (dateStr) => {
    const today = new Date();
    const date = new Date(dateStr);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const navigateHolidayMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedHolidayMonth === 1) {
        setSelectedHolidayMonth(12);
        setSelectedHolidayYear(selectedHolidayYear - 1);
      } else {
        setSelectedHolidayMonth(selectedHolidayMonth - 1);
      }
    } else {
      if (selectedHolidayMonth === 12) {
        setSelectedHolidayMonth(1);
        setSelectedHolidayYear(selectedHolidayYear + 1);
      } else {
        setSelectedHolidayMonth(selectedHolidayMonth + 1);
      }
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedHolidayMonth(now.getMonth() + 1);
    setSelectedHolidayYear(now.getFullYear());
  };

  const filteredHolidays = holidays.filter(holiday =>
    holiday.name.toLowerCase().includes(holidaySearchTerm.toLowerCase()) ||
    holiday.description?.toLowerCase().includes(holidaySearchTerm.toLowerCase())
  );

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
            <p className="text-slate-500 text-sm mt-0.5">Manage your attendance, leaves, holidays, and profile</p>
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

      {/* Tabs */}
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
          Attendance
          {!todayAttendance?.punchInTime && (
            <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">No Data</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'leave'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Calendar size={18} />
          Leave
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'holidays'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <HolidayIcon size={18} />
          Holidays
          {holidays.length > 0 && (
            <span className="text-[8px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full">
              {holidays.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <User size={18} />
          Profile
        </button>
      </div>

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <Attendance userId={userId} token={token} />
      )}

      {/* LEAVE TAB */}
      {activeTab === 'leave' && (
        <EmployeeLeave userId={userId} token={token} />
      )}

      {/* HOLIDAY TAB */}
      {activeTab === 'holidays' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <HolidayIcon size={20} className="text-purple-600" />
                Holidays
              </h3>
              <p className="text-xs text-slate-500">View public and optional holidays</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={goToCurrentMonth}
                className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100 transition-all"
              >
                Today
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateHolidayMonth('prev')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                >
                  <ChevronLeft size={18} className="text-slate-500" />
                </button>
                <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
                  {monthNames[selectedHolidayMonth - 1]} {selectedHolidayYear}
                </span>
                <button
                  onClick={() => navigateHolidayMonth('next')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                >
                  <ChevronRight size={18} className="text-slate-500" />
                </button>
              </div>
              
              <div className="relative w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search holidays..."
                  value={holidaySearchTerm}
                  onChange={(e) => setHolidaySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none text-sm focus:border-purple-400 bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Holiday Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
              <div className="flex items-center gap-2">
                <HolidayIcon size={14} className="text-purple-600" />
                <p className="text-[10px] font-bold text-purple-700 uppercase">Total Holidays</p>
              </div>
              <p className="text-2xl font-bold text-purple-800">{holidayStats.total}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-emerald-600" />
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Upcoming</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{holidayStats.upcoming}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-amber-600" />
                <p className="text-[10px] font-bold text-amber-700 uppercase">Optional</p>
              </div>
              <p className="text-2xl font-bold text-amber-800">{holidayStats.optional}</p>
            </div>
          </div>

          {/* Holiday List */}
          {holidaysLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="text-purple-600 animate-spin" />
            </div>
          ) : filteredHolidays.length === 0 ? (
            <div className="text-center py-12">
              <HolidayIcon size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No holidays found</p>
              <p className="text-xs text-slate-400 mt-1">
                {holidaySearchTerm 
                  ? 'Try adjusting your search' 
                  : `No holidays for ${monthNames[selectedHolidayMonth - 1]} ${selectedHolidayYear}`}
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                Try navigating to a different month using the arrows above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-gradient-to-r from-purple-50 to-white border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Day</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Holiday Name</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHolidays.map((holiday) => {
                    const isPast = isPastHoliday(holiday.date);
                    const isToday = isTodayHoliday(holiday.date);
                    const weekday = getWeekdayName(holiday.date);
                    const displayDate = formatDateDisplay(holiday.date);
                    
                    return (
                      <tr key={holiday._id} className={`hover:bg-slate-50/60 transition-all ${isToday ? 'bg-purple-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isToday ? 'text-purple-600' : isPast ? 'text-slate-400' : 'text-slate-800'}`}>
                              {displayDate}
                            </span>
                            {isToday && (
                              <span className="text-[8px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">Today</span>
                            )}
                            {isPast && (
                              <span className="text-[8px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Past</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-600">{weekday}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{holiday.name}</p>
                            {holiday.description && (
                              <p className="text-xs text-slate-400">{holiday.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${holiday.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {holiday.isOptional ? 'Optional' : 'Public'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Holiday Info Note */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-slate-400 mt-0.5" />
              <p className="text-[10px] text-slate-500">
                <span className="font-bold">Note:</span> Optional holidays are at the discretion of the employee. 
                Please coordinate with your manager before taking optional holidays.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
              <p className="text-xs text-slate-500">Update your profile details</p>
            </div>
            {canEditEmployeeProfile() && (
              !isEditingProfile ? (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      fetchDashboardData();
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              )
            )}
          </div>

          {!canEditEmployeeProfile() && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle size={14} />
                {userRole === 'Admin' ? 'Admin users cannot edit profile details.' : 
                 userRole === 'Super Admin' ? 'Super Admin users cannot edit profile details.' :
                 'Client users cannot edit profile details.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Phone size={12} className="inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={profileForm.phoneNumber}
                onChange={(e) => setProfileForm({...profileForm, phoneNumber: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                placeholder="e.g., +91 98765 43210"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Calendar size={12} className="inline mr-1" />
                Date of Joining
              </label>
              <input
                type="date"
                value={profileForm.dateOfJoining}
                onChange={(e) => setProfileForm({...profileForm, dateOfJoining: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Calendar size={12} className="inline mr-1" />
                Date of Birth
              </label>
              <input
                type="date"
                value={profileForm.dateOfBirth}
                onChange={(e) => setProfileForm({...profileForm, dateOfBirth: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <ClockIcon size={12} className="inline mr-1" />
                Shift Timing
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={profileForm.shiftHour}
                    onChange={(e) => setProfileForm({...profileForm, shiftHour: parseInt(e.target.value)})}
                    disabled={!isEditingProfile || !canEditEmployeeProfile()}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <p className="text-[6px] text-slate-400 text-center mt-0.5">Hour</p>
                </div>
                <div className="flex-1">
                  <select
                    value={profileForm.shiftMinute}
                    onChange={(e) => setProfileForm({...profileForm, shiftMinute: parseInt(e.target.value)})}
                    disabled={!isEditingProfile || !canEditEmployeeProfile()}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                  >
                    {[...Array(60)].map((_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <p className="text-[6px] text-slate-400 text-center mt-0.5">Minute</p>
                </div>
                <div className="flex-1">
                  <select
                    value={profileForm.shiftAmPm}
                    onChange={(e) => setProfileForm({...profileForm, shiftAmPm: e.target.value})}
                    disabled={!isEditingProfile || !canEditEmployeeProfile()}
                    className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <p className="text-[6px] text-slate-400 text-center mt-0.5">AM/PM</p>
                </div>
              </div>
              {!isEditingProfile && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Shift starts at: {getFormattedShiftTime(profileForm.shiftHour, profileForm.shiftMinute, profileForm.shiftAmPm)}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Phone size={12} className="inline mr-1" />
                Contact Number
              </label>
              <input
                type="tel"
                value={profileForm.contactNumber}
                onChange={(e) => setProfileForm({...profileForm, contactNumber: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                placeholder="Personal contact number"
              />
              <p className="text-[7px] text-slate-400 mt-0.5">Personal contact number</p>
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <AlertCircle size={12} className="inline mr-1" />
                Emergency Contact
              </label>
              <input
                type="tel"
                value={profileForm.emergencyContact}
                onChange={(e) => setProfileForm({...profileForm, emergencyContact: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all"
                placeholder="e.g., +91 98765 43210 (Name)"
              />
              <p className="text-[7px] text-slate-400 mt-0.5">Name and contact number of emergency contact person</p>
            </div>
            
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <MapPin size={12} className="inline mr-1" />
                Address
              </label>
              <textarea
                rows={2}
                value={profileForm.address}
                onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                disabled={!isEditingProfile || !canEditEmployeeProfile()}
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm disabled:opacity-60 focus:border-blue-400 transition-all resize-none"
                placeholder="Enter your full address"
              />
            </div>
          </div>

          {!isEditingProfile && profileForm.contactNumber && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] text-slate-500 flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-600" />
                Profile is up to date
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;