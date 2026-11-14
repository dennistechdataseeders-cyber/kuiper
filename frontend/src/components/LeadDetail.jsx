// frontend/src/components/LeadDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ArrowLeft, StickyNote, ChevronDown, ListTodo, Video, Phone,
  PhoneIncoming, PhoneOutgoing, X, Loader2, Trash2, CheckCircle2,
  Clock, MapPin, Save, Handshake, Plus, Mail, Globe, UserCircle2, Building2, Tag as TagIcon,
} from 'lucide-react';
import API_BASE_URL from '../config';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from './CustomFieldsSection';
import { useSidebar } from '../context/SidebarContext';
import ConvertDealModal from './ConvertDealModal';
import useRecordTags from '../utils/useRecordTags';
import { TagChip, TagDialogs, useTagDialogs } from './RecordTags';
import {
  Cell, cellInput, InlineSelect, InlineCustom, FieldGroup, useUnsavedChanges, FloatingSaveBar,
} from './InlineEdit';

// ============================================
// HELPERS
// ============================================
// Read at call time (not when the file first loads) so a fresh login is picked up without a page refresh
const currentUserId = () => localStorage.getItem('userId') || '';
const currentRole = () => localStorage.getItem('role') || '';

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
const canEditLead = () => ['Admin', 'Super Admin', 'Sales', 'Sales Manager'].includes(currentRole());

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

