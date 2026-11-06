// frontend/src/components/LeadDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ArrowLeft, StickyNote, ChevronDown, ListTodo, Video, Phone,
  PhoneIncoming, PhoneOutgoing, X, Loader2, Trash2, CheckCircle2,
  Clock, MapPin, Save, Handshake,
} from 'lucide-react';
import API_BASE_URL from '../config';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from './CustomFieldsSection';
import { useSidebar } from '../context/SidebarContext';
import ConvertDealModal from './ConvertDealModal';

// ============================================
// HELPERS
// ============================================
const CURRENT_USER_ID = localStorage.getItem('userId') || '';
const CURRENT_ROLE = localStorage.getItem('role') || '';

// An activity is "closed" only when finished or cancelled.
// Task stages like In Progress / Deferred / Waiting for input are still open.
const CLOSED_STATUSES = ['Completed', 'Cancelled'];
const isClosed = (status) => CLOSED_STATUSES.includes(status);

// Hide the badge for the plain "not started" states
const showStatusBadge = (status) => status && status !== 'Open' && status !== 'Not Started';

const statusBadgeCls = (status) => {
  switch (status) {
    case 'Completed':         return 'bg-emerald-100 text-emerald-700';
    case 'Cancelled':         return 'bg-red-100 text-red-700';
    case 'In Progress':       return 'bg-blue-100 text-blue-700';
    case 'Waiting for input': return 'bg-amber-100 text-amber-700';
    case 'Deferred':          return 'bg-purple-100 text-purple-700';
    default:                  return 'bg-slate-100 text-slate-600';
  }
};

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { dateStyle: 'medium' }) : '';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100';

const MODAL_META = {
  note:    { title: 'Add Note',     icon: StickyNote },
  task:    { title: 'Add Activity', icon: ListTodo },
  meeting: { title: 'Add Meeting',  icon: Video },
  call:    { title: 'Add Call',     icon: Phone },
};

// Which Customize-Modules module each activity type belongs to (notes have none)
const MODULE_BY_TYPE = { task: 'Tasks', meeting: 'Meetings', call: 'Calls' };

const emptyForm = {
  title: '',
  content: '',
  scheduledAt: '',
  dueAt: '',
  durationMinutes: '',
  location: '',
  attendees: '',
  callDirection: 'Outbound',
  callOutcome: '',
  priority: 'Medium',
};

// ============================================
// EDITABLE LEAD DETAILS
// Shows every lead field as an input — including the fields added in
// Customize Modules → Leads — and saves them with PUT /api/leads/:id.
// ============================================
const CAN_EDIT = ['Admin', 'Super Admin', 'Sales', 'Sales Manager'].includes(CURRENT_ROLE);

// ✅ Updated Lead Sources to match the new form requirements
const FALLBACK_LEAD_SOURCES = [
  'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral', 'Online Store',
  'Email', 'Public Relations', 'Sales Email Alias', 'Seminar Partner', 'Internal Seminar',
  'Trade Show', 'Web Download', 'Web Research', 'Chat', 'X (Twitter)', 'Facebook', 'LinkedIn'
];
const FALLBACK_INDUSTRIES = ['ECOM', 'FOOD', 'HTL', 'TRVL', 'FNC', 'SCLM', 'JOB', 'AUTO', 'IT', 'Other'];
const FALLBACK_LEAD_STATUSES = [
  'Attempted to Contact', 'Contact in Future', 'Contacted', 'Junk Lead', 'Lost Lead',
  'Not Contacted', 'Pre-Qualified', 'Not Qualified'
];

// These have their own inputs below. Any other field in the schema is a custom
// field whose value lives in lead.dynamicFields[].
const CORE_FIELD_KEYS = new Set([
  'leadOwner', 'firstName', 'lastName', 'title', 'phone', 'mobile', 'leadSource', 'industry',
  'company', 'email', 'fax', 'website', 'leadStatus', 'noOfEmployees', 'rating', 'description'
]);

// Customize Modules type -> input kind (same mapping the Create Lead form uses)
const MODULE_TYPE_MAP = {
  'Single Line': 'text', 'Multi-Line': 'textarea', 'Email': 'email', 'Phone': 'phone',
  'Pick List': 'select', 'Date': 'date', 'Date/Time': 'date', 'Number': 'number',
  'Decimal': 'number', 'Currency': 'number', 'Percent': 'number', 'Long Integer': 'number',
  'Checkbox': 'checkbox', 'URL': 'text'
};

