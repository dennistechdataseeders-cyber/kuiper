// frontend/src/components/AttendanceCombined.jsx
// ✅ Effective/Gross calculation
// ✅ Half-day leave no longer shows duplicate sessions
// ✅ Weekend/Absent rows no longer show "0 hr 0 min"
// ✅ Removed "Sessions" column from table
// ✅ REMOVED: Row-click session details expansion
// ✅ Effective hours now falls back to Gross if no session breakdown available
// ✅ GUARANTEED CONSISTENT local vs VPS: uses fixed IST offset (UTC+5:30)
//    instead of toLocaleTimeString or getHours. Never touches OS timezone.
// ✅ REMOVED: "Eff" column from table
// ✅ REMOVED: "Avg Eff" stat card
// ✅ REMOVED: "Eff" bar/legend/label from Weekly Averages chart

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Gift,
  Coffee,
  User,
  RefreshCw
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// IST OFFSET
// ─────────────────────────────────────────────────────────────
// IST is UTC+5:30 with no DST. We add this offset manually instead
// of relying on the OS timezone. This makes the output IDENTICAL on
// Windows dev, Ubuntu VPS, or any Docker container regardless of the
// TZ environment variable.
const IST_OFFSET_MINUTES = 5 * 60 + 30; // 330

// ─────────────────────────────────────────────────────────────
// Shift Configuration
// ─────────────────────────────────────────────────────────────
const DEFAULT_SHIFT_HOUR = 10;
const DEFAULT_SHIFT_MINUTE = 0;
const GRACE_PERIOD_MINUTES = 15;

