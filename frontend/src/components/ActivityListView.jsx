// frontend/src/components/ActivityListView.jsx
//
// Meetings / Calls list page with two views:
//   • Table    — Zoho-style: left filter panel, column ☰ menus, tags, checkboxes
//   • Calendar — Month / Week, events colour-coded by status
// Clicking a row or a calendar event opens /sales/activity/:id.
// The chosen view is remembered per page.
//
//   <ActivityListView type="meeting" />   or   <ActivityListView type="call" />
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, List, CalendarDays, ChevronLeft, ChevronRight, Video, PhoneIncoming, PhoneOutgoing, Phone,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import Pagination from './Pagination';
import { getActivityLeadName } from '../utils/useAlphaPagination';
import useDashboardFilter, { filterActivities, idOf, isTodayLocal } from '../utils/useDashboardFilter';
import DashboardFilterBanner from './DashboardFilterBanner';
import ZohoFilterSidebar, {
  FilterLayout, FilterToggleButton, EMPTY_FILTERS, applyAllFilters, countActiveFilters,
} from './ZohoFilterSidebar';
import useColumnTable from '../utils/useColumnTable';
import { ColumnHead, ColumnToolbar } from './ColumnTable';
import { rowClickHandler } from './RecordDetailKit';
import useRecordTags, { useRowSelection } from '../utils/useRecordTags';
import {
  selectionColumn, tagsColumn, tagFilterField, TagToolbar, TagDialogs, useTagDialogs,
} from './RecordTags';

const CLOSED = ['Completed', 'Cancelled'];
const DAY_MS = 86400000;

const CONFIG = {
  meeting: {
    title: 'Meetings', subtitle: 'Scheduled meetings with prospects', noun: 'meeting', nouns: 'meetings',
    tagModule: 'Meetings', storeKey: 'meetings', icon: Video,
    emptyHint: <>Open a lead and use <b>New → Meeting</b> to schedule one.</>,
  },
  call: {
    title: 'Calls', subtitle: 'All logged and scheduled calls', noun: 'call', nouns: 'calls',
    tagModule: 'Calls', storeKey: 'calls', icon: Phone,
    emptyHint: <>Open a lead and use <b>New → Call</b> to log one.</>,
  },
};

// ---------- helpers ----------
const ownerName = (a) => a.assignedTo?.name || a.createdBy?.name || '';
const isOpen = (a) => !CLOSED.includes(a.status);
const isPast = (a) => a.scheduledAt && new Date(a.scheduledAt).getTime() < Date.now();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const fmtDT = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

const statusCls = (a) => {
  if (a.status === 'Completed') return 'bg-emerald-50 border-emerald-100 text-emerald-700';
  if (a.status === 'Cancelled') return 'bg-red-50 border-red-100 text-red-700';
  if (isPast(a)) return 'bg-amber-50 border-amber-100 text-amber-700'; // open but time has passed
  return 'bg-blue-50 border-blue-100 text-blue-700';
};
// calendar chip colours
const chipCls = (a) => {
  if (a.status === 'Completed') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (a.status === 'Cancelled') return 'bg-slate-50 border-slate-200 text-slate-400 line-through';
  if (isPast(a)) return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-blue-50 border-blue-200 text-blue-800';
};
const priorityCls = (p) =>
  p === 'High' ? 'text-red-600' : p === 'Low' ? 'text-slate-500' : 'text-slate-700';

