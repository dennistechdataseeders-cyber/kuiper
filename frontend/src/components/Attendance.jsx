// frontend/src/components/Attendance.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  UserCheck,
  UserX,
  ClockAlert,
  RefreshCw,
  Eye
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import AttendanceTimeline from './AttendanceTimeline';

const Attendance = ({ userId, token }) => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [activeTab, setActiveTab] = useState('monthly');
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const formatTimeShortUTC = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  // Get arrival status based on punch time
  const getArrivalStatus = (day) => {
    // Check both punchInUTC and punchIn
    const punchTime = day.punchInUTC || day.punchIn;
    if (!punchTime) return '—';
    try {
      const punchIn = new Date(punchTime);
      if (isNaN(punchIn.getTime())) return '—';
      const hour = punchIn.getUTCHours();
      const minute = punchIn.getUTCMinutes();
      if (hour < 10 || (hour === 10 && minute <= 45)) {
        return 'On Time';
      }
      const totalMinutes = hour * 60 + minute;
      const officeMinutes = 10 * 60 + 45;
      const diff = totalMinutes - officeMinutes;
      return `${diff}m late`;
    } catch (e) {
      return '—';
    }
  };

  // Get status based on punch time and day status
  const getDisplayStatus = (day) => {
    // If weekend or leave, use the original status
    if (day.status === 'weekend' || day.status === 'leave') {
      return day.status;
    }
    
    // Check both punchInUTC and punchIn
    const punchTime = day.punchInUTC || day.punchIn;
    
    // If no punch in, it's absent
    if (!punchTime) {
      return 'absent';
    }
    
    // Check if late based on punch time
    try {
      const punchIn = new Date(punchTime);
      if (isNaN(punchIn.getTime())) return day.status;
      const hour = punchIn.getUTCHours();
      const minute = punchIn.getUTCMinutes();
      // If after 10:45 AM, it's late
      if (hour > 10 || (hour === 10 && minute > 45)) {
        return 'late';
      }
      // Otherwise present
      return 'present';
    } catch (e) {
      return day.status;
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      present: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle,
        iconColor: 'text-emerald-500',
        label: 'Present'
      },
      late: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: ClockAlert,
        iconColor: 'text-amber-500',
        label: 'Late'
      },
      partial: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: Clock,
        iconColor: 'text-blue-500',
        label: 'Partial'
      },
      absent: {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
        iconColor: 'text-rose-500',
        label: 'Absent'
      },
      leave: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        icon: CalendarDays,
        iconColor: 'text-indigo-500',
        label: 'Leave'
      },
      weekend: {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-200',
        icon: CalendarIcon,
        iconColor: 'text-slate-400',
        label: 'Weekend'
      }
    };
    return configs[status] || configs.absent;
  };

  const isLate = (punchIn) => {
    if (!punchIn) return false;
    const d = new Date(punchIn);
    if (isNaN(d.getTime())) return false;
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    return hours > 10 || (hours === 10 && minutes > 45);
  };

  const getLateMinutes = (punchIn) => {
    if (!punchIn) return 0;
    const d = new Date(punchIn);
    if (isNaN(d.getTime())) return 0;
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;
    const officeMinutes = 10 * 60 + 45;
    const diff = totalMinutes - officeMinutes;
    return Math.max(0, diff);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/employee/attendance/today`, authHeader),
        axios.get(`${API_BASE_URL}/api/employee/attendance/monthly-stats?month=${attendanceMonth + 1}&year=${attendanceYear}`, authHeader)
      ]);

      setTodayAttendance(attendanceRes.data.data);
      setMonthlyStats(statsRes.data.data);
      
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [attendanceMonth, attendanceYear]);

  const syncAttendance = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(attendanceYear, attendanceMonth, 1).toISOString().split('T')[0];
      
      toast.loading('Syncing attendance data...', { id: 'sync' });
      
      const response = await axios.post(
        `${API_BASE_URL}/api/hr/attendance/sync`,
        { fromDate: monthStart, toDate: today },
        authHeader
      );
      
      toast.dismiss('sync');
      
      if (response.data.success) {
        const data = response.data.data;
        setSyncStatus({
          success: true,
          message: `Synced ${data?.processed || 0} records`
        });
        toast.success(`Attendance synced! ${data?.processed || 0} records processed`);
        setLastSyncTime(new Date());
        fetchData();
      } else {
        setSyncStatus({
          success: false,
          message: response.data.message || 'Sync failed'
        });
        toast.error('Sync failed');
      }
    } catch (error) {
      console.error('Error syncing attendance:', error);
      toast.dismiss('sync');
      toast.error(error.response?.data?.error || 'Failed to sync attendance');
      setSyncStatus({
        success: false,
        message: error.response?.data?.error || 'Failed to sync attendance'
      });
    } finally {
      setSyncing(false);
    }
  };

  const goToPreviousMonth = () => {
    if (attendanceMonth === 0) {
      setAttendanceMonth(11);
      setAttendanceYear(attendanceYear - 1);
    } else {
      setAttendanceMonth(attendanceMonth - 1);
    }
    setShowMonthSelector(false);
  };

  const goToNextMonth = () => {
    if (attendanceMonth === 11) {
      setAttendanceMonth(0);
      setAttendanceYear(attendanceYear + 1);
    } else {
      setAttendanceMonth(attendanceMonth + 1);
    }
    setShowMonthSelector(false);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setAttendanceMonth(now.getMonth());
    setAttendanceYear(now.getFullYear());
    setShowMonthSelector(false);
  };

  const handleMonthSelect = (monthIndex) => {
    setAttendanceMonth(monthIndex);
    setShowMonthSelector(false);
  };

  const handleYearSelect = (year) => {
    setAttendanceYear(year);
    setShowMonthSelector(false);
  };

  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // Calculate attendance rate
  const getAttendanceRate = () => {
    if (!monthlyStats) return { rate: 0, color: 'text-slate-500' };
    const worked = monthlyStats.presentDays || 0;
    const total = monthlyStats.workingDays || 1;
    const rate = Math.round((worked / total) * 100);
    let color = 'text-slate-500';
    let bgColor = 'bg-slate-200';
    if (rate >= 90) { color = 'text-emerald-600'; bgColor = 'bg-emerald-500'; }
    else if (rate >= 70) { color = 'text-amber-600'; bgColor = 'bg-amber-500'; }
    else { color = 'text-rose-600'; bgColor = 'bg-rose-500'; }
    return { rate, color, bgColor };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 size={36} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading attendance...</p>
        </div>
      </div>
    );
  }

  const displayDays = monthlyStats?.days || [];
  const attendanceRate = getAttendanceRate();

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Attendance Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Track your daily attendance and view monthly summary</p>
        </div>
        <div className="flex items-center gap-2">
          
          {lastSyncTime && (
            <span className="text-[10px] text-slate-400 font-medium">
              Last sync: {getLastSyncDisplay()}
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'monthly'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <CalendarIcon size={16} />
          Monthly View
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'timeline'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <BarChart3 size={16} />
          Timeline
        </button>
      </div>

      {activeTab === 'monthly' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Present</p>
                  <p className="text-2xl font-bold text-slate-800 mt-0.5">{monthlyStats?.presentDays || 0}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">
                    {attendanceRate.rate}% rate
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <UserCheck size={20} className="text-emerald-600" />
                </div>
              </div>
            </div>

       

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Absent</p>
                  <p className="text-2xl font-bold text-rose-600 mt-0.5">{monthlyStats?.absentDays || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {monthlyStats?.workingDays ? Math.round((monthlyStats.absentDays / monthlyStats.workingDays) * 100) : 0}% of days
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <UserX size={20} className="text-rose-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Leave</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-0.5">{monthlyStats?.leaveDays || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {monthlyStats?.workingDays ? Math.round((monthlyStats.leaveDays / monthlyStats.workingDays) * 100) : 0}% of days
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <CalendarDays size={20} className="text-indigo-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Month Selector & View Toggle */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} className="text-blue-600" />
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowMonthSelector(!showMonthSelector)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-semibold text-slate-700 shadow-sm"
                    >
                      <span>{monthNames[attendanceMonth]} {attendanceYear}</span>
                      {showMonthSelector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {showMonthSelector && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 min-w-[260px]">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                          <button
                            onClick={() => handleYearSelect(attendanceYear - 1)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                          >
                            <ChevronLeft size={14} className="text-slate-500" />
                          </button>
                          <select
                            value={attendanceYear}
                            onChange={(e) => handleYearSelect(Number(e.target.value))}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          >
                            {yearOptions.map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleYearSelect(attendanceYear + 1)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                          >
                            <ChevronRight size={14} className="text-slate-500" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          {monthNames.map((month, index) => (
                            <button
                              key={month}
                              onClick={() => handleMonthSelect(index)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                attendanceMonth === index
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              {shortMonthNames[index]}
                            </button>
                          ))}
                        </div>
                        
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <button
                            onClick={goToCurrentMonth}
                            className="w-full py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all"
                          >
                            Go to Current Month
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      <ChevronLeft size={14} className="text-slate-500" />
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      <ChevronRight size={14} className="text-slate-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                      viewMode === 'table'
                        ? 'bg-white text-slate-700 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white text-slate-700 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </div>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Day</th>
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Punch In</th>
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Punch Out</th>
                      <th className="px-4 py-3 text-left text-[9px] font-semibold uppercase text-slate-400 tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {displayDays.length > 0 ? (
                      [...displayDays]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((day, idx) => {
                          const displayStatus = getDisplayStatus(day);
                          const arrivalStatus = getArrivalStatus(day);
                          const statusConfig = getStatusConfig(displayStatus);
                          const StatusIcon = statusConfig.icon;
                          
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                              <td className="px-4 py-3 text-sm font-medium text-slate-700">
                                {day.date}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">
                                {day.dayName}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                                  <StatusIcon size={10} className={statusConfig.iconColor} />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                                {day.punchIn ? formatTimeShortUTC(day.punchIn) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                                {day.punchOut ? formatTimeShortUTC(day.punchOut) : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {arrivalStatus !== '—' && arrivalStatus !== 'On Time' && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                                    arrivalStatus.includes('late') 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {arrivalStatus.includes('late') ? (
                                      <ClockAlert size={10} className="text-amber-500" />
                                    ) : (
                                      <CheckCircle size={10} className="text-emerald-500" />
                                    )}
                                    {arrivalStatus}
                                  </span>
                                )}
                                {displayStatus === 'partial' && (
                                  <span className="text-[10px] text-blue-600 font-medium">Partial Day</span>
                                )}
                                {displayStatus === 'weekend' && (
                                  <span className="text-[10px] text-slate-400 font-medium">—</span>
                                )}
                                {displayStatus === 'absent' && (
                                  <span className="text-[10px] text-rose-600 font-medium">✕ No Punch</span>
                                )}
                                {displayStatus === 'present' && arrivalStatus === 'On Time' && (
                                  <span className="text-[10px] text-emerald-600 font-medium">✓ On Time</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                              <CalendarIcon size={32} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">No attendance data for this month</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="p-4">
                {displayDays.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[...displayDays]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((day, idx) => {
                        const displayStatus = getDisplayStatus(day);
                        const arrivalStatus = getArrivalStatus(day);
                        const statusConfig = getStatusConfig(displayStatus);
                        const StatusIcon = statusConfig.icon;
                        
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border ${statusConfig.border} ${statusConfig.bg} hover:shadow-md transition-all`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-700">{day.date}</p>
                                <p className="text-[10px] text-slate-500">{day.dayName}</p>
                              </div>
                              <StatusIcon size={16} className={statusConfig.iconColor} />
                            </div>
                            <div className="mt-2">
                              <span className={`text-[10px] font-semibold ${statusConfig.text}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                              {day.punchIn && <span>In: {formatTimeShortUTC(day.punchIn)}</span>}
                              {day.punchOut && <span>Out: {formatTimeShortUTC(day.punchOut)}</span>}
                              {!day.punchIn && !day.punchOut && displayStatus !== 'weekend' && (
                                <span className="text-rose-500 font-medium">No punch</span>
                              )}
                            </div>
                            {arrivalStatus !== '—' && arrivalStatus !== 'On Time' && (
                              <div className={`mt-1.5 text-[9px] font-semibold ${
                                arrivalStatus.includes('late') 
                                  ? 'text-amber-700 bg-amber-100/50' 
                                  : 'text-emerald-700 bg-emerald-100/50'
                              } px-2 py-0.5 rounded-full inline-block`}>
                                {arrivalStatus}
                              </div>
                            )}
                            {arrivalStatus === 'On Time' && displayStatus === 'present' && (
                              <div className="mt-1.5 text-[9px] font-semibold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-full inline-block">
                                On Time
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                        <CalendarIcon size={32} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No attendance data for this month</p>
                      <p className="text-xs text-slate-400">Click <strong className="text-blue-600">"Sync"</strong> to load your attendance records</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'timeline' && (
        <AttendanceTimeline 
          userId={userId} 
          token={token} 
          isCollapsed={isCollapsed}
        />
      )}
    </div>
  );
};

export default Attendance;