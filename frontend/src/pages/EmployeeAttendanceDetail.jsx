// frontend/src/pages/EmployeeAttendanceDetail.jsx - FIXED VERSION

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, 
  CheckCircle, XCircle, AlertCircle, Coffee,
  Loader2, Calendar as CalendarIcon, ChevronUp, 
  MousePointer2, ChevronDown, BarChart3,
  Users, UserCheck, UserX, Search, X
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Timeline track config
// ─────────────────────────────────────────────────────────────
const TRACK_START_HOUR = 6;
const TRACK_END_HOUR = 21;
const TRACK_TOTAL_MIN = (TRACK_END_HOUR - TRACK_START_HOUR) * 60;

const minutesOfDayUTC = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

const clampToTrack = (mins) => {
  const start = TRACK_START_HOUR * 60;
  const end = TRACK_END_HOUR * 60;
  return Math.min(end, Math.max(start, mins));
};

const STATUS_STYLES = {
  present: { 
    bar: 'from-emerald-400 to-emerald-500', 
    text: 'text-emerald-700', 
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  late: { 
    bar: 'from-amber-400 to-amber-500', 
    text: 'text-amber-700', 
    chip: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  absent: { 
    bar: 'from-rose-400 to-rose-500', 
    text: 'text-rose-700', 
    chip: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  leave: { 
    bar: 'from-indigo-400 to-indigo-500', 
    text: 'text-indigo-700', 
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  weekend: { 
    bar: 'from-slate-300 to-slate-400', 
    text: 'text-slate-500', 
    chip: 'bg-slate-50 text-slate-500 border-slate-200'
  },
  default: { 
    bar: 'from-blue-400 to-blue-500', 
    text: 'text-slate-600', 
    chip: 'bg-slate-50 text-slate-500 border-slate-200'
  }
};

const formatTimeDisplay = (dateString) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    let hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getDayShortName = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[date.getDay()];
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
};

const calculateHours = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  const inTime = new Date(punchIn);
  const outTime = new Date(punchOut);
  if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) return 0;
  const diffMs = outTime.getTime() - inTime.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
};

const formatDuration = (hours) => {
  if (!hours || hours <= 0) return '0h';
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
};

const formatBreakMinutes = (minutes) => {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins > 0) return `${hrs}h ${mins}m`;
  return `${hrs}h`;
};

