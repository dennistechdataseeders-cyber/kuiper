// path: frontend/src/components/ZohoFilterBar.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, ChevronDown, RotateCcw, Search, Check } from 'lucide-react';

// ============================================
// Operators per field type
// ============================================
const TEXT_OPS = [
  ['contains', 'contains'],
  ['notContains', "doesn't contain"],
  ['equals', 'is'],
  ['notEquals', 'is not'],
  ['startsWith', 'starts with'],
  ['empty', 'is empty'],
  ['notEmpty', 'is not empty']
];

export const OPERATORS = {
  text: TEXT_OPS,
  email: TEXT_OPS,
  phone: TEXT_OPS,
  number: [
    ['eq', '='], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤'],
    ['empty', 'is empty'], ['notEmpty', 'is not empty']
  ],
  date: [
    ['on', 'on'], ['before', 'before'], ['after', 'after'],
    ['empty', 'is empty'], ['notEmpty', 'is not empty']
  ],
  select: [
    ['is', 'is'], ['isNot', 'is not'], ['in', 'is any of'], ['notIn', 'is none of'],
    ['empty', 'is empty'], ['notEmpty', 'is not empty']
  ]
};

const NO_VALUE_OPS = new Set(['empty', 'notEmpty']);
const MULTI_OPS = new Set(['in', 'notIn']);

const opsForType = (type) => OPERATORS[type] || OPERATORS.text;
const newId = () => Math.random().toString(36).slice(2, 9);

// ============================================
// Rule helpers
// ============================================
export const createFilterRule = (field) => ({
  id: newId(),
  fieldKey: field.fieldKey,
  op: opsForType(field.type)[0][0],
  value: ''
});

// A rule only filters once it is complete (Zoho ignores half-typed chips)
export const isRuleActive = (rule) => {
  if (!rule) return false;
  if (NO_VALUE_OPS.has(rule.op)) return true;
  if (MULTI_OPS.has(rule.op)) return Array.isArray(rule.value) && rule.value.length > 0;
  if (Array.isArray(rule.value)) return false;
  return rule.value !== '' && rule.value !== undefined && rule.value !== null;
};

// ============================================
// Persistence — usePersistedFilters('<page>Filters.v1')
// ============================================
const readRules = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((r) => r && typeof r.fieldKey === 'string' && typeof r.op === 'string')
      .map((r) => ({ id: r.id || newId(), fieldKey: r.fieldKey, op: r.op, value: r.value ?? '' }));
  } catch {
    return null;
  }
};

// legacyKey (optional) lets a page adopt filters saved under an older key.
export function usePersistedFilters(storageKey, legacyKey) {
  const [filters, setFilters] = useState(
    () => readRules(storageKey) ?? (legacyKey ? readRules(legacyKey) : null) ?? []
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch { /* ignore */ }
  }, [storageKey, filters]);

  return [filters, setFilters];
}

// ============================================
// Value helpers shared by pages
// ============================================
export const normalizeValue = (v) => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map(normalizeValue).filter(Boolean).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v).trim();
};

