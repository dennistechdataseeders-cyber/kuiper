// frontend/src/components/ColumnTable.jsx
//
// UI for utils/useColumnTable.js
//   <ColumnToolbar ct={ct} />   chips for active sort/filters + "Columns" picker (restore hidden columns)
//   <ColumnHead   ct={ct} />    <thead> whose cells have the Zoho-style menu (Sort / Pin / Filter by / Hide)
//
// Body cells:  <td {...ct.cellProps(col, 'px-6 py-4')}>{col.render(row)}</td>
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Menu, ArrowUp, ArrowDown, Pin, PinOff, Filter, EyeOff, X, Columns3, RotateCcw, Search,
} from 'lucide-react';
import { EMPTY_TOKEN, opsFor, sortLabels } from '../utils/useColumnTable';

const DEFAULT_TH = 'px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider';

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all';

// ============================================
// Floating popup (portal → never clipped by the table's overflow-x-auto)
// ============================================
function Popup({ anchor, onClose, width = 200, align = 'left', children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const close = () => closeRef.current();
    const onScroll = (e) => {
      if (ref.current && ref.current.contains(e.target)) return; // scrolling inside the popup is fine
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  let left = align === 'right' ? anchor.right - width : anchor.left;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  const top = anchor.bottom + 4;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[190]" onMouseDown={() => closeRef.current()} />
      <div
        ref={ref}
        className="fixed z-[191] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto"
        style={{ top, left, width, maxHeight: Math.max(160, window.innerHeight - top - 12) }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
};

// ============================================
// "Filter by" panel
// ============================================
function FilterPanel({ ct, col, onClose }) {
  const type = col.type || 'text';
  const isSelect = type === 'select';
  const ops = opsFor(type);
  const existing = ct.filters[col.key];

  const [op, setOp] = useState(!isSelect && existing && existing.op !== 'in' ? existing.op : ops[0][0]);
  const [value, setValue] = useState(!isSelect && existing && existing.op !== 'in' ? existing.value ?? '' : '');
  const [picked, setPicked] = useState(isSelect && existing?.op === 'in' ? existing.value : []);
  const [search, setSearch] = useState('');

  // distinct values (with counts) for pick-list columns
  const options = useMemo(() => {
    if (!isSelect) return [];
    const counts = new Map();
    const bump = (key) => counts.set(key, (counts.get(key) || 0) + 1);
    ct.sourceRows.forEach((row) => {
      const raw = col.getValue(row);
      if (Array.isArray(raw)) {
        // multi-value cell (tags): count every value once
        if (raw.length === 0) bump(EMPTY_TOKEN);
        else [...new Set(raw.map(String))].forEach(bump);
        return;
      }
      bump(raw === undefined || raw === null || raw === '' ? EMPTY_TOKEN : String(raw));
    });
    return [...counts.entries()]
      .map(([val, count]) => ({ val, count, label: val === EMPTY_TOKEN ? '(Empty)' : val }))
      .sort((a, b) => {
        if (a.val === EMPTY_TOKEN) return 1;
        if (b.val === EMPTY_TOKEN) return -1;
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ct.sourceRows, col.key]);

  const shown = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()));
  const noValueNeeded = op === 'empty' || op === 'notEmpty';

  const apply = () => {
    if (isSelect) {
      ct.setFilter(col.key, picked.length ? { op: 'in', value: picked } : null);
    } else if (noValueNeeded) {
      ct.setFilter(col.key, { op });
    } else if (value === '' || value === null) {
      ct.setFilter(col.key, null);
    } else {
      ct.setFilter(col.key, { op, value });
    }
    onClose();
  };

  const clear = () => {
    ct.setFilter(col.key, null);
    onClose();
  };

  const togglePick = (val) =>
    setPicked((p) => (p.includes(val) ? p.filter((x) => x !== val) : [...p, val]));

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        Filter by <span className="text-slate-800">{col.label}</span>
      </p>

      {isSelect ? (
        <>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className={`${inputCls} pl-8`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <button
              onClick={() => setPicked(shown.map((o) => o.val))}
              className="text-blue-600 hover:underline"
            >
              Select all
            </button>
            <button onClick={() => setPicked([])} className="text-slate-400 hover:text-red-500">
              Clear selection
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto -mx-1">
            {shown.length === 0 ? (
              <p className="px-2 py-3 text-xs font-semibold text-slate-400">No values</p>
            ) : (
              shown.map((o) => (
                <label
                  key={o.val}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-blue-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(o.val)}
                    onChange={() => togglePick(o.val)}
                    className="accent-blue-600"
                  />
                  <span className="truncate flex-1">{o.label}</span>
                  <span className="text-[10px] font-bold text-slate-400">{o.count}</span>
                </label>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <select
            value={op}
            onChange={(e) => { setOp(e.target.value); setValue(''); }}
            className={inputCls}
          >
            {ops.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {!noValueNeeded && (
            <input
              autoFocus
              type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
              placeholder={type === 'number' ? '0' : 'Value...'}
              className={inputCls}
            />
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={clear}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          onClick={apply}
          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ============================================
// Header cell + its menu
// ============================================
function HeaderCell({ ct, col, thClass }) {
  const [anchor, setAnchor] = useState(null);
  const [mode, setMode] = useState(null); // null | 'menu' | 'filter'

  const hasMenu = col.menu !== false && !!col.getValue;
  const type = col.type || 'text';
  const [ascLabel, descLabel] = sortLabels(type);
  const sortDir = ct.sort?.key === col.key ? ct.sort.dir : null;
  const filtered = !!ct.filters[col.key];
  const pinned = ct.isPinned(col.key);
  const canPin = !col.fixed;
  const canHide = !col.fixed && ct.visibleColumns.filter((c) => !c.fixed).length > 1;

  const close = () => { setMode(null); setAnchor(null); };
  const open = (e) => {
    setAnchor(rectOf(e.currentTarget.closest('th')));
    setMode('menu');
  };

  const { className, style } = ct.cellProps(col, `${col.thClass ?? thClass} group whitespace-nowrap`, { head: true });
  const active = !!sortDir || filtered || pinned;

  const item =
    'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-left transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <th className={className} style={style}>
      <div className="flex items-center gap-1.5">
        <span className="truncate">{col.renderHeader ? col.renderHeader() : col.label}</span>
        {sortDir === 'asc' && <ArrowUp size={12} className="text-blue-600 shrink-0" />}
        {sortDir === 'desc' && <ArrowDown size={12} className="text-blue-600 shrink-0" />}
        {filtered && <Filter size={11} className="text-blue-600 shrink-0" fill="currentColor" />}
        {pinned && <Pin size={11} className="text-blue-600 shrink-0" />}

        {hasMenu && (
          <button
            onClick={open}
            title="Column options"
            className={`ml-auto shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition ${
              mode ? 'bg-slate-200 opacity-100' : active ? 'opacity-100' : 'opacity-60 md:opacity-0 md:group-hover:opacity-100'
            }`}
          >
            <Menu size={13} />
          </button>
        )}
      </div>

      {mode === 'menu' && anchor && (
        <Popup anchor={anchor} onClose={close} width={200}>
          <div className="py-1.5 normal-case tracking-normal">
            <button
              onClick={() => { ct.setSort(col.key, 'asc'); close(); }}
              className={`${item} ${sortDir === 'asc' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <ArrowUp size={14} /> {ascLabel}
            </button>
            <button
              onClick={() => { ct.setSort(col.key, 'desc'); close(); }}
              className={`${item} ${sortDir === 'desc' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <ArrowDown size={14} /> {descLabel}
            </button>
            <button
              disabled={!canPin}
              onClick={() => { ct.togglePin(col.key); close(); }}
              className={`${item} text-slate-700 hover:bg-slate-50`}
            >
              {pinned ? <PinOff size={14} /> : <Pin size={14} />} {pinned ? 'Unpin Column' : 'Pin Column'}
            </button>
            <button
              onClick={() => setMode('filter')}
              className={`${item} ${filtered ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <Filter size={14} /> Filter by
            </button>
            <button
              disabled={!canHide}
              onClick={() => { ct.hideColumn(col.key); close(); }}
              className={`${item} text-slate-700 hover:bg-slate-50`}
            >
              <EyeOff size={14} /> Hide Column
            </button>
          </div>
        </Popup>
      )}

      {mode === 'filter' && anchor && (
        <Popup anchor={anchor} onClose={close} width={260}>
          <div className="normal-case tracking-normal font-normal">
            <FilterPanel ct={ct} col={col} onClose={close} />
          </div>
        </Popup>
      )}
    </th>
  );
}

// ============================================
// <thead>
// ============================================
export function ColumnHead({ ct, thClass = DEFAULT_TH }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        {ct.visibleColumns.map((col) => (
          <HeaderCell key={col.key} ct={ct} col={col} thClass={thClass} />
        ))}
      </tr>
    </thead>
  );
}

// ============================================
// Toolbar: chips + Columns picker
// ============================================
function describeFilter(col, f) {
  if (f.op === 'in') {
    return f.value.length === 1
      ? `is "${f.value[0] === EMPTY_TOKEN ? '(Empty)' : f.value[0]}"`
      : `is any of ${f.value.length}`;
  }
  const label = opsFor(col.type || 'text').find(([k]) => k === f.op)?.[1] || f.op;
  return f.op === 'empty' || f.op === 'notEmpty' ? label : `${label} "${f.value}"`;
}

export function ColumnToolbar({ ct, className = '' }) {
  const [anchor, setAnchor] = useState(null);

  const colByKey = new Map(ct.columns.map((c) => [c.key, c]));
  const filterChips = Object.entries(ct.filters).filter(([k]) => colByKey.has(k));
  const sortCol = ct.sort ? colByKey.get(ct.sort.key) : null;
  const toggleable = ct.columns.filter((c) => !c.fixed && c.getValue);
  const visibleCount = toggleable.filter((c) => !ct.hidden.includes(c.key)).length;
  const layoutChanged = ct.hidden.length > 0 || ct.pinned.length > 0;
  const dirty = layoutChanged || !!sortCol || filterChips.length > 0;

  const chip =
    'inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-700';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {sortCol && (
        <span className={chip}>
          {ct.sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {sortCol.label}
          <button onClick={() => ct.setSort(null)} title="Clear sort" className="p-0.5 rounded-full hover:bg-blue-100">
            <X size={11} />
          </button>
        </span>
      )}

      {filterChips.map(([k, f]) => (
        <span key={k} className={chip}>
          <Filter size={11} />
          {colByKey.get(k).label} {describeFilter(colByKey.get(k), f)}
          <button onClick={() => ct.setFilter(k, null)} title="Remove filter" className="p-0.5 rounded-full hover:bg-blue-100">
            <X size={11} />
          </button>
        </span>
      ))}

      {filterChips.length > 1 && (
        <button
          onClick={ct.clearFilters}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition"
        >
          <RotateCcw size={11} /> Clear filters
        </button>
      )}

      <div className="ml-auto">
        <button
          onClick={(e) => setAnchor(rectOf(e.currentTarget))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition"
        >
          <Columns3 size={13} /> Columns
          {ct.hidden.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black">
              {ct.hidden.length} hidden
            </span>
          )}
        </button>
      </div>

      {anchor && (
        <Popup anchor={anchor} onClose={() => setAnchor(null)} width={230} align="right">
          <div className="py-2">
            <p className="px-3.5 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Show / hide columns
            </p>
            {toggleable.map((c) => {
              const isHidden = ct.hidden.includes(c.key);
              const lastOne = !isHidden && visibleCount <= 1;
              return (
                <label
                  key={c.key}
                  className={`flex items-center gap-2.5 px-3.5 py-1.5 text-sm text-slate-700 ${
                    lastOne ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    disabled={lastOne}
                    onChange={() => (isHidden ? ct.showColumn(c.key) : ct.hideColumn(c.key))}
                    className="accent-blue-600"
                  />
                  <span className="truncate">{c.label}</span>
                  {ct.isPinned(c.key) && <Pin size={11} className="ml-auto text-blue-600 shrink-0" />}
                </label>
              );
            })}
            {dirty && (
              <div className="border-t border-slate-100 mt-2 pt-2 px-3.5">
                <button
                  onClick={() => { ct.resetView(); setAnchor(null); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-500 transition"
                >
                  <RotateCcw size={11} /> Reset columns, sort &amp; filters
                </button>
              </div>
            )}
          </div>
        </Popup>
      )}
    </div>
  );
}