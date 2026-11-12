// frontend/src/pages/SalesManagerDashboard.jsx
//
// Sales Command – full visibility of the whole sales team for the Sales Manager.
//
//  • KPI strip            – conversion, pipeline / won value, open + overdue tasks, today's meetings & calls
//  • Team performance     – one row per sales person (click a row to focus the whole page on that person)
//  • Task assignment      – assign tasks to any sales person; track open / overdue / completed,
//                           re-assign, send a reminder, delete
//  • Team schedule        – today's meetings & calls for everyone + latest team activity
//
// Data:
//   GET /api/sales-manager/overview     (new – one call for all team numbers)
//   POST|PATCH|DELETE /api/lead-activities  (assign / re-assign / remove)
//   POST /api/lead-activities/:id/remind    (nudge the assignee)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users, Calendar, ClipboardCheck,
  RefreshCw, Filter, Plus, Target, TrendingUp, Wallet, Trophy, ListTodo, AlertTriangle, Video, Phone,
  Bell, Trash2, CheckCircle2, ArrowUp, ArrowDown, StickyNote, Loader2, UserPlus,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import AssignTaskModal from '../components/AssignTaskModal';

// ============================================
// helpers
// ============================================
const fmtMoney = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No due date');
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

const timeAgo = (d) => {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isClosed = (t) => t.status === 'Completed' || t.status === 'Cancelled';
const isLate = (t) => !isClosed(t) && t.dueAt && new Date(t.dueAt) < startOfToday();
const ownerOf = (a) => a.assignedTo || a.createdBy;
const idOf = (x) => String(x?._id || x || '');

const priorityStyle = {
  High: 'bg-red-50 text-red-600 border-red-100',
  Medium: 'bg-amber-50 text-amber-600 border-amber-100',
  Low: 'bg-slate-50 text-slate-500 border-slate-200',
};

// ============================================
// small UI pieces
// ============================================
const Kpi = ({ icon, label, value, sub, tone = 'blue', alert = false, onClick, hint }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  const clickable = typeof onClick === 'function';
  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      {...(clickable ? { type: 'button', onClick, title: hint } : {})}
      className={`bg-white rounded-2xl border p-4 shadow-sm text-left w-full ${alert ? 'border-red-200' : 'border-slate-200'} ${
        clickable ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <span className={`p-1.5 rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-black ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{sub}</p>}
    </Wrapper>
  );
};