export const distinctValues = (values = []) =>
  Array.from(new Set(values.map(normalizeValue).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

// Customize-Modules field type → filter field type
export const CUSTOM_FIELD_FILTER_TYPES = {
  'Single Line': 'text',
  'Multi-Line': 'text',
  'Multi-Select': 'text',
  URL: 'text',
  Email: 'email',
  Phone: 'phone',
  'Pick List': 'select',
  Checkbox: 'select',
  Date: 'date',
  'Date/Time': 'date',
  Number: 'number',
  Decimal: 'number',
  Currency: 'number',
  Percent: 'number',
  'Long Integer': 'number'
};

// defs: module-field definitions (useCustomFields). valuesFor(fieldKey) → raw
// values present in the loaded rows, used to build dropdown choices.
export function customFieldsToFilterFields(defs = [], valuesFor, { prefix = 'custom.', section = 'Custom' } = {}) {
  return defs.map((f) => {
    const type = CUSTOM_FIELD_FILTER_TYPES[f.type] || 'text';
    const options = f.type === 'Checkbox' ? ['Yes', 'No'] : (f.options || []).map((o) => o.label).filter(Boolean);
    const seen = type === 'select' && valuesFor ? valuesFor(f.fieldKey) : [];
    return {
      fieldKey: `${prefix}${f.fieldKey}`,
      label: f.label,
      type,
      section,
      options,
      distinctValues: type === 'select' ? distinctValues([...options, ...seen]) : []
    };
  });
}

// ============================================
// Matcher — AND across every complete rule
//   getValue(row, fieldKey) → raw value for that row
// ============================================
const toNumber = (v) => {
  if (v === '' || v === undefined || v === null || typeof v === 'boolean' || Array.isArray(v)) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const parseDay = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function evalRule(raw, { op, value }) {
  const sv = normalizeValue(raw).toLowerCase();
  const tokens = Array.isArray(raw)
    ? raw.map((x) => normalizeValue(x).toLowerCase()).filter(Boolean)
    : (sv ? [sv] : []);
  const rv = String(value ?? '').trim().toLowerCase();

  switch (op) {
    case 'contains':    return sv.includes(rv);
    case 'notContains': return !sv.includes(rv);
    case 'equals':
    case 'is':          return tokens.includes(rv);
    case 'notEquals':
    case 'isNot':       return !tokens.includes(rv);
    case 'startsWith':  return sv.startsWith(rv);
    case 'empty':       return sv === '';
    case 'notEmpty':    return sv !== '';
    case 'in': {
      const set = (Array.isArray(value) ? value : []).map((x) => String(x).toLowerCase());
      return tokens.some((t) => set.includes(t));
    }
    case 'notIn': {
      const set = (Array.isArray(value) ? value : []).map((x) => String(x).toLowerCase());
      return !tokens.some((t) => set.includes(t));
    }
    case 'eq':
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      const a = toNumber(raw);
      const b = toNumber(value);
      if (a === null || b === null) return false;
      if (op === 'eq') return a === b;
      if (op === 'gt') return a > b;
      if (op === 'lt') return a < b;
      if (op === 'gte') return a >= b;
      return a <= b;
    }
    case 'on':
    case 'before':
    case 'after': {
      const a = parseDay(raw);
      const b = parseDay(value);
      if (!a || !b) return false;
      const ka = dayKey(a);
      const kb = dayKey(b);
      if (op === 'on') return ka === kb;
      return op === 'before' ? ka < kb : ka > kb;
    }
    default:
      return true;
  }
}

export function matchesZohoFilters(row, filters, getValue) {
  if (!filters || filters.length === 0) return true;
  for (const rule of filters) {
    if (!isRuleActive(rule)) continue;
    if (!evalRule(getValue(row, rule.fieldKey), rule)) return false;
  }
  return true;
}

// ============================================
// Small UI pieces
// ============================================
const valueInputCls =
  'bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-300 py-1.5';

function ChipSelect({ value, onChange, className = '', selectClass = '', title, children }) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={value}
        onChange={onChange}
        title={title}
        className={`appearance-none bg-transparent pl-2.5 pr-6 py-1.5 outline-none cursor-pointer max-w-[190px] truncate ${selectClass}`}
      >
        {children}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-2 text-slate-400" />
    </div>
  );
}

