// frontend/src/pages/WorkReport.jsx

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Search,
  Calendar,
  Users,
  Clock,
  Rss,
  Ticket as TicketIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  Briefcase,
  BarChart3,
  CalendarDays,
  Hash,
  Timer,
  AlertCircle,
  Activity,
  Info
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

// Default date: yesterday (avoids showing today's still-in-progress data)
function defaultDate() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate());
  return yesterday.toISOString().split('T')[0];
}

// ============================================
// SHARED FORMATTERS (copied from Worklog.jsx)
// ============================================
const formatTimeWithSeconds = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

// ============================================
// INTERVAL MERGE HELPERS (copied from Worklog.jsx)
// ============================================
const mergeIntervals = (intervals) => {
  if (!intervals || intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
};

const WorkReport = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [developers, setDevelopers] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState('');
  const [selectedDate, setSelectedDate] = useState(defaultDate());

  const [loading, setLoading] = useState(false);
  const [loadingDevs, setLoadingDevs] = useState(true);
  const [report, setReport] = useState(null);

  const [expandedFeed, setExpandedFeed] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'ticket'

  // ============================================
  // FETCH DEVELOPERS
  // ============================================
  useEffect(() => {
    const fetchDevelopers = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/work-report/developers`, authHeader);
        if (res.data.success) {
          setDevelopers(res.data.developers || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load developers');
      } finally {
        setLoadingDevs(false);
      }
    };
    fetchDevelopers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // FETCH REPORT (single day = startDate === endDate)
  // ============================================
  const fetchReport = async () => {
    if (!selectedDeveloper) {
      toast.error('Please select a developer');
      return;
    }
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    setLoading(true);
    setReport(null);
    try {
      const params = {
        developerId: selectedDeveloper,
        startDate: selectedDate,
        endDate: selectedDate
      };

      const res = await axios.get(`${API_BASE_URL}/api/work-report`, {
        ...authHeader,
        params
      });

      if (res.data.success) {
        setReport(res.data);
      } else {
        toast.error('Failed to generate report');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when developer changes (with a saved date)
  useEffect(() => {
    if (selectedDeveloper) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeveloper]);

  // ============================================
  // FILTERED LISTS
  // ============================================
  const filteredFeeds = useMemo(() => {
    if (!report?.perFeed) return [];
    if (!searchTerm.trim()) return report.perFeed;
    const s = searchTerm.toLowerCase();
    return report.perFeed.filter(f =>
      f.feedName?.toLowerCase().includes(s) ||
      f.projectCustomId?.toLowerCase().includes(s) ||
      f.projectName?.toLowerCase().includes(s)
    );
  }, [report, searchTerm]);

  const filteredTickets = useMemo(() => {
    if (!report?.perTicket) return [];
    if (!searchTerm.trim()) return report.perTicket;
    const s = searchTerm.toLowerCase();
    return report.perTicket.filter(t =>
      t.ticketNumber?.toLowerCase().includes(s) ||
      t.ticketTitle?.toLowerCase().includes(s) ||
      t.projectCustomId?.toLowerCase().includes(s)
    );
  }, [report, searchTerm]);

  // ============================================
  // STATS — EXACT SAME LOGIC AS Worklog.jsx
  // ============================================
  /*
    NOTE ON DATA SHAPE:

    In Worklog.jsx (live view), each item has:
      - feed.worklog = { totalTime, isRunning, startedAt, timeBlocks: [{startTime, endTime}] }

    In WorkReport (historical/day view), the API returns per-feed / per-ticket
    aggregates with:
      - entries: [{ date, seconds, formatted, description }]
      - totalHours (hours, float)
      - totalFormatted (h/m/s string)
      - totalSeconds (if backend provides it; else we compute from totalHours)

    To replicate Worklog.jsx's overlap-aware stat, we reconstruct per-day
    intervals from the entries. The report is single-day here, but the logic
    is identical to Worklog's `getAllTimeIntervals` + `mergeIntervals`.
  */

  // Total individual time (sum of every feed's + ticket's seconds) — matches
  // Worklog's `totalIndividualTime` (getFeedTime / getTicketTime sums).
  const totalIndividualTime = useMemo(() => {
    if (!report) return 0;

    const feedTotal = (report.perFeed || []).reduce(
      (sum, f) => sum + (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)),
      0
    );
    const ticketTotal = (report.perTicket || []).reduce(
      (sum, t) => sum + (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)),
      0
    );
    return feedTotal + ticketTotal;
  }, [report]);

  // Actual working time (overlap-aware) — matches Worklog's `calculateActualWorkingTime`.
  //
  // In Worklog.jsx, intervals are built from timeBlocks + live running timers.
  // Here we build intervals from the per-day entries. Because the report is
  // single-day, we treat each entry as a full-day block scoped to that date.
  // We derive interval start/end from the entry date; if the backend ever
  // exposes startTime/endTime per entry, this will use those directly.
  const actualWorkingTime = useMemo(() => {
    if (!report) return 0;

    const collectIntervals = (items) => {
      const intervals = [];
      (items || []).forEach((item) => {
        (item.entries || []).forEach((entry) => {
          // Prefer explicit interval fields if the backend sends them.
          if (entry.startTime && entry.endTime) {
            intervals.push({
              start: new Date(entry.startTime).getTime(),
              end: new Date(entry.endTime).getTime()
            });
            return;
          }

          // Otherwise reconstruct from `date` + `seconds` for that day.
          const seconds = entry.seconds ?? Math.round((entry.hours || 0) * 3600);
          if (!entry.date || seconds <= 0) return;

          // Anchor intervals to the entry's date at 00:00 local time, then
          // place the block using a canonical day-relative offset. This keeps
          // overlap detection deterministic across feeds/tickets on the same day.
          const dayStart = new Date(`${entry.date}T00:00:00`).getTime();
          intervals.push({
            start: dayStart,
            end: dayStart + seconds * 1000
          });
        });
      });
      return intervals;
    };

    const intervals = [
      ...collectIntervals(report.perFeed),
      ...collectIntervals(report.perTicket)
    ];

    // Same fallback as Worklog.jsx: if no intervals, return sum of totals.
    if (intervals.length === 0) {
      return totalIndividualTime;
    }

    const merged = mergeIntervals(intervals);
    const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
    return Math.floor(totalMs / 1000);
  }, [report, totalIndividualTime]);

  // Overlap — matches Worklog.jsx: max(0, totalIndividualTime - actualWorkingTime)
  const overlapTime = useMemo(
    () => Math.max(0, totalIndividualTime - actualWorkingTime),
    [totalIndividualTime, actualWorkingTime]
  );

  // Active timers — in a historical report, running timers are usually 0,
  // but we keep the same shape as Worklog.jsx so the UI is consistent.
  const activeRunningCount = useMemo(() => {
    if (!report) return 0;
    const feedRunning = (report.perFeed || []).filter(f => f.isRunning).length;
    const ticketRunning = (report.perTicket || []).filter(t => t.isRunning).length;
    return feedRunning + ticketRunning;
  }, [report]);

  // Ticket timers running (mirrors Worklog's purple "Ticket Timers" stat)
  const ticketRunningCount = useMemo(() => {
    if (!report) return 0;
    return (report.perTicket || []).filter(t => t.isRunning).length;
  }, [report]);

  // ============================================
  // RESET
  // ============================================
  const handleReset = () => {
    setSelectedDate(defaultDate());
    setSearchTerm('');
    if (selectedDeveloper) {
      setTimeout(fetchReport, 0);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* HEADER */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Work Report
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-1">
            Developer Activity & Time Tracking
          </p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading || !selectedDeveloper}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Developer */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Users size={11} /> Developer
            </label>
            <select
              value={selectedDeveloper}
              onChange={(e) => setSelectedDeveloper(e.target.value)}
              disabled={loadingDevs}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 font-semibold text-sm outline-none focus:border-blue-500 bg-slate-50 cursor-pointer"
            >
              <option value="">
                {loadingDevs ? 'Loading...' : 'Select a developer'}
              </option>
              {developers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} {d.employeeCode ? `(${d.employeeCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Single Date */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Calendar size={11} /> Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 font-semibold text-sm outline-none focus:border-blue-500 bg-slate-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button
              onClick={fetchReport}
              disabled={loading || !selectedDeveloper}
              className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Generate
            </button>
            <button
              onClick={handleReset}
              className="h-10 px-4 rounded-lg bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* EMPTY STATE */}
      {!loading && !report && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            Select a developer and date to view the work report
          </p>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">Generating work report...</p>
        </div>
      )}

      {/* REPORT CONTENT */}
      {report && !loading && (
        <>
          {/* UNIFIED REPORT HEADER + SUMMARY */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
            {/* Header Strip - Developer Info */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-700 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">
                  Report For
                </p>
                <h2 className="text-lg font-black mt-0.5 truncate">
                  {report.developer.name}
                </h2>
                <p className="text-[11px] opacity-70 truncate">
                  {report.developer.email}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {report.developer.employeeCode && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-lg border border-white/10">
                    {report.developer.employeeCode}
                  </span>
                )}
                <span className="text-[9px] font-black uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-lg border border-white/10">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* ============================================
                STATS BAR — MIRRORS Worklog.jsx EXACTLY
                ============================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4">
              {/* Actual Time */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Timer size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                      Actual Time
                    </p>
                    <p className="text-sm font-black text-blue-700 font-mono">
                      {formatTimeWithSeconds(actualWorkingTime)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Overlap */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertCircle size={14} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                      Overlap
                    </p>
                    <p className="text-sm font-black text-amber-700 font-mono">
                      {formatTimeWithSeconds(overlapTime)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Timers */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Activity size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                      Active Timers
                    </p>
                    <p className="text-sm font-black text-emerald-600">
                      {activeRunningCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ticket Timers */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <TicketIcon size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                      Ticket Timers
                    </p>
                    <p className="text-sm font-black text-purple-600">
                      {ticketRunningCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* INFO NOTE — shown when multiple overlapping entries exist */}
            {overlapTime > 0 && (
              <div className="px-4 pb-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-black text-blue-700">
                        Overlapping work detected
                      </p>
                      <p className="text-[8px] text-blue-600 mt-0.5">
                        Time is counted only once in "Actual Time" (overlapping periods are merged)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TABS */}
          <div className="flex gap-2 mb-4 border-b border-slate-200">
            <button
              onClick={() => { setActiveTab('feed'); setSearchTerm(''); }}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'feed'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Rss size={14} /> Feeds ({report.perFeed.length})
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('ticket'); setSearchTerm(''); }}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'ticket'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <TicketIcon size={14} /> Tickets ({report.perTicket.length})
              </div>
            </button>

            <div className="ml-auto relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'feed' ? 'Search feeds...' : 'Search tickets...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 bg-white w-56"
              />
            </div>
          </div>

          {/* FEED TAB */}
          {activeTab === 'feed' && (
            <div className="space-y-3">
              {filteredFeeds.length === 0 ? (
                <EmptyState text="No feed activity for this date" />
              ) : (
                filteredFeeds.map((feed) => {
                  const isExpanded = expandedFeed === feed.feedId;
                  return (
                    <div
                      key={feed.feedId}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                    >
                      <div
                        onClick={() =>
                          setExpandedFeed(isExpanded ? null : feed.feedId)
                        }
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <Rss size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">
                              {feed.feedName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                <Briefcase size={9} />
                                {feed.projectCustomId}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                • {feed.daysWorked} day{feed.daysWorked === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-700 font-mono">
                              {feed.totalFormatted}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400">
                              {feed.totalHours} hrs
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            Daily Breakdown
                          </p>
                          <div className="space-y-2">
                            {feed.entries.map((e, idx) => (
                              <div
                                key={idx}
                                className="bg-white rounded-lg border border-slate-200 p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Hash size={10} className="text-slate-400" />
                                    {e.date}
                                  </span>
                                  <span className="text-xs font-black text-emerald-700 font-mono">
                                    {e.formatted}
                                  </span>
                                </div>
                                {e.description ? (
                                  <p className="text-[11px] text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded mt-1">
                                    {e.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] italic text-slate-400 mt-1">
                                    No description recorded
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TICKET TAB */}
          {activeTab === 'ticket' && (
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <EmptyState text="No ticket activity for this date" />
              ) : (
                filteredTickets.map((ticket) => {
                  const isExpanded = expandedTicket === ticket.ticketId;
                  return (
                    <div
                      key={ticket.ticketId}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                    >
                      <div
                        onClick={() =>
                          setExpandedTicket(isExpanded ? null : ticket.ticketId)
                        }
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                            <TicketIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">
                              #{ticket.ticketNumber} — {ticket.ticketTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                <Briefcase size={9} />
                                {ticket.projectCustomId}
                              </span>
                              {ticket.status && (
                                <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {ticket.status}
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-slate-400">
                                • {ticket.daysWorked} day{ticket.daysWorked === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-black text-purple-700 font-mono">
                              {ticket.totalFormatted}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400">
                              {ticket.totalHours} hrs
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            Daily Breakdown
                          </p>
                          <div className="space-y-2">
                            {ticket.entries.map((e, idx) => (
                              <div
                                key={idx}
                                className="bg-white rounded-lg border border-slate-200 p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Hash size={10} className="text-slate-400" />
                                    {e.date}
                                  </span>
                                  <span className="text-xs font-black text-purple-700 font-mono">
                                    {e.formatted}
                                  </span>
                                </div>
                                {e.description ? (
                                  <p className="text-[11px] text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded mt-1">
                                    {e.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] italic text-slate-400 mt-1">
                                    No description recorded
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const InlineStat = ({ icon, color, label, value, sub }) => (
  <div className="px-4 py-3 flex flex-col gap-1">
    <div className={`flex items-center gap-1.5 ${color}`}>
      {icon}
      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
    </div>
    <p className="text-base font-black text-slate-800 leading-tight">{value}</p>
    {sub && <p className="text-[10px] font-medium text-slate-400">{sub}</p>}
  </div>
);

const EmptyState = ({ text }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center">
    <BarChart3 size={36} className="text-slate-300 mx-auto mb-2" />
    <p className="text-xs font-bold text-slate-500">{text}</p>
  </div>
);

export default WorkReport;