// ============================================
// EDITABLE LEAD DETAILS
// Every field is editable in place. As soon as something changes a save bar
// floats at the bottom of the screen (Ctrl/Cmd + S also saves), so there is
// no need to scroll back up to save.
// ============================================
function LeadDetailsPanel({ lead, authHeader, onSaved, onDirtyChange, isCollapsed }) {
  const CAN_EDIT = canEditLead();
  const [form, setForm] = useState(() => leadToForm(lead));
  const [baseline, setBaseline] = useState(() => leadToForm(lead));
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState({ core: {}, custom: [] });

  // reset whenever a fresh copy of the lead arrives (e.g. right after saving)
  useEffect(() => {
    const f = leadToForm(lead);
    setForm(f);
    setBaseline(f);
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

  // ---- what changed (also gives Ctrl/Cmd+S and the leave-page warning) ----
  const saveRef = React.useRef(null);
  const unsaved = useUnsavedChanges(form, baseline, () => saveRef.current?.());
  const { dirty, isChanged } = unsaved;
  const changedIn = (prefix) => unsaved.changedIn(prefix);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const readOnly = !CAN_EDIT || saving;

  const setTop = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setNested = (group, k, v) => setForm((p) => ({ ...p, [group]: { ...p[group], [k]: v } }));
  const discard = () => setForm(baseline);

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

  useEffect(() => { saveRef.current = save; });

  const text = (key, value, onChange, props = {}) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
      className={cellInput(isChanged(key), !CAN_EDIT)}
      {...props}
    />
  );
  const select = (key, value, onChange, options) => (
    <InlineSelect value={value} onChange={onChange} options={options} disabled={readOnly} changed={isChanged(key)} />
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-black text-slate-800">Lead Details</h2>
        <span className="text-[11px] font-semibold text-slate-400">
          {CAN_EDIT ? 'Click any field to edit' : 'Read only'}
        </span>
      </div>

      <FieldGroup id="info" title="Lead Information" count={changedIn('companyName') + changedIn('website') + changedIn('leadSource') + changedIn('leadStatus') + changedIn('industry') + changedIn('noOfEmployees') + changedIn('custom.')}>
        <Cell label="Company" required changed={isChanged('companyName')}>{text('companyName', form.companyName, (v) => setTop('companyName', v))}</Cell>
        <Cell label="Website" changed={isChanged('website')}>{text('website', form.website, (v) => setTop('website', v))}</Cell>
        <Cell label="Lead Status" changed={isChanged('leadStatus')}>
          {select('leadStatus', form.leadStatus, (v) => setTop('leadStatus', v), schema.core.leadStatus?.length ? schema.core.leadStatus : FALLBACK_LEAD_STATUSES)}
        </Cell>
        <Cell label="Lead Source" changed={isChanged('leadSource')}>
          {select('leadSource', form.leadSource, (v) => setTop('leadSource', v), schema.core.leadSource?.length ? schema.core.leadSource : FALLBACK_LEAD_SOURCES)}
        </Cell>
        <Cell label="Industry" changed={isChanged('industry')}>
          {select('industry', form.industry, (v) => setTop('industry', v), schema.core.industry?.length ? schema.core.industry : FALLBACK_INDUSTRIES)}
        </Cell>
        <Cell label="No. of Employees" changed={isChanged('noOfEmployees')}>
          {text('noOfEmployees', form.noOfEmployees, (v) => setTop('noOfEmployees', v), { type: 'number', min: 0 })}
        </Cell>
        <Cell label="Lead Owner">
          <input value={lead.leadOwner?.name || 'Unassigned'} readOnly disabled title="Set automatically" className={cellInput(false, true)} />
        </Cell>
        {schema.custom.map((def) => (
          <Cell key={def.fieldKey} label={def.label} required={def.required} changed={isChanged(`custom.${def.fieldKey}`)} wide={def.kind === 'textarea'}>
            <InlineCustom
              def={def}
              value={form.custom[def.fieldKey]}
              onChange={(v) => setNested('custom', def.fieldKey, v)}
              disabled={readOnly}
              changed={isChanged(`custom.${def.fieldKey}`)}
            />
          </Cell>
        ))}
      </FieldGroup>

      <FieldGroup id="contact" title="Primary Contact" count={changedIn('contact.')}>
        <Cell label="First Name" changed={isChanged('contact.firstName')}>{text('contact.firstName', form.contact.firstName, (v) => setNested('contact', 'firstName', v))}</Cell>
        <Cell label="Last Name" changed={isChanged('contact.lastName')}>{text('contact.lastName', form.contact.lastName, (v) => setNested('contact', 'lastName', v))}</Cell>
        <Cell label="Title" changed={isChanged('contact.title')}>{text('contact.title', form.contact.title, (v) => setNested('contact', 'title', v))}</Cell>
        <Cell label="Email" changed={isChanged('contact.email')}>{text('contact.email', form.contact.email, (v) => setNested('contact', 'email', v), { type: 'email' })}</Cell>
        <Cell label="Phone" changed={isChanged('contact.phone')}>{text('contact.phone', form.contact.phone, (v) => setNested('contact', 'phone', v), { type: 'tel' })}</Cell>
        <Cell label="Mobile" changed={isChanged('contact.mobile')}>{text('contact.mobile', form.contact.mobile, (v) => setNested('contact', 'mobile', v), { type: 'tel' })}</Cell>
      </FieldGroup>

      <FieldGroup id="address" title="Address" count={changedIn('address.')}>
        <Cell label="Flat / House No." changed={isChanged('address.flatHouse')}>{text('address.flatHouse', form.address.flatHouse, (v) => setNested('address', 'flatHouse', v))}</Cell>
        <Cell label="Street Address" changed={isChanged('address.streetAddress')}>{text('address.streetAddress', form.address.streetAddress, (v) => setNested('address', 'streetAddress', v))}</Cell>
        <Cell label="City" changed={isChanged('address.city')}>{text('address.city', form.address.city, (v) => setNested('address', 'city', v))}</Cell>
        <Cell label="State / Province" changed={isChanged('address.stateProvince')}>{text('address.stateProvince', form.address.stateProvince, (v) => setNested('address', 'stateProvince', v))}</Cell>
        <Cell label="Country / Region" changed={isChanged('address.countryRegion')}>{text('address.countryRegion', form.address.countryRegion, (v) => setNested('address', 'countryRegion', v))}</Cell>
        <Cell label="Zip / Postal Code" changed={isChanged('address.zipPostalCode')}>{text('address.zipPostalCode', form.address.zipPostalCode, (v) => setNested('address', 'zipPostalCode', v))}</Cell>
      </FieldGroup>

      <FieldGroup id="description" title="Description" count={changedIn('description')}>
        <Cell label="Description" wide changed={isChanged('description')}>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setTop('description', e.target.value)}
            disabled={readOnly}
            className={`${cellInput(isChanged('description'), !CAN_EDIT)} h-auto py-2 resize-y`}
          />
        </Cell>
      </FieldGroup>

      <FloatingSaveBar
        show={CAN_EDIT && dirty}
        count={unsaved.count}
        saving={saving}
        onSave={save}
        onDiscard={discard}
        isCollapsed={isCollapsed}
      />
    </div>
  );
}

