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
    <div className="modal-backdrop" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="modal-panel max-w-xl"
      >
        <div className="modal-header">
          <div>
            <h2 className="section-title">Assign a task</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The task appears on their dashboard and they get a notification straight away.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body pb-6 space-y-5">
          {/* ASSIGNEES */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label block mb-1.5">
                Assign to ({selected.length} selected)
              </label>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : reps.map((r) => String(r._id)))}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Users size={12} /> {allSelected ? 'Clear all' : 'Select everyone'}
              </button>
            </div>
            {reps.length > 6 && (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sales person…"
                className="input mb-2 bg-slate-50"
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-semibold transition ${
                      on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {on && <Check size={12} />}
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
            <label className="label block mb-1.5">Task</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Follow up with Acme Corp on the proposal"
              className="input mt-1 bg-slate-50"
              autoFocus
            />
          </div>

          {/* DETAILS */}
          <div>
            <label className="label block mb-1.5">Details (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Context, links, what “done” looks like…"
              className="input mt-1 bg-slate-50 resize-none"
            />
          </div>

          {/* PRIORITY + DUE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="label block mb-1.5">Priority</label>
              <div className="mt-1 flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`btn btn-md flex-1 border ${
                      priority === p.value ? p.on : p.cls
                    }`}
                  >
                    {p.value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label block mb-1.5">Due date</label>
              <input
                type="date"
                min={today}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="input mt-1 bg-slate-50"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
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