const Badge = ({ cls, children }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${cls}`}>{children}</span>
);

// ============================================
// MAIN
// ============================================
export default function ActivityListView({ type }) {
  const cfg = CONFIG[type];
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const myId = localStorage.getItem('userId');
  const dash = useDashboardFilter(); // ?rep=…&focus=today&team=1 (Sales Command dashboard)

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [view, setViewState] = useState(() => {
    try { return localStorage.getItem(`activityView.${cfg.storeKey}`) || 'table'; } catch { return 'table'; }
  });
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem(`activityView.${cfg.storeKey}`, v); } catch { /* ignore */ }
  };

  const tagsApi = useRecordTags(cfg.tagModule);
  const sel = useRowSelection();
  const tagDialogs = useTagDialogs();

  // ---------- load ----------
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/lead-activities?type=${type}&scope=${dash.team ? 'team' : 'mine'}`,
        authHeader
      );
      setItems(res.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load ${cfg.nouns}`);
    } finally {
      setLoading(false);
    }
  }, [type, dash.team, authHeader, cfg.nouns]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ---------- left filter panel ----------
  const systemFilters = useMemo(() => [
    { key: 'upcoming',  label: `Upcoming ${cfg.title}`, test: (a) => isOpen(a) && a.scheduledAt && !isPast(a) },
    { key: 'today',     label: `Today's ${cfg.title}`,  test: (a) => isTodayLocal(a.scheduledAt) },
    { key: 'missed',    label: 'Past & still open',      test: (a) => isOpen(a) && isPast(a) },
    { key: 'completed', label: `Completed ${cfg.title}`, test: (a) => a.status === 'Completed' },
    { key: 'cancelled', label: `Cancelled ${cfg.title}`, test: (a) => a.status === 'Cancelled' },
    { key: 'mine',      label: `My ${cfg.title}`,        test: (a) => !!myId && idOf(a.assignedTo || a.createdBy) === String(myId) },
  ], [cfg.title, myId]);

  const { namesOf, tagNames } = tagsApi;
  const filterFields = useMemo(() => [
    { key: 'title',    label: type === 'meeting' ? 'Title' : 'Subject', type: 'text', getValue: (a) => a.title },
    { key: 'lead',     label: 'Related To (Lead)', type: 'text',   getValue: (a) => getActivityLeadName(a) },
    { key: 'company',  label: 'Company',           type: 'text',   getValue: (a) => a.leadId?.companyName },
    { key: 'when',     label: type === 'meeting' ? 'From' : 'Call Start Time', type: 'date', getValue: (a) => a.scheduledAt },
    { key: 'status',   label: 'Status',            type: 'select', options: ['Open', 'Completed', 'Cancelled'], getValue: (a) => a.status },
    { key: 'priority', label: 'Priority',          type: 'select', options: ['Low', 'Medium', 'High'], getValue: (a) => a.priority },
    { key: 'owner',    label: type === 'meeting' ? 'Host' : 'Call Owner', type: 'select', getValue: ownerName },
    ...(type === 'meeting'
      ? [{ key: 'location', label: 'Location', type: 'text', getValue: (a) => a.location }]
      : [
          { key: 'callDirection', label: 'Call Type',   type: 'select', options: ['Outbound', 'Inbound'], getValue: (a) => a.callDirection },
          { key: 'callOutcome',   label: 'Call Result', type: 'select', options: ['Connected', 'Voicemail', 'No Answer', 'Busy', 'Wrong Number'], getValue: (a) => a.callOutcome },
        ]),
    { key: 'createdAt', label: 'Created Time', type: 'date', getValue: (a) => a.createdAt },
    tagFilterField({ namesOf, tagNames }, (a) => a._id),
  ], [type, namesOf, tagNames]);

  // dashboard link → search → left panel
  const filtered = useMemo(() => {
    let list = filterActivities(items, dash);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((a) =>
        [a.title, a.content, getActivityLeadName(a), a.leadId?.companyName, a.location, ownerName(a)]
          .some((v) => String(v || '').toLowerCase().includes(term))
      );
    }
    return applyAllFilters(list, systemFilters, filterFields, filters);
  }, [items, dash, q, systemFilters, filterFields, filters]);

  // ---------- table columns ----------
  const columns = [
    selectionColumn({
      sel, tagsApi, getId: (a) => a._id, getPageRows: () => paged,
      openTags: tagDialogs.openTags, openManage: tagDialogs.openManage,
    }),
    tagsColumn(tagsApi, (a) => a._id),
    {
      key: 'title', label: type === 'meeting' ? 'Title' : 'Subject', type: 'text', width: 240,
      getValue: (a) => a.title,
      render: (a) => {
        const Icon = type === 'meeting' ? Video : a.callDirection === 'Inbound' ? PhoneIncoming : PhoneOutgoing;
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon size={14} /></div>
            <span className="font-bold text-slate-800 group-hover:text-blue-600 transition truncate max-w-[260px]">{a.title || 'Untitled'}</span>
          </div>
        );
      },
    },
    {
      key: 'when', label: type === 'meeting' ? 'From' : 'Call Start Time', type: 'date',
      getValue: (a) => a.scheduledAt,
      render: (a) => (
        <span className={`text-sm whitespace-nowrap ${isOpen(a) && isPast(a) ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>{fmtDT(a.scheduledAt)}</span>
      ),
    },
    {
      key: 'duration', label: 'Duration', type: 'number',
      getValue: (a) => (a.durationMinutes == null ? '' : Number(a.durationMinutes)),
      tdClass: 'text-sm text-slate-600',
      render: (a) => (a.durationMinutes ? `${a.durationMinutes} min` : '—'),
    },
    ...(type === 'call'
      ? [
          { key: 'callDirection', label: 'Call Type', type: 'select', getValue: (a) => a.callDirection, tdClass: 'text-sm text-slate-600', render: (a) => a.callDirection || '—' },
          { key: 'callOutcome', label: 'Call Result', type: 'select', getValue: (a) => a.callOutcome, tdClass: 'text-sm text-slate-600', render: (a) => a.callOutcome || '—' },
        ]
      : [
          { key: 'location', label: 'Location', type: 'text', getValue: (a) => a.location, tdClass: 'text-sm text-slate-600', render: (a) => a.location || '—' },
        ]),
    {
      key: 'lead', label: 'Related To', type: 'text',
      getValue: (a) => getActivityLeadName(a),
      render: (a) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{getActivityLeadName(a) || '—'}</p>
          {a.leadId?.companyName && a.leadId.companyName !== getActivityLeadName(a) && (
            <p className="text-[11px] text-slate-400 truncate">{a.leadId.companyName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status', label: 'Status', type: 'select',
      getValue: (a) => a.status,
      render: (a) => <span className="whitespace-nowrap"><Badge cls={statusCls(a)}>{a.status}{isOpen(a) && isPast(a) ? ' · past' : ''}</Badge></span>,
    },
    {
      key: 'priority', label: 'Priority', type: 'select',
      getValue: (a) => a.priority || 'Medium',
      render: (a) => <span className={`text-sm font-semibold ${priorityCls(a.priority)}`}>{a.priority || 'Medium'}</span>,
    },
    ...(type === 'meeting'
      ? [{
          key: 'attendees', label: 'Participants', type: 'text',
          getValue: (a) => (a.attendees || []).join(', '),
          tdClass: 'text-sm text-slate-600 max-w-[220px] truncate',
          render: (a) => (a.attendees || []).join(', ') || '—',
        }]
      : []),
    {
      key: 'owner', label: type === 'meeting' ? 'Host' : 'Call Owner', type: 'select',
      getValue: ownerName, tdClass: 'text-sm text-slate-600', render: (a) => ownerName(a) || '—',
    },
  ];

  const ct = useColumnTable(`activities.${type}`, columns, filtered, tagsApi.version);
  const rows = ct.rows;
  useEffect(() => { setPage(1); }, [q, filters, ct.stateKey, dash.team]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage, pageSize]);

  const open = (a) => navigate(`/sales/activity/${a._id}`);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{cfg.title}</h1>
          <p className="text-sm text-slate-500">{cfg.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <FilterToggleButton open={showFilters} onClick={() => setShowFilters((v) => !v)} count={countActiveFilters(filters)} />
          <div className="relative flex-1 lg:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${cfg.nouns}...`}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm bg-white"
            />
          </div>
          {/* view toggle */}
          <div className="flex items-center p-1 rounded-lg bg-white border border-slate-200 shadow-sm shrink-0">
            {[
              { id: 'table', label: 'List', icon: List },
              { id: 'calendar', label: 'Calendar', icon: CalendarDays },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  view === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DashboardFilterBanner filter={dash} label={dash.focus === 'today' ? `${cfg.title} today` : ''} className="mb-4" />

      <FilterLayout
        open={showFilters}
        sidebar={
          <ZohoFilterSidebar
            title={cfg.title}
            systemFilters={systemFilters}
            fields={filterFields}
            rows={items}
            value={filters}
            onChange={setFilters}
          />
        }
      >
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl py-20 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={30} className="animate-spin text-blue-600" />
            <span className="text-sm font-semibold">Loading {cfg.nouns}...</span>
          </div>
        ) : view === 'calendar' ? (
          <CalendarView items={filtered} type={type} onOpen={open} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <TagToolbar sel={sel} openTags={tagDialogs.openTags} openManage={tagDialogs.openManage} />
              <ColumnToolbar ct={ct} className="flex-1" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <ColumnHead ct={ct} />
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={ct.visibleColumns.length} className="py-14 text-center">
                          <p className="text-sm font-bold text-slate-500">
                            {items.length === 0 ? `No ${cfg.nouns} yet` : `No ${cfg.nouns} match these filters`}
                          </p>
                          {items.length === 0 && <p className="text-xs text-slate-400 mt-1">{cfg.emptyHint}</p>}
                        </td>
                      </tr>
                    ) : (
                      paged.map((a) => (
                        <tr
                          key={a._id}
                          onClick={rowClickHandler(() => open(a))}
                          className={`hover:bg-slate-50 transition group cursor-pointer ${sel.isSelected(a._id) ? 'bg-blue-50/60' : ''}`}
                        >
                          {ct.visibleColumns.map((col) => (
                            <td key={col.key} {...ct.cellProps(col, `${col.tdBase || 'px-5 py-3'} ${col.tdClass || ''}`)}>
                              {col.render(a)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > 0 && (
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalItems={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
              )}
            </div>
          </>
        )}
      </FilterLayout>

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} onDone={sel.clear} />
    </div>
  );
}

// ============================================
// CALENDAR (Month / Week)
// ============================================
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mondayOf = (d) => { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; };

function CalendarView({ items, type, onOpen }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('activityView.calendarMode') || 'month'; } catch { return 'month'; }
  });
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const changeMode = (m) => {
    setMode(m);
    try { localStorage.setItem('activityView.calendarMode', m); } catch { /* ignore */ }
  };

  const scheduled = useMemo(
    () => items.filter((a) => a.scheduledAt).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    [items]
  );
  const unscheduled = items.length - scheduled.length;

  const days = useMemo(() => {
    if (mode === 'week') {
      const start = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [mode, cursor]);

  const byDay = useMemo(() => {
    const m = new Map();
    scheduled.forEach((a) => {
      const k = startOfDay(a.scheduledAt).getTime();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    });
    return m;
  }, [scheduled]);

  const move = (dir) => {
    const d = new Date(cursor);
    if (mode === 'week') d.setDate(d.getDate() + dir * 7);
    else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
    setCursor(d);
  };

  const label = mode === 'week'
    ? `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const today = new Date();
  const inPeriod = days.reduce((n, d) => n + (byDay.get(startOfDay(d).getTime())?.filter(() => mode === 'week' || d.getMonth() === cursor.getMonth()).length || 0), 0);

  const Chip = ({ a, compact }) => {
    const Icon = type === 'meeting' ? Video : a.callDirection === 'Inbound' ? PhoneIncoming : PhoneOutgoing;
    return (
      <button
        onClick={() => onOpen(a)}
        title={`${a.title || 'Untitled'} · ${fmtDT(a.scheduledAt)}${getActivityLeadName(a) ? ` · ${getActivityLeadName(a)}` : ''}`}
        className={`w-full text-left rounded-md border px-1.5 ${compact ? 'py-0.5' : 'py-1.5'} hover:shadow-sm hover:brightness-95 transition ${chipCls(a)}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <Icon size={10} className="shrink-0 opacity-70" />
          <span className="text-[10px] font-black shrink-0">{fmtTime(a.scheduledAt)}</span>
          <span className="text-[11px] font-semibold truncate">{a.title || 'Untitled'}</span>
        </div>
        {!compact && getActivityLeadName(a) && (
          <p className="text-[10px] opacity-70 truncate mt-0.5 pl-3.5">{getActivityLeadName(a)}</p>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50" title="Previous"><ChevronLeft size={16} /></button>
          <button onClick={() => move(1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50" title="Next"><ChevronRight size={16} /></button>
          <button onClick={() => setCursor(startOfDay(new Date()))} className="ml-1 px-3 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Today</button>
        </div>
        <h3 className="text-base font-black text-slate-800">{label}</h3>
        <span className="text-[11px] font-semibold text-slate-400">{inPeriod} in view{unscheduled ? ` · ${unscheduled} without a date` : ''}</span>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200" /> Upcoming</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200" /> Past, open</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200" /> Completed</span>
          </div>
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100">
            {['month', 'week'].map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{w}</div>
        ))}
      </div>

      {/* grid */}
      <div className={`grid grid-cols-7 ${mode === 'month' ? 'grid-rows-6' : ''}`}>
        {days.map((d) => {
          const list = byDay.get(startOfDay(d).getTime()) || [];
          const outside = mode === 'month' && d.getMonth() !== cursor.getMonth();
          const isToday = sameDay(d, today);
          const max = mode === 'month' ? 3 : 99;
          return (
            <div
              key={d.toISOString()}
              className={`border-r border-b border-slate-100 p-1.5 ${mode === 'month' ? 'min-h-[112px]' : 'min-h-[420px]'} ${outside ? 'bg-slate-50/60' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center text-xs font-bold ${
                    isToday ? 'w-6 h-6 rounded-full bg-blue-600 text-white' : outside ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {d.getDate()}
                </span>
                {mode === 'week' && (
                  <span className="text-[10px] font-semibold text-slate-400">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                )}
              </div>
              <div className="space-y-1">
                {list.slice(0, max).map((a) => <Chip key={a._id} a={a} compact={mode === 'month'} />)}
                {list.length > max && (
                  <button
                    onClick={() => { setCursor(startOfDay(d)); changeMode('week'); }}
                    className="w-full text-left px-1.5 text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    +{list.length - max} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
