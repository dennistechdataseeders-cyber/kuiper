// frontend/src/components/AssignedToMePanel.jsx
//
// "Assigned by your manager" – sits at the top of the Sales dashboard.
// Shows open tasks a Sales Manager handed to the logged-in rep, overdue first,
// with one-click Start / Done. Refreshes live when a new task arrives
// (SalesNotifier dispatches `tasks:refresh`).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Check, Play, Clock, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import API_BASE_URL from '../config';

const priorityStyle = {
  High: 'bg-red-50 text-red-600 border-red-100',
  Medium: 'bg-amber-50 text-amber-600 border-amber-100',
  Low: 'bg-slate-50 text-slate-500 border-slate-200',
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No due date');

const AssignedToMePanel = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/lead-activities?type=task&scope=assigned`, authHeader);
      setTasks(res.data?.data || []);
    } catch (err) {
      console.error('Assigned tasks load failed', err);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    load();
    window.addEventListener('tasks:refresh', load);
    return () => window.removeEventListener('tasks:refresh', load);
  }, [load]);

  const open = useMemo(() => {
    const today = startOfToday();
    return tasks
      .filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
      .map((t) => ({ ...t, late: t.dueAt && new Date(t.dueAt) < today }))
      .sort((a, b) => {
        if (a.late !== b.late) return a.late ? -1 : 1;
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt) - new Date(b.dueAt);
      });
  }, [tasks]);

  const setStatus = async (task, status) => {
    setBusyId(task._id);
    try {
      await axios.patch(`${API_BASE_URL}/api/lead-activities/${task._id}`, { status }, authHeader);
      toast.success(status === 'Completed' ? 'Task completed – your manager was notified' : 'Task started');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update task');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || open.length === 0) return null;

  const overdue = open.filter((t) => t.late).length;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm overflow-hidden mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white">
            <UserCheck size={16} />
          </div>
          <div>
            <h2 className="section-title">Assigned to you by your manager</h2>
            <p className="meta">
              {open.length} open{overdue ? ` · ${overdue} overdue` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/sales/activities/tasks')}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          Open task board <ArrowRight size={12} />
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {open.slice(0, 6).map((t) => (
          <div
            key={t._id}
            className={`p-3 rounded-xl border bg-white ${t.late ? 'border-red-200' : 'border-slate-100'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-800 leading-snug">{t.title}</p>
              <span
                className={`badge rounded-full shrink-0 border ${
                  priorityStyle[t.priority] || priorityStyle.Medium
                }`}
              >
                {t.priority || 'Medium'}
              </span>
            </div>

            {t.content && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{t.content}</p>}

            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 truncate">
                From <b className="text-slate-600">{t.assignedBy?.name || 'Manager'}</b>
                {t.leadId?.companyName ? ` · ${t.leadId.companyName}` : ''}
              </span>
              <span
                className={`flex items-center gap-1 font-bold whitespace-nowrap ${
                  t.late ? 'text-red-500' : 'text-slate-500'
                }`}
              >
                {t.late ? <AlertTriangle size={12} /> : <Clock size={12} />}
                {t.late ? 'Overdue · ' : ''}
                {fmtDate(t.dueAt)}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              {t.status !== 'In Progress' && (
                <button
                  disabled={busyId === t._id}
                  onClick={() => setStatus(t, 'In Progress')}
                  className="btn btn-sm flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Play size={12} /> Start
                </button>
              )}
              <button
                disabled={busyId === t._id}
                onClick={() => setStatus(t, 'Completed')}
                className="btn btn-sm flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busyId === t._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Done
              </button>
            </div>
          </div>
        ))}
      </div>

      {open.length > 6 && (
        <button
          onClick={() => navigate('/sales/activities/tasks')}
          className="w-full py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-blue-100"
        >
          +{open.length - 6} more on the task board
        </button>
      )}
    </div>
  );
};

export default AssignedToMePanel;
