// frontend/src/components/ZohoFilterSidebar.jsx
//
// Zoho CRM-style "Filter <Module> by" side panel that sits BESIDE the table / board.
//
//   <FilterLayout open={showFilters} sidebar={<ZohoFilterSidebar ... />}>
//     ...table or kanban...
//   </FilterLayout>
//
// • System Defined Filters – ready-made checkboxes (any ticked = match any of them)
// • Filter By Fields       – tick a field → operator dropdown + value input(s)
//     text   : is / isn't / contains / doesn't contain / starts with / ends with / is empty / is not empty
//     number : = / != / < / <= / > / >= / between / not between / is empty / is not empty
//     select : checkbox list of values
//     date   : from / to
// • Nothing is applied until "Apply Filter" is pressed; "Clear" resets everything.
//
// Filter state shape: { system: string[], fields: { [fieldKey]: value } }
//   text   value → { op, value }
//   number value → { op, value, value2 }
//   select value → string[]
//   date   value → { from, to }
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, X, Check as CheckIcon } from 'lucide-react';

export const EMPTY_FILTERS = { system: [], fields: {} };

// ------------------------------------------------------------------
// operators (labels exactly as Zoho shows them)
// ------------------------------------------------------------------
export const TEXT_OPS = [
  ['is', 'is'],
  ['isNot', "isn't"],
  ['contains', 'contains'],
  ['notContains', "doesn't contain"],
  ['startsWith', 'starts with'],
  ['endsWith', 'ends with'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty'],
];

export const NUMBER_OPS = [
  ['eq', '='],
  ['ne', '!='],
  ['lt', '<'],
  ['lte', '<='],
  ['gt', '>'],
  ['gte', '>='],
  ['between', 'between'],
  ['notBetween', 'not between'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty'],
];

const NO_INPUT_OPS = ['empty', 'notEmpty'];
const RANGE_OPS = ['between', 'notBetween'];

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------
const isBlank = (v) => v === undefined || v === null || v === '';

const defaultFor = (type) => {
  if (type === 'select') return [];
  if (type === 'number') return { op: 'eq', value: '', value2: '' };
  if (type === 'date') return { from: '', to: '' };
  return { op: 'contains', value: '' };
};

// is this field's value complete enough to filter on?
const hasValue = (type, v) => {
  if (isBlank(v)) return false;
  if (type === 'select') return Array.isArray(v) && v.length > 0;
  if (type === 'date') return !isBlank(v.from) || !isBlank(v.to);
  // text / number
  if (typeof v !== 'object') return false;
  if (NO_INPUT_OPS.includes(v.op)) return true;
  if (RANGE_OPS.includes(v.op)) return !isBlank(v.value) && !isBlank(v.value2);
  return String(v.value ?? '').trim() !== '';
};

export const countActiveFilters = (value) => {
  if (!value) return 0;
  return (value.system?.length || 0) + Object.keys(value.fields || {}).length;
};

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ------------------------------------------------------------------
// filtering — use on the page's own rows
// ------------------------------------------------------------------
export function applySystemFilters(rows, systemFilters, value) {
  const active = (systemFilters || []).filter((s) => value?.system?.includes(s.key));
  if (active.length === 0) return rows;
  return rows.filter((r) => active.some((s) => s.test(r)));
}

function matchText(raw, v) {
  const s = String(raw ?? '').trim().toLowerCase();
  const q = String(v.value ?? '').trim().toLowerCase();
  switch (v.op) {
    case 'is':          return s === q;
    case 'isNot':       return s !== q;
    case 'contains':    return s.includes(q);
    case 'notContains': return !s.includes(q);
    case 'startsWith':  return s.startsWith(q);
    case 'endsWith':    return s.endsWith(q);
    case 'empty':       return s === '';
    case 'notEmpty':    return s !== '';
    default:            return true;
  }
}

function matchNumber(raw, v) {
  const blank = isBlank(raw) || String(raw).trim() === '';
  if (v.op === 'empty') return blank;
  if (v.op === 'notEmpty') return !blank;

  const n = blank ? NaN : Number(raw);
  const a = Number(v.value);
  const b = Number(v.value2);
  if (v.op === 'ne') return Number.isNaN(n) ? true : n !== a;
  if (v.op === 'notBetween') {
    if (Number.isNaN(n)) return true;
    return n < Math.min(a, b) || n > Math.max(a, b);
  }
  if (Number.isNaN(n)) return false;
  switch (v.op) {
    case 'eq':      return n === a;
    case 'lt':      return n < a;
    case 'lte':     return n <= a;
    case 'gt':      return n > a;
    case 'gte':     return n >= a;
    case 'between': return n >= Math.min(a, b) && n <= Math.max(a, b);
    default:        return true;
  }
}

// fields: [{ key, label, type, getValue(row) }]  → AND across fields
export function applyFieldFilters(rows, fields, value) {
  const entries = Object.entries(value?.fields || {})
    .map(([key, v]) => ({ field: (fields || []).find((f) => f.key === key), v }))
    .filter(({ field, v }) => field && hasValue(field.type, v));
  if (entries.length === 0) return rows;

  return rows.filter((row) =>
    entries.every(({ field, v }) => {
      const raw = field.getValue ? field.getValue(row) : row[field.key];

      if (field.type === 'select') {
        const wanted = v.map((x) => String(x).toLowerCase());
        // multi-value fields (e.g. tags): match if ANY value was ticked
        if (Array.isArray(raw)) return raw.some((x) => wanted.includes(String(x ?? '').trim().toLowerCase()));
        return wanted.includes(String(raw ?? '').trim().toLowerCase());
      }
      if (field.type === 'number') return matchNumber(raw, v);
      if (field.type === 'date') {
        const d = parseDate(raw);
        if (!d) return false;
        if (!isBlank(v.from) && d < new Date(`${v.from}T00:00:00`)) return false;
        if (!isBlank(v.to) && d > new Date(`${v.to}T23:59:59.999`)) return false;
        return true;
      }
      return matchText(raw, v);
    })
  );
}

export const applyAllFilters = (rows, systemFilters, fields, value) =>
  applyFieldFilters(applySystemFilters(rows, systemFilters, value), fields, value);

// ------------------------------------------------------------------
// UI atoms
// ------------------------------------------------------------------
const Caret = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-slate-800">
    {open ? <path d="M1 3l4 4 4-4z" fill="currentColor" /> : <path d="M3 1l4 4-4 4z" fill="currentColor" />}
  </svg>
);

const Check = ({ checked, onChange, label, small }) => (
  <label className={`flex items-start gap-3 cursor-pointer select-none ${small ? 'py-1' : 'py-1.5'}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="mt-[3px] h-4 w-4 shrink-0 rounded-[3px] border-slate-400 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
    />
    <span className={`leading-snug text-slate-700 ${small ? 'text-[13px]' : 'text-sm'}`}>{label}</span>
  </label>
);

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-[13px] text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

// Zoho-style operator dropdown — the list is portalled so the sidebar's scroll area can't clip it
function OpSelect({ ops, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const current = ops.find(([k]) => k === value) || ops[0];

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const listH = Math.min(ops.length * 34 + 8, 260);
    const top = r.bottom + 4 + listH > window.innerHeight ? Math.max(8, r.top - listH - 4) : r.bottom + 4;
    setPos({ top, left: r.left });
  }, [open, ops.length]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[13px] text-slate-700 bg-white ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300'
        }`}
      >
        {current[1]}
        <svg width="9" height="9" viewBox="0 0 10 10" className="text-slate-500">
          {open ? <path d="M1 7l4-4 4 4z" fill="currentColor" /> : <path d="M1 3l4 4 4-4z" fill="currentColor" />}
        </svg>
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[91] w-52 max-h-[260px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl py-1"
              style={{ top: pos.top, left: pos.left }}
            >
              {ops.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { onChange(k); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-blue-50 ${
                    k === current[0] ? 'font-bold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="w-4 shrink-0">{k === current[0] && <CheckIcon size={13} />}</span>
                  {label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function SelectValues({ options, selected, onChange }) {
  const [term, setTerm] = useState('');
  const shown = term ? options.filter((o) => String(o).toLowerCase().includes(term.toLowerCase())) : options;
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);

  if (options.length === 0) return <p className="text-xs text-slate-400 py-1">No values yet</p>;

  return (
    <div>
      {options.length > 6 && (
        <div className="relative mb-1.5">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search" className={`${inputCls} pl-7`} />
        </div>
      )}
      <div className="max-h-44 overflow-y-auto pr-1">
        {shown.map((o) => (
          <Check key={o} small checked={selected.includes(o)} onChange={() => toggle(o)} label={String(o)} />
        ))}
        {shown.length === 0 && <p className="text-xs text-slate-400 py-1">No match</p>}
      </div>
    </div>
  );
}

function FieldEditor({ field, options, value, onChange }) {
  if (field.type === 'select') {
    return <SelectValues options={options} selected={Array.isArray(value) ? value : []} onChange={onChange} />;
  }

  if (field.type === 'date') {
    const v = value || {};
    return (
      <div className="space-y-1.5">
        <input type="date" value={v.from ?? ''} onChange={(e) => onChange({ ...v, from: e.target.value })} className={inputCls} title="From" />
        <input type="date" value={v.to ?? ''} onChange={(e) => onChange({ ...v, to: e.target.value })} className={inputCls} title="To" />
      </div>
    );
  }

  // text + number: operator dropdown, then the value box(es)
  const isNumber = field.type === 'number';
  const v = value || defaultFor(field.type);
  const ops = isNumber ? NUMBER_OPS : TEXT_OPS;
  const inputType = isNumber ? 'number' : 'text';

  return (
    <div className="space-y-2">
      <OpSelect ops={ops} value={v.op} onChange={(op) => onChange({ ...v, op })} />
      {!NO_INPUT_OPS.includes(v.op) && (
        RANGE_OPS.includes(v.op) ? (
          <div className="space-y-1.5">
            <input type={inputType} placeholder="From" value={v.value ?? ''} onChange={(e) => onChange({ ...v, value: e.target.value })} className={inputCls} />
            <input type={inputType} placeholder="To" value={v.value2 ?? ''} onChange={(e) => onChange({ ...v, value2: e.target.value })} className={inputCls} />
          </div>
        ) : (
          <input
            type={inputType}
            placeholder="Type here"
            value={v.value ?? ''}
            onChange={(e) => onChange({ ...v, value: e.target.value })}
            className={inputCls}
          />
        )
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// the sidebar
// ------------------------------------------------------------------
export default function ZohoFilterSidebar({
  title,                 // 'Contacts'  → "Filter Contacts by"
  systemFilters = [],    // [{ key, label }]
  fields = [],           // [{ key, label, type: 'text'|'select'|'number'|'date', options?, getValue? }]
  rows = [],             // full row list — used to build value lists when `options` isn't given
  value,                 // the APPLIED filters
  onChange,              // called with the new applied filters when "Apply Filter" / "Clear" is pressed
  loading = false,
}) {
  const [term, setTerm] = useState('');
  const [sysOpen, setSysOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);

  // draft = what the user is editing; only pushed up on Apply
  const [draft, setDraft] = useState(value || EMPTY_FILTERS);
  const lastApplied = useRef(value);
  useEffect(() => {
    // the page changed the filters itself (e.g. "Clear all filters") → mirror them
    if (value !== lastApplied.current) {
      lastApplied.current = value;
      setDraft(value || EMPTY_FILTERS);
    }
  }, [value]);

  const t = term.trim().toLowerCase();
  const shownSystem = useMemo(() => systemFilters.filter((s) => !t || s.label.toLowerCase().includes(t)), [systemFilters, t]);
  const shownFields = useMemo(() => fields.filter((f) => !t || f.label.toLowerCase().includes(t)), [fields, t]);

  const optionsFor = (f) => {
    if (f.type !== 'select') return [];
    if (Array.isArray(f.options) && f.options.length) return f.options;
    const set = new Set();
    rows.forEach((r) => {
      const v = f.getValue ? f.getValue(r) : r[f.key];
      if (Array.isArray(v)) v.forEach((x) => { if (!isBlank(x)) set.add(String(x)); });
      else if (!isBlank(v)) set.add(String(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  const toggleSystem = (key) =>
    setDraft((d) => ({
      ...d,
      system: d.system.includes(key) ? d.system.filter((k) => k !== key) : [...d.system, key],
    }));

  const isFieldOn = (f) => f.key in (draft.fields || {});

  const toggleField = (f) =>
    setDraft((d) => {
      const next = { ...(d.fields || {}) };
      if (f.key in next) delete next[f.key];
      else next[f.key] = defaultFor(f.type);
      return { ...d, fields: next };
    });

  const setFieldValue = (f, v) =>
    setDraft((d) => ({ ...d, fields: { ...(d.fields || {}), [f.key]: v } }));

  const apply = () => {
    // drop ticked-but-empty fields so the count / badge stays accurate
    const pruned = {};
    Object.entries(draft.fields || {}).forEach(([k, v]) => {
      const f = fields.find((x) => x.key === k);
      if (f && hasValue(f.type, v)) pruned[k] = v;
    });
    const next = { system: draft.system, fields: pruned };
    lastApplied.current = next;
    onChange(next);
  };

  const clear = () => {
    lastApplied.current = EMPTY_FILTERS;
    setDraft(EMPTY_FILTERS);
    onChange(EMPTY_FILTERS);
  };

  const hasDraft = countActiveFilters(draft) > 0 || countActiveFilters(value) > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col max-h-[calc(100vh-120px)] sticky top-4">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[15px] font-semibold text-slate-800">Filter {title} by</h3>
      </div>

      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search"
            className="w-full pl-9 pr-8 py-2 rounded-md border border-slate-300 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
          />
          {term && (
            <button onClick={() => setTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto px-5 pb-3 flex-1">
        {shownSystem.length > 0 && (
          <div className="mb-3">
            <button onClick={() => setSysOpen((v) => !v)} className="w-full flex items-center gap-2 py-2 text-left">
              <Caret open={sysOpen || !!t} />
              <span className="text-sm font-bold text-slate-900 truncate">System Defined Filters</span>
            </button>
            {(sysOpen || t) && (
              <div className="pl-0.5">
                {shownSystem.map((s) => (
                  <Check key={s.key} checked={draft.system.includes(s.key)} onChange={() => toggleSystem(s.key)} label={s.label} />
                ))}
              </div>
            )}
          </div>
        )}

        {shownFields.length > 0 && (
          <div>
            <button onClick={() => setFieldsOpen((v) => !v)} className="w-full flex items-center gap-2 py-2 text-left">
              <Caret open={fieldsOpen || !!t} />
              <span className="text-sm font-bold text-slate-900">Filter By Fields</span>
            </button>
            {(fieldsOpen || t) && (
              <div className="pl-0.5">
                {loading && <p className="text-xs text-slate-400 py-1">Loading fields…</p>}
                {shownFields.map((f) => {
                  const on = isFieldOn(f);
                  return (
                    <div key={f.key}>
                      <Check checked={on} onChange={() => toggleField(f)} label={f.label} />
                      {on && (
                        <div className="ml-7 mb-2">
                          <FieldEditor
                            field={f}
                            options={optionsFor(f)}
                            value={draft.fields?.[f.key]}
                            onChange={(v) => setFieldValue(f, v)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {shownSystem.length === 0 && shownFields.length === 0 && (
          <p className="text-sm text-slate-400 py-4">No filters match “{term}”.</p>
        )}
      </div>

      {/* footer — Apply Filter / Clear */}
      <div className="px-5 py-3 border-t border-slate-200 space-y-2 bg-white rounded-b-lg">
        <button
          onClick={apply}
          className="w-full py-2 rounded-md bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm"
        >
          Apply Filter
        </button>
        <button
          onClick={clear}
          disabled={!hasDraft}
          className="w-full py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Toolbar button that opens / closes the panel (Zoho's "Filter" pill)
// ------------------------------------------------------------------
export function FilterToggleButton({ open, onClick, count = 0 }) {
  return (
    <button
      onClick={onClick}
      title={open ? 'Hide filters' : 'Show filters'}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold shadow-sm transition ${
        open ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Filter size={14} /> Filter
      {count > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black leading-none">{count}</span>
      )}
    </button>
  );
}

// ------------------------------------------------------------------
// Layout: sidebar on the left, content (table / kanban) on the right
// ------------------------------------------------------------------
export function FilterLayout({ open, sidebar, children }) {
  return (
    <div className="flex items-start gap-4">
      {open && <aside className="w-[260px] shrink-0">{sidebar}</aside>}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}