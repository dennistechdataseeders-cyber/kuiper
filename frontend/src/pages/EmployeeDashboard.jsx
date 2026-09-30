// frontend/src/pages/EmployeeDashboard.jsx - UPDATED WITH ON-LEAVE & EMPLOYEE SEARCH

import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import AttendanceCombined from '../components/AttendanceCombined';
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
  LayoutDashboard,
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
  Globe,
  Cake,
  UserPlus,
  Trophy,
  Sparkles,
  Search as SearchIcon,
} from 'lucide-react';

import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

// ============================================
// IST HELPERS (shared with shift-based late)
// ============================================
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const LATE_BUFFER_MINUTES = 15;

const formatTimeUTC = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  total = ((total % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${ampm}`;
};

const formatShift = (emp) => {
  const h = String(emp.shiftHour ?? 10).padStart(2, '0');
  const m = String(emp.shiftMinute ?? 30).padStart(2, '0');
  const ap = emp.shiftAmPm || 'AM';
  return `${h}:${m} ${ap}`;
};

const formatShortDate = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[d.getUTCMonth()]} ${day}`;
};

const formatShortDateWithYear = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[d.getUTCMonth()]} ${day}, ${d.getUTCFullYear()}`;
};

// ============================================

const EmployeeDashboard = () => {
  const { isCollapsed } = useSidebar();

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  const socketRef = useRef(null);

  // ============================================
  // STATE
  // ============================================
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);

  const [activeTab, setActiveTab] = useState('attendance');

  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());

  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Team & Culture
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [teamCulture, setTeamCulture] = useState({
    birthdays: [],
    newHires: [],
    anniversaries: []
  });
  const [teamCultureLoading, setTeamCultureLoading] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showYearlyHolidayModal, setShowYearlyHolidayModal] = useState(false);

  // ============================================
  // 🆕 ON LEAVE TODAY + EMPLOYEE SEARCH STATE
  // ============================================
  const [todayStatusList, setTodayStatusList] = useState([]);
  const [todayStatusLoading, setTodayStatusLoading] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  // ============================================
  // FETCH TODAY STATUS (all employees)
  // ============================================
  const fetchTodayStatus = async () => {
    setTodayStatusLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/hr/attendance/today-status`,
        authHeader
      );
      if (res.data.success) {
        setTodayStatusList(res.data.data || []);
      }
    } catch (err) {
      console.warn('Could not fetch today-status:', err.message);
      setTodayStatusList([]);
    } finally {
      setTodayStatusLoading(false);
    }
  };

  // ============================================
  // FETCH HOLIDAYS
  // ============================================
  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/holidays`, authHeader);
      if (res.data.success) {
        const holidayData = (res.data.data || [])
          .slice()
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setHolidays(holidayData);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  };

  // ============================================
  // FETCH TEAM & CULTURE
  // ============================================
  const fetchTeamCulture = async () => {
    setTeamCultureLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/employee/team-culture`, authHeader);
      if (res.data?.success && res.data.data) {
        setTeamCulture({
          birthdays: res.data.data?.birthdays || [],
          newHires: res.data.data?.newHires || [],
          anniversaries: res.data.data?.anniversaries || []
        });
      } else {
        calculateTeamCultureFromUsers();
      }
    } catch (error) {
      calculateTeamCultureFromUsers();
    } finally {
      setTeamCultureLoading(false);
    }
  };

  const calculateTeamCultureFromUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`, authHeader);
      const users = res.data || [];
      const today = new Date();
      const currentMonth = today.getUTCMonth();
      const currentYear = today.getUTCFullYear();
      const currentDate = today.getUTCDate();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      const birthdays = [];
      const anniversaries = [];
      const newHires = [];

      users.forEach((user) => {
        if (user.dateOfBirth) {
          const d = new Date(user.dateOfBirth);
          if (d.getUTCMonth() === currentMonth && d.getUTCDate() >= currentDate) {
            birthdays.push({
              _id: user._id, name: user.name, date: user.dateOfBirth,
              dateDisplay: formatShortDate(user.dateOfBirth), role: user.role
            });
          }
        }
        if (user.dateOfJoining) {
          const d = new Date(user.dateOfJoining);
          const years = currentYear - d.getUTCFullYear();
          if (d.getUTCMonth() === currentMonth && d.getUTCDate() >= currentDate && years >= 1) {
            anniversaries.push({
              _id: user._id, name: user.name, date: user.dateOfJoining,
              dateDisplay: formatShortDate(user.dateOfJoining), years, role: user.role
            });
          }
          if (d >= oneMonthAgo && d <= today) {
            newHires.push({
              _id: user._id, name: user.name, date: user.dateOfJoining,
              dateDisplay: formatShortDateWithYear(user.dateOfJoining),
              role: user.role, designation: user.designation || 'Team Member'
            });
          }
        }
      });

      birthdays.sort((a, b) => new Date(a.date).getUTCDate() - new Date(b.date).getUTCDate());
      anniversaries.sort((a, b) => new Date(a.date).getUTCDate() - new Date(b.date).getUTCDate());

      setTeamCulture({
        birthdays: birthdays.slice(0, 5),
        newHires: newHires.slice(0, 5),
        anniversaries: anniversaries.slice(0, 5)
      });
    } catch (error) {
      console.error('Error calculating team culture:', error);
      setTeamCulture({ birthdays: [], newHires: [], anniversaries: [] });
    }
  };

  // ============================================
  // SOCKET
  // ============================================
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
      socketRef.current.emit('join-attendance-room', userId);
      socketRef.current.emit('join-user-room', userId);
    });

    socketRef.current.on('attendance_updated', (data) => {
      if (data.employeeId === userId || data.userId === userId) {
        fetchDashboardData();
      }
      // Refresh today-status list on any attendance update
      fetchTodayStatus();
    });

    socketRef.current.on('attendance_sync_complete', () => {
      setLastSyncTime(new Date());
      fetchTodayStatus();
    });

    socketRef.current.on('holiday_updated', () => fetchHolidays());

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-attendance-room', userId);
        socketRef.current.disconnect();
      }
    };
  }, [token, userId]);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    fetchHolidays();
    fetchTeamCulture();
    fetchTodayStatus();

    // Auto-refresh today-status every 2 minutes
    const interval = setInterval(fetchTodayStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  // ============================================
  // FETCH DASHBOARD DATA
  // ============================================
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [profileRes, attendanceRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/today`, authHeader),
        axios.get(
          `${API_BASE_URL}/api/employee/attendance/monthly-stats?month=${attendanceMonth + 1}&year=${attendanceYear}`,
          authHeader
        )
      ]);
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

  // ============================================
  // HELPERS
  // ============================================
  const getInOutStatus = () => {
    if (!todayAttendance) {
      return { isIn: false, label: 'No Data', displayText: '—', color: 'from-slate-400 to-slate-500', time: '—' };
    }
    if (todayAttendance.status === 'on_leave') {
      return { isIn: false, label: 'On Leave', displayText: 'OUT', color: 'from-indigo-500 to-indigo-600', time: '—' };
    }
    if (todayAttendance.punchInTime && !todayAttendance.punchOutTime) {
      return { isIn: true, label: 'ACTIVE', displayText: 'IN', color: 'from-blue-600 to-blue-700', time: formatTimeUTC(todayAttendance.punchInTime) };
    }
    if (todayAttendance.punchInTime && todayAttendance.punchOutTime) {
      return { isIn: false, label: 'CHECKED OUT', displayText: 'OUT', color: 'from-rose-500 to-rose-600', time: formatTimeUTC(todayAttendance.punchOutTime) };
    }
    return { isIn: false, label: 'NOT IN', displayText: '—', color: 'from-slate-400 to-slate-500', time: '—' };
  };

  const inOutStatus = getInOutStatus();

  // ============================================
  // 🆕 DERIVED: on-leave-today list & search results
  // ============================================
  const onLeaveToday = useMemo(
    () => todayStatusList.filter((e) => e.status === 'leave'),
    [todayStatusList]
  );

  const searchResults = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return todayStatusList
      .filter((e) =>
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.role?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [todayStatusList, employeeSearchQuery]);

  // Status badge style resolver
  const getStatusPillStyle = (status) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'late':    return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'leave':   return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'absent':  return 'bg-rose-100 text-rose-700 border-rose-200';
      default:        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present': return 'Present';
      case 'late':    return 'Late';
      case 'leave':   return 'On Leave';
      case 'absent':  return 'Absent';
      default:        return 'Unknown';
    }
  };

  // ============================================
  // LOADING
  // ============================================
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

  // ============================================
  // MAIN UI
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* HEADER */}
      <div className="mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your attendance and leaves</p>
          </div>
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">

        {/* LEFT: MAIN CONTENT */}
        <div className="min-w-0">

          {/* TOP ROW: Status · Tabs */}
          <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch">

            <div className={`flex-1 rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br ${inOutStatus.color}`}>
              <div className="flex items-center justify-between h-full">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Status:</p>
                  <p className="text-xl font-bold mt-0.5">{inOutStatus.label}</p>
                </div>
                <div className="h-9 w-px bg-white/25 mx-2 hidden sm:block" />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Check In:</p>
                  <p className="text-xl font-bold mt-0.5">{inOutStatus.time}</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white border-4 border-blue-300 text-blue-600 font-black text-lg">
                  {inOutStatus.displayText}
                </div>
              </div>
            </div>

            <div className="md:w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-1 flex gap-1">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeTab === 'attendance'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Clock size={16} />
                Attendance
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeTab === 'leave'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Calendar size={16} />
                Leave
              </button>
            </div>
          </div>

          {/* TABS */}
          {activeTab === 'attendance' && <AttendanceCombined userId={userId} token={token} />}
          {activeTab === 'leave' && <EmployeeLeave userId={userId} token={token} />}
        </div>

        {/* RIGHT: TEAM & CULTURE + NEW FEATURES */}
        <div className="h-full min-h-0">
          <div className="space-y-3 xl:sticky xl:top-4">

            {/* =========================================
                🆕 EMPLOYEE STATUS SEARCH BAR
            ========================================= */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                  <SearchIcon size={12} className="text-blue-600" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-800">
                  Who's In / Out
                </h3>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder="Search employee by name…"
                  className="w-full pl-8 pr-7 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                />
                {employeeSearchQuery && (
                  <button
                    onClick={() => setEmployeeSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Search results */}
              {employeeSearchQuery.trim() && (
                <div className="mt-2 max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                  {searchResults.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-3">
                      No matching employee
                    </p>
                  ) : (
                    searchResults.map((emp) => {
                      const isIn = emp.isCurrentlyIn;
                      const showLeave = emp.status === 'leave';

                      return (
                        <div
                          key={emp._id}
                          className="p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {emp.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                                {emp.name}
                              </p>
                              <p className="text-[10px] text-slate-500 leading-tight truncate">
                                {emp.role} • Shift {formatShift(emp)}
                              </p>
                            </div>

                            {/* IN / OUT pill */}
                            {showLeave ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-100 text-indigo-700 border-indigo-200">
                                On Leave
                              </span>
                            ) : isIn ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                <LogIn size={10} /> IN
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-rose-100 text-rose-700 border-rose-200 flex items-center gap-1">
                                <LogOut size={10} /> OUT
                              </span>
                            )}
                          </div>

                          {/* Meta row: time + status chip */}
                          <div className="mt-1.5 pl-10 flex items-center gap-2 flex-wrap">
                            {!showLeave && (
                              <>
                                {emp.punchInUTC && (
                                  <span className="text-[9px] text-slate-500">
                                    In: {formatTimeUTC(emp.punchInUTC)}
                                  </span>
                                )}
                                {emp.punchOutUTC && (
                                  <span className="text-[9px] text-slate-500">
                                    Out: {formatTimeUTC(emp.punchOutUTC)}
                                  </span>
                                )}
                                {!emp.punchInUTC && (
                                  <span className="text-[9px] text-slate-400 italic">
                                    No punch today
                                  </span>
                                )}
                              </>
                            )}
                            {showLeave && emp.leaveType && (
                              <span className="text-[9px] text-indigo-600 font-semibold">
                                {emp.leaveType}
                                {emp.isHalfDay && emp.halfDayType
                                  ? ` (${emp.halfDayType === 'first' ? 'First Half' : 'Second Half'})`
                                  : ''}
                              </span>
                            )}
                            <span
                              className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${getStatusPillStyle(
                                emp.status
                              )}`}
                            >
                              {getStatusLabel(emp.status)}
                              {emp.status === 'late' && emp.lateMinutes
                                ? ` +${emp.lateMinutes}m`
                                : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!employeeSearchQuery.trim() && (
                <p className="text-[10px] text-slate-400 italic text-center mt-2">
                  Type a name to check IN/OUT status
                </p>
              )}
            </div>

            {/* =========================================
                🆕 ON LEAVE TODAY
            ========================================= */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={14} className="text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-black leading-tight">
                    On Leave Today
                  </p>
                  <p className="text-[10px] font-medium text-black/70 leading-tight mt-0.5">
                    Employees on approved leave
                  </p>
                </div>
                <span className="ml-auto text-[11px] font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                  {onLeaveToday.length}
                </span>
              </div>

              {todayStatusLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 size={14} className="text-indigo-500 animate-spin" />
                </div>
              ) : onLeaveToday.length === 0 ? (
                <p className="text-[11px] font-medium text-black/70 pl-8 py-1">
                  No one is on leave today
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {onLeaveToday.map((emp) => (
                    <li
                      key={emp._id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 flex-shrink-0">
                        {emp.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-black leading-tight truncate">
                          {emp.name}
                        </p>
                        <p className="text-[10px] font-medium text-slate-600 leading-tight mt-0.5 truncate">
                          {emp.leaveType || 'Leave'}
                          {emp.isHalfDay && emp.halfDayType
                            ? ` • ${emp.halfDayType === 'first' ? '1st Half' : '2nd Half'}`
                            : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* EXISTING: TEAM & CULTURE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-black">
                  Team &amp; Culture
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowYearlyHolidayModal(true)}
                    title="View yearly holiday list"
                    className="h-6 px-2 rounded-md bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center gap-1 flex-shrink-0 transition-colors"
                  >
                    <CalendarDays size={12} className="text-indigo-600" />
                    <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wide">
                      Holiday List
                    </span>
                  </button>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    title="View all activities"
                    className="w-6 h-6 rounded-md bg-blue-50 hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors"
                  >
                    <Calendar size={13} className="text-blue-600" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* Upcoming Holidays */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <HolidayIcon size={14} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-black leading-tight">Upcoming Holidays</p>
                      <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">
                        Next few holidays
                      </p>
                    </div>
                    <span className="ml-auto text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                      {holidays.filter(h => new Date(h.date) >= new Date()).length}
                    </span>
                  </div>

                  {holidaysLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={14} className="text-amber-500 animate-spin" />
                    </div>
                  ) : (
                    (() => {
                      const upcoming = holidays
                        .filter(h => {
                          const d = new Date(h.date);
                          const today = new Date();
                          const hd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                          const td = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                          return hd >= td;
                        })
                        .slice(0, 4);
                      if (upcoming.length === 0) {
                        return <p className="text-[11px] font-medium text-black/70 pl-8">No upcoming holidays</p>;
                      }
                      return (
                        <ul className="space-y-1.5 pl-8">
                          {upcoming.map((h) => (
                            <li key={h._id} className="flex items-center gap-1.5 text-[11px] text-black leading-tight flex-wrap">
                              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                              <span className="font-semibold">{formatShortDate(h.date)}:</span>
                              <span className="font-medium">{h.name}</span>
                              {h.isOptional && (
                                <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded ml-0.5 font-semibold">
                                  Optional
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      );
                    })()
                  )}
                </div>

                {/* Birthdays */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-7 h-7 rounded-md bg-pink-50 flex items-center justify-center flex-shrink-0">
                      <Cake size={14} className="text-pink-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-black leading-tight">Upcoming Birthdays</p>
                      <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">This month</p>
                    </div>
                  </div>

                  {teamCultureLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={14} className="text-pink-500 animate-spin" />
                    </div>
                  ) : teamCulture.birthdays.length === 0 ? (
                    <p className="text-[11px] font-medium text-black/70 pl-8">No birthdays this month</p>
                  ) : (
                    <ul className="space-y-1.5 pl-8">
                      {teamCulture.birthdays.slice(0, 4).map((b) => (
                        <li key={b._id} className="flex items-center gap-1.5 text-[11px] text-black leading-tight">
                          <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px] font-bold text-pink-700 flex-shrink-0">
                            {b.name?.charAt(0) || '?'}
                          </div>
                          <span>
                            <span className="font-semibold">{formatShortDate(b.date)}:</span>{' '}
                            <span className="font-medium">{b.name}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Anniversaries */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Trophy size={14} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-black leading-tight">Work Anniversaries</p>
                      <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">This month</p>
                    </div>
                  </div>

                  {teamCultureLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={14} className="text-amber-500 animate-spin" />
                    </div>
                  ) : teamCulture.anniversaries.length === 0 ? (
                    <p className="text-[11px] font-medium text-black/70 pl-8">No anniversaries this month</p>
                  ) : (
                    <ul className="space-y-1.5 pl-8">
                      {teamCulture.anniversaries.slice(0, 4).map((a) => (
                        <li key={a._id} className="flex items-center gap-1.5 text-[11px] text-black leading-tight">
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 flex-shrink-0">
                            {a.name?.charAt(0) || '?'}
                          </div>
                          <span>
                            <span className="font-semibold">{a.name}</span>
                            <span className="font-medium"> - {a.years} {a.years === 1 ? 'Year' : 'Years'}!</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          ALL ACTIVITIES MODAL (unchanged)
      ======================================== */}
      {showActivityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowActivityModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">All Activities</h3>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Holidays, birthdays &amp; anniversaries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowActivityModal(false)}
                className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center flex-shrink-0"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 flex-1">
              {/* combine everything */}
              {(() => {
                const all = [
                  ...holidays
                    .filter(h => new Date(h.date) >= new Date())
                    .map(h => ({ id: `h-${h._id}`, type: 'holiday', date: h.date, title: h.name, subtitle: h.isOptional ? 'Optional holiday' : 'Holiday' })),
                  ...teamCulture.birthdays.map(b => ({ id: `b-${b._id}`, type: 'birthday', date: b.date, title: b.name, subtitle: 'Birthday' })),
                  ...teamCulture.anniversaries.map(a => ({ id: `a-${a._id}`, type: 'anniversary', date: a.date, title: a.name, subtitle: `${a.years} ${a.years === 1 ? 'Year' : 'Years'} work anniversary` }))
                ].sort((a, b) => new Date(a.date) - new Date(b.date));

                if (all.length === 0) {
                  return <p className="text-xs text-slate-500 text-center py-6">No upcoming activities</p>;
                }

                const iconMap = {
                  holiday: { Icon: HolidayIcon, bg: 'bg-amber-50', text: 'text-amber-600' },
                  birthday: { Icon: Cake, bg: 'bg-pink-50', text: 'text-pink-600' },
                  anniversary: { Icon: Trophy, bg: 'bg-blue-50', text: 'text-blue-600' }
                };

                return (
                  <ul className="space-y-2">
                    {all.map(item => {
                      const s = iconMap[item.type];
                      const I = s.Icon;
                      return (
                        <li key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100">
                          <div className={`w-9 h-9 rounded-md ${s.bg} flex items-center justify-center flex-shrink-0`}>
                            <I size={16} className={s.text} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 leading-tight truncate">{item.title}</p>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.subtitle}</p>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 flex-shrink-0">
                            {formatShortDate(item.date)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          YEARLY HOLIDAY LIST MODAL (unchanged)
      ======================================== */}
      {showYearlyHolidayModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowYearlyHolidayModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <CalendarDays size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Yearly Holiday List — {new Date().getFullYear()}
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    All holidays for the current year
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowYearlyHolidayModal(false)}
                className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center flex-shrink-0"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 flex-1">
              {(() => {
                const yr = new Date().getFullYear();
                const list = holidays.filter(h => {
                  const d = new Date(h.date);
                  return !isNaN(d.getTime()) && d.getUTCFullYear() === yr;
                });
                if (list.length === 0) {
                  return <p className="text-xs text-slate-500 text-center py-6">No holidays found for {yr}</p>;
                }
                return (
                  <ul className="space-y-1.5">
                    {list.map(h => {
                      const d = new Date(h.date);
                      return (
                        <li key={h._id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
                          <div className="w-14 flex-shrink-0 text-center">
                            <p className="text-[9px] font-bold uppercase text-indigo-600">
                              {monthNames[d.getUTCMonth()].substring(0, 3)}
                            </p>
                            <p className="text-lg font-black text-slate-800 leading-none">
                              {d.getUTCDate()}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-slate-800 leading-tight">{h.name}</p>
                              {h.isOptional && (
                                <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                  Optional
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <p className="text-[10px] text-slate-500 leading-tight mt-1">{h.description}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;