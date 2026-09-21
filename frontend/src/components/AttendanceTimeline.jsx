// frontend/src/components/AttendanceTimeline.jsx
// ✅ FIXED: Time and date are now consistently displayed in IST, matching the
//    AttendanceCombined.jsx component. This ensures "late" status and times
//    are calculated correctly regardless of server timezone.
// ✅ FIXED (2026-08-31): Race condition where attendance data was processed
//    before the holidays list finished loading, permanently baking in
//    isHoliday: false for holidays like Rakshabandhan (Aug 28, 2026).
//    Raw attendance data and holiday data are now merged reactively via
//    useMemo, so it recomputes automatically whenever either finishes loading.
// ✅ FIXED (2026-09-21): Component now accepts an optional `targetUserId`
//    prop. When set (HR view of another employee), it calls the HR timeline
//    endpoint; otherwise it calls the self endpoint. Both endpoints return
//    the exact same shape, so the rendering path is identical.
//    Also switched all date math (formatDateDisplay, getDayShortName,
//    isToday, calculateStatsForMonth, monthDays) from local timezone to
//    UTC so day labels and month filters stay correct on any server.
// ✅ FIXED (2026-09-21): Time and "late" status now use a fixed IST (+05:30)
//    offset, matching the exact logic of AttendanceCombined.jsx. This
//    resolves inconsistencies where a punch time was shown correctly in one
//    view but was considered "late" in another due to timezone differences.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Calendar, Clock, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Coffee,
  Loader2, Calendar as CalendarIcon, ChevronUp, Play,
  Pause, Info, MousePointer2, ChevronDown,
  TrendingUp, TrendingDown, Minus, BarChart3,
  Users, UserCheck, UserX, ClockAlert, Gift
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// ✅ IST TIME CONVERSION HELPERS (Matches AttendanceCombined)
// ─────────────────────────────────────────────────────────────

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +05:30
const OFFICE_START_MINUTES = 10 * 60 + 45; // 10:45 AM IST cutoff

/**
 * Formats a UTC date string into IST 12-hour time (e.g., "10:09 AM").
 */
const formatTimeDisplay = (dateString) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    let total = date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MINUTES;
    total = ((total % 1440) + 1440) % 1440;

    const hours24 = Math.floor(total / 60);
    const minutes = String(total % 60).padStart(2, '0');
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;

    return `${hours12}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
};

/**
 * Returns the IST calendar date string (YYYY-MM-DD) from a UTC Date.
 */
const getISTDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Arrival status: "On Time", "Xm late", or "—".
 * Compares the IST-adjusted punch-in minute to the 10:45 AM cutoff.
 */
const getArrivalStatus = (punchInUTC) => {
  if (!punchInUTC) return '—';
  try {
    const d = new Date(punchInUTC);
    if (isNaN(d.getTime())) return '—';

    let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
    total = ((total % 1440) + 1440) % 1440;

    if (total <= OFFICE_START_MINUTES) return 'On Time';
    return `${total - OFFICE_START_MINUTES}m late`;
  } catch (e) {
    return '—';
  }
};

// ─────────────────────────────────────────────────────────────
// Timeline track config
// ─────────────────────────────────────────────────────────────
const TRACK_START_HOUR = 6;
const TRACK_END_HOUR = 21;
const TRACK_TOTAL_MIN = (TRACK_END_HOUR - TRACK_START_HOUR) * 60;

// This function is now IST-aware
const minutesOfDayIST = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;

  let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  return ((total % 1440) + 1440) % 1440;
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
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bg: 'bg-emerald-50'
  },
  late: {
    bar: 'from-amber-400 to-amber-500',
    text: 'text-amber-700',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    bg: 'bg-amber-50'
  },
  absent: {
    bar: 'from-rose-400 to-rose-500',
    text: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    bg: 'bg-rose-50'
  },
  leave: {
    bar: 'from-indigo-400 to-indigo-500',
    text: 'text-indigo-700',
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    bg: 'bg-indigo-50'
  },
  weekend: {
    bar: 'from-slate-300 to-slate-400',
    text: 'text-slate-500',
    chip: 'bg-slate-50 text-slate-500 border-slate-200',
    bg: 'bg-slate-50'
  },
  holiday: {
    bar: 'from-purple-400 to-purple-500',
    text: 'text-purple-700',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    bg: 'bg-purple-50'
  },
  default: {
    bar: 'from-blue-400 to-blue-500',
    text: 'text-slate-600',
    chip: 'bg-slate-50 text-slate-500 border-slate-200',
    bg: 'bg-slate-50'
  }
};

// ✅ UTC-based date display (no local timezone shift)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
};

// ✅ UTC-based day name
const getDayShortName = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[date.getUTCDay()];
};

// ✅ UTC-based "is today" check
const isToday = (dateStr) => {
  if (!dateStr) return false;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${d}`;
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