const getShiftStartMinutes = (shiftHour, shiftMinute, shiftAmPm) => {
  let hour = shiftHour || DEFAULT_SHIFT_HOUR;
  const minute = shiftMinute || DEFAULT_SHIFT_MINUTE;
  if (shiftAmPm?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  else if (shiftAmPm?.toUpperCase() === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
};

// ─────────────────────────────────────────────────────────────
// Timeline config
// ─────────────────────────────────────────────────────────────
const TRACK_START_HOUR = 6;
const TRACK_END_HOUR = 21;
const TRACK_TOTAL_MIN = (TRACK_END_HOUR - TRACK_START_HOUR) * 60;
const NOON_MINUTES = 720;

/**
 * Convert a stored UTC timestamp to IST minutes-of-day.
 *
 * MongoDB stores the biometric wall-clock time as if it were UTC
 * (e.g. a punch at 5:53 AM local is stored as "T05:53:27.000Z").
 * To display it as IST we add the fixed +5:30 offset.
 *
 * This function NEVER uses getHours(), getMinutes(), or
 * toLocaleString({ timeZone }), so the output is identical on
 * every server regardless of the OS timezone setting.
 */
const minutesOfDayIST = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  total = ((total % 1440) + 1440) % 1440; // wrap across midnight
  return total;
};

const clampToTrack = (mins) => {
  const start = TRACK_START_HOUR * 60;
  const end = TRACK_END_HOUR * 60;
  return Math.min(end, Math.max(start, mins));
};

const STATUS_STYLES = {
  present: { bar: 'from-emerald-400 to-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bg: 'bg-emerald-50' },
  late: { bar: 'from-amber-400 to-amber-500', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-200', bg: 'bg-amber-50' },
  absent: { bar: 'from-rose-400 to-rose-500', text: 'text-rose-700', chip: 'bg-rose-50 text-rose-700 border-rose-200', bg: 'bg-rose-50' },
  leave: { bar: 'from-indigo-400 to-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', bg: 'bg-indigo-50' },
  'leave-half-first': { bar: 'from-indigo-400 to-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', bg: 'bg-indigo-50' },
  'leave-half-second': { bar: 'from-indigo-400 to-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', bg: 'bg-indigo-50' },
  weekend: { bar: 'from-slate-300 to-slate-400', text: 'text-slate-500', chip: 'bg-slate-50 text-slate-500 border-slate-200', bg: 'bg-slate-50' },
  holiday: { bar: 'from-purple-400 to-purple-500', text: 'text-purple-700', chip: 'bg-purple-50 text-purple-700 border-purple-200', bg: 'bg-purple-50' },
  default: { bar: 'from-blue-400 to-blue-500', text: 'text-slate-600', chip: 'bg-slate-50 text-slate-500 border-slate-200', bg: 'bg-slate-50' }
};

const formatTimeDisplay = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';

  // Convert UTC -> IST by adding the fixed offset. No OS timezone involved.
  let total = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES;
  total = ((total % 1440) + 1440) % 1440;

  let hours24 = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${ampm}`;
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';

  // Shift to IST, then read the calendar day from the shifted value.
  const istMs = d.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  return `${day} ${month} ${year}`;
};

const getDayShortName = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const istMs = d.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][ist.getUTCDay()];
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  return dateStr === new Date().toISOString().split('T')[0];
};

const calculateHours = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  const inTime = new Date(punchIn);
  const outTime = new Date(punchOut);
  if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) return 0;
  // getTime() is timezone-agnostic; the difference is the true duration.
  return Math.max(0, (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60));
};

// ✅ SINGLE FORMATTER - used everywhere for consistency
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

const formatBreakMinutes = (minutes) => {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const STATUS_ICONS = {
  present: <CheckCircle size={14} className="text-emerald-600" />,
  late: <AlertCircle size={14} className="text-amber-600" />,
  absent: <XCircle size={14} className="text-rose-600" />,
  leave: <CalendarIcon size={14} className="text-indigo-600" />,
  'leave-half-first': <CalendarIcon size={14} className="text-indigo-600" />,
  'leave-half-second': <CalendarIcon size={14} className="text-indigo-600" />,
  weekend: <Coffee size={14} className="text-slate-400" />,
  holiday: <Gift size={14} className="text-purple-600" />
};
const getStatusIcon = (status) => STATUS_ICONS[status] || <Clock size={14} className="text-slate-400" />;

const STATUS_LABELS = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'On Leave',
  'leave-half-first': 'First Half Leave',
  'leave-half-second': 'Second Half Leave',
  weekend: 'Weekend',
  holiday: 'Holiday 🎉'
};
const getStatusLabel = (status) => STATUS_LABELS[status] || '—';

/**
 * Arrival status uses the SAME IST conversion as formatTimeDisplay,
 * so the "Arrival" column always agrees with the "In" column.
 */
const getArrivalStatus = (day, shiftStartMinutes, gracePeriodMinutes = 15) => {
  if (!day.punchInUTC) return '—';
  const shiftStart = shiftStartMinutes || (10 * 60 + 45);
  try {
    const punchMinutes = minutesOfDayIST(day.punchInUTC);
    if (punchMinutes === null) return '—';
    const threshold = shiftStart + gracePeriodMinutes;
    if (punchMinutes > threshold) {
      const diff = punchMinutes - threshold;
      const diffHours = Math.floor(diff / 60);
      const diffMins = diff % 60;
      return diffHours > 0 ? `${diffHours}h ${diffMins}m late` : `${diffMins}m late`;
    }
    return 'On Time';
  } catch (e) {
    return '—';
  }
};

const getDisplayStatus = (day) => {
  if (day.isHalfDay && day.halfDayType) {
    return day.halfDayType === 'first' ? 'leave-half-first' : 'leave-half-second';
  }
  if (day.status === 'leave') return 'leave';
  if (day.isHoliday) return 'holiday';
  if (day.isWeekend) return 'weekend';
  if (day.punchInUTC) {
    if (day.isLate === true) return 'late';
    if (day.punchOutUTC) return 'present';
    return 'present';
  }
  return 'absent';
};

// ─────────────────────────────────────────────────────────────
// Hover tooltip
// ─────────────────────────────────────────────────────────────
const HoverTooltip = ({ session, breakInfo, position }) => {
  if (!session && !breakInfo) return null;
  return (
    <div
      className="fixed z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-3 min-w-[200px] pointer-events-none border border-white/10"
      style={{ left: position.x, top: position.y, transform: 'translateY(-100%)' }}
    >
      {session && (
        <>
         
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">In:</span>
              <span className="font-mono font-medium">{formatTimeDisplay(session.punchIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Out:</span>
              <span className="font-mono font-medium text-rose-400">{formatTimeDisplay(session.punchOut) || 'No Out Punch'}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
              <span className="text-slate-400">Duration:</span>
              <span className="font-bold text-emerald-400">{session.durationFormatted}</span>
            </div>
          </div>
        </>
      )}
      {breakInfo && (
        <>
          <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/10">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span className="text-[11px] font-bold">Break {breakInfo.breakIndex + 1}</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Started:</span>
              <span className="font-mono font-medium">{formatTimeDisplay(breakInfo.start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ended:</span>
              <span className="font-mono font-medium">{formatTimeDisplay(breakInfo.end)}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
              <span className="text-slate-400">Duration:</span>
              <span className="font-bold text-amber-400">{breakInfo.formattedDuration}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Average Bar Chart (Gross only)
// ─────────────────────────────────────────────────────────────
const AverageBarChart = ({ weeklyAverages }) => {
  if (!weeklyAverages || weeklyAverages.length === 0) return null;

  const filteredWeeks = weeklyAverages.filter(w => w.dayCount >= 2);
  if (filteredWeeks.length === 0) {
    return (
      <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 text-center">
        <span className="text-[8px] font-medium text-slate-400">No weeks with sufficient data</span>
      </div>
    );
  }

  const maxAvg = Math.max(...filteredWeeks.map(w => w.avgGross || 0), 1);
  const maxDisplay = Math.ceil(maxAvg / 2) * 2 + 2;

  return (
    <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-4 mb-2">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Avg Hours by Week</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-slate-600"></div>
            <span className="text-[7px] font-bold text-slate-500">Gross</span>
          </div>
        </div>
        <span className="text-[6px] text-slate-400 ml-auto">{maxDisplay}h max</span>
      </div>

      <div className="space-y-1.5">
        {filteredWeeks.map((week) => {
          const grossPercent = Math.min((week.avgGross / maxDisplay) * 100, 100);
          return (
            <div key={week.weekNumber} className="flex items-center gap-2">
              <span className="text-[7px] font-bold text-slate-500 w-12 flex-shrink-0">{week.weekDisplay}</span>
              <div className="flex-1">
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-slate-600 rounded-full transition-all duration-500" style={{ width: `${grossPercent}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 min-w-[100px]">
                <span className="text-[8px] font-bold text-slate-600 w-[45px] text-right">{week.avgGrossFormatted}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Day Timeline Bar
// ─────────────────────────────────────────────────────────────
const DayTimelineBar = ({ day }) => {
  const isHoliday = day.isHoliday || false;
  const holidayName = day.holidayName || null;
  const isHalfDayLeave = !!(day.isHalfDay && day.halfDayType);
  const halfDayType = isHalfDayLeave ? day.halfDayType : null;

  const statusKey = isHalfDayLeave ? (halfDayType === 'first' ? 'leave-half-first' : 'leave-half-second') : day.status;
  const styles = isHoliday ? STATUS_STYLES.holiday : (STATUS_STYLES[statusKey] || STATUS_STYLES.default);

  const hasSessions = day.sessions && day.sessions.length > 0;
  const hasPunchIn = day.punchInUTC || hasSessions;
  const trackStart = TRACK_START_HOUR * 60;

  const [hoveredSession, setHoveredSession] = useState(null);
  const [hoveredBreak, setHoveredBreak] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleBarMouseLeave = () => {
    setHoveredSession(null);
    setHoveredBreak(null);
  };

  const handleSessionHover = (e, session, sessionIndex, totalSessions) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const duration = session.punchOutUTC ? calculateHours(session.punchInUTC, session.punchOutUTC) : 0;
    setHoveredSession({
      sessionIndex,
      totalSessions,
      punchIn: session.punchInUTC,
      punchOut: session.punchOutUTC || 'No Out Punch',
      durationFormatted: formatHours(duration, { unit: 'detailed' })
    });
    setHoveredBreak(null);
    setTooltipPosition({ x: e.clientX - 120, y: rect.top - 10 });
  };

  const handleBreakHover = (e, breakGap, breakIndex) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredBreak({
      breakIndex,
      start: breakGap.start,
      end: breakGap.end,
      formattedDuration: formatBreakMinutes(breakGap.minutes)
    });
    setHoveredSession(null);
    setTooltipPosition({ x: e.clientX - 100, y: rect.top - 10 });
  };

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

  // ─────────────────────────────────────────────────────────────
  // HALF-DAY LEAVE
  // ─────────────────────────────────────────────────────────────
  if (isHalfDayLeave) {
    const halfDayLabel = halfDayType === 'first' ? 'First Half Leave' : 'Second Half Leave';
    const leaveColor = halfDayType === 'first' ? 'from-indigo-400 to-indigo-500' : 'from-indigo-500 to-indigo-600';
    const leaveLeftPct = halfDayType === 'first' ? 0 : 50;
    const leaveWidthPct = 50;

    const isInWorkingHalf = (punchMin) => {
      if (!punchMin) return false;
      return halfDayType === 'first'
        ? punchMin >= NOON_MINUTES
        : punchMin < NOON_MINUTES;
    };

    let allSessions = [];
    if (day.sessions && day.sessions.length > 0) {
      allSessions = day.sessions;
    } else if (day.punchInUTC) {
      allSessions = [{ punchInUTC: day.punchInUTC, punchOutUTC: day.punchOutUTC || null }];
    }

    const workSessions = allSessions.filter(s => {
      if (!s.punchInUTC) return false;
      const punchMin = minutesOfDayIST(s.punchInUTC);
      return punchMin !== null && isInWorkingHalf(punchMin);
    });

    const totalEffectiveHours = workSessions.reduce(
      (sum, s) => sum + (s.punchOutUTC ? calculateHours(s.punchInUTC, s.punchOutUTC) : 0), 0
    );

    const hasInProgress = workSessions.some(s => s.punchInUTC && !s.punchOutUTC);

    return (
      <div className="pt-2 pb-0.5 relative" onMouseLeave={handleBarMouseLeave}>
        <div className="relative h-1 rounded-full bg-slate-100">
          <div
            className={`absolute top-0 h-1 rounded-full bg-gradient-to-r ${leaveColor}`}
            style={{ left: `${leaveLeftPct}%`, width: `${leaveWidthPct}%` }}
          />

          {workSessions.map((session, idx) => {
            const startMin = clampToTrack(minutesOfDayIST(session.punchInUTC));
            const endMin = session.punchOutUTC
              ? clampToTrack(minutesOfDayIST(session.punchOutUTC))
              : clampToTrack(startMin + 2);

            const segLeftPct = ((startMin - trackStart) / TRACK_TOTAL_MIN) * 100;
            const segWidthPct = Math.max(1, ((endMin - startMin) / TRACK_TOTAL_MIN) * 100);

            return (
              <div
                key={`work-${idx}`}
                className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all duration-200"
                style={{ left: `${segLeftPct}%`, width: `${segWidthPct}%` }}
                onMouseEnter={(e) => handleSessionHover(e, session, idx, workSessions.length)}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] font-medium text-indigo-600 flex items-center gap-1">
            <CalendarIcon size={10} className="text-indigo-500" />
            {halfDayLabel}
            {(totalEffectiveHours > 0 || hasInProgress) && (
              <span className="text-[8px] font-medium text-emerald-600 ml-1">
                (Worked: {totalEffectiveHours > 0 ? formatHours(totalEffectiveHours) : 'In progress'})
              </span>
            )}
          </span>
          {totalEffectiveHours > 0 && (
            <span className="text-[8px] font-medium text-emerald-600">{formatHours(totalEffectiveHours)}</span>
          )}
          {hasInProgress && !totalEffectiveHours && (
            <span className="text-[8px] font-medium text-amber-600">In progress</span>
          )}
        </div>

        <HoverTooltip session={hoveredSession} breakInfo={hoveredBreak} position={tooltipPosition} />
      </div>
    );
  }

  // Full day leave
  if (day.status === 'leave') {
    return (
      <div className="pt-2 pb-0.5 relative">
        <div className="relative h-1 rounded-full bg-slate-100">
          <div className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-500" style={{ left: '0%', width: '100%' }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] font-medium text-indigo-600 flex items-center gap-1">
            <CalendarIcon size={10} className="text-indigo-500" />
            Full Day Leave
          </span>
        </div>
      </div>
    );
  }

  if (!hasPunchIn) {
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
      const endMin = clampToTrack(minutesOfDayIST(day.punchOutUTC) || startMin + 5);
      const leftPct = ((startMin - trackStart) / TRACK_TOTAL_MIN) * 100;
      const widthPct = Math.max(1, ((endMin - startMin) / TRACK_TOTAL_MIN) * 100);
      return <div className={`absolute top-0 h-1 rounded-full bg-gradient-to-r ${styles.bar}`} style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />;
    }

    const elements = [];
    const totalSegments = day.sessions.length;

    day.sessions.forEach((session, idx) => {
      if (!session.punchInUTC) return;

      const startMin = clampToTrack(minutesOfDayIST(session.punchInUTC));
      const isLast = idx === totalSegments - 1;
      const endMin = session.punchOutUTC ? clampToTrack(minutesOfDayIST(session.punchOutUTC)) : clampToTrack(startMin + 2);
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
        const label = session.punchOutUTC ? formatTimeDisplay(session.punchOutUTC) : '';
        elements.push(
          <div key={`end-m-${idx}`} className="absolute -top-3 flex flex-col items-center z-10" style={{ left: `${leftPct + widthPct}%`, transform: 'translateX(-90%)' }}>
            <span className={`text-[7px] font-semibold ${!session.punchOutUTC ? 'text-rose-500' : 'text-slate-500'} whitespace-nowrap`}>{label}</span>
          </div>
        );
      }

      if (!isLast && session.punchOutUTC && day.sessions[idx + 1]?.punchInUTC) {
        const gapStart = clampToTrack(minutesOfDayIST(session.punchOutUTC));
        const gapEnd = clampToTrack(minutesOfDayIST(day.sessions[idx + 1].punchInUTC));
        const gapMinutes = gapEnd - gapStart;

        if (gapMinutes >= 5) {
          const gLeft = ((gapStart - trackStart) / TRACK_TOTAL_MIN) * 100;
          const gWidth = Math.max(0, ((gapEnd - gapStart) / TRACK_TOTAL_MIN) * 100);
          const breakGap = day.breakGaps && day.breakGaps.find(b => Math.abs(b.minutes - gapMinutes) < 0.1);

          elements.push(
            <div
              key={`break-${idx}`}
              className="absolute top-0 h-1 rounded-full bg-amber-200/60 cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all duration-200"
              style={{ left: `${gLeft}%`, width: `${gWidth}%`, minWidth: '4px' }}
              onMouseEnter={(e) => breakGap && handleBreakHover(e, breakGap, idx)}
            />
          );
        }
      }
    });

    return elements;
  };

  return (
    <div className="pt-2 pb-0.5 relative" onMouseLeave={handleBarMouseLeave}>
      <div className="relative h-1 rounded-full bg-slate-100">{renderSegments()}</div>

      <div className="flex items-center justify-between mt-1">
        
        {day.grossHours > 0 && day.grossHours !== day.effectiveHours && (
          <span className="text-[8px] font-medium text-slate-400">Gross: {formatHours(day.grossHours)}</span>
        )}
        {day.breakMinutes > 0 && (
          <span className="inline-flex items-center gap-1 text-[8px] font-medium text-slate-400">
            <Coffee size={10} className="text-amber-500" />
            {formatBreakMinutes(day.breakMinutes)}
          </span>
        )}
      </div>

      <HoverTooltip session={hoveredSession} breakInfo={hoveredBreak} position={tooltipPosition} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const AttendanceCombined = ({ userId, token }) => {
  const { isCollapsed } = useSidebar();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [loading, setLoading] = useState(true);
  const [rawAttendanceData, setRawAttendanceData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const DAYS_PER_PAGE = 10;
  const [stats, setStats] = useState({
    totalDays: 0, present: 0, absent: 0, late: 0, onLeave: 0, weekends: 0, holidays: 0,
    totalEffectiveHours: 0, totalGrossHours: 0, averageEffectiveHours: 0, averageGrossHours: 0, weeklyAverages: []
  });

  const [shiftConfig, setShiftConfig] = useState({
    shiftHour: DEFAULT_SHIFT_HOUR, shiftMinute: DEFAULT_SHIFT_MINUTE, shiftAmPm: 'AM',
    gracePeriod: GRACE_PERIOD_MINUTES, isLoading: true
  });
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) yearOptions.push(y);

  // ─────────────────────────────────────────────────────────────
  // FETCH helpers
  // ─────────────────────────────────────────────────────────────
  const fetchUserProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/employee/profile`, authHeader);
      if (res.data.success) {
        const profile = res.data.data;
        setShiftConfig({
          shiftHour: profile.shiftHour || DEFAULT_SHIFT_HOUR,
          shiftMinute: profile.shiftMinute || DEFAULT_SHIFT_MINUTE,
          shiftAmPm: profile.shiftAmPm || 'AM',
          gracePeriod: GRACE_PERIOD_MINUTES,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setShiftConfig({ shiftHour: DEFAULT_SHIFT_HOUR, shiftMinute: DEFAULT_SHIFT_MINUTE, shiftAmPm: 'AM', gracePeriod: GRACE_PERIOD_MINUTES, isLoading: false });
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/holidays`, authHeader);
      if (res.data.success) setHolidays(res.data.data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    }
  };

  const fetchLeaves = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/leaves/history?status=approved`, authHeader);
      if (res.data.success) setLeaves(res.data.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setLeaves([]);
    }
  };

  const toUTCDateString = (dateLike) => {
    const date = new Date(dateLike);
    if (isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isHoliday = useCallback((dateStr) => {
    const dateString = toUTCDateString(dateStr);
    if (!dateString) return null;
    return holidays.find(h => toUTCDateString(h.date) === dateString) || null;
  }, [holidays]);

  const getLeaveForDate = useCallback((dateStr) => {
    const dateString = toUTCDateString(dateStr);
    if (!dateString) return null;
    const checkDate = new Date(dateString + 'T00:00:00.000Z');
    return leaves.find(l => {
      if (l.status !== 'approved') return false;
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return checkDate >= start && checkDate <= end;
    }) || null;
  }, [leaves]);

  const isLatePunchWithShift = useCallback((punchTime) => {
    if (!punchTime || shiftConfig.isLoading) return false;
    const punchMinutes = minutesOfDayIST(punchTime);
    if (punchMinutes === null) return false;
    const shiftStartMinutes = getShiftStartMinutes(shiftConfig.shiftHour, shiftConfig.shiftMinute, shiftConfig.shiftAmPm);
    const gracePeriod = shiftConfig.gracePeriod || 15;
    return punchMinutes > shiftStartMinutes + gracePeriod;
  }, [shiftConfig]);

  // ─────────────────────────────────────────────────────────────
  // DERIVE attendanceData
  // ─────────────────────────────────────────────────────────────
  const attendanceData = useMemo(() => {
    return rawAttendanceData.map(day => {
      const holidayData = isHoliday(day.date);
      const isHolidayDay = !!holidayData;
      const leaveData = getLeaveForDate(day.date);
      const isLeaveDay = !!leaveData;
      const isLate = isLatePunchWithShift(day.punchInUTC);

      let status = day.status;
      if (isHolidayDay) status = 'holiday';
      else if (isLeaveDay) status = 'leave';
      else if (!day.punchInUTC) status = 'absent';
      else if (isLate) status = 'late';
      else status = 'present';

      return {
        ...day,
        isHoliday: isHolidayDay,
        holidayName: holidayData ? holidayData.name : null,
        isHalfDay: leaveData ? leaveData.isHalfDay || false : false,
        halfDayType: leaveData ? leaveData.halfDayType || null : null,
        leaveType: leaveData ? leaveData.leaveType : null,
        status,
        isLate,
        shiftConfig
      };
    });
  }, [rawAttendanceData, isHoliday, getLeaveForDate, isLatePunchWithShift, shiftConfig]);

  // ─────────────────────────────────────────────────────────────
  // FETCH ATTENDANCE DATA
  // ─────────────────────────────────────────────────────────────
  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/employee/attendance/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months: 12 }
      });

      if (response.data.success) {
        const data = response.data.data;

        const processedDays = (data.days || []).map(day => {
          const sessions = (day.sessions && day.sessions.length > 0) ? day.sessions : [];

          let effectiveMs = 0;
          let firstInMs = null;
          let lastOutMs = null;
          let lastOutUTC = null;

          sessions.forEach((session) => {
            if (!session.punchInUTC) return;

            const inMs = new Date(session.punchInUTC).getTime();
            if (isNaN(inMs)) return;

            if (firstInMs === null || inMs < firstInMs) firstInMs = inMs;

            if (session.punchOutUTC) {
              const outMs = new Date(session.punchOutUTC).getTime();
              if (isNaN(outMs)) return;

              const sessionMs = outMs - inMs;
              if (sessionMs > 0) effectiveMs += sessionMs;

              if (lastOutMs === null || outMs > lastOutMs) {
                lastOutMs = outMs;
                lastOutUTC = session.punchOutUTC;
              }
            }
          });

          if (sessions.length === 0 && day.punchInUTC) {
            const inMs = new Date(day.punchInUTC).getTime();
            if (!isNaN(inMs)) {
              firstInMs = inMs;
              if (day.punchOutUTC) {
                const outMs = new Date(day.punchOutUTC).getTime();
                if (!isNaN(outMs) && outMs > inMs) {
                  effectiveMs = outMs - inMs;
                  lastOutMs = outMs;
                  lastOutUTC = day.punchOutUTC;
                }
              }
            }
          }

          const grossHours = (firstInMs !== null && lastOutMs !== null && lastOutMs > firstInMs)
            ? (lastOutMs - firstInMs) / (1000 * 60 * 60)
            : (effectiveMs / (1000 * 60 * 60));

          let effectiveHours = effectiveMs / (1000 * 60 * 60);
          if (effectiveHours <= 0 && grossHours > 0) {
            effectiveHours = grossHours;
          }

          const safeEffectiveHours = Math.min(effectiveHours, grossHours);

          const breakMinutes = grossHours > safeEffectiveHours
            ? (grossHours - safeEffectiveHours) * 60
            : 0;

          const breakGaps = [];
          for (let i = 0; i < sessions.length - 1; i++) {
            const currentOut = sessions[i].punchOutUTC;
            const nextIn = sessions[i + 1]?.punchInUTC;
            if (!currentOut || !nextIn) continue;

            const gapMs = new Date(nextIn).getTime() - new Date(currentOut).getTime();
            if (gapMs > 0 && gapMs / 60000 >= 5) {
              breakGaps.push({
                start: currentOut,
                end: nextIn,
                minutes: gapMs / 60000,
                breakIndex: i
              });
            }
          }

          return {
            ...day,
            sessions,
            punchInDisplay: day.punchInUTC ? formatTimeDisplay(day.punchInUTC) : null,
            punchOutDisplay: lastOutUTC ? formatTimeDisplay(lastOutUTC) : null,
            punchOutUTC: lastOutUTC,
            effectiveHours: safeEffectiveHours,
            grossHours,
            breakMinutes,
            breakGaps,
            totalDuration: safeEffectiveHours
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

  // ─────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────
  const calculateStatsForMonth = (days) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthDaysList = days.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      return date.getUTCMonth() === selectedMonth && date.getUTCFullYear() === selectedYear;
    });
    const sortedDays = [...monthDaysList].sort((a, b) => new Date(a.date) - new Date(b.date));

    const weeks = [];
    let currentWeek = [];
    let weekStartDate = null;
    let weekNumber = 1;

    for (const day of sortedDays) {
      const dayOfWeek = new Date(day.date).getUTCDay();
      if (dayOfWeek === 1 || weekStartDate === null) {
        if (currentWeek.length > 0) {
          weeks.push({ weekNumber, days: [...currentWeek] });
          weekNumber++;
        }
        currentWeek = [];
        weekStartDate = day.date;
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) weeks.push({ weekNumber, days: [...currentWeek] });

    const weeklyAverages = weeks.map((week) => {
      const daysWithoutToday = week.days.filter(day => day.date !== todayStr);
      const daysWithoutLeave = daysWithoutToday.filter(d => d.status !== 'leave' && !d.isHoliday);
      const presentDays = daysWithoutLeave.filter(d => ['present', 'late'].includes(getDisplayStatus(d)));
      const lateDays = daysWithoutLeave.filter(d => getDisplayStatus(d) === 'late');
      const totalEff = presentDays.reduce((sum, d) => sum + (d.effectiveHours || 0), 0);
      const totalGross = presentDays.reduce((sum, d) => sum + (d.grossHours || 0), 0);
      const avgEff = presentDays.length > 0 ? totalEff / presentDays.length : 0;
      const avgGross = presentDays.length > 0 ? totalGross / presentDays.length : 0;

      return {
        weekNumber: week.weekNumber,
        weekDisplay: `Week ${week.weekNumber}`,
        avgEff,
        avgGross,
        avgEffFormatted: formatHours(avgEff, { unit: 'hrmin' }),
        avgGrossFormatted: formatHours(avgGross, { unit: 'hrmin' }),
        dayCount: presentDays.length,
        lateCount: lateDays.length,
        totalDays: week.days.length,
        holidayCount: week.days.filter(d => d.isHoliday).length,
        leaveCount: week.days.filter(d => d.status === 'leave').length
      };
    });

    const workingDays = monthDaysList.filter(d => !d.isWeekend && !d.isHoliday && d.status !== 'leave');
    const daysWithoutToday = workingDays.filter(d => d.date !== todayStr);
    const presentDays = daysWithoutToday.filter(d => ['present', 'late'].includes(getDisplayStatus(d)));
    const lateDays = daysWithoutToday.filter(d => getDisplayStatus(d) === 'late');
    const absentDays = daysWithoutToday.filter(d => getDisplayStatus(d) === 'absent');
    const leaveDays = monthDaysList.filter(d => d.status === 'leave' && !d.isHoliday).length;
    const weekends = monthDaysList.filter(d => d.isWeekend).length;
    const holidaysCount = monthDaysList.filter(d => d.isHoliday).length;
    const totalEffectiveHours = presentDays.reduce((sum, d) => sum + (d.effectiveHours || 0), 0);
    const totalGrossHours = presentDays.reduce((sum, d) => sum + (d.grossHours || 0), 0);

    setStats({
      totalDays: workingDays.length + leaveDays,
      present: presentDays.length,
      absent: absentDays.length,
      late: lateDays.length,
      onLeave: leaveDays,
      weekends,
      holidays: holidaysCount,
      totalEffectiveHours,
      totalGrossHours,
      averageEffectiveHours: presentDays.length > 0 ? totalEffectiveHours / presentDays.length : 0,
      averageGrossHours: presentDays.length > 0 ? totalGrossHours / presentDays.length : 0,
      weeklyAverages
    });
  };

  // ─────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchUserProfile(); fetchHolidays(); fetchLeaves(); }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchAttendanceData();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (attendanceData.length > 0) calculateStatsForMonth(attendanceData);
  }, [selectedMonth, selectedYear, attendanceData]);

  // ─────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────
  const handleMonthSelect = (monthIndex) => { setSelectedMonth(monthIndex); setShowMonthPicker(false); };
  const handleYearSelect = (year) => { setSelectedYear(year); setShowMonthPicker(false); };
  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setShowMonthPicker(false);
  };

  const monthDays = useMemo(() => {
    return attendanceData.filter(day => {
      if (!day.date) return false;
      const date = new Date(day.date);
      return date.getUTCMonth() === selectedMonth && date.getUTCFullYear() === selectedYear;
    });
  }, [attendanceData, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(monthDays.length / DAYS_PER_PAGE));

  const paginatedMonthDays = useMemo(() => {
    const sorted = [...monthDays].sort((a, b) => new Date(b.date) - new Date(a.date));
    const startIndex = (currentPage - 1) * DAYS_PER_PAGE;
    return sorted.slice(startIndex, startIndex + DAYS_PER_PAGE);
  }, [monthDays, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const getShiftDisplay = () => {
    if (shiftConfig.isLoading) return 'Loading...';
    const { shiftHour, shiftMinute, shiftAmPm } = shiftConfig;
    return `${String(shiftHour).padStart(2, '0')}:${String(shiftMinute).padStart(2, '0')} ${shiftAmPm}`;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 size={32} className="text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading attendance...</p>
        </div>
      </div>
    );
  }

  if (attendanceData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
          <CalendarIcon size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No attendance data available</p>
        <p className="text-xs text-slate-400 mt-1">Try syncing your attendance data</p>
        <button onClick={fetchAttendanceData} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm">
          <RefreshCw size={14} className="inline mr-1" />
          Refresh Data
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 size={16} className="text-blue-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-700">Attendance Timeline</h3>

            <button
              onClick={() => {
                fetchAttendanceData();
                toast.success('Refreshing attendance data...');
              }}
              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
              title="Refresh attendance data"
            >
              <RefreshCw size={14} />
            </button>

            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMonthPicker(!showMonthPicker); }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-[10px] font-semibold text-slate-700 shadow-sm"
              >
                <span>{monthNames[selectedMonth]} {selectedYear}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showMonthPicker ? 'rotate-180' : ''}`} />
              </button>

              {showMonthPicker && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <button onClick={() => handleYearSelect(selectedYear - 1)} className="p-1 rounded-lg hover:bg-slate-100 transition-all">
                      <ChevronLeft size={12} className="text-slate-500" />
                    </button>
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearSelect(Number(e.target.value))}
                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <button onClick={() => handleYearSelect(selectedYear + 1)} className="p-1 rounded-lg hover:bg-slate-100 transition-all">
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
                    <button onClick={goToCurrentMonth} className="w-full py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-semibold hover:bg-blue-100 transition-all">
                      Go to Current Month
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-200">
              <User size={10} className="text-indigo-500" />
              <span className="text-[7px] font-bold text-indigo-600">Shift: {getShiftDisplay()}</span>
              <span className="text-[6px] text-indigo-400">(Grace: {shiftConfig.gracePeriod}m)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-100 text-[7px] font-medium text-slate-400">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div><span>On Time</span></span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span>Late</span></span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-200/60"></div><span>Break</span></span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-400"></div><span>Holiday</span></span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400"></div><span>Leave</span></span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-2 bg-slate-50/50 border-b border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-2 items-stretch">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-slate-400 uppercase tracking-wider">Working</p>
              <p className="text-base font-black text-slate-800">{stats.totalDays}</p>
            </div>
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-emerald-600 uppercase tracking-wider">On Time</p>
              <p className="text-base font-black text-emerald-700">{stats.present}</p>
            </div>
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-rose-600 uppercase tracking-wider">Absent</p>
              <p className="text-base font-black text-rose-700">{stats.absent}</p>
            </div>
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-amber-600 uppercase tracking-wider">Late</p>
              <p className="text-base font-black text-amber-700">{stats.late}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 size={11} className="text-blue-500 flex-shrink-0" />
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Weekly Averages</span>
              </div>
              <span className="text-[6px] text-slate-400 whitespace-nowrap">Excluding today & holidays/leaves</span>
            </div>
            {stats.weeklyAverages && stats.weeklyAverages.length > 0 ? (
              <AverageBarChart weeklyAverages={stats.weeklyAverages} />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[70px]">
                <span className="text-[8px] text-slate-400">No weekly data available</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-indigo-600 uppercase tracking-wider">Leave</p>
              <p className="text-base font-black text-indigo-700">{stats.onLeave}</p>
            </div>
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100">
              <p className="text-[6px] font-bold text-purple-600 uppercase tracking-wider">Holidays</p>
              <p className="text-base font-black text-purple-700">{stats.holidays}</p>
            </div>
            <div className="text-center bg-white rounded-lg py-2 px-1.5 shadow-sm border border-slate-100 col-span-2">
              <p className="text-[6px] font-bold text-slate-600 uppercase tracking-wider">Avg Gross</p>
              <p className="text-[10px] sm:text-xs font-black text-slate-700 mt-1 leading-tight">{formatHours(stats.averageGrossHours, { unit: 'hrmin' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {['Date', 'Day', 'Status', 'Timeline', 'In', 'Last Out', 'Gross', 'Arrival'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left text-[7px] font-bold uppercase text-slate-400 tracking-wider">{h}</th>
              ))}
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
              paginatedMonthDays.map((day, idx) => {
                const isHolidayDay = day.isHoliday || false;
                const holidayName = day.holidayName || null;
                const isLeaveDay = day.status === 'leave';
                const isHalfDayLeave = isLeaveDay && day.isHalfDay && !!day.halfDayType;
                const isFullDayLeaveOnly = isLeaveDay && !isHalfDayLeave;
                const halfDayLabel = isHalfDayLeave ? (day.halfDayType === 'first' ? 'First Half' : 'Second Half') : null;
                const displayStatus = getDisplayStatus(day);
                const styles = isHolidayDay ? STATUS_STYLES.holiday : (STATUS_STYLES[displayStatus] || STATUS_STYLES.default);
                const hasIn = !!(day.punchInUTC || (day.sessions && day.sessions.length > 0));
                const today = isToday(day.date);
                const isWeekend = day.isWeekend || false;

                const shiftStartMinutes = shiftConfig.isLoading ? null : getShiftStartMinutes(shiftConfig.shiftHour, shiftConfig.shiftMinute, shiftConfig.shiftAmPm);
                const arrivalStatus = getArrivalStatus(day, shiftStartMinutes, shiftConfig.gracePeriod);

                let outDisplay = '—';
                if (!isWeekend && !isHolidayDay && !isFullDayLeaveOnly && hasIn) {
                  outDisplay = day.punchOutUTC ? formatTimeDisplay(day.punchOutUTC) : 'No Out Punch';
                }
                const hideWorkData = isHolidayDay || isFullDayLeaveOnly;

                return (
                  <tr
                    key={idx}
                    className={`transition-all ${today ? 'bg-blue-50/30' : ''} ${isHolidayDay ? 'bg-purple-50/20' : ''} ${isLeaveDay ? 'bg-indigo-50/20' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] font-medium ${today ? 'text-blue-600 font-bold' : isHolidayDay ? 'text-purple-600' : isLeaveDay ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {formatDateDisplay(day.date)}
                      </span>
                      {today && <span className="ml-1 text-[7px] font-bold bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">Today</span>}
                      {isHolidayDay && (
                        <span className="ml-1 text-[7px] font-bold bg-purple-100 text-purple-600 px-1 py-0.5 rounded-full flex items-center gap-0.5">
                          <Gift size={8} />Holiday
                        </span>
                      )}
                      {isLeaveDay && (
                        <span className="ml-1 text-[7px] font-bold bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-full flex items-center gap-0.5">
                          <CalendarIcon size={8} />
                          {isHalfDayLeave ? `${halfDayLabel} Leave` : 'Leave'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5"><span className="text-[10px] font-medium text-slate-500">{getDayShortName(day.date)}</span></td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold border ${styles.chip}`}>
                        {getStatusIcon(displayStatus)}
                        {getStatusLabel(displayStatus)}
                        {displayStatus === 'late' && <span className="text-[6px] text-amber-500 ml-0.5">(Grace: {shiftConfig.gracePeriod}m)</span>}
                      </span>
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
                      ) : (isLeaveDay || hasIn) ? (
                        <DayTimelineBar day={day} />
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] font-mono font-medium text-slate-700">
                        {hideWorkData ? '—' : (day.punchInDisplay || '—')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] font-mono font-medium ${hideWorkData || isWeekend ? 'text-slate-400' : outDisplay === 'No Out Punch' ? 'text-rose-500 font-bold' : 'text-slate-700'}`}>
                        {hideWorkData ? '—' : outDisplay}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] font-bold text-slate-700">
                        {isWeekend || hideWorkData
                          ? '—'
                          : (day.grossHours > 0
                              ? formatHours(day.grossHours, { unit: 'hrmin' })
                              : '0 hr 0 min')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] font-medium ${isFullDayLeaveOnly ? 'text-indigo-600' : displayStatus === 'late' ? 'text-amber-600' : displayStatus === 'present' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isHolidayDay ? '🎉' : (isWeekend || isFullDayLeaveOnly ? '—' : arrivalStatus)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {monthDays.length > DAYS_PER_PAGE && (
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[8px] text-slate-400">
            Showing <span className="font-semibold text-slate-600">{((currentPage - 1) * DAYS_PER_PAGE) + 1}</span>–
            <span className="font-semibold text-slate-600">{Math.min(currentPage * DAYS_PER_PAGE, monthDays.length)}</span> of{' '}
            <span className="font-semibold text-slate-600">{monthDays.length}</span> days
          </p>

          <div className="flex items-center justify-center gap-1">
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
              className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center transition-all hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Previous page">
              <ChevronLeft size={11} className="text-slate-600" />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
              <button
                type="button"
                key={page}
                onClick={() => goToPage(page)}
                className={`min-w-6 h-6 px-1 rounded-md text-[8px] font-bold transition-all ${currentPage === page ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
              >
                {page}
              </button>
            ))}

            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
              className="w-6 h-6 rounded-md border border-slate-200 bg-white flex items-center justify-center transition-all hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Next page">
              <ChevronRight size={11} className="text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCombined;