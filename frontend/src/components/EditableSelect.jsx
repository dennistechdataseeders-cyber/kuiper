// frontend/src/components/EditableSelect.jsx
//
// Drop-in replacement for <select> that lets a user add / rename / delete
// the field's dropdown options on the fly.
//
// The parent MUST pass `onOptionsChanged(newOptionsArray)` so it can
// re-render with the updated list (this is how we surface the new option
// without a full page reload).
//
// All mutations hit /api/leads/fields/:fieldKey/options.
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import API_BASE_URL from '../config';

const normalize = (opts = []) =>
  (opts || [])
    .map(o =>
      typeof o === 'string'
        ? { value: o, locked: false }
        : { value: String(o?.value ?? ''), locked: !!o?.locked }
    )
    .filter(o => o.value !== '');

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed';

export default function EditableSelect({
  fieldKey,
  value,
  onChange,
  options = [],
  onOptionsChanged,
  disabled = false,
  placeholder = '-None-',
  className = inputCls,
}) {
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // value of the row whose ⋯ menu is open
  const [renaming, setRenaming] = useState(null); // value currently being renamed
  const [renameValue, setRenameValue] = useState('');
  const cancelRename = useRef(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const list = normalize(options);
  const isPlaceholder = (v) => v === '-None-' || v === '';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setMenuFor(null);
      setAdding(false);
      setRenaming(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const apiErr = (err, fb) => err.response?.data?.error || fb;

  // ---------- ADD ----------
  const addOption = async () => {
    const v = newName.trim();
    if (!v || busy) return;
    try {
      setBusy(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/leads/fields/${fieldKey}/options`,
        { value: v },
        authHeader
      );
      const saved = res.data?.data?.options || [];
      onOptionsChanged?.(saved);
      onChange?.(v); // auto-select the new option
      setNewName('');
      setAdding(false);
      toast.success(`"${v}" added`);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to add option'));
    } finally {
      setBusy(false);
    }
  };

  // ---------- RENAME ----------
  const startRename = (opt) => {
    setMenuFor(null);
    cancelRename.current = false;
    setRenaming(opt.value);
    setRenameValue(opt.value);
  };

  const commitRename = async (opt) => {
    const next = renameValue.trim();
    setRenaming(null);
    if (cancelRename.current) { cancelRename.current = false; return; }
    if (!next || next === opt.value) return;
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/leads/fields/${fieldKey}/options`,
        { oldValue: opt.value, newValue: next },
        authHeader
      );
      const saved = res.data?.data?.options || [];
      onOptionsChanged?.(saved);
      if (value === opt.value) onChange?.(next); // keep the selection aligned
      toast.success('Option renamed');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to rename option'));
    }
  };

  // ---------- DELETE ----------
  const deleteOption = async (opt) => {
    setMenuFor(null);
    if (!window.confirm(`Remove "${opt.value}" from the dropdown?`)) return;
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/leads/fields/${fieldKey}/options/${encodeURIComponent(opt.value)}`,
        authHeader
      );
      const saved = res.data?.data?.options || [];
      onOptionsChanged?.(saved);
      if (value === opt.value) onChange?.(''); // clear selection if removed
      toast.success('Option removed');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to remove option'));
    }
  };

  // ---------- RENDER ----------
  return (
    <div className="relative">
      {/* Trigger button (mimics the native select box) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${className} flex items-center justify-between text-left`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400 shrink-0 ml-2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Placeholder row */}
          <button
            type="button"
            onClick={() => { onChange?.(''); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 ${
              !value ? 'font-bold text-blue-600' : 'text-slate-500'
            }`}
          >
            <span className="italic">{placeholder}</span>
            {!value && <Check size={14} className="text-blue-600" />}
          </button>

          {/* Options (with legacy "ghost" fallback for saved values not in the list) */}
          {(() => {
            const optionsToRender = list.filter(o => !isPlaceholder(o.value));
            if (value && !optionsToRender.some(o => o.value === value) && !isPlaceholder(value)) {
              optionsToRender.push({ value, locked: false, ghost: true });
            }
            return optionsToRender.map((opt) => (
              <div
                key={opt.value}
                className={`relative flex items-center ${opt.ghost ? 'bg-amber-50' : ''}`}
              >
                {renaming === opt.value ? (
                  <div className="flex items-center gap-1 w-full px-2 py-1">
                    <input
                      autoFocus
                      value={renameValue}
                      maxLength={60}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(opt)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') {
                          cancelRename.current = true;
                          setRenaming(null);
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded outline-none ring-2 ring-blue-100"
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { onChange?.(opt.value); setOpen(false); }}
                      className={`flex-1 text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                        value === opt.value ? 'font-bold text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      {opt.value}
                    </button>
                    {opt.ghost && (
                      <span className="mr-2 text-[9px] font-black uppercase text-amber-600">
                        legacy
                      </span>
                    )}
                    {!opt.ghost && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === opt.value ? null : opt.value);
                          }}
                          disabled={opt.locked}
                          title={opt.locked ? 'Locked option' : 'Edit option'}
                          className="p-1 mr-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {menuFor === opt.value && !opt.locked && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onMouseDown={() => setMenuFor(null)}
                            />
                            <div className="absolute right-6 top-full mt-1 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                              <button
                                type="button"
                                onClick={() => startRename(opt)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil size={12} /> Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteOption(opt)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ));
          })()}

          {/* Footer — Add new option */}
          <div className="border-t border-slate-100 p-1.5">
            {adding ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newName}
                  maxLength={60}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New option..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addOption();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={addOption}
                  disabled={busy || !newName.trim()}
                  className="p-1 rounded bg-blue-600 text-white disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewName(''); }}
                  disabled={busy}
                  className="p-1 rounded bg-slate-200 text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus size={12} /> Add option
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}