const formatHoursToHrMin = (hours) => {
  if (!hours || hours <= 0) return '0 hr 0 min';
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
  if (hrs > 0) return `${hrs} hr 0 min`;
  return `0 hr ${mins} min`;
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
  switch (status) {
    case 'present': return <CheckCircle size={14} className="text-emerald-600" />;
    case 'late': return <AlertCircle size={14} className="text-amber-600" />;
    case 'absent': return <XCircle size={14} className="text-rose-600" />;
    case 'leave': return <CalendarIcon size={14} className="text-indigo-600" />;
    case 'weekend': return <Coffee size={14} className="text-slate-400" />;
    case 'holiday': return <Gift size={14} className="text-purple-600" />;
    default: return <Clock size={14} className="text-slate-400" />;
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'present': return 'Present';
    case 'late': return 'Late';
    case 'absent': return 'Absent';
    case 'leave': return 'On Leave';
    case 'weekend': return 'Weekend';
    case 'holiday': return 'Holiday 🎉';
    default: return '—';
  }
};

// ─────────────────────────────────────────────────────────────
// Average Bar Chart Component
// ─────────────────────────────────────────────────────────────
const AverageBarChart = ({ weeklyAverages }) => {
  if (!weeklyAverages || weeklyAverages.length === 0) {
    return null;
  }

  const filteredWeeks = weeklyAverages.filter(w => w.dayCount >= 2);

  if (filteredWeeks.length === 0) {
    return (
      <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 text-center">
        <span className="text-[8px] font-medium text-slate-400">No weeks with sufficient data</span>
      </div>
    );
  }

  const maxAvg = Math.max(
    ...filteredWeeks.map(w => Math.max(w.avgEff || 0, w.avgGross || 0)),
    1
  );
  const maxDisplay = Math.ceil(maxAvg / 2) * 2 + 2;

  return (
    <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-4 mb-2">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Avg Hours by Week</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-emerald-500"></div>
            <span className="text-[7px] font-bold text-slate-500">Eff</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-slate-600"></div>
            <span className="text-[7px] font-bold text-slate-500">Gross</span>
          </div>
        </div>
        <span className="text-[6px] text-slate-400 ml-auto">{maxDisplay}h max</span>
      </div>

      <div className="space-y-1.5">
        {filteredWeeks.map((week) => {
          const effPercent = Math.min((week.avgEff / maxDisplay) * 100, 100);
          const grossPercent = Math.min((week.avgGross / maxDisplay) * 100, 100);

          return (
            <div key={week.weekNumber} className="flex items-center gap-2">
              <span className="text-[7px] font-bold text-slate-500 w-12 flex-shrink-0">
                {week.weekDisplay}
              </span>
              <div className="flex-1">
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-600 rounded-full transition-all duration-500"
                    style={{ width: `${grossPercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${effPercent}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 min-w-[100px]">
                <span className="text-[8px] font-bold text-emerald-700 w-[45px] text-right">
                  {week.avgEffFormatted}
                </span>
                <span className="text-[8px] font-bold text-slate-600 w-[45px] text-right">
                  {week.avgGrossFormatted}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Day Timeline Bar Component
// ─────────────────────────────────────────────────────────────
const DayTimelineBar = ({ day }) => {
  const isHoliday = day.isHoliday || false;
  const holidayName = day.holidayName || null;

  const styles = isHoliday ? STATUS_STYLES.holiday : (STATUS_STYLES[day.status] || STATUS_STYLES.default);
  const hasIn = day.punchInUTC || (day.sessions && day.sessions.length > 0);
  const trackStart = TRACK_START_HOUR * 60;

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

  // If it's a holiday, show a special holiday bar
  if (isHoliday) {
    return (
      <div className="flex items-center gap-2 h-5">
        <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-purple-300 to-purple-400" />
        <span className="text-[8px] font-medium text-purple-600 whitespace-nowrap flex items-center gap-1">
          <Gift size={10} className="text-purple-500" />
          {holidayName || 'Holiday'}
        </span>
      </div>
    );
  }

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
      const startMin = clampToTrack(minutesOfDayIST(day.punchInUTC));
      const endMin = clampToTrack(
        minutesOfDayIST(day.punchOutUTC) || startMin + 5
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

      const startMin = clampToTrack(minutesOfDayIST(session.punchInUTC));
      const isLast = idx === totalSegments - 1;

      let endMin;
      if (session.punchOutUTC) {
        endMin = clampToTrack(minutesOfDayIST(session.punchOutUTC));
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

      if (!isLast && session.punchOutUTC && day.sessions[idx + 1] && day.sessions[idx + 1].punchInUTC) {
        const gapStart = clampToTrack(minutesOfDayIST(session.punchOutUTC));
        const gapEnd = clampToTrack(minutesOfDayIST(day.sessions[idx + 1].punchInUTC));
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
                  {formatTimeDisplay(localHoveredSession.punchOut) || 'No Out Punch'}
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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const AttendanceTimeline = ({ userId, token, isCollapsed, targetUserId = null }) => {
  const [loading, setLoading] = useState(true);
  const [rawAttendanceData, setRawAttendanceData] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [stats, setStats] = useState({
    totalDays: 0,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    weekends: 0,
    holidays: 0,
    totalEffectiveHours: 0,
    totalGrossHours: 0,
    averageEffectiveHours: 0,
    averageGrossHours: 0,
    weeklyAverages: []
  });

  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/holidays`,
        authHeader
      );

      if (res.data.success) {
        setHolidays(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  };

  const isHoliday = useCallback((dateStr) => {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const holiday = holidays.find(h => {
      const hDate = new Date(h.date);
      if (isNaN(hDate.getTime())) return false;
      const hYear = hDate.getUTCFullYear();
      const hMonth = String(hDate.getUTCMonth() + 1).padStart(2, '0');
      const hDay = String(hDate.getUTCDate()).padStart(2, '0');
      const hDateString = `${hYear}-${hMonth}-${hDay}`;
      return hDateString === dateString;
    });

    return holiday || null;
  }, [holidays]);

  const attendanceData = useMemo(() => {
    return rawAttendanceData.map(day => {
      const holidayData = isHoliday(day.date);
      const isHolidayDay = !!holidayData;
      const holidayName = holidayData ? holidayData.name : null;

      return {
        ...day,
        isHoliday: isHolidayDay,
        holidayName: holidayName,
        status: isHolidayDay ? 'holiday' : day.status
      };
    });
  }, [rawAttendanceData, isHoliday]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const effectiveUserId = targetUserId || userId;
      const endpoint = targetUserId
        ? `${API_BASE_URL}/api/hr/attendance/employee-timeline/${effectiveUserId}`
        : `${API_BASE_URL}/api/employee/attendance/timeline`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months: 12 }
      });

      if (response.data.success) {
        const data = response.data.data;

        const processedDays = (data.days || []).map(day => {
          let sessions = day.sessions || [];

          if (sessions.length === 0 && day.punchInUTC) {
            sessions = [{
              punchInUTC: day.punchInUTC,
              punchOutUTC: day.punchOutUTC || null
            }];
          }

          let effectiveHours = 0;
          let grossHours = 0;
          let breakMinutes = 0;
          let firstIn = null;
          let lastOut = null;
          let lastOutUTC = null;

          sessions.forEach((session) => {
            if (session.punchInUTC) {
              const inTime = new Date(session.punchInUTC);
              if (!firstIn || inTime < firstIn) firstIn = inTime;

              if (session.punchOutUTC) {
                const outTime = new Date(session.punchOutUTC);
                if (!lastOutUTC || outTime > new Date(lastOutUTC)) {
                  lastOutUTC = session.punchOutUTC;
                }
                const hours = calculateHours(session.punchInUTC, outTime.toISOString());
                effectiveHours += hours;
                if (!lastOut || outTime > lastOut) lastOut = outTime;
              }
            }
          });

          if (!lastOutUTC && sessions.length > 0) {
            const lastSession = sessions[sessions.length - 1];
            if (lastSession.punchOutUTC) {
              lastOutUTC = lastSession.punchOutUTC;
            }
          }

          if (!lastOutUTC) {
            lastOutUTC = day.punchOutUTC || null;
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

          return {
            ...day,
            sessions: sessions,
            punchInDisplay: day.punchInUTC ? formatTimeDisplay(day.punchInUTC) : null,
            punchOutDisplay: lastOutUTC ? formatTimeDisplay(lastOutUTC) : null,
            punchOutUTC: lastOutUTC,
            effectiveHours: effectiveHours,
            grossHours: grossHours,
            breakMinutes: breakMinutes,
            breakGaps: breakGaps,
            totalDuration: effectiveHours
          };
        });

        setRawAttendanceData(processedDays);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsForMonth = (days) => {
    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    const monthDays = days.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      if (isNaN(date.getTime())) return false;
      return date.getUTCMonth() === selectedMonth && date.getUTCFullYear() === selectedYear;
    });

    const sortedDays = [...monthDays].sort((a, b) => new Date(a.date) - new Date(b.date));

    const weeks = [];
    let currentWeek = [];
    let weekStartDate = null;
    let weekNumber = 1;

    for (const day of sortedDays) {
      const date = new Date(day.date);
      const dayOfWeek = date.getUTCDay();
      const dateStr = day.date;

      if (dayOfWeek === 1 || weekStartDate === null) {
        if (currentWeek.length > 0) {
          weeks.push({
            weekNumber: weekNumber,
            days: [...currentWeek]
          });
          weekNumber++;
        }
        currentWeek = [];
        weekStartDate = dateStr;
      }

      currentWeek.push(day);
    }

    if (currentWeek.length > 0) {
      weeks.push({
        weekNumber: weekNumber,
        days: [...currentWeek]
      });
    }

    const weeklyAverages = weeks.map((week) => {
      const daysWithoutToday = week.days.filter(day => day.date !== todayStr);
      const daysWithoutHolidays = daysWithoutToday.filter(d => !d.isHoliday);
      const presentDays = daysWithoutHolidays.filter(d => d.status === 'present' || d.status === 'late');
      const lateDays = daysWithoutHolidays.filter(d => d.status === 'late');

      const totalEff = presentDays.reduce((sum, d) => sum + (d.effectiveHours || 0), 0);
      const totalGross = presentDays.reduce((sum, d) => sum + (d.grossHours || 0), 0);

      const avgEff = presentDays.length > 0 ? totalEff / presentDays.length : 0;
      const avgGross = presentDays.length > 0 ? totalGross / presentDays.length : 0;

      return {
        weekNumber: week.weekNumber,
        weekDisplay: `Week ${week.weekNumber}`,
        avgEff,
        avgGross,
        avgEffFormatted: formatHoursToHrMin(avgEff),
        avgGrossFormatted: formatHoursToHrMin(avgGross),
        dayCount: presentDays.length,
        lateCount: lateDays.length,
        totalDays: week.days.length,
        holidayCount: week.days.filter(d => d.isHoliday).length
      };
    });

    const workingDays = monthDays.filter(d => !d.isWeekend && !d.isHoliday);
    const daysWithoutToday = workingDays.filter(d => d.date !== todayStr);

    const presentDays = daysWithoutToday.filter(d => d.status === 'present' || d.status === 'late');
    const lateDays = daysWithoutToday.filter(d => d.status === 'late');
    const absentDays = daysWithoutToday.filter(d => d.status === 'absent');
    const leaveDays = daysWithoutToday.filter(d => d.status === 'leave');
    const weekends = monthDays.filter(d => d.isWeekend).length;
    const holidays = monthDays.filter(d => d.isHoliday).length;

    const totalEffectiveHours = presentDays.reduce((sum, d) => sum + (d.effectiveHours || 0), 0);
    const totalGrossHours = presentDays.reduce((sum, d) => sum + (d.grossHours || 0), 0);

    const avgEffectiveHours = presentDays.length > 0 ? totalEffectiveHours / presentDays.length : 0;
    const avgGrossHours = presentDays.length > 0 ? totalGrossHours / presentDays.length : 0;

    setStats({
      totalDays: workingDays.length,
      present: presentDays.length,
      absent: absentDays.length,
      late: lateDays.length,
      onLeave: leaveDays.length,
      weekends: weekends,
      holidays: holidays,
      totalEffectiveHours: totalEffectiveHours,
      totalGrossHours: totalGrossHours,
      averageEffectiveHours: avgEffectiveHours,
      averageGrossHours: avgGrossHours,
      weeklyAverages: weeklyAverages
    });
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedMonth, selectedYear, targetUserId]);

  useEffect(() => {
    if (attendanceData.length > 0) {
      calculateStatsForMonth(attendanceData);
    }
  }, [selectedMonth, selectedYear, attendanceData]);

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

  const monthDays = useMemo(() => {
    return attendanceData.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      if (isNaN(date.getTime())) return false;
      return date.getUTCMonth() === selectedMonth && date.getUTCFullYear() === selectedYear;
    });
  }, [attendanceData, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 size={32} className="text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (attendanceData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
          <Calendar size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No attendance data available</p>
        <p className="text-xs text-slate-400 mt-1">Try syncing your attendance data</p>
        <button
          onClick={fetchAttendanceData}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm"
        >
          Refresh Data
        </button>
      </div>
    );
  }

  return (
    <>
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
                        className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                          className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${selectedMonth === index ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
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

              {stats.holidays > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[7px] font-bold">
                  <Gift size={10} />
                  {stats.holidays} holidays
                </span>
              )}
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

          <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-100 text-[7px] font-medium text-slate-400">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span>Work</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span>Break</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>Holiday</span>
            </span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 p-2 bg-slate-50/50 border-b border-slate-100">
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
            <p className="text-[6px] font-bold text-indigo-600 uppercase tracking-wider">Leave</p>
            <p className="text-base font-black text-indigo-700">{stats.onLeave}</p>
          </div>
          <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
            <p className="text-[6px] font-bold text-purple-600 uppercase tracking-wider">Holidays</p>
            <p className="text-base font-black text-purple-700">{stats.holidays}</p>
          </div>
          <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
            <p className="text-[6px] font-bold text-emerald-600 uppercase tracking-wider">Avg Eff</p>
            <p className="text-base font-black text-emerald-700">{formatHoursToHrMin(stats.averageEffectiveHours)}</p>
          </div>
          <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
            <p className="text-[6px] font-bold text-slate-600 uppercase tracking-wider">Avg Gross</p>
            <p className="text-base font-black text-slate-700">{formatHoursToHrMin(stats.averageGrossHours)}</p>
          </div>
          <div className="text-center bg-white rounded-lg py-1.5 px-2 shadow-sm">
            <p className="text-[6px] font-bold text-amber-600 uppercase tracking-wider">Late %</p>
            <p className="text-base font-black text-amber-700">
              {stats.present > 0 ? Math.round((stats.late / stats.present) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Weekly Averages Section */}
        {stats.weeklyAverages && stats.weeklyAverages.length > 0 && (
          <div className="p-2 border-b border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Weekly Averages</span>
              <span className="text-[7px] text-slate-400">(excluding today & holidays)</span>
              {stats.weeklyAverages.some(w => w.holidayCount > 0) && (
                <span className="text-[6px] text-purple-500 bg-purple-50 px-1 py-0.5 rounded-full flex items-center gap-0.5">
                  <Gift size={8} />
                  {stats.weeklyAverages.reduce((sum, w) => sum + w.holidayCount, 0)} holidays
                </span>
              )}
            </div>

            <AverageBarChart weeklyAverages={stats.weeklyAverages} />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5 mt-2">
              {stats.weeklyAverages
                .filter(week => week.dayCount >= 2)
                .map((week) => (
                  <div key={week.weekNumber} className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[7px] font-bold text-slate-600">{week.weekDisplay}</span>
                      <span className="text-[6px] font-bold text-slate-400">({week.dayCount}d)</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] font-bold text-emerald-700">{week.avgEffFormatted}</span>
                      <span className="text-[8px] font-bold text-slate-600">{week.avgGrossFormatted}</span>
                    </div>
                    {week.holidayCount > 0 && (
                      <div className="text-[6px] text-purple-500 mt-0.5 flex items-center gap-0.5">
                        <Gift size={8} />
                        {week.holidayCount} holiday{week.holidayCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {stats.weeklyAverages.filter(week => week.dayCount >= 2).length === 0 && (
              <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 text-center">
                <span className="text-[8px] font-medium text-slate-400">No weeks with sufficient data (minimum 2 days)</span>
              </div>
            )}
          </div>
        )}

        {/* Timeline Table */}
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Date</th>
                <th className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">Day</th>
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
                  <td colSpan={8} className="px-2 py-8 text-center">
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
                    const isHolidayDay = day.isHoliday || false;
                    const holidayName = day.holidayName || null;
                    const styles = isHolidayDay ? STATUS_STYLES.holiday : (STATUS_STYLES[day.status] || STATUS_STYLES.default);
                    const hasIn = day.punchInUTC || (day.sessions && day.sessions.length > 0);
                    const today = isToday(day.date);
                    const isWeekend = day.isWeekend || false;

                    let outDisplay = '—';
                    if (!isWeekend && !isHolidayDay) {
                      outDisplay = day.punchOutUTC ? formatTimeDisplay(day.punchOutUTC) : 'No Out Punch';
                    }

                    return (
                      <tr key={idx} className={`hover:bg-slate-50/50 transition-all ${today ? 'bg-blue-50/30' : ''} ${isHolidayDay ? 'bg-purple-50/20' : ''}`}>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] font-medium ${today ? 'text-blue-600 font-bold' : isHolidayDay ? 'text-purple-600' : 'text-slate-700'}`}>
                            {formatDateDisplay(day.date)}
                          </span>
                          {today && (
                            <span className="ml-1 text-[7px] font-bold bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">Today</span>
                          )}
                          {isHolidayDay && (
                            <span className="ml-1 text-[7px] font-bold bg-purple-100 text-purple-600 px-1 py-0.5 rounded-full flex items-center gap-0.5">
                              <Gift size={8} />
                              Holiday
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-[10px] font-medium text-slate-500">{getDayShortName(day.date)}</span>
                        </td>
                        <td className="px-2 py-1.5 min-w-[180px]">
                          {isHolidayDay ? (
                            <div className="flex items-center gap-2 h-5">
                              <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-purple-300 to-purple-400" />
                              <span className="text-[8px] font-medium text-purple-600 whitespace-nowrap flex items-center gap-1">
                                <Gift size={10} className="text-purple-500" />
                                {holidayName || 'Holiday'}
                              </span>
                            </div>
                          ) : hasIn ? (
                            <DayTimelineBar day={day} />
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-[10px] font-mono font-medium text-slate-700">
                            {isHolidayDay ? '—' : (day.punchInDisplay || '—')}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] font-mono font-medium ${isHolidayDay ? 'text-slate-400' : isWeekend ? 'text-slate-400' : outDisplay === 'No Out Punch' ? 'text-rose-500 font-bold' : 'text-slate-700'}`}>
                            {isHolidayDay ? '—' : outDisplay}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-[10px] font-bold text-emerald-700">
                            {isHolidayDay ? '—' : (day.effectiveHours ? formatHoursToHrMin(day.effectiveHours) : '0 hr 0 min')}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-[10px] font-bold text-slate-700">
                            {isHolidayDay ? '—' : (day.grossHours ? formatHoursToHrMin(day.grossHours) : '0 hr 0 min')}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] font-medium ${isHolidayDay ? 'text-purple-600' : day.status === 'late' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {isHolidayDay ? '🎉' : (isWeekend ? '—' : getArrivalStatus(day.punchInUTC))}
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
    </>
  );
};

export default AttendanceTimeline;