function MultiValue({ values, selected, onChange, autoOpen, onClose }) {
  const [open, setOpen] = useState(!!autoOpen);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);

  const label =
    selected.length === 0 ? 'Select…' : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 py-1.5 text-xs font-semibold text-slate-700 max-w-[160px]"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-300' : ''}`}>{label}</span>
        <ChevronDown size={11} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1">
          {values.length === 0 ? (
            <div className="px-3 py-2 text-xs font-semibold text-slate-400">No options</div>
          ) : (
            values.map((v) => (
              <label
                key={v}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(v)}
                  onChange={() => toggle(v)}
                  className="rounded border-slate-300"
                />
                <span className="truncate">{v}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ZohoFilterBar
//
//   fields:  [{ fieldKey, label, type, options?, distinctValues?, section? }]
//   filters: [{ id, fieldKey, op, value }]      (AND-ed together)
//   onChange(nextFilters)
// ============================================
export default function ZohoFilterBar({
  fields = [],
  filters = [],
  onChange,
  loading = false,
  primarySection = 'Lead Information',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState(null);
  const addRef = useRef(null);
  const prevIds = useRef(null);

  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.fieldKey, f])), [fields]);

  // Close the "+ Filter" popover on outside click / Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the value input of a freshly added chip (also when added from a column menu)
  useEffect(() => {
    const ids = filters.map((r) => r.id);
    if (prevIds.current) {
      const added = ids.filter((id) => !prevIds.current.includes(id));
      if (added.length === 1) setFocusId(added[0]);
    }
    prevIds.current = ids;
  }, [filters]);

  const matchingFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => (f.label || f.fieldKey).toLowerCase().includes(q));
  }, [fields, query]);

  const updateRule = (id, patch) =>
    onChange(filters.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRule = (id) => onChange(filters.filter((r) => r.id !== id));
  const clearAll = () => onChange([]);

  const addRule = (field) => {
    onChange([...filters, createFilterRule(field)]);
    setOpen(false);
    setQuery('');
  };

  const changeField = (rule, nextKey) => {
    const next = fieldByKey.get(nextKey);
    if (!next) return;
    const prev = fieldByKey.get(rule.fieldKey);
    const ops = opsForType(next.type);
    // Same non-dropdown type → keep the operator and typed value
    if (prev && prev.type === next.type && next.type !== 'select') {
      updateRule(rule.id, { fieldKey: nextKey });
    } else {
      updateRule(rule.id, { fieldKey: nextKey, op: ops[0][0], value: '' });
    }
  };

  const changeOp = (rule, nextOp) => {
    let value = rule.value;
    if (NO_VALUE_OPS.has(nextOp)) value = '';
    else if (MULTI_OPS.has(nextOp)) value = Array.isArray(rule.value) ? rule.value : (rule.value ? [rule.value] : []);
    else if (Array.isArray(rule.value)) value = rule.value[0] || '';
    updateRule(rule.id, { op: nextOp, value });
  };

  const renderValue = (rule, field) => {
    const focusProps = {
      autoFocus: rule.id === focusId,
      onBlur: () => setFocusId((cur) => (cur === rule.id ? null : cur))
    };
    const choices = field.distinctValues?.length ? field.distinctValues : (field.options || []);

    if (MULTI_OPS.has(rule.op)) {
      return (
        <MultiValue
          values={choices}
          selected={Array.isArray(rule.value) ? rule.value : []}
          onChange={(v) => updateRule(rule.id, { value: v })}
          autoOpen={rule.id === focusId}
          onClose={() => setFocusId((cur) => (cur === rule.id ? null : cur))}
        />
      );
    }

    if (field.type === 'select' && choices.length > 0) {
      const current = typeof rule.value === 'string' ? rule.value : '';
      const list = !current || choices.includes(current) ? choices : [current, ...choices];
      return (
        <select
          value={current}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${valueInputCls} min-w-[110px] max-w-[190px] cursor-pointer`}
          {...focusProps}
        >
          <option value="">Select…</option>
          {list.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={rule.value ?? ''}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${valueInputCls} w-24`}
          placeholder="0"
          {...focusProps}
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={rule.value ?? ''}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${valueInputCls} min-w-[125px]`}
          {...focusProps}
        />
      );
    }

    return (
      <input
        type="text"
        value={typeof rule.value === 'string' ? rule.value : ''}
        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
        className={`${valueInputCls} w-32`}
        placeholder="Value…"
        {...focusProps}
      />
    );
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {filters.map((rule) => {
        const known = fieldByKey.get(rule.fieldKey);
        if (!known && loading) return null;
        const field = known || { fieldKey: rule.fieldKey, label: rule.fieldKey, type: 'text' };

        let ops = opsForType(field.type);
        if (!ops.some(([o]) => o === rule.op)) ops = [...ops, [rule.op, rule.op]];

        const active = isRuleActive(rule);
        const hasValueInput = !NO_VALUE_OPS.has(rule.op);

        return (
          <div
            key={rule.id}
            className={`inline-flex items-stretch rounded-lg border bg-white shadow-sm text-xs transition ${
              active ? 'border-blue-300' : 'border-slate-200'
            }`}
          >
            <ChipSelect
              value={rule.fieldKey}
              onChange={(e) => changeField(rule, e.target.value)}
              title="Field"
              className="bg-slate-50 rounded-l-lg border-r border-slate-200"
              selectClass="text-[10px] font-black uppercase tracking-wider text-slate-500"
            >
              {!known && <option value={rule.fieldKey}>{rule.fieldKey}</option>}
              {fields.map((f) => (
                <option key={f.fieldKey} value={f.fieldKey}>{f.label || f.fieldKey}</option>
              ))}
            </ChipSelect>

            <ChipSelect
              value={rule.op}
              onChange={(e) => changeOp(rule, e.target.value)}
              title="Operator"
              className={hasValueInput ? 'border-r border-slate-100' : ''}
              selectClass="text-xs font-bold text-blue-600"
            >
              {ops.map(([o, label]) => <option key={o} value={o}>{label}</option>)}
            </ChipSelect>

            {hasValueInput && <div className="flex items-center px-2.5">{renderValue(rule, field)}</div>}

            <button
              type="button"
              onClick={() => removeRule(rule.id)}
              title="Remove filter"
              aria-label="Remove filter"
              className="px-1.5 rounded-r-lg border-l border-slate-100 text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* + Filter */}
      <div ref={addRef} className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setQuery(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Plus size={12} /> Filter
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Add a filter
            </div>
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fields…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            {loading ? (
              <div className="p-4 text-xs font-semibold text-slate-400">Loading fields…</div>
            ) : matchingFields.length === 0 ? (
              <div className="p-4 text-xs font-semibold text-slate-400">No matching fields.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto py-1">
                {matchingFields.map((f) => {
                  const used = filters.some((r) => r.fieldKey === f.fieldKey);
                  return (
                    <button
                      key={f.fieldKey}
                      type="button"
                      onClick={() => addRule(f)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                    >
                      <span className="truncate">
                        {f.label || f.fieldKey}
                        {f.section && f.section !== primarySection && (
                          <span className="ml-1.5 text-[9px] font-black uppercase text-slate-400">{f.section}</span>
                        )}
                      </span>
                      {used ? (
                        <Check size={12} className="text-blue-500 shrink-0" />
                      ) : (
                        <Plus size={12} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {filters.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition"
        >
          <RotateCcw size={11} /> Clear
        </button>
      )}
    </div>
  );
}