// frontend/src/components/CustomFieldsSection.jsx
//
// Renders the fields created in  Customize Modules  inside any create-form.
//
//   const customFields = useCustomFields('Accounts');          // load definitions
//   const [custom, setCustom] = useState({});                   // { [fieldKey]: value }
//
//   <CustomFieldsSection
//     fields={customFields}
//     values={custom}
//     onChange={(key, val) => setCustom(p => ({ ...p, [key]: val }))}
//     disabled={saving}
//   />
//
//   // on save
//   const err = validateCustomFields(customFields, custom);
//   if (err) return toast.error(err);
//   payload.customFields = buildCustomFieldsPayload(customFields, custom);
//
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

// Types that cannot be entered by hand in a simple create-form
const SKIP_TYPES = ['Auto-Number', 'Formula', 'File Upload', 'Image Upload'];
const NUMERIC_TYPES = ['Number', 'Decimal', 'Currency', 'Percent', 'Long Integer'];

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 disabled:bg-slate-100';
const labelCls = 'text-xs font-bold text-slate-600 block mb-1';

// --------------------------------------------------------------------
// Load the custom-field definitions for a module.
//   moduleName: 'Leads' | 'Contacts' | 'Accounts' | 'Deals' | 'Tasks' | 'Meetings' | 'Calls' | 'Projects'
//               (pass null/undefined to skip loading)
//   refreshKey: optional – changing it (e.g. a modal's `open` flag) re-fetches
// --------------------------------------------------------------------
export function useCustomFields(moduleName, refreshKey = true) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!moduleName || !refreshKey) return undefined;
    let alive = true;
    const token = localStorage.getItem('token');

    axios
      .get(`${API_BASE_URL}/api/module-fields/${moduleName}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        if (!alive) return;
        const list = (res.data?.data || []).filter((f) => !SKIP_TYPES.includes(f.type));
        setFields(list);
      })
      .catch(() => alive && setFields([]));

    return () => {
      alive = false;
    };
  }, [moduleName, refreshKey]);

  return fields;
}

const isEmpty = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Returns an error message for the first missing required field, or null.
export function validateCustomFields(fields, values) {
  for (const f of fields) {
    if (!f.isRequired || f.type === 'Checkbox') continue;
    if (isEmpty(values?.[f.fieldKey])) return `${f.label} is required`;
  }
  return null;
}

// Converts { fieldKey: value } into the array saved on the record:
//   [{ fieldKey, label, type, value }]
export function buildCustomFieldsPayload(fields, values) {
  return fields
    .map((f) => {
      let v = values?.[f.fieldKey];
      if (f.type === 'Checkbox') v = !!v;
      else if (isEmpty(v)) return null;
      else if (NUMERIC_TYPES.includes(f.type)) v = Number(v);
      return { fieldKey: f.fieldKey, label: f.label, type: f.type, value: v };
    })
    .filter(Boolean);
}

function FieldInput({ field, value, onChange, disabled }) {
  const common = {
    disabled,
    className: inputCls,
    placeholder: field.placeholder || ''
  };

  switch (field.type) {
    case 'Multi-Line':
      return (
        <textarea
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );

    case 'Pick List':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">-None-</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case 'Multi-Select': {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (label) =>
        onChange(
          selected.includes(label) ? selected.filter((x) => x !== label) : [...selected, label]
        );
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 py-1">
          {(field.options || []).length === 0 && (
            <span className="text-xs text-slate-400">No options defined</span>
          )}
          {(field.options || []).map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selected.includes(o.label)}
                onChange={() => toggle(o.label)}
                disabled={disabled}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }

    case 'Checkbox':
      return (
        <label className="flex items-center gap-2 py-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          {field.placeholder || 'Yes'}
        </label>
      );

    case 'Date':
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'Date/Time':
      return (
        <input
          type="datetime-local"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );

    case 'Number':
    case 'Long Integer':
      return (
        <input type="number" step="1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />
      );

    case 'Decimal':
    case 'Currency':
    case 'Percent':
      return (
        <input type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />
      );

    case 'Email':
      return <input type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'Phone':
      return <input type="tel" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'URL':
      return <input type="url" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    // Single Line, Address, Lookup, User, Multi User → plain text
    default:
      return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

export default function CustomFieldsSection({
  fields,
  values,
  onChange,
  disabled = false,
  title = 'Custom Fields'
}) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="pt-2 border-t border-slate-100">
      {title && (
        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">{title}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div
            key={f.fieldKey}
            className={f.type === 'Multi-Line' || f.type === 'Multi-Select' ? 'sm:col-span-2' : ''}
          >
            <label className={labelCls}>
              {f.label}
              {f.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldInput
              field={f}
              value={values?.[f.fieldKey]}
              onChange={(v) => onChange(f.fieldKey, v)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
