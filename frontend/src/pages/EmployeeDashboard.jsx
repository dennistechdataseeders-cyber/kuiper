// frontend/src/pages/EmployeeDashboard.jsx - UPDATED
// ✅ Effective/Gross time formatted like timeline (Xh Ym)
// ✅ Wider Team & Culture panel with larger, high-contrast text
// ✅ Time handling now uses UTC components everywhere for consistency
//    across local (Windows) and VPS (Ubuntu) environments
// ✅ Keka-style top row: Paid Leave (left) + Status (center) + Tabs (right), one row
// ✅ Attendance Rate card removed, "Remaining Leaves" renamed to "Paid Leave"
// ✅ ADDED: Yearly Holiday List button and modal

import React, { useState, useEffect, useRef } from 'react';
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
  Globe,
  Cake,
  UserPlus,
  Trophy,
  Sparkles
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

  // ============================================
  // STATE
  // ============================================

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);

  const [activeTab, setActiveTab] = useState('attendance');

  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().getMonth()
  );

  const [attendanceYear, setAttendanceYear] = useState(
    new Date().getFullYear()
  );

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ============================================
  // TEAM & CULTURE SIDEBAR STATE
  // ============================================

  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const [teamCulture, setTeamCulture] = useState({
    birthdays: [],
    newHires: [],
    anniversaries: []
  });

  const [teamCultureLoading, setTeamCultureLoading] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // ============================================
  // NEW: YEARLY HOLIDAY LIST MODAL STATE
  // ============================================
  const [showYearlyHolidayModal, setShowYearlyHolidayModal] = useState(false);

  // ============================================
  // AUTH HEADER
  // ============================================

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  // ============================================
  // MONTH NAMES
  // ============================================

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  // ============================================
  // ✅ NEW: HOURS → "Xh Ym" FORMATTER (same as timeline)
  // ============================================

  const formatHours = (hours, { unit = 'short', zero = '0h' } = {}) => {
    if (!hours || hours <= 0) return zero;
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (unit === 'hrmin') {
      if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
      if (hrs > 0) return `${hrs} hr 0 min`;
      return `0 hr ${mins} min`;
    }
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return unit === 'detailed' ? `${hrs}h 0m` : `${hrs}h`;
    return unit === 'detailed' ? `0h ${mins}m` : `${mins}m`;
  };

const IST_OFFSET_MINUTES = 5 * 60 + 30;

