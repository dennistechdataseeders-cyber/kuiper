// path: frontend/src/components/ColumnFilterMenu.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Filter, EyeOff, Check, SlidersHorizontal } from 'lucide-react';

// ============================================
// Hidden-column persistence
// ============================================
const readList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

export function useHiddenColumns(storageKey) {
  const [hidden, setHidden] = useState(() => readList(storageKey));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(hidden));
    } catch { /* ignore */ }
  }, [storageKey, hidden]);

  const hide = useCallback(
    (key) => setHidden((prev) => (prev.includes(key) ? prev : [...prev, key])),
    []
  );
  const toggle = useCallback(
    (key) => setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
    []
  );
  const reset = useCallback(() => setHidden([]), []);

  return { hidden, hide, toggle, reset };
}

// ============================================
// Client-side sorting (empty values always sink to the bottom)
// ============================================
export function sortRows(rows, sort, getSortValue) {
  if (!sort?.key || !sort?.dir) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  const norm = (v) => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.join(', ');
    return String(v).trim();
  };

  return [...rows].sort((a, b) => {
    const av = norm(getSortValue(a, sort.key));
    const bv = norm(getSortValue(b, sort.key));
    const aEmpty = av === '';
    const bEmpty = bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}

// ============================================
// ☰ icon
// ============================================
function HamburgerIcon() {
  return (
    <span aria-hidden="true" className="flex flex-col gap-[2.5px]">
      <span className="block w-3 h-[1.5px] rounded bg-current" />
      <span className="block w-3 h-[1.5px] rounded bg-current" />
      <span className="block w-3 h-[1.5px] rounded bg-current" />
    </span>
  );
}

function MenuItem({ icon: Icon, label, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50 disabled:hover:bg-transparent'
      }`}
    >
      <Icon size={14} className={active ? 'text-blue-600' : 'text-slate-400'} />
      <span className="flex-1">{label}</span>
      {active && <Check size={13} className="text-blue-600" />}
    </button>
  );
}

// ============================================
// Per-column dropdown: Asc / Desc / Filter by… / Hide Column
//
// Rendered through a portal with fixed positioning so the table's
// `overflow-x-auto` wrapper can never clip it.
// ============================================
const MENU_WIDTH = 192;

export default function ColumnFilterMenu({
  label,
  sortDir = null,
  onSort,
  onFilter,
  onHide,
  canHide = true
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8));
    setPos({ top: r.bottom + 6, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const run = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        aria-label={`${label} column options`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Column options"
        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition ${
          open ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700'
        }`}
      >
        <HamburgerIcon />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-[200] bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 normal-case tracking-normal"
          >
            <MenuItem
              icon={ArrowUp}
              label="Asc"
              active={sortDir === 'asc'}
              onClick={run(() => onSort?.(sortDir === 'asc' ? null : 'asc'))}
            />
            <MenuItem
              icon={ArrowDown}
              label="Desc"
              active={sortDir === 'desc'}
              onClick={run(() => onSort?.(sortDir === 'desc' ? null : 'desc'))}
            />
            {onFilter && <MenuItem icon={Filter} label="Filter by…" onClick={run(onFilter)} />}
            {onHide && (
              <MenuItem icon={EyeOff} label="Hide Column" disabled={!canHide} onClick={run(onHide)} />
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// ============================================
// <th> with label, sort arrow and ☰ menu
// ============================================
export function ColumnTh({
  label,
  sortDir = null,
  onSort,
  onFilter,
  onHide,
  canHide = true,
  className = ''
}) {
  return (
    <th
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'}
      className={`px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {sortDir === 'asc' && <ArrowUp size={11} className="text-blue-600" />}
        {sortDir === 'desc' && <ArrowDown size={11} className="text-blue-600" />}
        <ColumnFilterMenu
          label={label}
          sortDir={sortDir}
          onSort={onSort}
          onFilter={onFilter}
          onHide={onHide}
          canHide={canHide}
        />
      </div>
    </th>
  );
}

// ============================================
// "Columns" toolbar button — restores hidden columns
// ============================================
export function ColumnVisibilityMenu({ columns = [], hidden = [], onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hiddenCount = columns.filter((c) => hidden.includes(c.key)).length;
  const visibleCount = columns.length - hiddenCount;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition"
      >
        <SlidersHorizontal size={12} /> Columns
        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black">
            {hiddenCount} hidden
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Show columns</span>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:underline"
              >
                Show all
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {columns.map((c) => {
              const isHidden = hidden.includes(c.key);
              const isLastVisible = !isHidden && visibleCount <= 1;
              return (
                <label
                  key={c.key}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition ${
                    isLastVisible ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'
                  } ${isHidden ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    disabled={isLastVisible}
                    onChange={() => onToggle?.(c.key)}
                    className="rounded border-slate-300"
                  />
                  <span className="truncate">{c.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}