// ============================================
// QUICK NOTE (type and add without opening a dialog)
// ============================================
function QuickNote({ leadId, authHeader, onAdded }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const content = text.trim();
    if (!content || busy) return;
    try {
      setBusy(true);
      await axios.post(`${API_BASE_URL}/api/lead-activities`, { leadId, type: 'note', title: '', content, customFields: [] }, authHeader);
      setText('');
      toast.success('Note added');
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add note');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }}
        placeholder="Write a note..."
        className="w-full px-3 pt-2 text-sm outline-none resize-none rounded-lg"
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[10px] text-slate-400 pl-1">Ctrl + Enter to add</span>
        <button
          onClick={add}
          disabled={!text.trim() || busy}
          className="flex items-center gap-1 px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={12} />} Add
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function LeadDetail({ lead: initialLead, onBack, onUpdated, tagsApi: tagsFromList }) {
  const { isCollapsed } = useSidebar();
  const CAN_EDIT = canEditLead();
  const [lead, setLead] = useState(initialLead); // local copy so edits show immediately
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Tags: share the list page's tags so both stay in sync (own copy if opened elsewhere)
  const ownTags = useRecordTags(tagsFromList ? null : 'Leads');
  const tagsApi = tagsFromList || ownTags;
  const tagDialogs = useTagDialogs();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [modalType, setModalType] = useState(null); // 'note' | 'task' | 'meeting' | 'call' | null
  const [showConvert, setShowConvert] = useState(false);
  const [tab, setTab] = useState('notes'); // notes | open | closed
  const [dirty, setDirty] = useState(false);

  const primary = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0] || null;
  const leadName =
    (primary && `${primary.firstName || ''} ${primary.lastName === '-' ? '' : primary.lastName || ''}`.trim()) ||
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

  const goBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onBack();
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
    String(a.createdBy?._id || a.createdBy) === String(currentUserId()) ||
    currentRole() === 'Admin' ||
    currentRole() === 'Super Admin';

  const tags = tagsApi.tagsOf(lead._id);
  const phone = primary?.phone || primary?.mobile;
  const quick = [
    primary?.email && { icon: Mail, text: primary.email, href: `mailto:${primary.email}` },
    phone && { icon: Phone, text: phone, href: `tel:${phone}` },
    lead.website && { icon: Globe, text: lead.website.replace(/^https?:\/\//, ''), href: /^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`, external: true },
    { icon: UserCircle2, text: lead.leadOwner?.name || 'Unassigned' },
  ].filter(Boolean);

  const TABS = [
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'open', label: 'Open Activities', count: open.length },
    { id: 'closed', label: 'Closed', count: closed.length },
  ];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* ---------- Header ---------- */}
      <div className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="px-6 pt-3 pb-2.5 flex items-center gap-4">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition shrink-0"
            title="Back to leads"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-black shrink-0">
            {leadName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-black text-slate-900 truncate">{leadName}</h1>
              {lead.leadStatus && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wide">
                  {lead.leadStatus}
                </span>
              )}
              {lead.isConverted && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wide">
                  Converted
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 truncate flex items-center gap-1">
              <Building2 size={12} className="text-slate-400" />
              {lead.companyName}
              {primary?.title && <span className="text-slate-400">· {primary.title}</span>}
              {lead.leadSource && <span className="text-slate-400">· {lead.leadSource}</span>}
            </p>
          </div>

          {/* Convert Deal + Add Note + Activity dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {!lead.isConverted && (
              <button
                onClick={() => setShowConvert(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm transition"
              >
                <Handshake size={14} /> Convert Deal
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowActivityMenu((v) => !v)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-sm transition"
              >
                <Plus size={14} /> New
                <ChevronDown size={14} className={`transition-transform ${showActivityMenu ? 'rotate-180' : ''}`} />
              </button>

              {showActivityMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActivityMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                    {[
                      { type: 'note',    label: 'Note',     icon: StickyNote },
                      { type: 'task',    label: 'Activity', icon: ListTodo },
                      { type: 'meeting', label: 'Meeting',  icon: Video },
                      { type: 'call',    label: 'Call',     icon: Phone },
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

        {/* quick facts + tags */}
        <div className="px-6 pb-2.5 pl-[112px] flex items-center gap-x-4 gap-y-1.5 flex-wrap">
          {quick.map(({ icon: Icon, text, href, external }) => (
            href ? (
              <a
                key={text}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 max-w-[260px]"
              >
                <Icon size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{text}</span>
              </a>
            ) : (
              <span key={text} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Icon size={13} className="text-slate-400" /> {text}
              </span>
            )
          ))}
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t) => (
              <TagChip key={t._id} tag={t} onRemove={CAN_EDIT ? () => tagsApi.removeOne(lead._id, t._id) : undefined} />
            ))}
            {CAN_EDIT && (
              <button
                onClick={() => tagDialogs.openTags('add', [lead._id])}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600"
              >
                <TagIcon size={11} /> Add Tags
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="px-6 pt-[124px] pb-24 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Lead details (edit in place) */}
        <div className="xl:col-span-7">
          <LeadDetailsPanel
            lead={lead}
            authHeader={authHeader}
            onSaved={handleLeadSaved}
            onDirtyChange={setDirty}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Notes + activities: stays in view, scrolls inside itself */}
        <div className="xl:col-span-5 xl:sticky xl:top-[124px]">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col xl:max-h-[calc(100vh-148px)]">
            <div className="flex items-center gap-1 px-2 pt-2 border-b border-slate-100">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition ${
                    tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto">
              {tab === 'notes' && (
                <div className="space-y-3">
                  <QuickNote leadId={lead._id} authHeader={authHeader} onAdded={fetchActivities} />
                  {loading ? <Spinner /> : notes.length === 0 ? (
                    <Empty text="No notes yet." />
                  ) : (
                    notes.map((n) => (
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
                    ))
                  )}
                </div>
              )}

              {tab === 'open' && (
                loading ? <Spinner /> : open.length === 0 ? (
                  <Empty text="No open activities. Use “New” to add a task, meeting or call." />
                ) : (
                  <div className="space-y-5">
                    <ActivityGroup label="Tasks" items={openTasks} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
                    <ActivityGroup label="Meetings" items={openMeetings} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
                    <ActivityGroup label="Calls" items={openCalls} onComplete={markCompleted} onDelete={deleteActivity} canDelete={canDelete} />
                  </div>
                )
              )}

              {tab === 'closed' && (
                loading ? <Spinner /> : closed.length === 0 ? (
                  <Empty text="No closed activities yet." />
                ) : (
                  <div className="space-y-2">
                    {closed.map((a) => (
                      <ActivityCard key={a._id} item={a} onDelete={deleteActivity} canDelete={canDelete(a)} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
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

      {/* ---------- Note / activity modal ---------- */}
      {modalType && (
        <ActivityModal
          type={modalType}
          leadId={lead._id}
          authHeader={authHeader}
          onClose={() => setModalType(null)}
          onSaved={() => { setModalType(null); fetchActivities(); if (modalType === 'note') setTab('notes'); else setTab('open'); }}
        />
      )}

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} />
    </div>
  );
}

// ============================================
// SMALL PRESENTATIONAL PIECES
// ============================================
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