const Section = ({ id, icon, title, subtitle, action, children, className = '' }) => (
  <div id={id} className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">{icon}</div>
        <div>
          <h2 className="text-base font-black text-slate-800">{title}</h2>
          {subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const EmptyState = ({ text = 'No records found.' }) => (
  <div className="text-center py-10 text-slate-400 text-[10px] italic font-medium">{text}</div>
);

// ============================================
// PAGE
// ============================================
const SORTERS = {
  name: (r) => r.name.toLowerCase(),
  pipeline: (r) => r.leadGen.total + r.prospects.total,
  rate: (r) => r.conversionRate,
  deals: (r) => r.deals.openValue,
  open: (r) => r.tasks.open,
  overdue: (r) => r.tasks.overdue,
  meetings: (r) => r.meetingsToday,
  calls: (r) => r.callsToday,
};

const SalesManagerDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [selectedRep, setSelectedRep] = useState('all'); // rep _id or 'all'
  const [assign, setAssign] = useState(null); // null | { repId }
  const [taskFilter, setTaskFilter] = useState('open');
  const [busyTask, setBusyTask] = useState(null);
  const [sort, setSort] = useState({ key: 'overdue', dir: 'desc' });
  const [lastUpdated, setLastUpdated] = useState(null);

  // ---------- load ----------
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/sales-manager/overview`, authHeader);
        setOverview(res.data);
        setLastUpdated(new Date());
      } catch (err) {
        if (!silent) toast.error('Could not load team overview');
      } finally {
        setLoading(false);
      }
    },
    [authHeader]
  );

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000); // keep the board live
    const onRefresh = () => fetchData(true);
    window.addEventListener('tasks:refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('tasks:refresh', onRefresh);
    };
  }, [fetchData]);

  // ---------- derived ----------
  const reps = overview?.reps || [];
  const focusedReps = useMemo(
    () => (selectedRep === 'all' ? reps : reps.filter((r) => idOf(r) === selectedRep)),
    [reps, selectedRep]
  );
  const focusedRep = selectedRep === 'all' ? null : reps.find((r) => idOf(r) === selectedRep);
  const matchesRep = (repLike) => selectedRep === 'all' || idOf(repLike) === selectedRep;

  const kpi = useMemo(() => {
    const sum = (fn) => focusedReps.reduce((s, r) => s + fn(r), 0);
    const pipeline = sum((r) => (r.leadGen.total || 0) + (r.prospects.total || 0));
    const converted = sum((r) => (r.leadGen.converted || 0) + (r.prospects.converted || 0));
    return {
      reps: focusedReps.length,
      conversion: pipeline ? ((converted / pipeline) * 100).toFixed(1) : '0.0',
      pipeline,
      converted,
      openValue: sum((r) => r.deals.openValue),
      openDeals: sum((r) => r.deals.open),
      wonValue: sum((r) => r.deals.wonValue),
      wonDeals: sum((r) => r.deals.won),
      tasksOpen: sum((r) => r.tasks.open),
      tasksOverdue: sum((r) => r.tasks.overdue),
      done7d: sum((r) => r.tasks.completed7d),
      meetings: sum((r) => r.meetingsToday),
      calls: sum((r) => r.callsToday),
      followUps: sum((r) => r.leadGen.followUpsToday),
    };
  }, [focusedReps]);

  const sortedReps = useMemo(() => {
    const fn = SORTERS[sort.key] || SORTERS.name;
    const out = [...focusedReps].sort((a, b) => {
      const x = fn(a);
      const y = fn(b);
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [focusedReps, sort]);

  const assigned = useMemo(
    () => (overview?.assignedTasks || []).filter((t) => matchesRep(t.assignedTo)),
    [overview, selectedRep] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const taskCounts = useMemo(
    () => ({
      open: assigned.filter((t) => !isClosed(t)).length,
      overdue: assigned.filter(isLate).length,
      completed: assigned.filter((t) => t.status === 'Completed').length,
      all: assigned.length,
    }),
    [assigned]
  );
  const shownTasks = useMemo(() => {
    const list = assigned.filter((t) => {
      if (taskFilter === 'open') return !isClosed(t);
      if (taskFilter === 'overdue') return isLate(t);
      if (taskFilter === 'completed') return t.status === 'Completed';
      return true;
    });
    return list.sort((a, b) => {
      if (taskFilter !== 'completed' && taskFilter !== 'all') {
        const la = isLate(a) ? 0 : 1;
        const lb = isLate(b) ? 0 : 1;
        if (la !== lb) return la - lb;
        if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [assigned, taskFilter]);

  const schedule = useMemo(
    () => (overview?.schedule || []).filter((a) => matchesRep(ownerOf(a))),
    [overview, selectedRep] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const recent = useMemo(
    () => (overview?.recent || []).filter((a) => matchesRep(ownerOf(a))).slice(0, 12),
    [overview, selectedRep] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---------- actions ----------
  const reassign = async (task, repId) => {
    if (!repId || repId === idOf(task.assignedTo)) return;
    setBusyTask(task._id);
    try {
      await axios.patch(`${API_BASE_URL}/api/lead-activities/${task._id}`, { assignedTo: repId }, authHeader);
      toast.success('Task re-assigned');
      await fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not re-assign');
    } finally {
      setBusyTask(null);
    }
  };

  const remind = async (task) => {
    setBusyTask(task._id);
    try {
      await axios.post(`${API_BASE_URL}/api/lead-activities/${task._id}/remind`, {}, authHeader);
      toast.success(`Reminder sent to ${task.assignedTo?.name || 'assignee'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send reminder');
    } finally {
      setBusyTask(null);
    }
  };

  const removeTask = async (task) => {
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    setBusyTask(task._id);
    try {
      await axios.delete(`${API_BASE_URL}/api/lead-activities/${task._id}`, authHeader);
      toast.success('Task deleted');
      await fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete task');
    } finally {
      setBusyTask(null);
    }
  };

  // Open another tab carrying the dashboard's current focus (selected sales person) + the card's own filter.
  const goTo = (path, extra = {}) => {
    const params = new URLSearchParams();
    if (focusedRep) {
      params.set('rep', idOf(focusedRep));
      params.set('repName', focusedRep.name);
    }
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    navigate(`${path}?${params.toString()}`);
  };

  const scrollToTeam = () =>
    document.getElementById('team-performance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const SortHead = ({ k, children, className = '' }) => (
    <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap ${className}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-700">
        {children}
        {sort.key === k && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
  );

  const typeIcon = { task: <ListTodo size={13} />, meeting: <Video size={13} />, call: <Phone size={13} />, note: <StickyNote size={13} /> };
  const typeTone = {
    task: 'bg-blue-50 text-blue-600',
    meeting: 'bg-purple-50 text-purple-600',
    call: 'bg-emerald-50 text-emerald-600',
    note: 'bg-amber-50 text-amber-600',
  };

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ============================================
  // render
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="max-w-[1700px] mx-auto">
        {/* HEADER */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Sales Command</h1>
            <p className="text-slate-500 font-medium mt-1">
              {todayLabel}
              {lastUpdated && <span className="text-slate-400"> · updated {timeAgo(lastUpdated)}</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 px-4 py-2 shadow-sm">
              <Filter size={16} className="text-blue-600 mr-2" />
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-4"
              >
                <option value="all">Whole team ({reps.length})</option>
                {reps.map((r) => (
                  <option key={r._id} value={idOf(r)}>{r.name}</option>
                ))}
              </select>
            </div>

           
            <button
              onClick={() => setAssign({ repId: focusedRep ? idOf(focusedRep) : null })}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white text-sm font-black shadow-sm hover:bg-blue-700"
            >
              <Plus size={16} /> Assign task
            </button>
          </div>
        </div>

        {loading && !overview ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="animate-spin mr-2" /> Loading team data…
          </div>
        ) : (
          <>
            {/* KPI STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
              <Kpi icon={<Users size={14} />} label={focusedRep ? 'Focused on' : 'Sales team'} value={focusedRep ? focusedRep.name.split(' ')[0] : kpi.reps} sub={focusedRep ? focusedRep.email : 'active sales people'} tone="slate" onClick={scrollToTeam} hint="Jump to team performance" />
              <Kpi icon={<Target size={14} />} label="Conversion" value={`${kpi.conversion}%`} sub={`${kpi.converted} of ${kpi.pipeline} converted`} tone="blue" onClick={() => goTo('/sales/lead_generation', { focus: 'converted' })} hint="View converted leads" />
              <Kpi icon={<Wallet size={14} />} label="Open pipeline" value={fmtMoney(kpi.openValue)} sub={`${kpi.openDeals} open deals`} tone="purple" onClick={() => goTo('/sales/deals', { focus: 'open' })} hint="View open deals" />
              <Kpi icon={<Trophy size={14} />} label="Won value" value={fmtMoney(kpi.wonValue)} sub={`${kpi.wonDeals} deals won`} tone="emerald" onClick={() => goTo('/sales/deals', { focus: 'won' })} hint="View won deals" />
              <Kpi icon={<ListTodo size={14} />} label="Open tasks" value={kpi.tasksOpen} sub={`${kpi.done7d} done in 7 days`} tone="amber" onClick={() => goTo('/sales/activities/tasks', { focus: 'open', team: '1' })} hint="View open tasks" />
              <Kpi icon={<AlertTriangle size={14} />} label="Overdue tasks" value={kpi.tasksOverdue} sub={kpi.tasksOverdue ? 'needs attention' : 'all on track'} tone="red" alert={kpi.tasksOverdue > 0} onClick={() => goTo('/sales/activities/tasks', { focus: 'overdue', team: '1' })} hint="View overdue tasks" />
              <Kpi icon={<Video size={14} />} label="Meetings today" value={kpi.meetings} sub={`${kpi.followUps} follow-ups due`} tone="purple" onClick={() => goTo('/sales/activities/meetings', { focus: 'today', team: '1' })} hint="View today's meetings" />
              <Kpi icon={<Phone size={14} />} label="Calls today" value={kpi.calls} sub="scheduled" tone="emerald" onClick={() => goTo('/sales/activities/calls', { focus: 'today', team: '1' })} hint="View today's calls" />
            </div>

            {overview?.totals?.unassignedProspects > 0 && selectedRep === 'all' && (
              <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
                <UserPlus size={14} />
                {overview.totals.unassignedProspects} prospect{overview.totals.unassignedProspects === 1 ? '' : 's'} waiting in the shared bucket – nobody has picked them up yet.
              </div>
            )}

            {/* TEAM PERFORMANCE */}
            <Section
              id="team-performance"
              icon={<TrendingUp size={18} />}
              title="Team performance"
              subtitle="Click a person to focus the whole dashboard on them"
              className="mb-6"
              action={
                selectedRep !== 'all' && (
                  <button onClick={() => setSelectedRep('all')} className="text-xs font-black text-blue-600 hover:underline">
                    Show whole team
                  </button>
                )
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <SortHead k="name" className="pl-6">Sales person</SortHead>
                      <SortHead k="pipeline">Pipeline</SortHead>
                      <SortHead k="rate">Conversion</SortHead>
                      <SortHead k="deals">Open deals</SortHead>
                      <SortHead k="open">Open tasks</SortHead>
                      <SortHead k="overdue">Overdue</SortHead>
                      <SortHead k="meetings">Meetings</SortHead>
                      <SortHead k="calls">Calls</SortHead>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Last active</th>
                      <th className="px-3 py-3 pr-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedReps.length === 0 && (
                      <tr><td colSpan={10}><EmptyState text="No sales people yet." /></td></tr>
                    )}
                    {sortedReps.map((r) => {
                      const active = selectedRep === idOf(r);
                      return (
                        <tr
                          key={r._id}
                          onClick={() => setSelectedRep(active ? 'all' : idOf(r))}
                          className={`cursor-pointer transition-colors ${active ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                        >
                          <td className="pl-6 pr-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-blue-900 text-white text-xs font-black flex items-center justify-center">
                                {r.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{r.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{r.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-slate-700">
                            {r.leadGen.total + r.prospects.total}
                            <span className="block text-[10px] font-semibold text-slate-400">
                              {r.leadGen.total} leads · {r.prospects.total} prospects
                            </span>
                          </td>
                          <td className="px-3 py-3 min-w-[110px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, r.conversionRate)}%` }} />
                              </div>
                              <span className="text-xs font-black text-blue-600 w-10 text-right">{r.conversionRate}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-slate-700">
                            {r.deals.open}
                            <span className="block text-[10px] font-semibold text-slate-400">{fmtMoney(r.deals.openValue)}</span>
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-slate-700">{r.tasks.open}</td>
                          <td className="px-3 py-3">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${r.tasks.overdue ? 'bg-red-50 text-red-600' : 'text-slate-300'}`}>
                              {r.tasks.overdue}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-slate-700">{r.meetingsToday}</td>
                          <td className="px-3 py-3 text-sm font-bold text-slate-700">{r.callsToday}</td>
                          <td className="px-3 py-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">{timeAgo(r.lastActive)}</td>
                          <td className="px-3 py-3 pr-6 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setAssign({ repId: idOf(r) }); }}
                              className="px-3 py-1.5 rounded-lg border border-blue-200 text-[11px] font-black text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                            >
                              Assign task
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* TASKS + SCHEDULE */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              {/* Assigned tasks tracker */}
              <Section
                className="xl:col-span-2"
                icon={<ClipboardCheck size={18} />}
                title="Assigned tasks"
                subtitle={focusedRep ? `Tasks for ${focusedRep.name}` : 'Everything you have handed out'}
                action={
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ['open', 'Open'],
                      ['overdue', 'Overdue'],
                      ['completed', 'Completed'],
                      ['all', 'All'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setTaskFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition ${
                          taskFilter === key
                            ? key === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {label} <span className="opacity-70">{taskCounts[key]}</span>
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="p-4 space-y-2 max-h-[560px] overflow-y-auto">
                  {shownTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-400">
                        {taskFilter === 'overdue' ? 'Nothing overdue 🎉' : 'No tasks here yet.'}
                      </p>
                      <button onClick={() => setAssign({ repId: focusedRep ? idOf(focusedRep) : null })} className="mt-2 text-xs font-black text-blue-600 hover:underline">
                        Assign a task
                      </button>
                    </div>
                  ) : (
                    shownTasks.map((t) => {
                      const late = isLate(t);
                      const done = t.status === 'Completed';
                      return (
                        <div
                          key={t._id}
                          className={`p-3.5 rounded-2xl border bg-white ${late ? 'border-red-200 bg-red-50/30' : 'border-slate-100'} ${busyTask === t._id ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`text-sm font-bold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</p>
                              {t.content && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.content}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${priorityStyle[t.priority] || priorityStyle.Medium}`}>
                                {t.priority || 'Medium'}
                              </span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${done ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {t.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <select
                                value={idOf(t.assignedTo)}
                                disabled={done || busyTask === t._id}
                                onChange={(e) => reassign(t, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none cursor-pointer disabled:opacity-60"
                                title="Re-assign"
                              >
                                {!reps.some((r) => idOf(r) === idOf(t.assignedTo)) && (
                                  <option value={idOf(t.assignedTo)}>{t.assignedTo?.name || 'Unknown'}</option>
                                )}
                                {reps.map((r) => <option key={r._id} value={idOf(r)}>{r.name}</option>)}
                              </select>
                              {t.leadId?.companyName && <span className="truncate max-w-[160px]">· {t.leadId.companyName}</span>}
                              <span>· assigned {timeAgo(t.assignedAt || t.createdAt)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold whitespace-nowrap ${late ? 'text-red-500' : 'text-slate-500'}`}>
                                {late ? 'Overdue · ' : ''}{fmtDate(t.dueAt)}
                              </span>
                              {!done && (
                                <button onClick={() => remind(t)} title="Send a reminder" className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600">
                                  <Bell size={14} />
                                </button>
                              )}
                              <button onClick={() => removeTask(t)} title="Delete task" className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Section>

              {/* Schedule + recent activity */}
              <div className="space-y-6">
                <Section icon={<Calendar size={18} />} title="Today's schedule" subtitle={`${schedule.length} meeting${schedule.length === 1 ? '' : 's'} & calls`}>
                  <div className="p-4 space-y-2 max-h-[250px] overflow-y-auto">
                    {schedule.length === 0 ? (
                      <EmptyState text="No meetings or calls today." />
                    ) : (
                      schedule.map((a) => (
                        <div key={a._id} className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100">
                          <span className={`p-1.5 rounded-lg ${typeTone[a.type]}`}>{typeIcon[a.type]}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{a.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {ownerOf(a)?.name || '—'}{a.leadId?.companyName ? ` · ${a.leadId.companyName}` : ''}
                            </p>
                          </div>
                          <span className="text-[10px] font-black text-slate-600 whitespace-nowrap">{fmtTime(a.scheduledAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Section>

                <Section icon={<TrendingUp size={18} />} title="Team activity" subtitle="Latest logged by the team">
                  <div className="p-4 space-y-2 max-h-[250px] overflow-y-auto">
                    {recent.length === 0 ? (
                      <EmptyState text="No recent activity." />
                    ) : (
                      recent.map((a) => (
                        <div key={a._id} className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100">
                          <span className={`p-1.5 rounded-lg ${typeTone[a.type]}`}>{typeIcon[a.type]}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {a.title || (a.content ? a.content.slice(0, 60) : `New ${a.type}`)}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {a.createdBy?.name || '—'} · {a.type}{a.assignedTo ? ` → ${a.assignedTo.name}` : ''}{a.leadId?.companyName ? ` · ${a.leadId.companyName}` : ''}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Section>
              </div>
            </div>
          </>
        )}
      </div>

      {assign && (
        <AssignTaskModal
          reps={reps}
          defaultRepId={assign.repId}
          onClose={() => setAssign(null)}
          onAssigned={() => fetchData(true)}
        />
      )}
    </div>
  );
};

export default SalesManagerDashboard;