// options may be strings, { value, locked } (Leads schema) or { label, value } (Customize Modules)
const optionText = (o) => (typeof o === 'string' ? o : String(o?.label ?? o?.value ?? ''));
const optionList = (opts = []) => opts.map(optionText).filter((v) => v && v !== '-None-');

const ADDRESS_KEYS = ['countryRegion', 'flatHouse', 'streetAddress', 'city', 'stateProvince', 'zipPostalCode'];

function leadToForm(lead) {
  const p = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0] || {};
  const custom = {};
  (lead.dynamicFields || []).forEach((d) => { custom[d.fieldKey] = d.value; });
  return {
    companyName: lead.companyName || '',
    website: lead.website || '',
    industry: lead.industry || '',
    noOfEmployees: lead.noOfEmployees ?? '',
    leadSource: lead.leadSource || '',
    leadStatus: lead.leadStatus || '',
    description: lead.description || '',
    address: Object.fromEntries(ADDRESS_KEYS.map((k) => [k, lead.address?.[k] || ''])),
    contact: {
      firstName: p.firstName || '',
      lastName: p.lastName === '-' ? '' : p.lastName || '',
      title: p.title || '',
      email: p.email || '',
      phone: p.phone || '',
      mobile: p.mobile || ''
    },
    custom
  };
}

