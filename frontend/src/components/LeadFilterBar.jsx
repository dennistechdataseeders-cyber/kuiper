// frontend/src/components/LeadFilterBar.jsx
//
// Zoho-style dynamic filter bar.
//
// Filters are driven by `filterSchema` (from GET /api/leads/filters).
// Each entry has { fieldKey, label, type, options, distinctValues } and
// the bar auto-renders the right control for the type.
//
// Filter shape is the simple AND of "fieldKey operator value" tuples.
// Any operator supported per type is listed in OPERATORS.
//
// onChange(nextFilters) is called on every change so the parent can
// filter the in-memory lead array.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Plus, X, ChevronDown, RotateCcw } from 'lucide-react';

// type -> operators allowed
const OPERATORS = {
  text:   [['contains', 'contains'], ['equals', 'is'], ['startsWith', 'starts with'], ['notEmpty', 'is not empty']],
  email:  [['contains', 'contains'], ['equals', 'is'], ['notEmpty', 'is not empty']],
  phone:  [['contains', 'contains'], ['equals', 'is'], ['notEmpty', 'is not empty']],
  number: [['eq', '='], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤']],
  date:   [['on', 'on'], ['before', 'before'], ['after', 'after']],
  select: [['is', 'is'], ['isNot', 'is not'], ['in', 'is any of'], ['notIn', 'is none of']],
};

const emptyRule = (fieldKey, type) => ({
  id: Math.random().toString(36).slice(2, 9),
  fieldKey,
  op: OPERATORS[type]?.[0]?.[0] || 'contains',
  value: '',
});

const inputCls =
  'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all';

const STORAGE_KEY = 'leadFilters.v1';

export default function LeadFilterBar({ filterSchema, filters, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const [addingTo, setAddingTo] = useState(false);
  const containerRef = useRef(null);

  // -------- persistence --------
  useEffect(() => {
    // Only hydrate once on mount
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        onChange(saved);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters || []));
    } catch { /* ignore */ }
  }, [filters]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setAddingTo(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const fieldByKey = useMemo(() => {
    const m = new Map();
    (filterSchema || []).forEach(f => m.set(f.fieldKey, f));
    return m;
  }, [filterSchema]);

  // Fields not already added to the filter bar (Zoho hides used ones)
  const availableFields = useMemo(() => {
    const used = new Set((filters || []).map(r => r.fieldKey));
    return (filterSchema || []).filter(f => !used.has(f.fieldKey));
  }, [filterSchema, filters]);

  const updateRule = (id, patch) => {
    onChange((filters || []).map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRule = (id) => {
    onChange((filters || []).filter(r => r.id !== id));
  };

  const addRule = (fieldKey) => {
    const field = fieldByKey.get(fieldKey);
    if (!field) return;
    onChange([...(filters || []), emptyRule(fieldKey, field.type)]);
    setAddingTo(false);
  };

  const clearAll = () => onChange([]);

  const renderValueInput = (rule, field) => {
    const type = field?.type || 'text';

    // ----- multi-select for "is any of" / "is none of" -----
    if (type === 'select' && (rule.op === 'in' || rule.op === 'notIn')) {
      const selected = Array.isArray(rule.value) ? rule.value : [];
      const values = field.distinctValues?.length ? field.distinctValues : field.options || [];
      return (
        <select
          multiple
          value={selected}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions).map(o => o.value);
            updateRule(rule.id, { value: next });
          }}
          className={`${inputCls} min-w-[140px] max-h-24`}
        >
          {values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }

    // ----- single-select for select fields -----
    if (type === 'select') {
      const values = field.distinctValues?.length ? field.distinctValues : field.options || [];
      return (
        <select
          value={rule.value || ''}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${inputCls} min-w-[140px]`}
        >
          <option value="">Select...</option>
          {values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }

    // ----- number -----
    if (type === 'number') {
      return (
        <input
          type="number"
          value={rule.value || ''}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${inputCls} w-24`}
          placeholder="0"
        />
      );
    }

    // ----- date -----
    if (type === 'date') {
      return (
        <input
          type="date"
          value={rule.value || ''}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className={`${inputCls} min-w-[130px]`}
        />
      );
    }

    // ----- "is not empty" has no input -----
    if (rule.op === 'notEmpty' || rule.op === 'empty') {
      return null;
    }

    // ----- default: text -----
    return (
      <input
        type="text"
        value={rule.value || ''}
        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
        className={`${inputCls} min-w-[130px]`}
        placeholder="Value..."
      />
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {(filters || []).map((rule) => {
          const field = fieldByKey.get(rule.fieldKey);
          if (!field) return null;
          const ops = OPERATORS[field.type] || OPERATORS.text;

          return (
            <div
              key={rule.id}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {field.label}
              </span>

              <select
                value={rule.op}
                onChange={(e) => updateRule(rule.id, { op: e.target.value, value: '' })}
                className="bg-transparent border-0 text-xs font-bold text-slate-600 outline-none cursor-pointer"
              >
                {ops.map(([op, label]) => (
                  <option key={op} value={op}>{label}</option>
                ))}
              </select>

              {renderValueInput(rule, field)}

              <button
                onClick={() => removeRule(rule.id)}
                title="Remove filter"
                className="p-0.5 rounded text-slate-300 hover:text-red-500"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* + Filter trigger */}
        <button
          onClick={() => { setOpen(v => !v); setAddingTo(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Filter size={12} /> Filter
          {(filters || []).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black">
              {filters.length}
            </span>
          )}
        </button>

        {(filters || []).length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition"
          >
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>

      {/* Popover */}
      {open && !addingTo && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Add a filter
          </div>
          {loading ? (
            <div className="p-4 text-xs font-semibold text-slate-400">Loading fields...</div>
          ) : availableFields.length === 0 ? (
            <div className="p-4 text-xs font-semibold text-slate-400">All fields are already being filtered.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {availableFields.map(f => (
                <button
                  key={f.fieldKey}
                  onClick={() => { addRule(f.fieldKey); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                >
                  <span className="truncate">
                    {f.label}
                    {f.section !== 'Lead Information' && (
                      <span className="ml-1 text-[9px] font-black uppercase text-slate-400">
                        {f.section}
                      </span>
                    )}
                  </span>
                  <Plus size={12} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Filter matcher — used by Leads.jsx
// ============================================
export function matchesFilters(lead, filters, getPrimaryContact) {
  if (!filters || filters.length === 0) return true;

  for (const rule of filters) {
    const { fieldKey, op, value } = rule;

    // Skip empty input rules (user just added a filter but hasn't typed)
    if (
      (op !== 'notEmpty' && op !== 'empty' && op !== 'in' && op !== 'notIn') &&
      (value === '' || value === undefined || value === null)
    ) continue;
    if ((op === 'in' || op === 'notIn') && (!Array.isArray(value) || value.length === 0)) continue;

    let v = '';

    // Synthesise the "contact" values
    if (['firstName', 'lastName', 'email', 'phone', 'mobile'].includes(fieldKey)) {
      const p = getPrimaryContact(lead);
      v = p ? (p[fieldKey] || '') : '';
    } else if (fieldKey === 'company') {
      v = lead.companyName || '';
    } else if (fieldKey.includes('.')) {
      const [k, sub] = fieldKey.split('.');
      v = lead[k]?.[sub] ?? '';
    } else if (['industry', 'leadSource', 'leadStatus', 'rating', 'website', 'noOfEmployees'].includes(fieldKey)) {
      v = lead[fieldKey] ?? '';
    } else {
      // Custom fields live under dynamicFields[]
      const dyn = (lead.dynamicFields || []).find(f => f.fieldKey === fieldKey);
      v = dyn ? dyn.value : '';
    }

    const sv = String(v ?? '').toLowerCase();
    const rv = String(value ?? '').toLowerCase();

    switch (op) {
      case 'contains':   if (!sv.includes(rv)) return false; break;
      case 'equals':     if (sv !== rv) return false; break;
      case 'startsWith': if (!sv.startsWith(rv)) return false; break;
      case 'notEmpty':   if (!sv) return false; break;
      case 'empty':      if (sv) return false; break;
      case 'is':         if (sv !== rv) return false; break;
      case 'isNot':      if (sv === rv) return false; break;
      case 'in':         if (!value.map(x => String(x).toLowerCase()).includes(sv)) return false; break;
      case 'notIn':      if (value.map(x => String(x).toLowerCase()).includes(sv)) return false; break;
      case 'eq':         if (Number(v) !== Number(value)) return false; break;
      case 'gt':         if (!(Number(v) > Number(value))) return false; break;
      case 'lt':         if (!(Number(v) < Number(value))) return false; break;
      case 'gte':        if (!(Number(v) >= Number(value))) return false; break;
      case 'lte':        if (!(Number(v) <= Number(value))) return false; break;
      case 'on': {
        const a = new Date(v).toISOString().slice(0, 10);
        const b = new Date(value).toISOString().slice(0, 10);
        if (a !== b) return false; break;
      }
      case 'before': if (!(new Date(v) < new Date(value))) return false; break;
      case 'after':  if (!(new Date(v) > new Date(value))) return false; break;
      default: break;
    }
  }
  return true;
}