// frontend/src/components/RecordDetailKit.jsx
//
// Building blocks for the Zoho-style record detail pages
// (pages/AccountDetail.jsx, ContactDetail.jsx, DealDetail.jsx)
//
//   <DetailShell>     back link, title, tags strip, Edit / Save / Cancel
//   <DetailSection>   white card with a heading
//   <FieldGrid>       2-column field list that switches between view and edit mode
//   <RelatedTable>    small clickable list (contacts of an account, deals, ...)
//   useSalesUsers()   owners for the "Owner" dropdowns
//   canEditSales()    Sales / Sales Manager / Admin / Super Admin can edit
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Pencil, Save, X, Loader2, Tag as TagIcon, ExternalLink } from 'lucide-react';
import API_BASE_URL from '../config';
import { TagChip } from './RecordTags';

export const SALES_EDIT_ROLES = ['Super Admin', 'Admin', 'Sales', 'Sales Manager'];
export const canEditSales = () => SALES_EDIT_ROLES.includes(localStorage.getItem('role') || '');

export const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
export const apiError = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};
export const withHttp = (url) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `https://${url}`);

// customFields array on a record → { fieldKey: value }
export const customValuesOf = (list) =>
  Object.fromEntries((list || []).map((f) => [f.fieldKey, f.value]));

// ============================================
// Owners (Sales + Sales Manager users)
// ============================================
export function useSalesUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      ['Sales', 'Sales Manager'].map((role) =>
        axios.get(`${API_BASE_URL}/api/admin/users?role=${encodeURIComponent(role)}`, authHeader())
          .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []))
          .catch(() => [])
      )
    ).then(([a, b]) => {
      if (!alive) return;
      const seen = new Set();
      const all = [...a, ...b].filter((u) => u?._id && !seen.has(u._id) && seen.add(u._id));
      setUsers(all.sort((x, y) => (x.name || '').localeCompare(y.name || '')));
    });
    return () => { alive = false; };
  }, []);
  return users;
}

// ============================================
// Layout
// ============================================
export function DetailShell({
  onBack, backLabel, icon: Icon, title, subtitle, badges,
  tags, onAddTags, onRemoveTag, canEdit, editing, saving, onEdit, onCancel, onSave, extraActions,
  isCollapsed, children,
}) {
  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft size={16} /> {backLabel}
      </button>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {Icon && (
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Icon size={22} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-800 break-words">{title}</h1>
              {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
              {badges && <div className="flex flex-wrap items-center gap-2 mt-2">{badges}</div>}

              {/* tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {(tags || []).map((t) => <TagChip key={t._id} tag={t} size="md" onRemove={onRemoveTag} />)}
                {onAddTags && (
                  <button
                    onClick={onAddTags}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    <TagIcon size={11} /> Add Tags
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {extraActions}
            {canEdit && !editing && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-sm"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={onCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

export function DetailSection({ title, right, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl shadow-sm mb-5 ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-600">{title}</h2>
        {right}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

// ============================================
// Fields
// field: { key, label, type, options?, readOnly?, render?(value, values), placeholder?, required?, wide? }
//   type: text | email | phone | url | number | date | select | textarea | checkbox
//   options (select): ['A','B'] or [{ value, label }]
// ============================================
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition';

const optList = (options) => (options || []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));

function ViewValue({ field, value, values }) {
  if (field.render) return field.render(value, values);
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
  if (field.type === 'checkbox') return <span>{value ? 'Yes' : 'No'}</span>;
  if (empty) return <span className="text-slate-300">—</span>;
  if (field.type === 'email') return <a href={`mailto:${value}`} className="text-blue-600 hover:underline break-all">{value}</a>;
  if (field.type === 'phone') return <a href={`tel:${value}`} className="text-blue-600 hover:underline">{value}</a>;
  if (field.type === 'url') {
    return (
      <a href={withHttp(value)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all inline-flex items-center gap-1">
        {value} <ExternalLink size={11} />
      </a>
    );
  }
  if (field.type === 'date') return <span>{fmtDate(value)}</span>;
  if (field.type === 'select') {
    const hit = optList(field.options).find((o) => String(o.value) === String(value));
    return <span>{hit ? hit.label : String(value)}</span>;
  }
  if (Array.isArray(value)) return <span>{value.join(', ')}</span>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function EditValue({ field, value, onChange }) {
  const v = value ?? '';
  switch (field.type) {
    case 'textarea':
      return <textarea rows={3} value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={field.placeholder} />;
    case 'select': {
      const opts = optList(field.options);
      const hasCurrent = v === '' || opts.some((o) => String(o.value) === String(v));
      return (
        <select value={v} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {!field.required && <option value="">-None-</option>}
          {!hasCurrent && <option value={v}>{v}</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2 py-2 cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <span className="text-sm text-slate-600">{field.checkboxLabel || 'Yes'}</span>
        </label>
      );
    case 'number':
      return <input type="number" min={field.min ?? 0} value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case 'date':
      return <input type="date" value={toInputDate(v) || v} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
    case 'email':
      return <input type="email" value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={field.placeholder} />;
    default:
      return <input type="text" value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={field.placeholder} />;
  }
}

export function FieldGrid({ fields, values, editing, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
      {fields.map((f) => {
        const editable = editing && !f.readOnly;
        return (
          <div
            key={f.key}
            className={`grid grid-cols-[150px_1fr] items-start gap-3 py-2.5 border-b border-slate-100 ${f.wide ? 'md:col-span-2' : ''}`}
          >
            <span className="text-[13px] text-slate-500 pt-2 leading-tight">
              {f.label}
              {editable && f.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            <div className={`text-sm font-medium text-slate-800 min-w-0 ${editable ? '' : 'pt-2'}`}>
              {editable
                ? <EditValue field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />
                : <ViewValue field={f} value={values[f.key]} values={values} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Customize-Modules field definitions → FieldGrid fields (keys prefixed "cf:")
const CF_TYPE = {
  'Multi-Line': 'textarea', 'Pick List': 'select', Email: 'email', Phone: 'phone', URL: 'url',
  Number: 'number', Decimal: 'number', Currency: 'number', Percent: 'number', 'Long Integer': 'number',
  Date: 'date', Checkbox: 'checkbox',
};
export const customFieldDefs = (defs) =>
  (defs || []).map((f) => ({
    key: `cf:${f.fieldKey}`,
    label: f.label,
    type: CF_TYPE[f.type] || 'text',
    options: f.type === 'Pick List' ? (f.options || []).map((o) => o.label) : undefined,
    required: !!f.isRequired,
    wide: f.type === 'Multi-Line',
  }));

// ============================================
// Related list
// ============================================
export function RelatedTable({ columns, rows, onRowClick, empty = 'Nothing here yet.' }) {
  if (!rows.length) return <p className="text-sm text-slate-400 py-3">{empty}</p>;
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr
              key={r._id || i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={onRowClick ? 'hover:bg-blue-50/50 cursor-pointer' : ''}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 text-slate-700">{c.render ? c.render(r) : r[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailLoading({ isCollapsed, message = 'Loading...' }) {
  return (
    <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 size={30} className="animate-spin text-blue-600" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
}

// Row click helper for list tables: ignore clicks on links / buttons / inputs and on popups
// rendered through portals (they bubble through React but aren't inside the <tr> in the DOM).
export const rowClickHandler = (go) => (e) => {
  if (!e.currentTarget.contains(e.target)) return;
  if (e.target.closest('a, button, input, select, textarea, label, [data-no-row-click]')) return;
  if (window.getSelection && String(window.getSelection()).length > 0) return; // user is selecting text
  go(e);
};