const formatDurationDetailed = (hours) => {
  if (!hours || hours <= 0) return '0h 0m';
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h 0m`;
  return `0h ${mins}m`;
};

const getStatusIcon = (status) => {
  switch(status) {
    case 'present': return <CheckCircle size={14} className="text-emerald-600" />;
    case 'late': return <AlertCircle size={14} className="text-amber-600" />;
    case 'absent': return <XCircle size={14} className="text-rose-600" />;
    case 'leave': return <CalendarIcon size={14} className="text-indigo-600" />;
    case 'weekend': return <Coffee size={14} className="text-slate-400" />;
    default: return <Clock size={14} className="text-slate-400" />;
  }
};

const getStatusLabel = (status) => {
  switch(status) {
    case 'present': return 'Present';
    case 'late': return 'Late';
    case 'absent': return 'Absent';
    case 'leave': return 'On Leave';
    case 'weekend': return 'Weekend';
    default: return '—';
  }
};

const getArrivalStatus = (day) => {
  // Weekends don't have arrival status
  if (day.isWeekend) return '—';
  if (!day.punchInUTC) return '—';
  try {
    const punchIn = new Date(day.punchInUTC);
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

// ─────────────────────────────────────────────────────────────
// Day Timeline Bar Component - FIXED for weekends
// ─────────────────────────────────────────────────────────────
const DayTimelineBar = ({ day }) => {
  const styles = STATUS_STYLES[day.status] || STATUS_STYLES.default;
  const hasIn = day.punchInUTC || (day.sessions && day.sessions.length > 0);
  const trackStart = TRACK_START_HOUR * 60;
  
  // ✅ FIX: If it's a weekend, don't show the bar
  if (day.isWeekend) {
    return (
      <div className="flex items-center gap-2 h-5">
        <div className="flex-1 h-1 rounded-full bg-slate-100" />
        <span className="text-[8px] font-medium text-slate-300 whitespace-nowrap">Weekend</span>
      </div>
    );
  }
  
  const [localHoveredSession, setLocalHoveredSession] = useState(null);
  const [localHoveredBreak, setLocalHoveredBreak] = useState(null);
  const [localTooltipPosition, setLocalTooltipPosition] = useState({ x: 0, y: 0 });
  
  const handleBarMouseLeave = () => {
    setLocalHoveredSession(null);
    setLocalHoveredBreak(null);
  };
  
  const handleSessionHover = (e, session, sessionIndex, totalSessions) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipX = e.clientX - 120;
    const tooltipY = rect.top - 10;
    
    const duration = session.punchOutUTC 
      ? calculateHours(session.punchInUTC, session.punchOutUTC)
      : 0;
    
    setLocalHoveredSession({
      sessionIndex,
      totalSessions,
      punchIn: session.punchInUTC,
      punchOut: session.punchOutUTC || 'No Out Punch',
      duration: duration,
      durationFormatted: formatDurationDetailed(duration),
      isOpen: false
    });
    setLocalHoveredBreak(null);
    setLocalTooltipPosition({ x: tooltipX, y: tooltipY });
  };
  
  const handleBreakHover = (e, breakGap, breakIndex) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipX = e.clientX - 100;
    const tooltipY = rect.top - 10;
    
    setLocalHoveredBreak({
      breakIndex,
      start: breakGap.start,
      end: breakGap.end,
      minutes: breakGap.minutes,
      formattedDuration: formatBreakMinutes(breakGap.minutes)
    });
    setLocalHoveredSession(null);
    setLocalTooltipPosition({ x: tooltipX, y: tooltipY });
  };
  
  if (!hasIn) {
    return (
      <div className="flex items-center gap-2 h-5">
        <div className="flex-1 h-1 rounded-full bg-slate-100" />
        <span className="text-[8px] font-medium text-slate-300 whitespace-nowrap">No punch data</span>
      </div>
    );
  }
  
  const renderSegments = () => {
    if (!day.sessions || day.sessions.length === 0) {
      const startMin = clampToTrack(minutesOfDayUTC(day.punchInUTC));
      const endMin = clampToTrack(
        minutesOfDayUTC(day.punchOutUTC) || startMin + 5
      );
      const leftPct = ((startMin - trackStart) / TRACK_TOTAL_MIN) * 100;
      const widthPct = Math.max(1, ((endMin - startMin) / TRACK_TOTAL_MIN) * 100);
      
      return (
        <div 
          className={`absolute top-0 h-1 rounded-full bg-gradient-to-r ${styles.bar}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      );
    }
    
    const elements = [];
    let totalSegments = day.sessions.length;
    
    day.sessions.forEach((session, idx) => {
      if (!session.punchInUTC) return;
      
      const startMin = clampToTrack(minutesOfDayUTC(session.punchInUTC));
      const isLast = idx === totalSegments - 1;
      
      let endMin;
      if (session.punchOutUTC) {
        endMin = clampToTrack(minutesOfDayUTC(session.punchOutUTC));
      } else {
        endMin = clampToTrack(startMin + 2);
      }
      
      const leftPct = ((startMin - trackStart) / TRACK_TOTAL_MIN) * 100;
      const widthPct = Math.max(1, ((endMin - startMin) / TRACK_TOTAL_MIN) * 100);
      
      elements.push(
        <div
          key={`sess-${idx}`}
          className={`absolute top-0 h-1 rounded-full bg-gradient-to-r ${styles.bar} cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all duration-200`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onMouseEnter={(e) => handleSessionHover(e, session, idx, totalSegments)}
        />
      );
      
      if (idx === 0) {
        elements.push(
          <div key={`start-m-${idx}`} className="absolute -top-3 flex flex-col items-center z-10" style={{ left: `${leftPct}%`, transform: 'translateX(-2px)' }}>
            <span className="text-[7px] font-semibold text-slate-500 whitespace-nowrap">{formatTimeDisplay(session.punchInUTC)}</span>
          </div>
        );
      }
      
      if (isLast) {
        let label;
        if (!session.punchOutUTC) {
          label = '';
        } else {
          label = formatTimeDisplay(session.punchOutUTC);
        }
        
        elements.push(
          <div key={`end-m-${idx}`} className="absolute -top-3 flex flex-col items-center z-10" style={{ left: `${leftPct + widthPct}%`, transform: 'translateX(-90%)' }}>
            <span className={`text-[7px] font-semibold ${!session.punchOutUTC ? 'text-rose-500' : 'text-slate-500'} whitespace-nowrap`}>
              {label}
            </span>
          </div>
        );
      }
      
      // Break rendering
      if (!isLast && session.punchOutUTC && day.sessions[idx + 1] && day.sessions[idx + 1].punchInUTC) {
        const gapStart = clampToTrack(minutesOfDayUTC(session.punchOutUTC));
        const gapEnd = clampToTrack(minutesOfDayUTC(day.sessions[idx + 1].punchInUTC));
        const gapMinutes = (gapEnd - gapStart);
        
        if (gapMinutes >= 5) {
          const gLeft = ((gapStart - trackStart) / TRACK_TOTAL_MIN) * 100;
          const gWidth = Math.max(0, ((gapEnd - gapStart) / TRACK_TOTAL_MIN) * 100);
          
          const breakGap = day.breakGaps && day.breakGaps.find(b => 
            Math.abs(b.minutes - gapMinutes) < 0.1
          );
          
          elements.push(
            <div
              key={`break-${idx}`}
              className="absolute top-0 h-1 rounded-full bg-amber-200/60 cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all duration-200"
              style={{ 
                left: `${gLeft}%`, 
                width: `${gWidth}%`,
                minWidth: '4px'
              }}
              onMouseEnter={(e) => breakGap && handleBreakHover(e, breakGap, idx)}
            />
          );
        }
      }
    });
    
    return elements;
  };
  
  const LocalTooltip = () => {
    if (!localHoveredSession && !localHoveredBreak) return null;
    
    return (
      <div 
        className="fixed z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-3 min-w-[200px] pointer-events-none border border-white/10"
        style={{ 
          left: localTooltipPosition.x, 
          top: localTooltipPosition.y,
          transform: 'translateY(-100%)'
        }}
      >
        {localHoveredSession && (
          <>
            <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-[11px] font-bold">
                Session {localHoveredSession.sessionIndex + 1} of {localHoveredSession.totalSessions}
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">In:</span>
                <span className="font-mono font-medium">{formatTimeDisplay(localHoveredSession.punchIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Out:</span>
                <span className="font-mono font-medium text-rose-400">
                  {localHoveredSession.punchOut || 'No Out Punch'}
                </span>
              </div>
              <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
                <span className="text-slate-400">Duration:</span>
                <span className="font-bold text-emerald-400">{localHoveredSession.durationFormatted}</span>
              </div>
            </div>
          </>
        )}
        
        {localHoveredBreak && (
          <>
            <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/10">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span className="text-[11px] font-bold">Break {localHoveredBreak.breakIndex + 1}</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Started:</span>
                <span className="font-mono font-medium">{formatTimeDisplay(localHoveredBreak.start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ended:</span>
                <span className="font-mono font-medium">{formatTimeDisplay(localHoveredBreak.end)}</span>
              </div>
              <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
                <span className="text-slate-400">Duration:</span>
                <span className="font-bold text-amber-400">{localHoveredBreak.formattedDuration}</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };
  
  return (
    <div className="pt-2 pb-0.5 relative" onMouseLeave={handleBarMouseLeave}>
      <div className="relative h-1 rounded-full bg-slate-100">
        {renderSegments()}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] font-medium text-slate-500">
          Effective: <span className={styles.text}>{formatDuration(day.effectiveHours)}</span>
        </span>
        {day.grossHours > 0 && day.grossHours !== day.effectiveHours && (
          <span className="text-[8px] font-medium text-slate-400">
            Gross: {formatDuration(day.grossHours)}
          </span>
        )}
        {day.breakMinutes > 0 && (
          <span className="inline-flex items-center gap-1 text-[8px] font-medium text-slate-400">
            <Coffee size={10} className="text-amber-500" />
            {formatBreakMinutes(day.breakMinutes)}
          </span>
        )}
      </div>
      
      <LocalTooltip />
    </div>
  );
};

const EmployeeAttendanceDetail = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [stats, setStats] = useState({
    totalDays: 0,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    weekends: 0,
    totalEffectiveHours: 0,
    totalGrossHours: 0,
    averageEffectiveHours: 0,
    averageGrossHours: 0,
    latePercentage: 0,
    attendanceRate: 0
  });
  const [employeeInfo, setEmployeeInfo] = useState(null);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  // Fetch employees on load
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch attendance when employee or month changes
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeAttendance(selectedEmployee._id);
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/hr/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmployees(response.data.employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeAttendance = async (userId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/hr/attendance/employee-timeline/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { months: 3 }
        }
      );
      
      if (response.data.success) {
        const data = response.data.data;
        setEmployeeInfo(data.employee);
        
        // Process days with sessions
        const processedDays = (data.days || []).map(day => {
          let sessions = day.sessions || [];
          let effectiveHours = 0;
          let grossHours = 0;
          let breakMinutes = 0;
          let firstIn = null;
          let lastOut = null;
          let lastOutTime = null;
          let lastOutUTC = null;
          
          // Get the last session's punchOutUTC
          if (sessions.length > 0) {
            const lastSession = sessions[sessions.length - 1];
            if (lastSession.punchOutUTC) {
              lastOutUTC = lastSession.punchOutUTC;
              lastOutTime = new Date(lastSession.punchOutUTC);
            }
            
            // Also check if any other session has a later out time
            sessions.forEach((session) => {
              if (session.punchOutUTC) {
                const outTime = new Date(session.punchOutUTC);
                if (!lastOutTime || outTime > lastOutTime) {
                  lastOutTime = outTime;
                  lastOutUTC = session.punchOutUTC;
                }
              }
            });
          }
          
          sessions.forEach((session) => {
            if (session.punchInUTC) {
              const inTime = new Date(session.punchInUTC);
              if (!firstIn || inTime < firstIn) firstIn = inTime;
              
              if (session.punchOutUTC) {
                const outTime = new Date(session.punchOutUTC);
                const hours = calculateHours(session.punchInUTC, outTime.toISOString());
                effectiveHours += hours;
                if (!lastOut || outTime > lastOut) lastOut = outTime;
              }
            }
          });
          
          // If we have no lastOutUTC but we have sessions, try to get it from the last session
          if (!lastOutUTC && sessions.length > 0) {
            const lastSession = sessions[sessions.length - 1];
            if (lastSession.punchOutUTC) {
              lastOutUTC = lastSession.punchOutUTC;
              lastOutTime = new Date(lastSession.punchOutUTC);
            }
          }
          
          if (firstIn && lastOut) {
            grossHours = (lastOut - firstIn) / (1000 * 60 * 60);
          } else if (sessions.length === 1 && sessions[0].punchInUTC) {
            grossHours = effectiveHours;
          }
          
          const breakGaps = [];
          for (let i = 0; i < sessions.length - 1; i++) {
            const currentOut = sessions[i].punchOutUTC;
            const nextIn = sessions[i + 1].punchInUTC;
            if (currentOut && nextIn) {
              const gapMinutes = calculateHours(currentOut, nextIn) * 60;
              if (gapMinutes >= 5) {
                breakGaps.push({
                  start: currentOut,
                  end: nextIn,
                  minutes: gapMinutes,
                  breakIndex: i
                });
                breakMinutes += gapMinutes;
              }
            }
          }
          
          let punchOutUTC = lastOutUTC || day.punchOutUTC || null;
          
          return {
            ...day,
            sessions: sessions,
            punchInDisplay: day.punchInUTC ? formatTimeDisplay(day.punchInUTC) : null,
            punchOutDisplay: punchOutUTC ? formatTimeDisplay(punchOutUTC) : null,
            punchOutUTC: punchOutUTC,
            effectiveHours: effectiveHours,
            grossHours: grossHours,
            breakMinutes: breakMinutes,
            breakGaps: breakGaps
          };
        });
        
        setAttendanceData(processedDays);
        calculateStatsForMonth(processedDays);
      }
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsForMonth = (days) => {
    const monthDays = days.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const workingDays = monthDays.filter(d => !d.isWeekend);
    const presentDays = monthDays.filter(d => d.status === 'present' || d.status === 'late');
    const absentDays = workingDays.filter(d => d.status === 'absent');
    const leaveDays = workingDays.filter(d => d.status === 'leave');
    const lateCount = monthDays.filter(d => d.status === 'late').length;
    const weekends = monthDays.filter(d => d.isWeekend).length;
    
    const totalEffectiveHours = presentDays.reduce((sum, d) => sum + (d.effectiveHours || 0), 0);
    const totalGrossHours = presentDays.reduce((sum, d) => sum + (d.grossHours || 0), 0);
    
    const avgEffectiveHours = presentDays.length > 0 ? totalEffectiveHours / presentDays.length : 0;
    const avgGrossHours = presentDays.length > 0 ? totalGrossHours / presentDays.length : 0;
    const latePercentage = presentDays.length > 0 ? (lateCount / presentDays.length) * 100 : 0;
    const attendanceRate = workingDays.length > 0 ? (presentDays.length / workingDays.length) * 100 : 0;

    setStats({
      totalDays: workingDays.length,
      present: presentDays.length,
      absent: absentDays.length,
      late: lateCount,
      onLeave: leaveDays.length,
      weekends: weekends,
      totalEffectiveHours: totalEffectiveHours,
      totalGrossHours: totalGrossHours,
      averageEffectiveHours: avgEffectiveHours,
      averageGrossHours: avgGrossHours,
      latePercentage: latePercentage,
      attendanceRate: attendanceRate
    });
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
    setShowMonthPicker(false);
  };

  const handleMonthSelect = (monthIndex) => {
    setSelectedMonth(monthIndex);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    setShowMonthPicker(false);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setShowMonthPicker(false);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  // Filter employees by search term
  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const monthDays = useMemo(() => {
    return attendanceData.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [attendanceData, selectedMonth, selectedYear]);

  if (loading && !selectedEmployee) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Loading employees...</p>
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
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Employee Attendance Detail
            </h1>
            <p className="text-slate-500 text-sm mt-1">View detailed attendance timeline for any employee</p>
          </div>
        </div>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or employee code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            {showDropdown && filteredEmployees.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredEmployees.map(emp => (
                  <div
                    key={emp._id}
                    className={`px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-all flex items-center justify-between ${
                      selectedEmployee?._id === emp._id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setSearchTerm(emp.name);
                      setShowDropdown(false);
                      setAttendanceData([]);
                      fetchEmployeeAttendance(emp._id);
                    }}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-slate-400">{emp.employeeCode || 'N/A'}</p>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {emp.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {selectedEmployee && (
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {selectedEmployee.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{selectedEmployee.name}</p>
                <p className="text-xs text-slate-500">{selectedEmployee.email}</p>
                <p className="text-[10px] font-mono text-slate-400">Code: {selectedEmployee.employeeCode || 'N/A'}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setSearchTerm('');
                  setAttendanceData([]);
                  setEmployeeInfo(null);
                }}
                className="ml-2 p-1 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <X size={16} className="text-blue-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Timeline */}
      {selectedEmployee ? (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <Loader2 size={36} className="text-blue-600 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Loading attendance...</p>
              </div>
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No attendance data available for this employee</p>
              <p className="text-xs text-slate-400 mt-1">Try syncing attendance data first</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header with Month Navigation */}
              <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <BarChart3 size={16} className="text-blue-600" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700">
                      Attendance Timeline
                    </h3>
                    
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMonthPicker(!showMonthPicker);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-[10px] font-semibold text-slate-700 shadow-sm"
                      >
                        <span>{monthNames[selectedMonth]} {selectedYear}</span>
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showMonthPicker ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showMonthPicker && (
                        <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 min-w-[220px]">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                            <button
                              onClick={() => handleYearSelect(selectedYear - 1)}
                              className="p-1 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              <ChevronLeft size={12} className="text-slate-500" />
                            </button>
                            <select
                              value={selectedYear}
                              onChange={(e) => handleYearSelect(Number(e.target.value))}
                              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400"
                            >
                              {yearOptions.map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleYearSelect(selectedYear + 1)}
                              className="p-1 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              <ChevronRight size={12} className="text-slate-500" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1">
                            {monthNames.map((month, index) => (
                              <button
                                key={month}
                                onClick={() => handleMonthSelect(index)}
                                className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                  selectedMonth === index
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                {month.substring(0, 3)}
                              </button>
                            ))}
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={goToCurrentMonth}
                              className="w-full py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-semibold hover:bg-blue-100 transition-all"
                            >
                              Go to Current Month
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1 rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
                      >
                        <ChevronLeft size={14} className="text-slate-500" />
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1 rounded-lg hover:bg-slate-100 transition-all border border-slate-200"
                      >
                        <ChevronRight size={14} className="text-slate-500" />
                      </button>
                    </div>
                    
                    <div className="hidden sm:flex items-center gap-1 text-[7px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-lg">
                      <MousePointer2 size={8} />
                      <span>Hover</span>
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-100 text-[7px] font-medium text-slate-400">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span>Work</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <span>Break</span>
                  </span>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5 p-2 bg-slate-50/50 border-b border-slate-100">
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-slate-400 uppercase tracking-wider">Working</p>
                  <p className="text-base font-black text-slate-800">{stats.totalDays}</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-emerald-600 uppercase tracking-wider">Present</p>
                  <p className="text-base font-black text-emerald-700">{stats.present}</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-rose-600 uppercase tracking-wider">Absent</p>
                  <p className="text-base font-black text-rose-700">{stats.absent}</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-amber-600 uppercase tracking-wider">Late</p>
                  <p className="text-base font-black text-amber-700">{stats.late}</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-indigo-600 uppercase tracking-wider">Leave</p>
                  <p className="text-base font-black text-indigo-700">{stats.onLeave}</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-blue-600 uppercase tracking-wider">Rate</p>
                  <p className="text-base font-black text-blue-700">{stats.attendanceRate.toFixed(0)}%</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-emerald-600 uppercase tracking-wider">Avg Eff</p>
                  <p className="text-base font-black text-emerald-700">{stats.averageEffectiveHours.toFixed(1)}h</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-slate-600 uppercase tracking-wider">Avg Gross</p>
                  <p className="text-base font-black text-slate-700">{stats.averageGrossHours.toFixed(1)}h</p>
                </div>
                <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
                  <p className="text-[6px] font-bold text-amber-600 uppercase tracking-wider">Late %</p>
                  <p className="text-base font-black text-amber-700">{stats.latePercentage.toFixed(0)}%</p>
                </div>
              </div>

              {/* Timeline Table */}
              <div className="overflow-x-auto p-3">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Date</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Day</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Timeline</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">In</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Last Out</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Eff</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Gross</th>
                      <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Arrival</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthDays.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-8 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <CalendarIcon size={20} className="text-slate-300" />
                            <p className="text-xs font-medium text-slate-500">No attendance data for {monthNames[selectedMonth]} {selectedYear}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      [...monthDays]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((day, idx) => {
                          const styles = STATUS_STYLES[day.status] || STATUS_STYLES.default;
                          const hasIn = day.punchInUTC || (day.sessions && day.sessions.length > 0);
                          const today = isToday(day.date);
                          const isWeekend = day.isWeekend || false;

                          // ✅ FIX: For weekends, set outDisplay to '—' instead of 'No Out Punch'
                          let outDisplay = day.punchOutDisplay || '—';
                          if (!isWeekend) {
                            if (day.sessions && day.sessions.length > 0) {
                              const lastSession = day.sessions[day.sessions.length - 1];
                              if (!lastSession.punchOutUTC) {
                                outDisplay = 'No Out Punch';
                              } else if (lastSession.punchOutUTC) {
                                outDisplay = formatTimeDisplay(lastSession.punchOutUTC);
                              }
                            }
                          }
                          
                          return (
                            <tr key={idx} className={`hover:bg-slate-50/50 transition-all ${today ? 'bg-blue-50/30' : ''}`}>
                              <td className="px-2 py-1.5">
                                <span className={`text-[10px] font-medium ${today ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>
                                  {formatDateDisplay(day.date)}
                                </span>
                                {today && (
                                  <span className="ml-1 text-[7px] font-bold bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">Today</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="text-[10px] font-medium text-slate-500">{getDayShortName(day.date)}</span>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold border ${styles.chip}`}>
                                  {getStatusIcon(day.status)}
                                  {getStatusLabel(day.status)}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 min-w-[180px]">
                                {isWeekend ? (
                                  <span className="text-[9px] text-slate-400 italic">—</span>
                                ) : hasIn ? (
                                  <DayTimelineBar day={day} />
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic">—</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="text-[10px] font-mono font-medium text-slate-700">
                                  {isWeekend ? '—' : (day.punchInDisplay || '—')}
                                </span>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`text-[10px] font-mono font-medium ${
                                  isWeekend ? 'text-slate-400' :
                                  !day.punchOutUTC ? 'text-rose-500 font-bold' : 'text-slate-700'
                                }`}>
                                  {isWeekend ? '—' : outDisplay}
                                </span>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="text-[10px] font-bold text-emerald-700">
                                  {isWeekend ? '—' : (day.effectiveHours ? day.effectiveHours.toFixed(1) : '0')}h
                                </span>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="text-[10px] font-medium text-slate-700">
                                  {isWeekend ? '—' : (day.grossHours ? day.grossHours.toFixed(1) : '0')}h
                                </span>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`text-[10px] font-medium ${day.status === 'late' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {isWeekend ? '—' : getArrivalStatus(day)}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Select an employee</p>
          <p className="text-xs text-slate-400 mt-1">Search and select an employee to view their attendance timeline</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceDetail;