// frontend/src/utils/useColumnTable.js
//
// Zoho-style per-column controls for any list table:
//   • Sort (A-Z / Z-A, 0-9 / 9-0, oldest / newest)
//   • Filter by (per-column condition or pick-values)
//   • Pin Column (freezes it on the left while scrolling sideways)
//   • Hide Column (+ a "Columns" picker to bring it back)
//
// Usage (see Accounts.jsx for a full example):
//
//   const columns = [
//     { key: 'name',  label: 'Account Name', type: 'text',   getValue: (a) => a.companyName, render: (a) => <b>{a.companyName}</b> },
//     { key: 'owner', label: 'Owner',        type: 'select', getValue: (a) => a.owner?.name, render: (a) => a.owner?.name },
//     { key: 'actions', label: '', menu: false, fixed: 'end', render: (a) => <button/> },
//   ];
//   const ct = useColumnTable('accounts', columns, rowsAfterSearch);
//   // ct.rows  -> rows after column filters + column sort (paginate this)
//
// Column definition:
//   key        unique id
//   label      header text
//   type       'text' (default) | 'phone' | 'select' | 'number' | 'date'
//   getValue   (row) => primitive used for sort / filter / pick-list   (not needed when menu:false)
//   render     (row) => JSX for the cell
//   menu       false → no header menu (action columns)
//   fixed      'start' | 'end' → keeps its place, can't be hidden/pinned.
//              A 'start' column needs `width` (it turns sticky when something is pinned).
//   width      px width used for pinned columns (default 200)
//   thClass    replaces the page's default header classes for this column
import { useCallback, useEffect, useMemo, useState } from 'react';

export const EMPTY_TOKEN = '__empty__';
const DEFAULT_PIN_WIDTH = 200;

// ---------- operators per column type ----------
export const TEXT_OPS = [
  ['contains', 'contains'],
  ['notContains', "doesn't contain"],
  ['equals', 'is'],
  ['startsWith', 'starts with'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty'],
];
export const NUMBER_OPS = [
  ['eq', '='],
  ['gt', '>'],
  ['lt', '<'],
  ['gte', '≥'],
  ['lte', '≤'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty'],
];
export const DATE_OPS = [
  ['on', 'on'],
  ['before', 'before'],
  ['after', 'after'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty'],
];

export const opsFor = (type) => {
  if (type === 'number') return NUMBER_OPS;
  if (type === 'date') return DATE_OPS;
  return TEXT_OPS;
};

export const sortLabels = (type) => {
  if (type === 'number' || type === 'phone') return ['0-9', '9-0'];
  if (type === 'date') return ['Oldest first', 'Newest first'];
  return ['A-Z', 'Z-A'];
};

// ---------- value helpers ----------
const isEmptyVal = (v) =>
  v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ||
  (Array.isArray(v) && v.length === 0);

const toTime = (v) => {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

// yyyy-mm-dd in LOCAL time (so "on 2026-11-13" matches what the user sees)
const ymd = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const compareValues = (a, b, type) => {
  // multi-value cells (e.g. tags) sort by their joined text
  if (Array.isArray(a) || Array.isArray(b)) {
    const ja = Array.isArray(a) ? a.join(', ') : String(a);
    const jb = Array.isArray(b) ? b.join(', ') : String(b);
    return ja.localeCompare(jb, undefined, { numeric: true, sensitivity: 'base' });
  }
  switch (type) {
    case 'number':
      return Number(a) - Number(b);
    case 'date':
      return (toTime(a) ?? 0) - (toTime(b) ?? 0);
    case 'phone': {
      const da = String(a).replace(/\D/g, '');
      const db = String(b).replace(/\D/g, '');
      if (da && db) return da.localeCompare(db, undefined, { numeric: true });
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    }
    default:
      return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }
};

// Does one cell value satisfy one column filter { op, value }?
export function matchesColumnFilter(raw, type, f) {
  const empty = isEmptyVal(raw);

  if (f.op === 'empty') return empty;
  if (f.op === 'notEmpty') return !empty;

  if (f.op === 'in') {
    if (!Array.isArray(f.value) || f.value.length === 0) return true;
    if (Array.isArray(raw)) {
      // multi-value cell (tags): match if ANY of its values was picked
      if (raw.length === 0) return f.value.includes(EMPTY_TOKEN);
      return raw.some((v) => f.value.includes(String(v)));
    }
    return f.value.includes(empty ? EMPTY_TOKEN : String(raw));
  }

  // text conditions on a multi-value cell → test its joined text
  if (Array.isArray(raw)) raw = raw.join(', ');

  // a rule the user added but hasn't filled in yet → ignore it
  if (f.value === '' || f.value === undefined || f.value === null) return true;

  if (type === 'number') {
    if (empty) return false;
    const n = Number(raw);
    const v = Number(f.value);
    switch (f.op) {
      case 'eq': return n === v;
      case 'gt': return n > v;
      case 'lt': return n < v;
      case 'gte': return n >= v;
      case 'lte': return n <= v;
      default: return true;
    }
  }

  if (type === 'date') {
    if (empty) return false;
    const a = ymd(raw);
    if (!a) return false;
    switch (f.op) {
      case 'on': return a === f.value;
      case 'before': return a < f.value;
      case 'after': return a > f.value;
      default: return true;
    }
  }

  // text / phone / select
  const sv = String(empty ? '' : raw).toLowerCase();
  const rv = String(f.value).toLowerCase();
  switch (f.op) {
    case 'contains': return !empty && sv.includes(rv);
    case 'notContains': return empty || !sv.includes(rv);
    case 'equals': return !empty && sv === rv;
    case 'startsWith': return !empty && sv.startsWith(rv);
    default: return true;
  }
}

// ---------- persisted layout (sort / hidden / pinned) ----------
const storageKey = (id) => `columnTable.v1.${localStorage.getItem('userId') || 'anon'}.${id}`;

const loadLayout = (id) => {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(id)) || 'null');
    return {
      sort: raw?.sort && raw.sort.key ? raw.sort : null,
      hidden: Array.isArray(raw?.hidden) ? raw.hidden : [],
      pinned: Array.isArray(raw?.pinned) ? raw.pinned : [],
    };
  } catch {
    return { sort: null, hidden: [], pinned: [] };
  }
};

export default function useColumnTable(id, columns, rows, depsKey = '') {
  const [layout, setLayout] = useState(() => loadLayout(id));
  // Filters are session-only on purpose: a forgotten filter hiding records after a reload is confusing.
  const [filters, setFilters] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(layout));
    } catch { /* ignore */ }
  }, [id, layout]);

  const { sort, hidden, pinned } = layout;

  // ---------- layout actions ----------
  const setSort = useCallback((key, dir) => {
    setLayout((l) => ({ ...l, sort: key && dir ? { key, dir } : null }));
  }, []);

  const hideColumn = useCallback((key) => {
    setLayout((l) => ({
      ...l,
      hidden: l.hidden.includes(key) ? l.hidden : [...l.hidden, key],
      pinned: l.pinned.filter((k) => k !== key),
      sort: l.sort?.key === key ? null : l.sort,
    }));
    setFilters((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });
  }, []);

  const showColumn = useCallback((key) => {
    setLayout((l) => ({ ...l, hidden: l.hidden.filter((k) => k !== key) }));
  }, []);

  const togglePin = useCallback((key) => {
    setLayout((l) => ({
      ...l,
      pinned: l.pinned.includes(key) ? l.pinned.filter((k) => k !== key) : [...l.pinned, key],
    }));
  }, []);

  const setFilter = useCallback((key, f) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (f) next[key] = f;
      else delete next[key];
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  const resetView = useCallback(() => {
    setLayout({ sort: null, hidden: [], pinned: [] });
    setFilters({});
  }, []);

  // ---------- which columns are visible, and in what order ----------
  const colSig = columns.map((c) => `${c.key}:${c.type || 'text'}`).join('|');

  const hiddenSet = new Set(hidden);
  const pinnedSet = new Set(pinned);
  const live = columns.filter((c) => !hiddenSet.has(c.key) || c.fixed);
  const startFixed = live.filter((c) => c.fixed === 'start');
  const endFixed = live.filter((c) => c.fixed === 'end');
  const body = live.filter((c) => !c.fixed);
  const pinnedCols = body.filter((c) => pinnedSet.has(c.key));
  const looseCols = body.filter((c) => !pinnedSet.has(c.key));
  const visibleColumns = [...startFixed, ...pinnedCols, ...looseCols, ...endFixed];

  // Sticky offsets: widths are fixed (not measured) so there is no layout jitter.
  const sticky = {};
  if (pinnedCols.length > 0) {
    const stickyList = [...startFixed, ...pinnedCols];
    let left = 0;
    stickyList.forEach((c, i) => {
      const width = c.width || DEFAULT_PIN_WIDTH;
      sticky[c.key] = { left, width, last: i === stickyList.length - 1 };
      left += width;
    });
  }

  // ---------- apply column filters, then column sort ----------
  const processed = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    let out = rows;

    const active = Object.entries(filters).filter(([k]) => byKey.has(k) && byKey.get(k).getValue);
    if (active.length > 0) {
      out = out.filter((row) =>
        active.every(([k, f]) => {
          const col = byKey.get(k);
          return matchesColumnFilter(col.getValue(row), col.type || 'text', f);
        })
      );
    }

    const sortCol = sort ? byKey.get(sort.key) : null;
    if (sortCol && sortCol.getValue) {
      const type = sortCol.type || 'text';
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = out
        .map((row, i) => ({ row, i, v: sortCol.getValue(row) }))
        .sort((x, y) => {
          const ex = isEmptyVal(x.v);
          const ey = isEmptyVal(y.v);
          if (ex && ey) return x.i - y.i;
          if (ex) return 1; // blanks always last, either direction
          if (ey) return -1;
          const c = compareValues(x.v, y.v, type) * dir;
          return c !== 0 ? c : x.i - y.i;
        })
        .map((x) => x.row);
    }
    return out;
    // getValue closures only read the row (+ anything in depsKey), so colSig is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, sort, colSig, depsKey]);

  const activeFilterCount = Object.keys(filters).filter((k) => columns.some((c) => c.key === k)).length;

  // Pages reset to page 1 when this string changes.
  const stateKey = JSON.stringify({ sort, filters });

  // className/style for a <th> or <td> (handles the pinned/sticky look)
  const cellProps = (col, baseClass = '', { head = false } = {}) => {
    const s = sticky[col.key];
    if (!s) return { className: baseClass, style: undefined };
    return {
      className: `${baseClass} sticky overflow-hidden ${
        head ? 'z-20 bg-slate-50' : 'z-10 bg-white group-hover:bg-slate-50'
      }`,
      style: {
        left: s.left,
        width: s.width,
        minWidth: s.width,
        maxWidth: s.width,
        boxShadow: s.last ? '2px 0 4px -2px rgba(15,23,42,0.18)' : undefined,
      },
    };
  };

  return {
    id,
    columns,
    visibleColumns,
    rows: processed,
    sourceRows: rows,
    sort,
    setSort,
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
    hidden,
    hideColumn,
    showColumn,
    pinned,
    isPinned: (key) => pinnedSet.has(key),
    togglePin,
    resetView,
    stateKey,
    cellProps,
  };
}