// frontend/src/pages/SalesDashboard.jsx
// Editable Zoho-style Sales home. Everything is scoped to the logged-in user.
//
//  • Click "Customize" to edit the dashboard: change how each widget is displayed
//    (list / data point / bar / pie / funnel), resize, reorder (drag or arrows),
//    hide built-in widgets or delete your own.
//  • Click "Add analytics" to build a NEW widget from any module
//    (Leads, Contacts, Accounts, Deals, Tasks, Meetings, Calls) — e.g. "Emails sent",
//    "LinkedIn requests sent" — and show it as a data point, bar chart or pie chart.
//  • The layout is saved per user via /api/dashboard-config/sales.
//
// Data sources (existing endpoints):
//   GET /api/deals · /api/deal-stages · /api/leads · /api/orgs
//   GET /api/lead-activities?scope=mine
//   GET /api/module-fields/:module        (custom fields from Customize Modules)
//   GET|PUT|DELETE /api/dashboard-config/sales
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Handshake, ListTodo, Video, Phone, Filter, Target, Calendar, Clock, BarChart3,
  RefreshCw, MapPin, Building2, SlidersHorizontal, Plus, Save, X, RotateCcw, Eye, Loader2,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { WidgetFrame, ViewAll, MoreLink } from '../components/dashboard/DashboardParts';
import AnalyticsBuilderModal from '../components/dashboard/AnalyticsBuilderModal';
import AssignedToMePanel from '../components/AssignedToMePanel';
import {
  usePeriod, dayKey, fmtDate, fmtTime, fmtAmount, buildAllRecords, runAnalytics, autoTitle,
  MODULE_LIST, MODULE_ROUTE, DEFAULT_WIDGETS, chartColor,
} from '../components/dashboard/dashboardUtils';

// ---------- constants ----------
const DASHBOARD_KEY = 'sales';
const LIST_LIMIT = 6;
const CLOSED_STAGE_NAMES = ['Closed Won', 'Closed Lost', 'Closed Lost to Competition'];
const isLostStage = (name = '') => name.startsWith('Closed Lost');
const isClosedStage = (name = '') => CLOSED_STAGE_NAMES.includes(name);

// Tailwind needs full class names (no string building)
const SPAN_CLASS = { 2: 'lg:col-span-2', 3: 'lg:col-span-3', 6: 'lg:col-span-6' };

const priorityStyle = {
  High: 'bg-red-50 text-red-600 border-red-100',
  Medium: 'bg-amber-50 text-amber-600 border-amber-100',
  Low: 'bg-slate-50 text-slate-500 border-slate-200',
};

const activityDate = (a) => (a.type === 'task' ? a.dueAt : a.scheduledAt);
const leadName = (a) => a.leadId?.companyName || '—';

const BUILTIN_META = {
  closing:   { icon: <Handshake size={15} />, views: ['list', 'number', 'bar', 'pie'] },
  tasks:     { icon: <ListTodo size={15} />,  views: ['list', 'number', 'bar', 'pie'] },
  meetings:  { icon: <Video size={15} />,     views: ['list', 'number', 'bar', 'pie'] },
  funnel:    { icon: <Filter size={15} />,    views: ['funnel', 'bar', 'pie', 'number'] },
  pipeline:  { icon: <BarChart3 size={15} />, views: ['bar', 'funnel', 'pie', 'number'] },
  leads:     { icon: <Target size={15} />,    views: ['list', 'number', 'bar', 'pie'] },
  followups: { icon: <Calendar size={15} />,  views: ['list', 'number', 'bar', 'pie'] },
};
const CUSTOM_VIEWS = ['number', 'bar', 'pie'];

// count rows grouped by a key (optionally in a fixed order)
const groupRows = (list, keyFn, order = []) => {
  const map = new Map();
  list.forEach((x) => {
    const k = keyFn(x) || '(blank)';
    map.set(k, (map.get(k) || 0) + 1);
  });
  const entries = [...map];
  entries.sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return b[1] - a[1];
  });
  return entries.map(([label, value]) => ({ label, value }));
};

