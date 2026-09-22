// frontend/src/pages/WorkReport.jsx - FULL UPDATED
// - Supports "All Developers" mode (loops over every dev in parallel)
// - Hides feeds/tickets with zero logged time
// - Per-developer expand/collapse + tab state

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
  Hash,
  Timer,
  AlertCircle,
  Activity,
  Info,
  AlertTriangle,
  Layers,
  TrendingUp
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
// SHARED FORMATTERS
// ============================================
const formatTimeWithSeconds = (seconds) => {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

// ============================================
// INTERVAL MERGE HELPERS
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

// ============================================
// SYSTEM AUTO-STOP BADGE
// ============================================
const SystemBadge = ({ title }) => (
  <span
    className="text-[8px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full uppercase inline-flex items-center gap-1"
    title={
      title ||
      'This timer was automatically stopped by the system at 11:55 PM'
    }
  >
    <AlertTriangle size={8} />
    System
  </span>
);

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ text, icon: Icon = BarChart3 }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center">
    <Icon size={36} className="text-slate-300 mx-auto mb-2" />
    <p className="text-xs font-bold text-slate-500">{text}</p>
  </div>
);

// ============================================
// PER-DEVELOPER REPORT BLOCK
// ============================================
const DeveloperReportBlock = ({ report, selectedDate }) => {
  const [activeTab, setActiveTab] = useState('feed');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFeed, setExpandedFeed] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);

  // ============================================
  // FILTER: drop zero-time feeds/tickets (defensive)
  // ============================================
  const perFeed = useMemo(() => {
    return (report.perFeed || []).filter(
      f => (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)) > 0
    );
  }, [report]);

  const perTicket = useMemo(() => {
    return (report.perTicket || []).filter(
      t => (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)) > 0
    );
  }, [report]);

  // ============================================
  // FILTERED LISTS (search)
  // ============================================
  const filteredFeeds = useMemo(() => {
    if (!searchTerm.trim()) return perFeed;
    const s = searchTerm.toLowerCase();
    return perFeed.filter(f =>
      f.feedName?.toLowerCase().includes(s) ||
      f.projectCustomId?.toLowerCase().includes(s) ||
      f.projectName?.toLowerCase().includes(s)
    );
  }, [perFeed, searchTerm]);

  const filteredTickets = useMemo(() => {
    if (!searchTerm.trim()) return perTicket;
    const s = searchTerm.toLowerCase();
    return perTicket.filter(t =>
      t.ticketNumber?.toLowerCase().includes(s) ||
      t.ticketTitle?.toLowerCase().includes(s) ||
      t.projectCustomId?.toLowerCase().includes(s)
    );
  }, [perTicket, searchTerm]);

  // ============================================
  // STATS
  // ============================================
  const totalIndividualTime = useMemo(() => {
    const feedTotal = perFeed.reduce(
      (sum, f) => sum + (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)),
      0
    );
    const ticketTotal = perTicket.reduce(
      (sum, t) => sum + (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)),
      0
    );
    return feedTotal + ticketTotal;
  }, [perFeed, perTicket]);

  const actualWorkingTime = useMemo(() => {
    const collectIntervals = (items) => {
      const intervals = [];
      (items || []).forEach((item) => {
        (item.entries || []).forEach((entry) => {
          if (entry.startTime && entry.endTime) {
            intervals.push({
              start: new Date(entry.startTime).getTime(),
              end: new Date(entry.endTime).getTime()
            });
            return;
          }
          const seconds = entry.seconds ?? Math.round((entry.hours || 0) * 3600);
          if (!entry.date || seconds <= 0) return;
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
      ...collectIntervals(perFeed),
      ...collectIntervals(perTicket)
    ];

    if (intervals.length === 0) return totalIndividualTime;
    const merged = mergeIntervals(intervals);
    const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
    return Math.floor(totalMs / 1000);
  }, [perFeed, perTicket, totalIndividualTime]);

  const overlapTime = useMemo(
    () => Math.max(0, totalIndividualTime - actualWorkingTime),
    [totalIndividualTime, actualWorkingTime]
  );

  const systemStoppedCount = useMemo(() => {
    const feedCount = perFeed.reduce(
      (sum, f) => sum + (f.entries || []).filter(e => e.stoppedBySystem).length,
      0
    );
    const ticketCount = perTicket.reduce(
      (sum, t) => sum + (t.entries || []).filter(e => e.stoppedBySystem).length,
      0
    );
    return feedCount + ticketCount;
  }, [perFeed, perTicket]);

  const hasAnyActivity = perFeed.length > 0 || perTicket.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-5 overflow-hidden">
      {/* ============================================
          DEVELOPER HEADER
          ============================================ */}
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
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
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
          {systemStoppedCount > 0 && (
            <span
              className="text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-100 px-2.5 py-1 rounded-lg border border-amber-300/30 inline-flex items-center gap-1"
              title={`${systemStoppedCount} timer(s) on this date were auto-stopped by the system`}
            >
              <AlertTriangle size={10} />
              {systemStoppedCount} System Stop{systemStoppedCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* ============================================
          STATS BAR
          ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
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

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Rss size={14} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                Feeds
              </p>
              <p className="text-sm font-black text-emerald-600">
                {perFeed.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <TicketIcon size={14} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                Tickets
              </p>
              <p className="text-sm font-black text-purple-600">
                {perTicket.length}
              </p>
            </div>
          </div>
        </div>
      </div>

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

      {/* ============================================
          NO ACTIVITY
          ============================================ */}
      {!hasAnyActivity && (
        <div className="px-4 pb-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
            <Clock size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-black text-slate-500">
              No work logged on this date
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              This developer did not track any feed or ticket time.
            </p>
          </div>
        </div>
      )}

      {/* ============================================
          TABS + CONTENT (only if activity exists)
          ============================================ */}
      {hasAnyActivity && (
        <>
          {/* TABS */}
          <div className="flex gap-2 px-4 border-b border-slate-200">
            <button
              onClick={() => { setActiveTab('feed'); setSearchTerm(''); }}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'feed'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Rss size={14} /> Feeds ({perFeed.length})
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
                <TicketIcon size={14} /> Tickets ({perTicket.length})
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

          {/* ============================================
              FEED TAB
              ============================================ */}
          {activeTab === 'feed' && (
            <div className="space-y-3 p-4">
              {filteredFeeds.length === 0 ? (
                <EmptyState text="No feed activity for this date" icon={Rss} />
              ) : (
                filteredFeeds.map((feed) => {
                  const isExpanded = expandedFeed === feed.feedId;
                  const hasSystemStop =
                    (feed.entries || []).some(e => e.stoppedBySystem);

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
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-slate-800 truncate">
                                {feed.feedName}
                              </p>
                              {hasSystemStop && <SystemBadge />}
                            </div>
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
                            {feed.entries
                              .filter(e => (e.seconds ?? Math.round((e.hours || 0) * 3600)) > 0)
                              .map((e, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-lg border border-slate-200 p-3"
                                >
                                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Hash size={10} className="text-slate-400" />
                                        {e.date}
                                      </span>
                                      {e.stoppedBySystem && <SystemBadge />}
                                    </div>
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

          {/* ============================================
              TICKET TAB
              ============================================ */}
          {activeTab === 'ticket' && (
            <div className="space-y-3 p-4">
              {filteredTickets.length === 0 ? (
                <EmptyState text="No ticket activity for this date" icon={TicketIcon} />
              ) : (
                filteredTickets.map((ticket) => {
                  const isExpanded = expandedTicket === ticket.ticketId;
                  const hasSystemStop =
                    (ticket.entries || []).some(e => e.stoppedBySystem);

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
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-slate-800 truncate">
                                #{ticket.ticketNumber} — {ticket.ticketTitle}
                              </p>
                              {hasSystemStop && <SystemBadge />}
                            </div>
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
                            {ticket.entries
                              .filter(e => (e.seconds ?? Math.round((e.hours || 0) * 3600)) > 0)
                              .map((e, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-lg border border-slate-200 p-3"
                                >
                                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Hash size={10} className="text-slate-400" />
                                        {e.date}
                                      </span>
                                      {e.stoppedBySystem && <SystemBadge />}
                                    </div>
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
// MAIN COMPONENT
// ============================================
const WorkReport = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [developers, setDevelopers] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState('');
  const [selectedDate, setSelectedDate] = useState(defaultDate());

  const [loading, setLoading] = useState(false);
  const [loadingDevs, setLoadingDevs] = useState(true);

  // Single-dev report
  const [report, setReport] = useState(null);
  // All-devs reports (array)
  const [allReports, setAllReports] = useState([]);

  const isAllMode = selectedDeveloper === '__all__';

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
  // FETCH SINGLE DEV REPORT
  // ============================================
  const fetchSingleReport = useCallback(async (developerId, date) => {
    const params = {
      developerId,
      startDate: date,
      endDate: date
    };
    const res = await axios.get(`${API_BASE_URL}/api/work-report`, {
      ...authHeader,
      params
    });
    return res.data;
  }, [token]);

  // ============================================
  // FETCH ALL DEVS REPORT (parallel)
  // ============================================
  const fetchAllReports = useCallback(async (date) => {
    if (developers.length === 0) return [];

    const promises = developers.map(async (dev) => {
      try {
        const data = await fetchSingleReport(dev._id, date);
        // Only keep devs who have any activity
        const hasFeed = (data.perFeed || []).some(
          f => (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)) > 0
        );
        const hasTicket = (data.perTicket || []).some(
          t => (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)) > 0
        );
        return hasFeed || hasTicket ? data : null;
      } catch (err) {
        console.error(`Failed to fetch report for ${dev.name}:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean);
  }, [developers, fetchSingleReport]);

  // ============================================
  // MAIN FETCH
  // ============================================
  const fetchReport = useCallback(async () => {
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
    setAllReports([]);

    try {
      if (isAllMode) {
        const reports = await fetchAllReports(selectedDate);
        setAllReports(reports);
        if (reports.length === 0) {
          toast('No work activity logged by any developer on this date', {
            icon: 'ℹ️'
          });
        }
      } else {
        const data = await fetchSingleReport(selectedDeveloper, selectedDate);
        if (data.success) {
          setReport(data);
        } else {
          toast.error('Failed to generate report');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [
    selectedDeveloper,
    selectedDate,
    isAllMode,
    fetchAllReports,
    fetchSingleReport
  ]);

  // Auto-fetch when developer changes
  useEffect(() => {
    if (selectedDeveloper) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeveloper]);

  // ============================================
  // COMBINED STATS (for "All" mode banner)
  // ============================================
  const combinedStats = useMemo(() => {
    if (!isAllMode || allReports.length === 0) return null;
    let totalSeconds = 0;
    let feeds = 0;
    let tickets = 0;
    let sysStops = 0;

    allReports.forEach(r => {
      (r.perFeed || []).forEach(f => {
        const s = f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600);
        if (s > 0) {
          totalSeconds += s;
          feeds++;
          sysStops += (f.entries || []).filter(e => e.stoppedBySystem).length;
        }
      });
      (r.perTicket || []).forEach(t => {
        const s = t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600);
        if (s > 0) {
          totalSeconds += s;
          tickets++;
          sysStops += (t.entries || []).filter(e => e.stoppedBySystem).length;
        }
      });
    });

    return {
      developersWithActivity: allReports.length,
      totalSeconds,
      feeds,
      tickets,
      sysStops
    };
  }, [isAllMode, allReports]);

  // ============================================
  // RESET
  // ============================================
  const handleReset = () => {
    setSelectedDate(defaultDate());
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

              {/* ✅ NEW: All developers option */}
              <option value="__all__">
                📊 All Developers ({developers.length})
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
      {!loading && !report && !isAllMode && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            Select a developer and date to view the work report
          </p>
        </div>
      )}

      {/* EMPTY ALL-MODE STATE */}
      {!loading && isAllMode && allReports.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Layers size={48} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            No developer activity on this date
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            Try picking a different date from the calendar above.
          </p>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {isAllMode
              ? `Generating reports for ${developers.length} developers...`
              : 'Generating work report...'}
          </p>
        </div>
      )}

      {/* ============================================
          ALL MODE — COMBINED SUMMARY + DEV LIST
          ============================================ */}
      {isAllMode && !loading && allReports.length > 0 && (
        <>
          {/* Combined Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Layers size={20} className="text-white" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">
                  Combined Report
                </p>
                <h2 className="text-lg font-black">
                  {allReports.length} Developer
                  {allReports.length === 1 ? '' : 's'} Active
                </h2>
                <p className="text-[11px] opacity-70">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 border border-white/10 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-wider opacity-70">
                  Total Time
                </p>
                <p className="text-lg font-black font-mono mt-0.5">
                  {formatTimeWithSeconds(combinedStats?.totalSeconds || 0)}
                </p>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-wider opacity-70">
                  Feeds Worked
                </p>
                <p className="text-lg font-black mt-0.5">
                  {combinedStats?.feeds || 0}
                </p>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-wider opacity-70">
                  Tickets Worked
                </p>
                <p className="text-lg font-black mt-0.5">
                  {combinedStats?.tickets || 0}
                </p>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-wider opacity-70 flex items-center gap-1">
                  <AlertTriangle size={9} /> System Stops
                </p>
                <p className="text-lg font-black mt-0.5">
                  {combinedStats?.sysStops || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Per-Developer Blocks */}
          <div className="space-y-5">
            {allReports
              .slice()
              .sort((a, b) => {
                const aTotal =
                  (a.perFeed || []).reduce((s, f) => s + (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)), 0) +
                  (a.perTicket || []).reduce((s, t) => s + (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)), 0);
                const bTotal =
                  (b.perFeed || []).reduce((s, f) => s + (f.totalSeconds ?? Math.round((f.totalHours || 0) * 3600)), 0) +
                  (b.perTicket || []).reduce((s, t) => s + (t.totalSeconds ?? Math.round((t.totalHours || 0) * 3600)), 0);
                return bTotal - aTotal;
              })
              .map((r) => (
                <DeveloperReportBlock
                  key={r.developer._id}
                  report={r}
                  selectedDate={selectedDate}
                />
              ))}
          </div>
        </>
      )}

      {/* ============================================
          SINGLE DEV MODE
          ============================================ */}
      {!isAllMode && report && !loading && (
        <DeveloperReportBlock report={report} selectedDate={selectedDate} />
      )}
    </div>
  );
};

export default WorkReport;