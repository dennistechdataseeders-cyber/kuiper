// frontend/src/pages/ActivitiesTasks.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Search, Loader2, Plus, MoreHorizontal, Pencil, Trash2, Lock, X,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { getActivityLeadName } from '../utils/useAlphaPagination';

// "Completed" is a built-in stage (locked on the server): the Lead page treats it as finished.
const DONE_STAGE = 'Completed';
const EDIT_ROLES = ['Super Admin', 'Admin', 'Sales', 'Sales Manager'];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—'); // dd/mm/yyyy

const isOverdue = (task, stageName) => {
  if (!task.dueAt || stageName === DONE_STAGE) return false;
  const end = new Date(task.dueAt);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
};

export default function ActivitiesTasks() {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const canEdit = EDIT_ROLES.includes(localStorage.getItem('role') || '');

  const [stages, setStages] = useState([]);   // [{ _id, name, locked, taskCount }]
  const [items, setItems] = useState([]);     // tasks
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // drag & drop
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  // stage management
  const [menuFor, setMenuFor] = useState(null);        // stage _id with its ⋯ menu open
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const cancelRename = useRef(false); // set when Esc is pressed so the blur doesn't save
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);      // stage being removed
  const [moveTo, setMoveTo] = useState('');

  const apiErr = (err, fallback) => err.response?.data?.error || fallback;

  // ---------- load ----------
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, t] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/task-stages`, authHeader),
        axios.get(`${API_BASE_URL}/api/lead-activities?type=task&scope=mine`, authHeader),
      ]);
      setStages(s.data?.data || []);
      setItems(t.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  // Old tasks were saved as 'Open' / 'Cancelled', and a removed stage may leave
  // stray statuses behind: show those in a sensible column instead of hiding them.
  const stageNames = useMemo(() => stages.map((s) => s.name), [stages]);
  const normalizeStatus = useCallback((status) => {
    if (stageNames.includes(status)) return status;
    if (status === 'Cancelled' && stageNames.includes('Deferred')) return 'Deferred';
    return stageNames[0];
  }, [stageNames]);

  // ---------- derived ----------
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) =>
      (i.title || '').toLowerCase().includes(s) ||
      (i.content || '').toLowerCase().includes(s) ||
      getActivityLeadName(i).toLowerCase().includes(s) ||
      (i.leadId?.companyName || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(stageNames.map((n) => [n, []]));
    filtered.forEach((i) => { const n = normalizeStatus(i.status); if (map[n]) map[n].push(i); });
    return stages.map((stage) => {
      const list = map[stage.name] || [];
      return { stage, list, overdue: list.filter((t) => isOverdue(t, stage.name)).length };
    });
  }, [filtered, stages, stageNames, normalizeStatus]);

  // ---------- move a task (drag & drop) ----------
  const moveTask = async (id, newStage) => {
    const task = items.find((i) => i._id === id);
    if (!task || normalizeStatus(task.status) === newStage) return;

    const previous = task.status;
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, status: newStage } : i))); // optimistic
    try {
      await axios.patch(`${API_BASE_URL}/api/lead-activities/${id}`, { status: newStage }, authHeader);
      toast.success(`Moved to ${newStage}`);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i._id === id ? { ...i, status: previous } : i))); // revert
      toast.error(apiErr(err, 'Failed to move task'));
    }
  };

  const onDrop = (e, stageName) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setOverStage(null);
    if (id) moveTask(id, stageName);
  };

  // ---------- stage management ----------
  const startRename = (stage) => {
    setMenuFor(null);
    cancelRename.current = false;
    setRenamingId(stage._id);
    setRenameValue(stage.name);
  };

  const saveRename = async (stage) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (cancelRename.current) { cancelRename.current = false; return; }
    if (!name || name === stage.name) return;
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/task-stages/${stage._id}`, { name }, authHeader);
      const saved = res.data?.data;
      setStages((prev) => prev.map((s) => (s._id === stage._id ? { ...s, name: saved?.name || name } : s)));
      setItems((prev) => prev.map((i) => (i.status === stage.name ? { ...i, status: name } : i)));
      toast.success('Stage renamed');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to rename stage'));
    }
  };

  const addStage = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE_URL}/api/task-stages`, { name }, authHeader);
      setStages((prev) => [...prev, res.data.data]);
      setNewName('');
      setAdding(false);
      toast.success('Stage added');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to add stage'));
    } finally {
      setBusy(false);
    }
  };

  const askDelete = (stage) => {
    setMenuFor(null);
    const firstOther = stages.find((s) => s._id !== stage._id);
    setMoveTo(firstOther?._id || '');
    setDeleting(stage);
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    const target = stages.find((s) => s._id === moveTo);
    try {
      setBusy(true);
      await axios.delete(
        `${API_BASE_URL}/api/task-stages/${deleting._id}${moveTo ? `?moveTo=${moveTo}` : ''}`,
        authHeader
      );
      setStages((prev) => prev.filter((s) => s._id !== deleting._id));
      if (target) {
        setItems((prev) => prev.map((i) => (i.status === deleting.name ? { ...i, status: target.name } : i)));
      }
      toast.success('Stage removed');
      setDeleting(null);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to remove stage'));
    } finally {
      setBusy(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* ---------- Header ---------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Tasks</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} task{filtered.length === 1 ? '' : 's'} · drag a card to change its stage
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {columns.map(({ stage, list, overdue }) => (
            <div
              key={stage._id}
              onDragOver={(e) => { e.preventDefault(); if (overStage !== stage.name) setOverStage(stage.name); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null); }}
              onDrop={(e) => onDrop(e, stage.name)}
              className="w-[320px] shrink-0"
            >
              {/* column header */}
              <div className="bg-cyan-50 border-t-4 border-teal-300 rounded-t-lg px-4 py-3">
                {renamingId === stage._id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    maxLength={40}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(stage)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { cancelRename.current = true; setRenamingId(null); }
                    }}
                    className="w-full px-2 py-1 rounded-md border border-blue-400 text-sm font-bold text-slate-800 outline-none ring-2 ring-blue-100 bg-white"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{stage.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-200/70 text-teal-800 text-[11px] font-black">
                      {list.length}
                    </span>
                    {stage.locked && (
                      <Lock size={12} className="text-slate-400 shrink-0" title="Built-in stage — can't be renamed or removed" />
                    )}

                    {canEdit && !stage.locked && (
                      <div className="relative ml-auto">
                        <button
                          onClick={() => setMenuFor(menuFor === stage._id ? null : stage._id)}
                          className="p-1 rounded-md text-slate-500 hover:bg-white/70 transition"
                          title="Stage options"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuFor === stage._id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                              <button
                                onClick={() => startRename(stage)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                              >
                                <Pencil size={14} /> Rename
                              </button>
                              <button
                                onClick={() => askDelete(stage)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition text-left"
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className={`text-sm font-black mt-1 ${overdue > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                  {overdue} overdue
                </p>
              </div>

              {/* cards */}
              <div
                className={`rounded-b-lg p-2 space-y-2 min-h-[140px] max-h-[calc(100vh-290px)] overflow-y-auto transition-colors ${
                  overStage === stage.name ? 'bg-blue-100/70 ring-2 ring-blue-300' : 'bg-slate-200/50'
                }`}
              >
                {list.map((t) => {
                  const leadName = getActivityLeadName(t);
                  const company = t.leadId?.companyName;
                  const late = isOverdue(t, stage.name);
                  return (
                    <div
                      key={t._id}
                      draggable
                      onDragStart={(e) => { setDraggingId(t._id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t._id); }}
                      onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                      className={`bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition ${
                        draggingId === t._id ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                      <div className="mt-1 space-y-0.5 text-[13px] text-slate-600">
                        <p className="truncate">{stage.name}</p>
                        <p className="truncate">{leadName}</p>
                        {company && company !== leadName && <p className="truncate">{company}</p>}
                        <p className="font-semibold text-slate-700">{t.priority || 'Medium'} priority</p>
                      </div>
                      <p className={`text-[13px] mt-1 ${late ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                        {fmtDate(t.dueAt)}
                      </p>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <p className="text-center text-xs font-semibold text-slate-400 py-6">No tasks</p>
                )}
              </div>
            </div>
          ))}

          {/* ---------- Add stage ---------- */}
          {canEdit && (
            <div className="w-[320px] shrink-0">
              {adding ? (
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                  <input
                    autoFocus
                    value={newName}
                    maxLength={40}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addStage();
                      if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                    }}
                    placeholder="Stage name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={busy}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setAdding(false); setNewName(''); }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addStage}
                      disabled={busy || !newName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busy ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-slate-300 text-sm font-bold text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition"
                >
                  <Plus size={16} /> Add Stage
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- Remove-stage dialog ---------- */}
      {deleting && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Remove “{deleting.name}”?</h3>
              <button onClick={() => setDeleting(null)} disabled={busy} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {deleting.taskCount > 0 ? (
                <>
                  <p className="text-sm text-slate-600">
                    This stage has <b>{deleting.taskCount}</b> task{deleting.taskCount === 1 ? '' : 's'} (across the whole team).
                    Choose where they should go:
                  </p>
                  <select
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={busy}
                  >
                    {stages.filter((s) => s._id !== deleting._id).map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-sm text-slate-600">This stage has no tasks. It will simply be removed from the board.</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDeleting(null)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={busy || (deleting.taskCount > 0 && !moveTo)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? <><Loader2 size={14} className="animate-spin" /> Removing...</> : 'Remove stage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}