// saved layout + any built-in widgets added after the user last saved (kept hidden)
const mergeWidgets = (saved) => {
  if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_WIDGETS.map((w) => ({ ...w }));
  const ids = new Set(saved.map((w) => w.id));
  const missing = DEFAULT_WIDGETS.filter((d) => !ids.has(d.id)).map((d) => ({ ...d, visible: false }));
  return [...saved, ...missing];
};

// ============================================
// ONE WIDGET  (own period filter, built-in or custom)
// ============================================
const Widget = ({ w, ctx, ed }) => {
  const {
    loading, navigate, userId, todayK, normalizeStage, orderedStages, myDeals, activities, leads, getRecords,
  } = ctx;

  const p = usePeriod(w.periodMode || 'all');
  // keep the filter in step when the default period is changed in edit mode
  useEffect(() => { p.setMode(w.periodMode || 'all'); }, [w.periodMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = BUILTIN_META[w.id];
  const views = w.kind === 'custom' ? CUSTOM_VIEWS : meta?.views || ['list'];
  const view = views.includes(w.view) ? w.view : views[0];

  const stageColor = (name) => chartColor(Math.max(0, orderedStages.findIndex((s) => s.name === name)));
  const buildStageStats = (list) =>
    orderedStages.map((stage, i) => {
      const inStage = list.filter((d) => normalizeStage(d.stage) === stage.name);
      return {
        name: stage.name,
        color: chartColor(i),
        count: inStage.length,
        amount: inStage.reduce((sum, d) => sum + Number(d.amount || 0), 0),
      };
    });

  // ---------- build the model for this widget ----------
  let m = null; // { title, icon, count, action, hint, rows, total, money, numberLabel, isEmpty, emptyText, list }

  if (w.kind === 'custom') {
    const records = getRecords(w.module);
    const r = runAnalytics(w, records, p, userId);
    const numberLabel = w.measure?.field
      ? `${w.measure.type === 'sum' ? 'Total' : 'Average'} ${w.measure.field.label}`
      : String(w.module || '').toLowerCase();
    m = {
      title: w.title || autoTitle(w),
      icon: <BarChart3 size={15} />,
      count: r.count,
      action: MODULE_ROUTE[w.module] ? <ViewAll onClick={() => navigate(MODULE_ROUTE[w.module])} /> : null,
      hint: w.dateField?.label ? `by ${w.dateField.label.toLowerCase()}` : undefined,
      rows: r.rows, total: r.total, money: r.money, numberLabel,
    };
  } else if (w.id === 'closing') {
    const list = myDeals
      .filter((d) => d.closingDate && p.contains(d.closingDate) && !isClosedStage(normalizeStage(d.stage)))
      .sort((a, b) => new Date(a.closingDate) - new Date(b.closingDate));
    const stageNames = orderedStages.map((s) => s.name);
    const rows = groupRows(list, (d) => normalizeStage(d.stage), stageNames).map((row) => ({
      ...row,
      color: stageColor(row.label),
      extra: `${row.value} · ${fmtAmount(list.filter((d) => normalizeStage(d.stage) === row.label).reduce((s, d) => s + Number(d.amount || 0), 0))}`,
    }));
    m = {
      title: `My Deals Closing ${p.phrase}`, icon: meta.icon, count: list.length,
      action: <ViewAll onClick={() => navigate('/sales/deals')} />, hint: 'by closing date',
      rows, total: list.length, numberLabel: 'deals closing', isEmpty: list.length === 0,
      emptyText: 'No open deals closing in this period',
      list: (
        <>
          <div className="space-y-2">
            {list.slice(0, LIST_LIMIT).map((d) => {
              const late = new Date(d.closingDate).setHours(23, 59, 59, 999) < Date.now();
              return (
                <div key={d._id} onClick={() => navigate('/sales/deals')} className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{d.dealName}</p>
                    <p className="text-xs font-black text-slate-700 whitespace-nowrap">{fmtAmount(d.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-slate-400 truncate">
                      {d.organizationId?.companyName || d.leadId?.companyName || '—'} · {normalizeStage(d.stage)}
                    </p>
                    <p className={`text-[10px] font-bold whitespace-nowrap ${late ? 'text-red-500' : 'text-slate-500'}`}>{fmtDate(d.closingDate)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <MoreLink shown={LIST_LIMIT} total={list.length} onClick={() => navigate('/sales/deals')} />
        </>
      ),
    };
  } else if (w.id === 'tasks') {
    const withOverdue = p.includesToday();
    const list = activities
      .filter((a) => {
        if (a.type !== 'task' || a.status === 'Completed') return false;
        if (p.mode === 'all') return true;
        if (!a.dueAt) return false;
        return p.contains(a.dueAt) || (withOverdue && dayKey(a.dueAt) < todayK);
      })
      .sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt) - new Date(b.dueAt);
      });
    m = {
      title: 'My Open Tasks', icon: meta.icon, count: list.length,
      action: <ViewAll onClick={() => navigate('/sales/activities/tasks')} />, hint: 'by due date',
      rows: groupRows(list, (t) => t.priority || 'Medium', ['High', 'Medium', 'Low']),
      total: list.length, numberLabel: 'open tasks', isEmpty: list.length === 0, emptyText: 'No open tasks in this period',
      list: (
        <>
          <div className="space-y-2">
            {list.slice(0, LIST_LIMIT).map((t) => {
              const late = t.dueAt && dayKey(t.dueAt) < todayK;
              return (
                <div key={t._id} onClick={() => navigate('/sales/activities/tasks')} className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{t.title || 'Untitled task'}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${priorityStyle[t.priority] || priorityStyle.Medium}`}>{t.priority || 'Medium'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-slate-400 truncate">{leadName(t)} · {t.status}</p>
                    <p className={`text-[10px] font-bold whitespace-nowrap ${late ? 'text-red-500' : 'text-slate-500'}`}>
                      {t.dueAt ? `${late ? 'Overdue · ' : ''}${fmtDate(t.dueAt)}` : 'No due date'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <MoreLink shown={LIST_LIMIT} total={list.length} onClick={() => navigate('/sales/activities/tasks')} />
        </>
      ),
    };
  } else if (w.id === 'meetings') {
    const list = activities
      .filter((a) => a.type === 'meeting' && a.status !== 'Completed' && a.status !== 'Cancelled' && a.scheduledAt && p.contains(a.scheduledAt))
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    m = {
      title: 'My Meetings', icon: meta.icon, count: list.length,
      action: <ViewAll onClick={() => navigate('/sales/activities/meetings')} />, hint: 'by meeting date',
      rows: groupRows(list, (x) => x.status || 'Scheduled'),
      total: list.length, numberLabel: 'meetings', isEmpty: list.length === 0, emptyText: 'No meetings in this period',
      list: (
        <>
          <div className="space-y-2">
            {list.slice(0, LIST_LIMIT).map((mt) => {
              const isToday = dayKey(mt.scheduledAt) === todayK;
              return (
                <div key={mt._id} onClick={() => navigate('/sales/activities/meetings')}
                  className={`p-2.5 rounded-xl border cursor-pointer hover:bg-slate-50 ${isToday ? 'border-purple-200 bg-purple-50/40' : 'border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{mt.title || 'Meeting'}</p>
                    {isToday && <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Today</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <Building2 size={10} /> {leadName(mt)}
                      {mt.location ? (<><MapPin size={10} className="ml-1" /> {mt.location}</>) : null}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{fmtDate(mt.scheduledAt)} · {fmtTime(mt.scheduledAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <MoreLink shown={LIST_LIMIT} total={list.length} onClick={() => navigate('/sales/activities/meetings')} />
        </>
      ),
    };
  } else if (w.id === 'funnel') {
    const stats = buildStageStats(myDeals.filter((d) => p.contains(d.closingDate))).filter((s) => !isLostStage(s.name));
    const total = stats.reduce((s, x) => s + x.count, 0);
    m = {
      title: 'Sales Funnel', icon: meta.icon, count: total,
      action: <ViewAll onClick={() => navigate('/sales/deals')} />, hint: 'deals by closing date',
      rows: stats.map((s) => ({ label: s.name, value: s.count, color: s.color, extra: `${s.count} · ${fmtAmount(s.amount)}` })),
      total, numberLabel: 'deals in funnel', isEmpty: total === 0, emptyText: 'No deals in your funnel for this period',
    };
  } else if (w.id === 'pipeline') {
    const stats = buildStageStats(myDeals.filter((d) => p.contains(d.closingDate))).filter((s) => !isClosedStage(s.name));
    const total = stats.reduce((s, x) => s + x.amount, 0);
    const count = stats.reduce((s, x) => s + x.count, 0);
    m = {
      title: 'My Pipeline Deals By Stage', icon: meta.icon, count,
      action: <span className="text-[11px] font-black text-slate-700">{fmtAmount(total)}</span>, hint: 'open deals by closing date',
      rows: stats.map((s) => ({ label: s.name, value: s.amount, color: s.color, extra: `${s.count} deal${s.count === 1 ? '' : 's'} · ${fmtAmount(s.amount)}` })),
      total, money: true, numberLabel: 'pipeline value', isEmpty: count === 0, emptyText: 'No open deals in your pipeline for this period',
    };
  } else if (w.id === 'leads') {
    const list = leads.filter((l) => {
      const owner = l.leadOwner?._id || l.leadOwner || l.createdBy;
      return String(owner) === String(userId) && p.contains(l.createdAt);
    });
    const isToday = p.mode === 'day' && p.day === todayK;
    m = {
      title: isToday ? "Today's Leads" : 'My Leads', icon: meta.icon, count: list.length,
      action: <ViewAll onClick={() => navigate('/sales/leads')} />, hint: 'by created date',
      rows: groupRows(list, (l) => l.leadStatus || 'Not Contacted'),
      total: list.length, numberLabel: 'leads', isEmpty: list.length === 0,
      emptyText: isToday ? 'No leads created today' : 'No leads created in this period',
      list: (
        <>
          <div className="space-y-2">
            {list.slice(0, LIST_LIMIT).map((l) => {
              const c = l.contacts?.find((x) => x.isPrimary) || l.contacts?.[0];
              return (
                <div key={l._id} onClick={() => navigate('/sales/leads')} className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{l.companyName}</p>
                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">{l.leadStatus || 'Not Contacted'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : 'No contact'}
                    {l.leadSource ? ` · ${l.leadSource}` : ''}
                    {!isToday ? ` · ${fmtDate(l.createdAt)}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
          <MoreLink shown={LIST_LIMIT} total={list.length} onClick={() => navigate('/sales/leads')} />
        </>
      ),
    };
  } else if (w.id === 'followups') {
    const withOverdue = p.includesToday();
    const list = activities
      .filter((a) => a.type !== 'note' && (a.type === 'task' ? a.status !== 'Completed' : a.status !== 'Completed' && a.status !== 'Cancelled'))
      .map((a) => { const when = activityDate(a); return when ? { a, when, key: dayKey(when) } : null; })
      .filter(Boolean)
      .filter((x) => p.contains(x.when) || (withOverdue && x.key < todayK))
      .sort((x, y) => new Date(x.when) - new Date(y.when));
    const typeIcon = { task: <ListTodo size={13} />, meeting: <Video size={13} />, call: <Phone size={13} /> };
    const typeColor = { task: 'bg-blue-50 text-blue-600', meeting: 'bg-purple-50 text-purple-600', call: 'bg-emerald-50 text-emerald-600' };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1) + 's';
    m = {
      title: 'Follow-ups', icon: meta.icon, count: list.length, action: null, hint: 'tasks, calls & meetings',
      rows: groupRows(list, (x) => cap(x.a.type)),
      total: list.length, numberLabel: 'follow-ups', isEmpty: list.length === 0, emptyText: 'No follow-ups in this period',
      list: (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {list.map(({ a, when, key }) => {
            const late = key < todayK;
            return (
              <div key={a._id}
                onClick={() => navigate(a.type === 'task' ? '/sales/activities/tasks' : a.type === 'meeting' ? '/sales/activities/meetings' : '/sales/activities/calls')}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <span className={`p-1.5 rounded-lg flex-shrink-0 ${typeColor[a.type]}`}>{typeIcon[a.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{a.title || a.type}</p>
                  <p className="text-[10px] text-slate-400 truncate">{leadName(a)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-[10px] font-bold ${late ? 'text-red-500' : 'text-slate-500'}`}>{late ? 'Overdue · ' : ''}{fmtDate(when)}</p>
                  {a.type !== 'task' && <p className="text-[10px] text-slate-400 flex items-center justify-end gap-1"><Clock size={9} /> {fmtTime(when)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ),
    };
  }

  if (!m) return null;

  // widgets with a period phrase in the title (closing) already include it; others show it in the header hint
  return (
    <WidgetFrame
      ed={ed ? { ...ed, views, view, span: w.span, periodMode: w.periodMode || 'all' } : null}
      view={view}
      title={m.title}
      icon={m.icon}
      count={m.count}
      action={m.action}
      p={p}
      hint={m.hint}
      loading={loading}
      rows={m.rows}
      total={m.total}
      money={m.money}
      numberLabel={m.numberLabel}
      isEmpty={m.isEmpty}
      emptyText={m.emptyText}
      list={m.list}
    />
  );
};

// ============================================
// PAGE
// ============================================
const SalesDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || '';
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // ----- data -----
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [leads, setLeads] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [defs, setDefs] = useState({}); // { Leads: [ModuleField...], ... }

  // ----- layout -----
  const [widgets, setWidgets] = useState(() => DEFAULT_WIDGETS.map((w) => ({ ...w })));
  const [draft, setDraft] = useState(null); // non-null while customizing
  const [saving, setSaving] = useState(false);
  const [builder, setBuilder] = useState(null); // null | { initial }
  const [dragId, setDragId] = useState(null);

  const editing = draft !== null;
  const shown = editing ? draft : widgets;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(widgets);

  // ---------- load ----------
  const loadDefs = useCallback(async () => {
    const results = await Promise.allSettled(
      MODULE_LIST.map((mod) => axios.get(`${API_BASE_URL}/api/module-fields/${mod}`, authHeader))
    );
    const next = {};
    MODULE_LIST.forEach((mod, i) => {
      next[mod] = results[i].status === 'fulfilled' ? results[i].value.data?.data || [] : [];
    });
    setDefs(next);
  }, [authHeader]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, a, l, o] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/deal-stages`, authHeader),
        axios.get(`${API_BASE_URL}/api/deals`, authHeader),
        axios.get(`${API_BASE_URL}/api/lead-activities?scope=mine`, authHeader),
        axios.get(`${API_BASE_URL}/api/leads`, authHeader),
        axios.get(`${API_BASE_URL}/api/orgs`, authHeader),
      ]);
      if (s.status === 'fulfilled') setStages(s.value.data?.data || []);
      if (d.status === 'fulfilled') setDeals(d.value.data?.data || []);
      if (a.status === 'fulfilled') setActivities(a.value.data?.data || []);
      if (l.status === 'fulfilled') setLeads(l.value.data?.data || []);
      if (o.status === 'fulfilled') {
        const body = o.value.data;
        setOrgs(Array.isArray(body) ? body : body?.data || []); // /api/orgs returns a bare array
      }
      if ([s, d, a, l].some((r) => r.status === 'rejected')) toast.error('Some dashboard data failed to load');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  const loadLayout = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/dashboard-config/${DASHBOARD_KEY}`, authHeader);
      setWidgets(mergeWidgets(res.data?.data));
    } catch {
      setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w }))); // route missing / offline → default layout
    }
  }, [authHeader]);

  useEffect(() => { load(); loadDefs(); loadLayout(); }, [load, loadDefs, loadLayout]);

  // ---------- derived data ----------
  const orderedStages = useMemo(() => [...stages].sort((a, b) => (a.order || 0) - (b.order || 0)), [stages]);
  const stageNames = useMemo(() => orderedStages.map((s) => s.name), [orderedStages]);
  const normalizeStage = useCallback((name) => (stageNames.includes(name) ? name : stageNames[0]), [stageNames]);
  const myDeals = useMemo(() => deals.filter((d) => String(d.owner?._id || d.owner) === String(userId)), [deals, userId]);

  const allRecords = useMemo(() => buildAllRecords({ leads, orgs, deals, activities }), [leads, orgs, deals, activities]);
  const getRecords = useCallback((mod) => allRecords[mod] || [], [allRecords]);

  const ctx = {
    loading, navigate, userId, todayK: dayKey(new Date()), normalizeStage, orderedStages, myDeals, activities, leads, getRecords,
  };

  // ---------- layout editing ----------
  const startEditing = () => setDraft(widgets.map((w) => ({ ...w })));
  const cancelEditing = () => { setDraft(null); setBuilder(null); };
  const patchWidget = (id, patch) => setDraft((d) => d.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const moveWidget = (id, dir) =>
    setDraft((d) => {
      const visibleIdx = d.map((w, i) => (w.visible !== false ? i : -1)).filter((i) => i !== -1);
      const pos = visibleIdx.findIndex((i) => d[i].id === id);
      const target = visibleIdx[pos + dir];
      if (pos === -1 || target === undefined) return d;
      const next = [...d];
      [next[visibleIdx[pos]], next[target]] = [next[target], next[visibleIdx[pos]]];
      return next;
    });

  const dropOn = (targetId) => {
    if (!dragId || dragId === targetId) return;
    setDraft((d) => {
      const from = d.findIndex((w) => w.id === dragId);
      const to = d.findIndex((w) => w.id === targetId);
      if (from === -1 || to === -1) return d;
      const next = [...d];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  };

  const removeWidget = (w) => {
    if (w.kind === 'custom') setDraft((d) => d.filter((x) => x.id !== w.id));
    else patchWidget(w.id, { visible: false });
  };

  const openBuilder = (initial = null) => {
    if (!editing) startEditing();
    setBuilder({ initial });
  };

  const saveBuilt = (w) => {
    setDraft((d) => {
      const base = d || widgets.map((x) => ({ ...x }));
      return base.some((x) => x.id === w.id) ? base.map((x) => (x.id === w.id ? w : x)) : [...base, w];
    });
    setBuilder(null);
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/dashboard-config/${DASHBOARD_KEY}`, { widgets: draft }, authHeader);
      setWidgets(draft);
      setDraft(null);
      toast.success('Dashboard saved');
    } catch (err) {
      toast.error(
        err.response?.status === 404
          ? 'Could not save: /api/dashboard-config is not mounted in server.js'
          : err.response?.data?.error || 'Could not save dashboard'
      );
    } finally {
      setSaving(false);
    }
  };

  const resetLayout = async () => {
    if (!window.confirm('Reset the dashboard to the default layout? Your custom analytics will be removed.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/dashboard-config/${DASHBOARD_KEY}`, authHeader);
    } catch { /* nothing saved yet / route missing → just reset locally */ }
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w })));
    setDraft(null);
    setBuilder(null);
    toast.success('Dashboard reset');
  };

  // create a field in Customize Modules without leaving the dashboard
  const createField = async (moduleName, body) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/module-fields/${moduleName}`, body, authHeader);
      await loadDefs();
      toast.success(`Field "${body.label}" added to ${moduleName}`);
      return res.data?.data || null;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create field');
      return null;
    }
  };

  const hiddenBuiltins = shown.filter((w) => w.kind === 'builtin' && w.visible === false);
  const visibleWidgets = shown.filter((w) => w.visible !== false);

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="max-w-[1600px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800">{userName ? `Welcome, ${userName}` : 'Sales Dashboard'}</h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">{todayLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { load(); loadDefs(); }}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {!editing ? (
              <>
                <button
                  onClick={() => openBuilder(null)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-600 hover:bg-blue-50"
                >
                  <Plus size={13} /> Add analytics
                </button>
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <SlidersHorizontal size={13} /> Customize dashboard
                </button>
              </>
            ) : (
              <>
                <button onClick={() => openBuilder(null)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-600 hover:bg-blue-50">
                  <Plus size={13} /> Add analytics
                </button>
                <button onClick={resetLayout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  <RotateCcw size={13} /> Reset
                </button>
                <button onClick={cancelEditing} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200">
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={saveLayout}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save dashboard
                </button>
              </>
            )}
          </div>
        </div>

        {/* EDIT-MODE BANNER */}
        {editing && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
            <span>
              <b>Customizing.</b> Use the toolbar on each card to change how it is shown (list, data point, bar, pie),
              its size and default period. Drag cards or use the arrows to reorder. Click <b>Save dashboard</b> when done.
            </span>
            {dirty && <span className="font-black text-amber-600">Unsaved changes</span>}
          </div>
        )}

        {/* TASKS ASSIGNED BY THE SALES MANAGER */}
        {!editing && <AssignedToMePanel />}

        {/* WIDGET GRID */}
        {visibleWidgets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-sm font-bold text-slate-500">Your dashboard is empty.</p>
            <button onClick={() => openBuilder(null)} className="mt-3 text-xs font-bold text-blue-600 hover:underline">Add analytics</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            {visibleWidgets.map((w) => {
              const ed = editing
                ? {
                    onView: (v) => patchWidget(w.id, { view: v }),
                    onSpan: (s) => patchWidget(w.id, { span: s }),
                    onPeriodMode: (pm) => patchWidget(w.id, { periodMode: pm }),
                    onMove: (dir) => moveWidget(w.id, dir),
                    onHide: () => removeWidget(w),
                    hideLabel: w.kind === 'custom' ? 'Delete' : 'Hide',
                    onEdit: w.kind === 'custom' ? () => setBuilder({ initial: w }) : null,
                  }
                : null;
              return (
                <div
                  key={w.id}
                  className={SPAN_CLASS[w.span] || SPAN_CLASS[3]}
                  draggable={editing}
                  onDragStart={() => editing && setDragId(w.id)}
                  onDragOver={(e) => editing && e.preventDefault()}
                  onDrop={() => editing && dropOn(w.id)}
                >
                  <Widget w={w} ctx={ctx} ed={ed} />
                </div>
              );
            })}
          </div>
        )}

        {/* HIDDEN BUILT-IN WIDGETS */}
        {editing && hiddenBuiltins.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-600 mb-2">Hidden widgets</p>
            <div className="flex flex-wrap gap-2">
              {hiddenBuiltins.map((w) => (
                <button
                  key={w.id}
                  onClick={() => patchWidget(w.id, { visible: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Eye size={12} /> {w.id === 'closing' ? 'Deals closing' : w.id === 'followups' ? 'Follow-ups' : w.id.charAt(0).toUpperCase() + w.id.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ANALYTICS BUILDER */}
      {builder && (
        <AnalyticsBuilderModal
          initial={builder.initial}
          defs={defs}
          getRecords={getRecords}
          userId={userId}
          onSave={saveBuilt}
          onClose={() => setBuilder(null)}
          onRefreshDefs={loadDefs}
          onCreateField={createField}
        />
      )}
    </div>
  );
};

export default SalesDashboard;