const formatTimeUTC = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  total = ((total % 1440) + 1440) % 1440;

  let hours24 = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${ampm}`;
};

  const formatDateUTC = (date) => {
    if (!date) return 'N/A';

    const d = new Date(date);

    if (isNaN(d.getTime())) return 'N/A';

    return d.toISOString().split('T')[0];
  };

  // ============================================
  // DATE FORMATTERS
  // ============================================
  // Use UTC components so calendar labels do not shift across
  // timezones when a date is stored at midnight UTC.

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return '';

    const day = d.getUTCDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getUTCMonth()];
    return `${month} ${day}`;
  };

  const formatShortDateWithYear = (dateStr) => {
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return '';

    const day = d.getUTCDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${month} ${day}, ${year}`;
  };

  // ============================================
  // FETCH HOLIDAYS
  // ============================================

  const fetchHolidays = async () => {
    setHolidaysLoading(true);

    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/holidays`,
        authHeader
      );

      if (res.data.success) {
        const holidayData = (res.data.data || [])
          .slice()
          .sort(
            (a, b) =>
              new Date(a.date) - new Date(b.date)
          );

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
  // UPCOMING HOLIDAYS - ALL HOLIDAYS FROM TODAY ONWARD
  // ============================================
  // Compare using UTC calendar day so "today" is stable across
  // servers with different timezones.

  const upcomingHolidays = holidays
    .filter((h) => {
      const d = new Date(h.date);
      const holidayDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const today = new Date();
      const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      return holidayDate >= todayDate;
    });

  // ============================================
  // ✅ NEW: ALL HOLIDAYS FOR THE CURRENT YEAR
  // ============================================
  const currentYear = new Date().getFullYear();

  const holidaysForCurrentYear = holidays.filter((h) => {
    const d = new Date(h.date);
    return !isNaN(d.getTime()) && d.getUTCFullYear() === currentYear;
  });

  // ============================================
  // ALL ACTIVITIES (for the calendar modal)
  // Holidays + Upcoming Birthdays + Work Anniversaries,
  // merged and sorted chronologically.
  // ============================================

  const allActivities = [
    ...upcomingHolidays.map((h) => ({
      id: `holiday-${h._id}`,
      type: 'holiday',
      date: h.date,
      title: h.name,
      subtitle: h.isOptional ? 'Optional holiday' : 'Holiday'
    })),
    ...teamCulture.birthdays.map((b) => ({
      id: `birthday-${b._id}`,
      type: 'birthday',
      date: b.date,
      title: b.name,
      subtitle: 'Birthday'
    })),
    ...teamCulture.anniversaries.map((a) => ({
      id: `anniversary-${a._id}`,
      type: 'anniversary',
      date: a.date,
      title: a.name,
      subtitle: `${a.years} ${a.years === 1 ? 'Year' : 'Years'} work anniversary`
    }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // ============================================
  // FETCH TEAM & CULTURE DATA
  // ============================================

  const fetchTeamCulture = async () => {
    setTeamCultureLoading(true);

    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/employee/team-culture`,
        authHeader
      );

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
      console.log(
        'Team culture API not available, calculating from user data...'
      );

      calculateTeamCultureFromUsers();
    } finally {
      setTeamCultureLoading(false);
    }
  };

  // ============================================
  // CALCULATE TEAM CULTURE FROM USER DATA
  // ============================================
  // Uses UTC calendar components for consistency across servers.

  const calculateTeamCultureFromUsers = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/users`,
        authHeader
      );

      const users = res.data || [];

      const today = new Date();

      const currentMonth = today.getUTCMonth();
      const currentYear = today.getUTCFullYear();
      const currentDate = today.getUTCDate();

      const oneMonthAgo = new Date(today);

      oneMonthAgo.setUTCMonth(
        oneMonthAgo.getUTCMonth() - 1
      );

      const birthdays = [];
      const anniversaries = [];
      const newHires = [];

      users.forEach((user) => {
        if (!user.dateOfBirth && !user.dateOfJoining) {
          return;
        }

        // ==========================================
        // BIRTHDAYS
        // ==========================================

        if (user.dateOfBirth) {
          const birthDate = new Date(user.dateOfBirth);
          const birthMonth = birthDate.getUTCMonth();
          const birthDay = birthDate.getUTCDate();

          if (birthMonth === currentMonth) {
            if (birthDay >= currentDate) {
              birthdays.push({
                _id: user._id,
                name: user.name,
                date: user.dateOfBirth,
                dateDisplay: formatShortDate(user.dateOfBirth),
                role: user.role
              });
            }
          }
        }

        // ==========================================
        // WORK ANNIVERSARIES
        // ==========================================

        if (user.dateOfJoining) {
          const joinDate = new Date(user.dateOfJoining);
          const joinMonth = joinDate.getUTCMonth();
          const joinDay = joinDate.getUTCDate();
          const years = currentYear - joinDate.getUTCFullYear();

          if (
            joinMonth === currentMonth &&
            joinDay >= currentDate &&
            years >= 1
          ) {
            anniversaries.push({
              _id: user._id,
              name: user.name,
              date: user.dateOfJoining,
              dateDisplay: formatShortDate(user.dateOfJoining),
              years,
              role: user.role
            });
          }
        }

        // ==========================================
        // NEW HIRES
        // ==========================================

        if (user.dateOfJoining) {
          const joinDate = new Date(user.dateOfJoining);

          if (
            joinDate >= oneMonthAgo &&
            joinDate <= today
          ) {
            newHires.push({
              _id: user._id,
              name: user.name,
              date: user.dateOfJoining,
              dateDisplay: formatShortDateWithYear(user.dateOfJoining),
              role: user.role,
              designation: user.designation || 'Team Member'
            });
          }
        }
      });

      // ==========================================
      // SORT DATA
      // ==========================================

      birthdays.sort((a, b) => {
        const aDay = new Date(a.date).getUTCDate();
        const bDay = new Date(b.date).getUTCDate();
        return aDay - bDay;
      });

      anniversaries.sort((a, b) => {
        const aDay = new Date(a.date).getUTCDate();
        const bDay = new Date(b.date).getUTCDate();
        return aDay - bDay;
      });

      newHires.sort(
        (a, b) =>
          new Date(a.date) - new Date(b.date)
      );

      setTeamCulture({
        birthdays: birthdays.slice(0, 5),
        newHires: newHires.slice(0, 5),
        anniversaries: anniversaries.slice(0, 5)
      });

      console.log(
        `📊 Team Culture Calculated: ${birthdays.length} birthdays, ${anniversaries.length} anniversaries, ${newHires.length} new hires`
      );
    } catch (error) {
      console.error(
        'Error calculating team culture:',
        error
      );

      setTeamCulture({
        birthdays: [],
        newHires: [],
        anniversaries: []
      });
    }
  };

  // ============================================
  // WEBSOCKET SETUP
  // ============================================

  useEffect(() => {
    if (!token || !userId) return;

    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: {
        token
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      setIsSocketConnected(true);

      socketRef.current.emit(
        'join-attendance-room',
        userId
      );

      socketRef.current.emit(
        'join-user-room',
        userId
      );
    });

    socketRef.current.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.log('⚠️ Socket connection error:', error.message);
      setIsSocketConnected(false);
    });

    socketRef.current.on('attendance_updated', (data) => {
      if (
        data.employeeId === userId ||
        data.userId === userId
      ) {
        fetchDashboardData();

        toast.success(
          `Attendance updated for ${data.name || 'you'}`,
          {
            icon: '🔄',
            duration: 3000
          }
        );

        setLastSyncTime(new Date());
      }
    });

    socketRef.current.on('attendance_sync_complete', (data) => {
      setLastSyncTime(new Date());

      if (
        data.updatedUsers &&
        data.updatedUsers > 0
      ) {
        toast.success(
          `Attendance sync complete! ${data.updatedUsers} users updated`,
          {
            icon: '✅',
            duration: 3000
          }
        );
      }
    });

    socketRef.current.on('holiday_updated', () => {
      fetchHolidays();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-attendance-room', userId);
        socketRef.current.disconnect();
      }
    };
  }, [token, userId]);

  // ============================================
  // SIDEBAR DATA LOAD
  // ============================================

  useEffect(() => {
    fetchHolidays();
    fetchTeamCulture();
  }, []);

  // ============================================
  // FETCH DASHBOARD DATA
  // ============================================

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [
        profileRes,
        attendanceRes,
        statsRes
      ] = await Promise.all([
        axios.get(
          `${API_BASE_URL}/api/employee/profile`,
          authHeader
        ),

        axios.get(
          `${API_BASE_URL}/api/employee/attendance/today`,
          authHeader
        ),

        axios.get(
          `${API_BASE_URL}/api/employee/attendance/monthly-stats?month=${
            attendanceMonth + 1
          }&year=${attendanceYear}`,
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

  // ============================================
  // MONTH CHANGE
  // ============================================

  useEffect(() => {
    fetchDashboardData();
  }, [attendanceMonth, attendanceYear]);

  // ============================================
  // ✅ LEAVE STATS - Now uses REAL leave balance from LeaveBucket
  // ============================================

  const getLeaveStats = () => {
    if (!monthlyStats) {
      return {
        used: 0,
        remaining: 0,
        pending: 0,
        approved: 0
      };
    }

    return {
      used: monthlyStats.leaveDays || 0,
      remaining: 12 - (monthlyStats.leaveDays || 0),
      pending: 0,
      approved: monthlyStats.leaveDays || 0
    };
  };

  // ============================================
  // IN / OUT STATUS
  // ============================================

  const getInOutStatus = () => {
    if (!todayAttendance) {
      return {
        isIn: false,
        label: 'No Data',
        displayText: '—',
        color: 'from-slate-400 to-slate-500',
        time: '—'
      };
    }

    if (todayAttendance.status === 'on_leave') {
      return {
        isIn: false,
        label: 'On Leave',
        displayText: 'OUT',
        color: 'from-indigo-500 to-indigo-600',
        time: '—'
      };
    }

    if (
      todayAttendance.punchInTime &&
      !todayAttendance.punchOutTime
    ) {
      return {
        isIn: true,
        label: 'ACTIVE',
        displayText: 'IN',
        color: 'from-blue-600 to-blue-700',
        time: formatTimeUTC(todayAttendance.punchInTime)
      };
    }

    if (
      todayAttendance.punchInTime &&
      todayAttendance.punchOutTime
    ) {
      return {
        isIn: false,
        label: 'CHECKED OUT',
        displayText: 'OUT',
        color: 'from-rose-500 to-rose-600',
        time: formatTimeUTC(todayAttendance.punchOutTime)
      };
    }

    return {
      isIn: false,
      label: 'NOT IN',
      displayText: '—',
      color: 'from-slate-400 to-slate-500',
      time: '—'
    };
  };

  const leaveStats = getLeaveStats();
  const inOutStatus = getInOutStatus();

  // ============================================
  // LOADING
  // ============================================

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-slate-50 flex items-center justify-center ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="text-center">
          <Loader2
            size={48}
            className="text-blue-600 animate-spin mx-auto mb-4"
          />

          <p className="text-slate-500 font-medium">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN UI
  // ============================================

  return (
    <div
      className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Dashboard
            </h1>

            <p className="text-slate-500 text-sm mt-0.5">
              Manage your attendance and leaves
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MAIN 2-COLUMN LAYOUT
      ======================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_256px] gap-4 items-start">

        {/* ======================================
            LEFT: MAIN CONTENT
        ====================================== */}
        <div className="min-w-0">

          {/* ====================================
              TOP ROW: Status (left) · Tabs (right) — same row
          ==================================== */}
          <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch">

            {/* STATUS / CHECK-IN */}
            <div
              className={`flex-1 rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br ${inOutStatus.color}`}
            >
              <div className="flex items-center justify-between h-full">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                    Status:
                  </p>

                  <p className="text-xl font-bold mt-0.5">
                    {inOutStatus.label}
                  </p>
                </div>

                <div className="h-9 w-px bg-white/25 mx-2 hidden sm:block" />

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                    Check In:
                  </p>

                  <p className="text-xl font-bold mt-0.5">
                    {inOutStatus.time}
                  </p>
                </div>

                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white border-4 border-blue-300 text-blue-600 font-black text-lg">
                  {inOutStatus.displayText}
                </div>
              </div>
            </div>

            {/* ATTENDANCE / LEAVE TOGGLE — now same row as Status */}
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
                {!todayAttendance?.punchInTime && (
                  <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                    No Data
                  </span>
                )}
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

          {/* ====================================
              ATTENDANCE TAB
          ==================================== */}
          {activeTab === 'attendance' && (
            <AttendanceCombined
              userId={userId}
              token={token}
            />
          )}

          {/* ====================================
              LEAVE TAB
          ==================================== */}
          {activeTab === 'leave' && (
            <EmployeeLeave
              userId={userId}
              token={token}
            />
          )}
        </div>
{/* ======================================
    RIGHT: TEAM & CULTURE UPDATES
====================================== */}
<div className="h-full min-h-0">
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 xl:sticky xl:top-4">
    {/* MAIN HEADING */}
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

    {/* INNER CARDS */}
    <div className="space-y-2.5">

      {/* =================================
          UPCOMING HOLIDAYS
      ================================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
            <HolidayIcon size={14} className="text-amber-600" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-black leading-tight">
              Upcoming Holidays
            </p>
            <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">
              All upcoming holidays this year
            </p>
          </div>

          <span className="ml-auto text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
            {upcomingHolidays.length}
          </span>
        </div>

        {holidaysLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="text-amber-500 animate-spin" />
          </div>
        ) : upcomingHolidays.length === 0 ? (
          <p className="text-[11px] font-medium text-black/70 pl-8">
            No upcoming holidays for the rest of the year
          </p>
        ) : (
          <ul className="space-y-1.5 pl-8 max-h-[220px] overflow-y-auto pr-1">
            {upcomingHolidays.map((h) => {
              const today = new Date();
              const holidayDate = new Date(h.date);
              const daysUntil = Math.ceil(
                (holidayDate - today) / (1000 * 60 * 60 * 24)
              );

              let dayLabel = '';
              if (daysUntil === 0) dayLabel = 'Today';
              else if (daysUntil === 1) dayLabel = 'Tomorrow';
              else if (daysUntil <= 7) dayLabel = `${daysUntil} days`;

              return (
                <li
                  key={h._id}
                  className="flex items-center gap-1.5 text-[11px] text-black leading-tight flex-wrap"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />

                  <span className="font-semibold">
                    {formatShortDate(h.date)}:
                  </span>

                  <span className="font-medium">{h.name}</span>

                  {h.isOptional && (
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded ml-0.5 font-semibold">
                      Optional
                    </span>
                  )}

                  {dayLabel && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ml-0.5 ${
                        daysUntil === 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {dayLabel}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* =================================
          UPCOMING BIRTHDAYS
      ================================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-pink-50 flex items-center justify-center flex-shrink-0">
            <Cake size={14} className="text-pink-600" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-black leading-tight">
              Upcoming Birthdays
            </p>
            <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">
              Birthdays for this month
            </p>
          </div>
        </div>

        {teamCultureLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="text-pink-500 animate-spin" />
          </div>
        ) : teamCulture.birthdays.length === 0 ? (
          <p className="text-[11px] font-medium text-black/70 pl-8">
            No birthdays this month
          </p>
        ) : (
          <ul className="space-y-1.5 pl-8">
            {teamCulture.birthdays.map((b) => (
              <li
                key={b._id}
                className="flex items-center gap-1.5 text-[11px] text-black leading-tight"
              >
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px] font-bold text-pink-700 flex-shrink-0">
                  {b.name?.charAt(0) || '?'}
                </div>

                <span>
                  <span className="font-semibold">
                    {formatShortDate(b.date)}:
                  </span>{' '}
                  <span className="font-medium">{b.name}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* =================================
          NEW HIRES
      ================================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
            <UserPlus size={14} className="text-blue-600" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-black leading-tight">
              New Hires (Last 1 Month)
            </p>
            <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">
              Recent hires
            </p>
          </div>
        </div>

        {teamCultureLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="text-blue-500 animate-spin" />
          </div>
        ) : teamCulture.newHires.length === 0 ? (
          <p className="text-[11px] font-medium text-black/70 pl-8">
            No new hires recently
          </p>
        ) : (
          <ul className="space-y-1.5">
            {teamCulture.newHires.map((n) => (
              <li key={n._id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
                  {n.name?.charAt(0) || '?'}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] text-black leading-tight truncate">
                    <span className="font-semibold">{n.name}</span>
                    <span className="font-medium text-black/80">
                      {' '}- {n.designation || 'Team Member'}
                    </span>
                  </p>

                  <p className="text-[10px] font-medium text-black/70 leading-tight mt-0.5">
                    Joined: {n.dateDisplay}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* =================================
          WORK ANNIVERSARIES
      ================================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Trophy size={14} className="text-amber-600" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-black leading-tight">
              Work Anniversaries
            </p>
            <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">
              Celebrating major milestones
            </p>
          </div>
        </div>

        {teamCultureLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="text-amber-500 animate-spin" />
          </div>
        ) : teamCulture.anniversaries.length === 0 ? (
          <p className="text-[11px] font-medium text-black/70 pl-8">
            No anniversaries this month
          </p>
        ) : (
          <ul className="space-y-1.5">
            {teamCulture.anniversaries.map((a) => (
              <li key={a._id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 flex-shrink-0">
                  {a.name?.charAt(0) || '?'}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] text-black leading-tight">
                    <span className="font-semibold">{a.name}</span>
                    <span className="font-medium"> - {a.years}{' '}
                      {a.years === 1 ? 'Year' : 'Years'}!</span>
                  </p>

                  <p className="text-[10px] font-medium text-black/70 leading-tight mt-0.5">
                    Joined {formatShortDate(a.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  </div>
</div>
      </div>

      {/* ========================================
          ALL ACTIVITIES MODAL
          Holidays + Upcoming Birthdays + Work Anniversaries
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
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    All Activities
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Holidays, birthdays &amp; work anniversaries
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

            {/* MODAL BODY */}
            <div className="overflow-y-auto px-4 py-3 flex-1">
              {allActivities.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No upcoming activities right now
                </p>
              ) : (
                <ul className="space-y-2">
                  {allActivities.map((item) => {
                    const iconMap = {
                      holiday: {
                        Icon: HolidayIcon,
                        bg: 'bg-amber-50',
                        text: 'text-amber-600',
                        dot: 'bg-amber-500'
                      },
                      birthday: {
                        Icon: Cake,
                        bg: 'bg-pink-50',
                        text: 'text-pink-600',
                        dot: 'bg-pink-500'
                      },
                      anniversary: {
                        Icon: Trophy,
                        bg: 'bg-blue-50',
                        text: 'text-blue-600',
                        dot: 'bg-blue-500'
                      }
                    };

                    const style = iconMap[item.type];
                    const { Icon } = style;

                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg border border-slate-100"
                      >
                        <div
                          className={`w-9 h-9 rounded-md ${style.bg} flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon size={16} className={style.text} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 leading-tight truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>

                        <span className="text-[10px] font-semibold text-slate-600 flex-shrink-0">
                          {formatShortDate(item.date)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          NEW: YEARLY HOLIDAY LIST MODAL
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
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <CalendarDays size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Yearly Holiday List — {currentYear}
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    All holidays for the current year
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  {holidaysForCurrentYear.length} holidays
                </span>
                <button
                  onClick={() => setShowYearlyHolidayModal(false)}
                  className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center flex-shrink-0"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="overflow-y-auto px-4 py-3 flex-1">
              {holidaysLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="text-indigo-500 animate-spin" />
                </div>
              ) : holidaysForCurrentYear.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    No holidays found for {currentYear}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {holidaysForCurrentYear.map((holiday) => {
                    const today = new Date();
                    const holidayDate = new Date(holiday.date);

                    const isPast =
                      holidayDate <
                      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

                    const isToday =
                      holidayDate.toISOString().split('T')[0] ===
                      today.toISOString().split('T')[0];

                    return (
                      <li
                        key={holiday._id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                          isToday
                            ? 'border-amber-300 bg-amber-50'
                            : isPast
                            ? 'border-slate-100 bg-slate-50 opacity-60'
                            : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        {/* Date block */}
                        <div className="w-14 flex-shrink-0 text-center">
                          <p
                            className={`text-[9px] font-bold uppercase tracking-wide ${
                              isToday
                                ? 'text-amber-600'
                                : isPast
                                ? 'text-slate-400'
                                : 'text-indigo-600'
                            }`}
                          >
                            {monthNames[holidayDate.getUTCMonth()].substring(0, 3)}
                          </p>
                          <p
                            className={`text-lg font-black leading-none ${
                              isToday
                                ? 'text-amber-700'
                                : isPast
                                ? 'text-slate-400'
                                : 'text-slate-800'
                            }`}
                          >
                            {holidayDate.getUTCDate()}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
                              holidayDate.getUTCDay()
                            ]}
                          </p>
                        </div>

                        {/* Holiday details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 leading-tight">
                              {holiday.name}
                            </p>

                            {holiday.isOptional && (
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                Optional
                              </span>
                            )}

                            {isToday && (
                              <span className="text-[8px] font-bold text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded-full">
                                Today
                              </span>
                            )}
                          </div>

                          {holiday.description && (
                            <p className="text-[10px] text-slate-500 leading-tight mt-1">
                              {holiday.description}
                            </p>
                          )}
                        </div>

                        {/* Status indicator */}
                        <div className="flex-shrink-0">
                          {isPast ? (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Past
                            </span>
                          ) : isToday ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;