// One row = fixed-width right-aligned label + input, so every input in the card
// starts at the same left edge (same pattern as the Create Lead form).
function FieldBox({ label, required, children }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-x-3">
      <label className="pt-2 text-right text-xs font-semibold leading-snug text-slate-500 break-words">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Full-bleed section band, then the rows underneath
function Group({ title, children }) {
  return (
    <section>
      <h3 className="-mx-5 mb-3 px-5 py-1.5 bg-slate-50 border-y border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SelectInput({ value, options, onChange, disabled }) {
  // keep a saved value visible even if it was later removed from the option list
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls}>
      <option value="">-None-</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function CustomInput({ def, value, onChange, disabled }) {
  const common = { disabled, className: inputCls, placeholder: def.placeholder || '' };
  switch (def.kind) {
    case 'textarea':
      return <textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'select':
      return <SelectInput value={value} options={def.options} onChange={onChange} disabled={disabled} />;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 py-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
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

function LeadDetailsPanel({ lead, authHeader, onSaved }) {
  const [form, setForm] = useState(() => leadToForm(lead));
  const [baseline, setBaseline] = useState(() => JSON.stringify(leadToForm(lead)));
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState({ core: {}, custom: [] });

  // reset whenever a fresh copy of the lead arrives (e.g. right after saving)
  useEffect(() => {
    const f = leadToForm(lead);
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [lead]);

  // Field definitions: Leads field schema + fields from Customize Modules → Leads
  useEffect(() => {
    let alive = true;
    (async () => {
      const [fieldsRes, modRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leads/fields`, authHeader).catch(() => null),
        axios.get(`${API_BASE_URL}/api/module-fields/Leads`, authHeader).catch(() => null)
      ]);
      if (!alive) return;

      const schemaFields = fieldsRes?.data?.data || [];
      const moduleFields = modRes?.data?.data || [];

      const core = {};
      schemaFields
        .filter((f) => f.type === 'select' && CORE_FIELD_KEYS.has(f.fieldKey))
        .forEach((f) => { core[f.fieldKey] = optionList(f.options); });

      const custom = [
        ...schemaFields
          .filter((f) => !f.isDefault && !CORE_FIELD_KEYS.has(f.fieldKey) && !String(f.fieldKey).startsWith('address.'))
          .map((f) => ({
            fieldKey: f.fieldKey, label: f.label, kind: f.type, options: optionList(f.options),
            required: !!f.required, placeholder: f.placeholder || '', order: f.order || 0
          })),
        ...moduleFields.map((f) => ({
          fieldKey: f.fieldKey, label: f.label, kind: MODULE_TYPE_MAP[f.type] || 'text', options: optionList(f.options),
          required: !!f.isRequired, placeholder: f.placeholder || '', order: 1000 + (f.order || 0)
        }))
      ].sort((a, b) => a.order - b.order);

      setSchema({ core, custom });
    })();
    return () => { alive = false; };
  }, [authHeader]);

  const dirty = JSON.stringify(form) !== baseline;
  const readOnly = !CAN_EDIT || saving;

  const setTop = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setNested = (group, k, v) => setForm((p) => ({ ...p, [group]: { ...p[group], [k]: v } }));
  const discard = () => setForm(JSON.parse(baseline));

  const save = async () => {
    if (saving || !dirty) return;
    if (!form.companyName.trim()) return toast.error('Company name is required');

    const c = form.contact;
    const hasContact = Object.values(c).some((v) => String(v).trim());
    if (hasContact && !c.firstName.trim() && !c.lastName.trim()) {
      return toast.error('Contact first or last name is required');
    }

    const missing = schema.custom.find(
      (d) => d.required && d.kind !== 'checkbox' && (form.custom[d.fieldKey] === undefined || form.custom[d.fieldKey] === '')
    );
    if (missing) return toast.error(`${missing.label} is required`);

    // ---- contacts: edit the primary one, keep the rest untouched ----
    let contacts = (lead.contacts || []).map((x) => ({ ...x }));
    if (hasContact) {
      const idx = Math.max(0, contacts.findIndex((x) => x.isPrimary));
      const merged = {
        ...(contacts[idx] || {}),
        firstName: c.firstName.trim(),
        lastName: c.lastName.trim() || '-',
        title: c.title.trim(),
        email: c.email.trim(),
        phone: c.phone.trim(),
        mobile: c.mobile.trim(),
        isPrimary: true
      };
      if (contacts.length) contacts[idx] = merged; else contacts = [merged];
    }

    // ---- custom fields: update known ones, keep any others already on the lead ----
    const byKey = new Map((lead.dynamicFields || []).map((d) => [d.fieldKey, { ...d }]));
    schema.custom.forEach((def) => {
      let v = form.custom[def.fieldKey];
      if (def.kind === 'checkbox') v = !!v;
      else if (def.kind === 'number' && v !== '' && v !== undefined) v = Number(v);

      const existing = byKey.get(def.fieldKey);
      const isBlank = v === undefined || v === '' || v === false;
      if (!existing && isBlank) return; // nothing to store

      byKey.set(def.fieldKey, {
        ...(existing || {}),
        fieldKey: def.fieldKey,
        label: def.label,
        type: def.kind,
        section: 'Custom',
        value: v === undefined ? '' : v,
        options: def.options,
        required: def.required
      });
    });

    const payload = {
      companyName: form.companyName.trim(),
      website: form.website.trim(),
      industry: form.industry,
      noOfEmployees: form.noOfEmployees,
      leadSource: form.leadSource,
      leadStatus: form.leadStatus,
      description: form.description,
      address: form.address,
      contacts,
      dynamicFields: Array.from(byKey.values())
    };

    try {
      setSaving(true);
      const res = await axios.put(`${API_BASE_URL}/api/leads/${lead._id}`, payload, authHeader);
      toast.success('Lead updated');
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const saveBar = (
    <div className="flex items-center gap-2">
      <button
        onClick={discard}
        disabled={saving}
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
      >
        Discard
      </button>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-70"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {saving ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  );

  const text = (value, onChange, props = {}) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} {...props} />
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      {/* Sticky header keeps Save / Discard in reach while scrolling a long record */}
      <div className="sticky top-[73px] z-10 -mx-5 -mt-5 mb-4 px-5 py-3 min-h-[52px] flex items-center justify-between gap-2 bg-white/95 backdrop-blur border-b border-slate-100 rounded-t-xl">
        <h2 className="text-sm font-black text-slate-800">Lead Information</h2>
        {CAN_EDIT && dirty && saveBar}
      </div>

      <div className="space-y-5">
        <Group title="Lead Information">
          <FieldBox label="Company" required>{text(form.companyName, (v) => setTop('companyName', v))}</FieldBox>
          <FieldBox label="Website">{text(form.website, (v) => setTop('website', v))}</FieldBox>
          <FieldBox label="Lead Source">
            <SelectInput value={form.leadSource} onChange={(v) => setTop('leadSource', v)} disabled={readOnly}
              options={schema.core.leadSource?.length ? schema.core.leadSource : FALLBACK_LEAD_SOURCES} />
          </FieldBox>
          <FieldBox label="Lead Status">
            <SelectInput value={form.leadStatus} onChange={(v) => setTop('leadStatus', v)} disabled={readOnly}
              options={schema.core.leadStatus?.length ? schema.core.leadStatus : FALLBACK_LEAD_STATUSES} />
          </FieldBox>
          <FieldBox label="Industry">
            <SelectInput value={form.industry} onChange={(v) => setTop('industry', v)} disabled={readOnly}
              options={schema.core.industry?.length ? schema.core.industry : FALLBACK_INDUSTRIES} />
          </FieldBox>
          <FieldBox label="No. of Employees">
            {text(form.noOfEmployees, (v) => setTop('noOfEmployees', v), { type: 'number', min: 0 })}
          </FieldBox>
          <FieldBox label="Lead Owner">
            <input value={lead.leadOwner?.name || ''} readOnly disabled title="Set automatically" className={inputCls} />
          </FieldBox>
          
          {/* ✅ RENDER CUSTOM FIELDS HERE (removes the separate "Custom Fields" section) */}
          {schema.custom.map((def) => (
            <FieldBox key={def.fieldKey} label={def.label} required={def.required}>
              <CustomInput
                def={def}
                value={form.custom[def.fieldKey]}
                onChange={(v) => setNested('custom', def.fieldKey, v)}
                disabled={readOnly}
              />
            </FieldBox>
          ))}
        </Group>

        <Group title="Contact">
          <FieldBox label="First Name">{text(form.contact.firstName, (v) => setNested('contact', 'firstName', v))}</FieldBox>
          <FieldBox label="Last Name">{text(form.contact.lastName, (v) => setNested('contact', 'lastName', v))}</FieldBox>
          <FieldBox label="Title">{text(form.contact.title, (v) => setNested('contact', 'title', v))}</FieldBox>
          <FieldBox label="Email">{text(form.contact.email, (v) => setNested('contact', 'email', v), { type: 'email' })}</FieldBox>
          <FieldBox label="Phone">{text(form.contact.phone, (v) => setNested('contact', 'phone', v), { type: 'tel' })}</FieldBox>
          <FieldBox label="Mobile">{text(form.contact.mobile, (v) => setNested('contact', 'mobile', v), { type: 'tel' })}</FieldBox>
        </Group>

        <Group title="Address">
          <FieldBox label="Country / Region">{text(form.address.countryRegion, (v) => setNested('address', 'countryRegion', v))}</FieldBox>
          <FieldBox label="Flat / House No.">{text(form.address.flatHouse, (v) => setNested('address', 'flatHouse', v))}</FieldBox>
          <FieldBox label="Street Address">{text(form.address.streetAddress, (v) => setNested('address', 'streetAddress', v))}</FieldBox>
          <FieldBox label="City">{text(form.address.city, (v) => setNested('address', 'city', v))}</FieldBox>
          <FieldBox label="State / Province">{text(form.address.stateProvince, (v) => setNested('address', 'stateProvince', v))}</FieldBox>
          <FieldBox label="Zip / Postal Code">{text(form.address.zipPostalCode, (v) => setNested('address', 'zipPostalCode', v))}</FieldBox>
        </Group>

        <Group title="Description">
          <FieldBox label="Description">
            <textarea rows={4} value={form.description} onChange={(e) => setTop('description', e.target.value)} disabled={readOnly} className={inputCls} />
          </FieldBox>
        </Group>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function LeadDetail({ lead: initialLead, onBack, onUpdated }) {
  const { isCollapsed } = useSidebar();
  const [lead, setLead] = useState(initialLead); // local copy so edits show immediately
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [modalType, setModalType] = useState(null); // 'note' | 'task' | 'meeting' | 'call' | null
  const [showConvert, setShowConvert] = useState(false);

  const primary = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0] || null;
  const leadName =
    (primary && `${primary.firstName || ''} ${primary.lastName || ''}`.trim()) ||
    lead.companyName ||
    '—';

  // ---------- fetch ----------
  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/lead-activities?leadId=${lead._id}`,
        authHeader
      );
      setActivities(res.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load notes & activities');
    } finally {
      setLoading(false);
    }
  }, [lead._id, authHeader]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  // ---------- derived ----------
  const notes = useMemo(() => activities.filter((a) => a.type === 'note'), [activities]);
  const open = useMemo(
    () => activities.filter((a) => a.type !== 'note' && !isClosed(a.status)),
    [activities]
  );
  const closed = useMemo(
    () => activities.filter((a) => a.type !== 'note' && isClosed(a.status)),
    [activities]
  );
  const openTasks = open.filter((a) => a.type === 'task');
  const openMeetings = open.filter((a) => a.type === 'meeting');
  const openCalls = open.filter((a) => a.type === 'call');

  // after a successful edit: refresh this view and tell the list page
  const handleLeadSaved = (updated) => {
    setLead(updated);
    onUpdated?.(updated);
  };

  // ---------- actions ----------
  const markCompleted = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/lead-activities/${id}`, { status: 'Completed' }, authHeader);
      toast.success('Marked as completed');
      fetchActivities();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const deleteActivity = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/lead-activities/${id}`, authHeader);
      toast.success('Deleted');
      fetchActivities();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const canDelete = (a) =>
    String(a.createdBy?._id || a.createdBy) === String(CURRENT_USER_ID) ||
    CURRENT_ROLE === 'Admin' ||
    CURRENT_ROLE === 'Super Admin';

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* ---------- Top bar ---------- */}
      <div className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="px-6 py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition shrink-0"
              title="Back to leads"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-black shrink-0">
              {leadName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900 truncate">{leadName}</h1>
              <p className="text-xs font-semibold text-slate-400 truncate">{lead.companyName}</p>
            </div>
          </div>

          {/* Convert Deal + Add Note + Activity dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {lead.isConverted ? (
              <span className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">
                Converted
              </span>
            ) : (
              <button
                onClick={() => setShowConvert(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition"
              >
                <Handshake size={14} /> Convert Deal
              </button>
            )}

            <button
              onClick={() => setModalType('note')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
            >
              <StickyNote size={14} /> Add Note
            </button>

            <div className="relative">
              <button
                onClick={() => setShowActivityMenu((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
              >
                Activity
                <ChevronDown size={14} className={`transition-transform ${showActivityMenu ? 'rotate-180' : ''}`} />
              </button>

              {showActivityMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActivityMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                    {[
                      { type: 'task',    label: 'Add activity', icon: ListTodo },
                      { type: 'meeting', label: 'Add meeting',  icon: Video },
                      { type: 'call',    label: 'Add call',     icon: Phone },
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => { setShowActivityMenu(false); setModalType(type); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                      >
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="px-6 pt-[96px] pb-12 grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* Lead details (editable) */}
        <div className="xl:col-span-2">
          <LeadDetailsPanel lead={lead} authHeader={authHeader} onSaved={handleLeadSaved} />
        </div>

        {/* Notes + activities */}
        <div className="xl:col-span-3 space-y-6">
          {/* Notes */}
          <Section
            title="Notes"
            count={notes.length}
            action={
              <button
                onClick={() => setModalType('note')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Add Note
              </button>
            }
          >
            {loading ? <Spinner /> : notes.length === 0 ? (
              <Empty text="No notes yet. Click “Add Note” to write one." />
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n._id} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 group">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {n.createdBy?.name || 'Unknown'} · {fmtDateTime(n.createdAt)}
                      </span>
                      {canDelete(n) && (
                        <button
                          onClick={() => deleteActivity(n._id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          title="Delete note"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Open activities */}
          <Section title="Open Activities" count={open.length}>
            {loading ? <Spinner /> : open.length === 0 ? (
              <Empty text="No open activities. Use the Activity menu to add a task, meeting or call." />
            ) : (
              <div className="space-y-5">
                <ActivityGroup label="Tasks" items={openTasks} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
                <ActivityGroup label="Meetings" items={openMeetings} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
                <ActivityGroup label="Calls" items={openCalls} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
              </div>
            )}
          </Section>

          {/* Closed activities */}
          {closed.length > 0 && (
            <Section title="Closed Activities" count={closed.length}>
              <div className="space-y-2">
                {closed.map((a) => (
                  <ActivityCard key={a._id} item={a} onDelete={deleteActivity} canDelete={canDelete(a)} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ---------- Convert to Deal ---------- */}
      {showConvert && (
        <ConvertDealModal
          lead={lead}
          onClose={() => setShowConvert(false)}
          onConverted={() => { setShowConvert(false); navigate('/sales/deals'); }}
        />
      )}

      {/* ---------- Modal ---------- */}
      {modalType && (
        <ActivityModal
          type={modalType}
          leadId={lead._id}
          authHeader={authHeader}
          onClose={() => setModalType(null)}
          onSaved={() => { setModalType(null); fetchActivities(); }}
        />
      )}
    </div>
  );
}

// ============================================
// SMALL PRESENTATIONAL PIECES
// ============================================
function Section({ title, count, action, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black text-slate-800">
          {title}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">{count}</span>
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const Spinner = () => (
  <div className="flex justify-center py-8">
    <Loader2 size={22} className="text-blue-600 animate-spin" />
  </div>
);

const Empty = ({ text }) => (
  <p className="text-xs font-semibold text-slate-400 text-center py-6">{text}</p>
);

function ActivityGroup({ label, items, onComplete, onDelete, canDelete }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
        {label} ({items.length})
      </p>
      <div className="space-y-2">
        {items.map((a) => (
          <ActivityCard
            key={a._id}
            item={a}
            onComplete={onComplete}
            onDelete={onDelete}
            canDelete={canDelete(a)}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ item, onComplete, onDelete, canDelete }) {
  const iconMap = {
    task: ListTodo,
    meeting: Video,
    call: item.callDirection === 'Inbound' ? PhoneIncoming : PhoneOutgoing,
  };
  const Icon = iconMap[item.type] || ListTodo;
  const when = item.type === 'task' ? item.dueAt : item.scheduledAt;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:shadow-sm transition group">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-800">{item.title}</span>
          {item.type === 'task' && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
              item.priority === 'High' ? 'bg-red-100 text-red-700'
              : item.priority === 'Low' ? 'bg-slate-100 text-slate-600'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {item.priority}
            </span>
          )}
          {showStatusBadge(item.status) && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusBadgeCls(item.status)}`}>
              {item.status}
            </span>
          )}
          {item.type === 'call' && item.callOutcome && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
              {item.callOutcome}
            </span>
          )}
        </div>
        {item.content && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.content}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-slate-400 flex-wrap">
          {when && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {item.type === 'task' ? `Due ${fmtDate(when)}` : fmtDateTime(when)}
            </span>
          )}
          {item.durationMinutes ? <span>{item.durationMinutes} min</span> : null}
          {item.location && (
            <span className="flex items-center gap-1"><MapPin size={10} />{item.location}</span>
          )}
          <span>by {item.createdBy?.name || 'Unknown'}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onComplete && !isClosed(item.status) && (
          <button
            onClick={() => onComplete(item._id)}
            className="p-1.5 rounded-md text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition"
            title="Mark as completed"
          >
            <CheckCircle2 size={16} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(item._id)}
            className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// ADD NOTE / TASK / MEETING / CALL MODAL
// Validation mirrors backend/routes/leadActivityRoutes.js
// ============================================
export function ActivityModal({ type, leadId, authHeader, onClose, onSaved }) {
  const meta = MODAL_META[type];
  const HeaderIcon = meta.icon;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Fields created in Customize Modules → Tasks / Meetings / Calls
  const customFields = useCustomFields(MODULE_BY_TYPE[type]);
  const [custom, setCustom] = useState({});

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    // ---- client-side validation ----
    if (type === 'note' && !form.content.trim()) return toast.error('Note content is required');
    if (type === 'task' && !form.title.trim()) return toast.error('Task subject is required');
    if (type === 'meeting') {
      if (!form.title.trim()) return toast.error('Meeting title is required');
      if (!form.scheduledAt) return toast.error('Meeting date & time is required');
    }
    if (type === 'call') {
      if (!form.title.trim()) return toast.error('Call subject is required');
      if (!form.scheduledAt) return toast.error('Call date & time is required');
    }
    const cfErr = validateCustomFields(customFields, custom);
    if (cfErr) return toast.error(cfErr);

    const payload = {
      leadId, type, title: form.title.trim(), content: form.content.trim(),
      customFields: buildCustomFieldsPayload(customFields, custom)
    };

    if (type === 'task') {
      payload.dueAt = form.dueAt ? new Date(form.dueAt).toISOString() : null;
      payload.priority = form.priority;
      payload.status = 'Not Started'; // new tasks land in the first Kanban column
    }
    if (type === 'meeting') {
      payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      payload.durationMinutes = form.durationMinutes || null;
      payload.location = form.location.trim();
      payload.attendees = form.attendees
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (type === 'call') {
      payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      payload.durationMinutes = form.durationMinutes || null;
      payload.callDirection = form.callDirection;
      payload.callOutcome = form.callOutcome;
      payload.location = form.location.trim(); // ✅ ADDED: Save location for calls
    }

    try {
      setSaving(true);
      await axios.post(`${API_BASE_URL}/api/lead-activities`, payload, authHeader);
      toast.success(
        type === 'note' ? 'Note added'
        : type === 'task' ? 'Activity added'
        : type === 'meeting' ? 'Meeting scheduled'
        : 'Call logged'
      );
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HeaderIcon size={16} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{meta.title}</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* ---------- NOTE ---------- */}
          {type === 'note' && (
            <Field label="Note" required>
              <textarea
                autoFocus
                rows={6}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder="Write your note here..."
                className={inputCls}
                disabled={saving}
              />
            </Field>
          )}

          {/* ---------- TASK / MEETING / CALL ---------- */}
          {type !== 'note' && (
            <Field label={type === 'task' ? 'Subject' : type === 'meeting' ? 'Title' : 'Call Subject'} required>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className={inputCls}
                disabled={saving}
                placeholder={
                  type === 'task' ? 'e.g. Send proposal'
                  : type === 'meeting' ? 'e.g. Product demo'
                  : 'e.g. Follow-up call'
                }
              />
            </Field>
          )}

          {type === 'task' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date">
                <input type="date" value={form.dueAt} onChange={(e) => set('dueAt', e.target.value)} className={inputCls} disabled={saving} />
              </Field>
              <Field label="Priority">
                <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCls} disabled={saving}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </Field>
            </div>
          )}

          {type === 'meeting' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date & Time" required>
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className={inputCls} disabled={saving} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" min="0" value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} className={inputCls} disabled={saving} />
                </Field>
              </div>
              <Field label="Location / Link">
                <input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputCls} disabled={saving} placeholder="Office, Google Meet link..." />
              </Field>
              <Field label="Attendees">
                <input value={form.attendees} onChange={(e) => set('attendees', e.target.value)} className={inputCls} disabled={saving} placeholder="Comma-separated emails or names" />
              </Field>
            </>
          )}

          {type === 'call' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date & Time" required>
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className={inputCls} disabled={saving} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" min="0" value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} className={inputCls} disabled={saving} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Direction">
                  <select value={form.callDirection} onChange={(e) => set('callDirection', e.target.value)} className={inputCls} disabled={saving}>
                    <option>Outbound</option>
                    <option>Inbound</option>
                  </select>
                </Field>
                <Field label="Outcome">
                  <select value={form.callOutcome} onChange={(e) => set('callOutcome', e.target.value)} className={inputCls} disabled={saving}>
                    <option value="">-None-</option>
                    <option>Connected</option>
                    <option>Voicemail</option>
                    <option>No Answer</option>
                    <option>Busy</option>
                    <option>Wrong Number</option>
                  </select>
                </Field>
              </div>
              {/* ✅ ADDED: Location / Link field for calls */}
              <Field label="Location / Link">
                <input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputCls} disabled={saving} placeholder="Dial-in number, Google Meet link..." />
              </Field>
            </>
          )}

          {type !== 'note' && (
            <Field label="Description">
              <textarea rows={3} value={form.content} onChange={(e) => set('content', e.target.value)} className={inputCls} disabled={saving} />
            </Field>
          )}

          {type !== 'note' && (
            <CustomFieldsSection
              fields={customFields}
              values={custom}
              onChange={(k, v) => setCustom((prev) => ({ ...prev, [k]: v }))}
              disabled={saving}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70 shadow-lg shadow-blue-200"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 block mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}