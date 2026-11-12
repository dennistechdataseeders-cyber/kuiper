// frontend/src/components/AssignTaskModal.jsx
//
// Sales Manager → assign a task to one or more sales reps.
// Creates one task per selected rep (POST /api/lead-activities with `assignedTo`);
// each rep gets a notification and the task shows on their dashboard.
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Send, Users, Check } from 'lucide-react';
import API_BASE_URL from '../config';

const PRIORITIES = [
  { value: 'Low', cls: 'border-slate-200 text-slate-600 bg-white', on: 'bg-slate-700 text-white border-slate-700' },
  { value: 'Medium', cls: 'border-amber-200 text-amber-700 bg-white', on: 'bg-amber-500 text-white border-amber-500' },
  { value: 'High', cls: 'border-red-200 text-red-600 bg-white', on: 'bg-red-600 text-white border-red-600' },
];

const AssignTaskModal = ({ reps = [], defaultRepId = null, onClose, onAssigned }) => {
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [selected, setSelected] = useState(() => (defaultRepId ? [String(defaultRepId)] : []));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const visible = reps.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const allSelected = reps.length > 0 && selected.length === reps.length;

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e) => {
    e.preventDefault();
    if (!selected.length) return toast.error('Pick at least one sales person');
    if (!title.trim()) return toast.error('Give the task a title');

    setSaving(true);
    const results = await Promise.allSettled(
      selected.map((repId) =>
        axios.post(
          `${API_BASE_URL}/api/lead-activities`,
          {
            type: 'task',
            title: title.trim(),
            content: content.trim(),
            priority,
            dueAt: dueAt || null,
            assignedTo: repId,
          },
          authHeader
        )
      )
    );
    setSaving(false);

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`Task assigned to ${ok} ${ok === 1 ? 'person' : 'people'}`);
    if (failed) {
      const firstErr = results.find((r) => r.status === 'rejected')?.reason;
      toast.error(firstErr?.response?.data?.error || `${failed} assignment(s) failed`);
    }
    if (ok) {
      onAssigned?.();
      if (!failed) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Assign a task</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The task appears on their dashboard and they get a notification straight away.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* ASSIGNEES */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Assign to ({selected.length} selected)
              </label>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : reps.map((r) => String(r._id)))}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Users size={12} /> {allSelected ? 'Clear all' : 'Select everyone'}
              </button>
            </div>
            {reps.length > 6 && (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sales person…"
                className="w-full mb-2 px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              />
            )}
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {visible.map((r) => {
                const id = String(r._id);
                const on = selected.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => toggle(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition ${
                      on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {on && <Check size={11} />}
                    </span>
                    <span className="truncate">{r.name}</span>
                  </button>
                );
              })}
              {visible.length === 0 && (
                <p className="col-span-2 text-center text-xs text-slate-400 py-4">No sales people found</p>
              )}
            </div>
          </div>

          {/* TITLE */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Follow up with Acme Corp on the proposal"
              className="mt-1 w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          {/* DETAILS */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Details (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Context, links, what “done” looks like…"
              className="mt-1 w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* PRIORITY + DUE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Priority</label>
              <div className="mt-1 flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs font-black transition ${
                      priority === p.value ? p.on : p.cls
                    }`}
                  >
                    {p.value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due date</label>
              <input
                type="date"
                min={today}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full px-4 py-2 text-sm font-semibold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Assign task
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssignTaskModal;
