// frontend/src/components/InlineEdit.jsx
//
// Shared "edit in place" building blocks for detail pages
// (LeadDetail, ActivityDetail): compact fields, collapsible groups,
// a floating save bar, Ctrl/Cmd+S and an unsaved-changes warning.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, Save } from 'lucide-react';

// ============================================
// INLINE FIELD (label on top, compact input; changed fields are highlighted)
// ============================================
export const cellInput = (changed, disabled) =>
  `w-full h-9 px-2.5 rounded-md border text-sm text-slate-800 outline-none transition-all ${
    disabled
      ? 'bg-slate-50 border-slate-100 text-slate-600 cursor-default'
      : changed
        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
        : 'bg-white border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }`;

export function Cell({ label, required, changed, wide, children }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
      <label className="flex items-center gap-1 mb-1 text-[11px] font-bold text-slate-500">
        <span className="truncate">{label}</span>
        {required && <span className="text-red-500">*</span>}
        {changed && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved change" />}
      </label>
      {children}
    </div>
  );
}

export function InlineSelect({ value, options, onChange, disabled, changed }) {
  // keep a saved value visible even if it was later removed from the option list
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={cellInput(changed, disabled)}>
      <option value="">-None-</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function InlineCustom({ def, value, onChange, disabled, changed }) {
  const cls = cellInput(changed, disabled);
  const common = { disabled, className: cls, placeholder: def.placeholder || '' };
  switch (def.kind) {
    case 'textarea':
      return <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} className={`${cls} h-auto py-2 resize-y`} />;
    case 'select':
      return <InlineSelect value={value} options={def.options} onChange={onChange} disabled={disabled} changed={changed} />;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 h-9 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="w-4 h-4 accent-blue-600" />
          {def.placeholder || 'Yes'}
        </label>
      );
    case 'date':
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'number':
      return <input type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'email':
      return <input type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'phone':
      return <input type="tel" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    default:
      return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

// Collapsible block; open/closed is remembered per browser
export function FieldGroup({ id, title, count, children }) {
  const storageKey = `leadDetail.group.${id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'closed'; } catch { return true; }
  });
  const toggle = () => {
    setOpen((v) => {
      try { localStorage.setItem(storageKey, v ? 'closed' : 'open'); } catch { /* ignore */ }
      return !v;
    });
  };
  return (
    <section className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-50/70 transition"
      >
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{title}</span>
        {count > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black">
            {count} changed
          </span>
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 grid gap-x-4 gap-y-2.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {children}
        </div>
      )}
    </section>
  );
}

// flatten { a, b: { c } } → { a, 'b.c' } so changes can be counted per field
export const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v, key));
    else acc[key] = v ?? '';
    return acc;
  }, {});

// ============================================
// Tracks unsaved changes between `form` and `baseline`
//   const u = useUnsavedChanges(form, baseline, save);
//   u.dirty, u.count, u.isChanged('address.city'), u.changedIn('address.')
// Adds Ctrl/Cmd+S → save and a browser warning when leaving with changes.
// ============================================
export function useUnsavedChanges(form, baseline, onSave) {
  const changedKeys = useMemo(() => {
    const a = flatten(form || {});
    const b = flatten(baseline || {});
    return new Set(
      [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => String(a[k] ?? '') !== String(b[k] ?? ''))
    );
  }, [form, baseline]);
  const dirty = changedKeys.size > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const saveRef = useRef(onSave);
  useEffect(() => { saveRef.current = onSave; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    dirty,
    count: changedKeys.size,
    isChanged: (key) => changedKeys.has(key),
    changedIn: (...prefixes) => [...changedKeys].filter((k) => prefixes.some((p) => k === p || k.startsWith(p))).length,
  };
}

// ============================================
// Floating save bar — sits at the bottom of the screen while there are changes
// ============================================
export function FloatingSaveBar({ show, count, saving, onSave, onDiscard, isCollapsed }) {
  if (!show) return null;
  return (
    <div className={`fixed bottom-5 right-0 z-[60] flex justify-center pointer-events-none transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-64'}`}>
      <div className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl bg-slate-900 text-white shadow-2xl shadow-slate-900/30 border border-slate-700">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm font-semibold">
          {count} unsaved change{count === 1 ? '' : 's'}
        </span>
        <span className="hidden md:inline text-[11px] text-slate-400">Ctrl + S to save</span>
        <button
          onClick={onDiscard}
          disabled={saving}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-70"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
