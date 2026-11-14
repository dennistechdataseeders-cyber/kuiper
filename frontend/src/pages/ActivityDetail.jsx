// frontend/src/pages/ActivityDetail.jsx
// Detail page for a Task, Meeting or Call.  Route: /sales/activity/:id
// Same layout as the Lead detail page: edit any field in place, a save bar
// floats at the bottom while there are changes (Ctrl/Cmd+S saves), and the
// related lead + its other activities stay in view on the right.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ListTodo, Video, PhoneOutgoing, PhoneIncoming, CheckCircle2, Trash2, Loader2,
  Building2, Mail, Phone, Globe, UserCircle2, Clock, AlertTriangle, ExternalLink, StickyNote,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { useCustomFields } from '../components/CustomFieldsSection';
import {
  Cell, cellInput, InlineSelect, InlineCustom, FieldGroup, useUnsavedChanges, FloatingSaveBar,
} from '../components/InlineEdit';

const EDIT_ROLES = ['Super Admin', 'Admin', 'Sales', 'Sales Manager'];
const MANAGER_ROLES = ['Sales Manager', 'Admin', 'Super Admin'];
const role = () => localStorage.getItem('role') || '';
const myId = () => localStorage.getItem('userId') || '';

const META = {
  task:    { label: 'Task',    module: 'Tasks',    list: '/sales/activities/tasks',    back: 'Tasks',    icon: ListTodo },
  meeting: { label: 'Meeting', module: 'Meetings', list: '/sales/activities/meetings', back: 'Meetings', icon: Video },
  call:    { label: 'Call',    module: 'Calls',    list: '/sales/activities/calls',    back: 'Calls',    icon: PhoneOutgoing },
};
const MEETING_STATUSES = ['Open', 'Completed', 'Cancelled'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const CALL_DIRECTIONS = ['Outbound', 'Inbound'];
const CALL_OUTCOMES = ['Connected', 'Voicemail', 'No Answer', 'Busy', 'Wrong Number'];
const CLOSED = ['Completed', 'Cancelled'];

// Customize Modules type → InlineCustom kind
const CF_KIND = {
  'Single Line': 'text', 'Multi-Line': 'textarea', Email: 'email', Phone: 'phone', 'Pick List': 'select',
  Date: 'date', 'Date/Time': 'date', Number: 'number', Decimal: 'number', Currency: 'number',
  Percent: 'number', 'Long Integer': 'number', Checkbox: 'checkbox', URL: 'text',
};

const pad = (n) => String(n).padStart(2, '0');
const toLocalDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const toLocalDate = (d) => (toLocalDateTime(d) || '').slice(0, 10);
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const statusCls = (s) => {
  switch (s) {
    case 'Completed':         return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    case 'Cancelled':         return 'bg-red-50 border-red-100 text-red-700';
    case 'In Progress':       return 'bg-blue-50 border-blue-100 text-blue-700';
    case 'Waiting for input': return 'bg-amber-50 border-amber-100 text-amber-700';
    case 'Deferred':          return 'bg-purple-50 border-purple-100 text-purple-700';
    default:                  return 'bg-slate-100 border-slate-200 text-slate-600';
  }
};
const priorityCls = (p) =>
  p === 'High' ? 'bg-red-50 border-red-100 text-red-700'
  : p === 'Low' ? 'bg-slate-100 border-slate-200 text-slate-600'
  : 'bg-blue-50 border-blue-100 text-blue-700';

const leadNameOf = (lead) => {
  const p = lead?.contacts?.find((c) => c.isPrimary) || lead?.contacts?.[0];
  const n = p ? `${p.firstName || ''} ${p.lastName === '-' ? '' : p.lastName || ''}`.trim() : '';
  return n || lead?.companyName || '';
};

function toForm(a) {
  return {
    title: a.title || '',
    content: a.content || '',
    dueAt: toLocalDate(a.dueAt),
    scheduledAt: toLocalDateTime(a.scheduledAt),
    durationMinutes: a.durationMinutes ?? '',
    location: a.location || '',
    attendees: Array.isArray(a.attendees) ? a.attendees.join(', ') : '',
    callDirection: a.callDirection || '',
    callOutcome: a.callOutcome || '',
    status: a.status || (a.type === 'task' ? 'Not Started' : 'Open'),
    priority: a.priority || 'Medium',
    assignedTo: a.assignedTo?._id || a.assignedTo || '',
    custom: Object.fromEntries((a.customFields || []).map((f) => [f.fieldKey, f.value ?? ''])),
  };
}

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const canEdit = EDIT_ROLES.includes(role());
  const isManager = MANAGER_ROLES.includes(role());

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [related, setRelated] = useState([]);

  const type = item?.type || 'task';
  const meta = META[type] || META.task;
  const customDefs = useCustomFields(item ? meta.module : null);

  // ---------- load ----------
  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/lead-activities/${id}`, authHeader);
      const a = res.data?.data;
      setItem(a);
      const f = toForm(a);
      setForm(f);
      setBaseline(f);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, authHeader]);

  useEffect(() => { load(); }, [load]);

  // task stages (task Status options)
  useEffect(() => {
    if (type !== 'task') return;
    axios.get(`${API_BASE_URL}/api/task-stages`, authHeader)
      .then((r) => setStages((r.data?.data || []).map((s) => s.name)))
      .catch(() => setStages(['Not Started', 'Deferred', 'In Progress', 'Completed', 'Waiting for input']));
  }, [type, authHeader]);

  // reps a manager can hand a task to
  useEffect(() => {
    if (type !== 'task' || !isManager) return;
    Promise.all(['Sales', 'Sales Manager'].map((r) =>
      axios.get(`${API_BASE_URL}/api/admin/users?role=${encodeURIComponent(r)}`, authHeader)
        .then((x) => (Array.isArray(x.data) ? x.data : x.data?.data || [])).catch(() => [])
    )).then(([a, b]) => {
      const seen = new Set();
      setSalesUsers([...a, ...b].filter((u) => u?._id && !seen.has(u._id) && seen.add(u._id)));
    });
  }, [type, isManager, authHeader]);

  // other activities on the same lead
  const leadId = item?.leadId?._id || item?.leadId;
  const loadRelated = useCallback(async () => {
    if (!leadId) { setRelated([]); return; }
    try {
      const r = await axios.get(`${API_BASE_URL}/api/lead-activities?leadId=${leadId}`, authHeader);
      setRelated((r.data?.data || []).filter((x) => String(x._id) !== String(id)));
    } catch { setRelated([]); }
  }, [leadId, id, authHeader]);
  useEffect(() => { loadRelated(); }, [loadRelated]);

  // ---------- editing ----------
  const saveRef = useRef(null);
  const unsaved = useUnsavedChanges(form, baseline, () => saveRef.current?.());
  const { dirty, isChanged } = unsaved;
  const readOnly = !canEdit || saving;

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setCustom = (k, v) => setForm((p) => ({ ...p, custom: { ...p.custom, [k]: v } }));
  const discard = () => setForm(baseline);

  const cfDefs = useMemo(() => customDefs.map((f) => ({
    fieldKey: f.fieldKey, label: f.label, kind: CF_KIND[f.type] || 'text',
    options: (f.options || []).map((o) => (typeof o === 'string' ? o : o.label)).filter(Boolean),
    required: !!f.isRequired, placeholder: f.placeholder || '', type: f.type,
  })), [customDefs]);

  const patch = async (payload, msg) => {
    const res = await axios.patch(`${API_BASE_URL}/api/lead-activities/${id}`, payload, authHeader);
    // PATCH returns the lighter populate → keep the richer lead we already have
    const updated = { ...res.data.data, leadId: item.leadId };
    setItem(updated);
    const f = toForm(updated);
    setForm(f);
    setBaseline(f);
    if (msg) toast.success(msg);
    return updated;
  };

  const save = async () => {
    if (saving || !dirty || !form) return;
    if (!form.title.trim()) return toast.error(`${type === 'meeting' ? 'Title' : 'Subject'} is required`);
    if ((type === 'meeting' || type === 'call') && !form.scheduledAt) return toast.error('Date & time is required');
    if (form.durationMinutes !== '' && Number(form.durationMinutes) < 0) return toast.error('Duration cannot be negative');
    const missing = cfDefs.find((d) => d.required && d.kind !== 'checkbox' && (form.custom[d.fieldKey] === undefined || form.custom[d.fieldKey] === ''));
    if (missing) return toast.error(`${missing.label} is required`);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      status: form.status,
      priority: form.priority,
    };
    if (type === 'task') {
      payload.dueAt = form.dueAt ? new Date(`${form.dueAt}T00:00:00`).toISOString() : null;
      if (isManager && isChanged('assignedTo')) payload.assignedTo = form.assignedTo || null;
    } else {
      payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      payload.durationMinutes = form.durationMinutes === '' ? null : Number(form.durationMinutes);
      payload.location = form.location.trim();
    }
    if (type === 'meeting') {
      payload.attendees = form.attendees.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (type === 'call') {
      payload.callDirection = form.callDirection;
      payload.callOutcome = form.callOutcome;
    }
    if (cfDefs.length) {
      payload.customFields = cfDefs
        .map((d) => {
          let v = form.custom[d.fieldKey];
          if (d.kind === 'checkbox') v = !!v;
          else if (v === undefined || v === '') return null;
          else if (d.kind === 'number') v = Number(v);
          return { fieldKey: d.fieldKey, label: d.label, type: d.type, value: v };
        })
        .filter(Boolean);
    }

    try {
      setSaving(true);
      await patch(payload, `${meta.label} updated`);
      loadRelated();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to update ${meta.label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => { saveRef.current = save; });

  const markCompleted = async () => {
    if (dirty && !window.confirm('Mark as completed? Your other unsaved changes will be discarded.')) return;
    try { await patch({ status: 'Completed' }, 'Marked as completed'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to update status'); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete this ${meta.label.toLowerCase()}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/lead-activities/${id}`, authHeader);
      toast.success(`${meta.label} deleted`);
      navigate(meta.list);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const goBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate(meta.list);
  };

  // ---------- render ----------
  const shell = `min-h-screen bg-slate-50 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`;
  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }
  if (!item || !form) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center gap-3`}>
        <p className="text-sm font-semibold text-slate-500">This activity could not be found.</p>
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const Icon = type === 'call' && item.callDirection === 'Inbound' ? PhoneIncoming : meta.icon;
  const lead = item.leadId && typeof item.leadId === 'object' ? item.leadId : null;
  const leadName = leadNameOf(lead);
  const primary = lead?.contacts?.find((c) => c.isPrimary) || lead?.contacts?.[0];
  const closed = CLOSED.includes(item.status);
  const when = type === 'task' ? item.dueAt : item.scheduledAt;
  const overdue = type === 'task' && item.dueAt && !closed && new Date(item.dueAt).setHours(23, 59, 59, 999) < Date.now();
  const canDelete = String(item.createdBy?._id || item.createdBy) === myId() || ['Admin', 'Super Admin'].includes(role());
  const statusOptions = type === 'task' ? (stages.length ? stages : [form.status]) : MEETING_STATUSES;

  const text = (key, props = {}) => (
    <input
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      disabled={readOnly}
      className={cellInput(isChanged(key), !canEdit)}
      {...props}
    />
  );
  const select = (key, options) => (
    <InlineSelect value={form[key]} options={options} onChange={(v) => set(key, v)} disabled={readOnly} changed={isChanged(key)} />
  );

  const ownerName = item.assignedTo?.name || item.createdBy?.name || '—';
  const quick = [
    when && { icon: Clock, text: type === 'task' ? `Due ${fmtDate(when)}` : fmtDateTime(when), warn: overdue },
    { icon: UserCircle2, text: item.assignedTo ? `Assigned to ${item.assignedTo.name}` : `Owner ${ownerName}` },
    lead && { icon: Building2, text: lead.companyName },
  ].filter(Boolean);

  return (
    <div className={shell}>
      {/* ---------- Header ---------- */}
      <div className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="px-6 pt-3 pb-2.5 flex items-center gap-4">
          <button onClick={goBack} title={`Back to ${meta.back}`} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-black text-slate-900 truncate">{item.title || `Untitled ${meta.label.toLowerCase()}`}</h1>
              <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${statusCls(item.status)}`}>{item.status}</span>
              <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${priorityCls(item.priority)}`}>{item.priority || 'Medium'}</span>
              {overdue && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-100 text-red-700 text-[10px] font-black uppercase tracking-wide">
                  <AlertTriangle size={10} /> Overdue
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 truncate">
              {meta.label}{leadName ? <> · {leadName}</> : null}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !closed && (
              <button onClick={markCompleted} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm transition">
                <CheckCircle2 size={14} /> Mark Completed
              </button>
            )}
            {canDelete && (
              <button onClick={remove} title="Delete" className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="px-6 pb-2.5 pl-[112px] flex items-center gap-x-4 gap-y-1 flex-wrap">
          {quick.map(({ icon: QIcon, text: t, warn }) => (
            <span key={t} className={`flex items-center gap-1.5 text-xs font-semibold ${warn ? 'text-red-600' : 'text-slate-600'}`}>
              <QIcon size={13} className={warn ? 'text-red-500' : 'text-slate-400'} /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="px-6 pt-[112px] pb-24 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800">{meta.label} Details</h2>
              <span className="text-[11px] font-semibold text-slate-400">{canEdit ? 'Click any field to edit' : 'Read only'}</span>
            </div>

            <FieldGroup
              id={`${type}.info`}
              title={`${meta.label} Information`}
              count={unsaved.changedIn('title', 'dueAt', 'scheduledAt', 'durationMinutes', 'location', 'attendees', 'callDirection', 'callOutcome', 'status', 'priority', 'assignedTo', 'custom.')}
            >
              <Cell label={type === 'meeting' ? 'Title' : 'Subject'} required changed={isChanged('title')} wide>
                {text('title')}
              </Cell>

              {type === 'task' && (
                <Cell label="Due Date" changed={isChanged('dueAt')}>{text('dueAt', { type: 'date' })}</Cell>
              )}
              {type !== 'task' && (
                <>
                  <Cell label={type === 'meeting' ? 'From' : 'Call Time'} required changed={isChanged('scheduledAt')}>
                    {text('scheduledAt', { type: 'datetime-local' })}
                  </Cell>
                  <Cell label="Duration (min)" changed={isChanged('durationMinutes')}>
                    {text('durationMinutes', { type: 'number', min: 0 })}
                  </Cell>
                </>
              )}

              <Cell label="Status" changed={isChanged('status')}>{select('status', statusOptions)}</Cell>
              <Cell label="Priority" changed={isChanged('priority')}>{select('priority', PRIORITIES)}</Cell>

              {type === 'call' && (
                <>
                  <Cell label="Call Type" changed={isChanged('callDirection')}>{select('callDirection', CALL_DIRECTIONS)}</Cell>
                  <Cell label="Call Result" changed={isChanged('callOutcome')}>{select('callOutcome', CALL_OUTCOMES)}</Cell>
                </>
              )}
              {type !== 'task' && (
                <Cell label="Location" changed={isChanged('location')}>{text('location', { placeholder: 'Office, Zoom link, ...' })}</Cell>
              )}
              {type === 'meeting' && (
                <Cell label="Participants" changed={isChanged('attendees')} wide>
                  {text('attendees', { placeholder: 'Comma separated, e.g. Julian, Tanvi' })}
                </Cell>
              )}

              {type === 'task' && (
                <Cell label={isManager ? 'Assigned To' : 'Owner'} changed={isChanged('assignedTo')}>
                  {isManager ? (
                    <select
                      value={form.assignedTo}
                      onChange={(e) => set('assignedTo', e.target.value)}
                      disabled={readOnly}
                      className={cellInput(isChanged('assignedTo'), !canEdit)}
                    >
                      <option value="">{item.createdBy?.name ? `${item.createdBy.name} (creator)` : 'Not assigned'}</option>
                      {item.assignedTo?._id && !salesUsers.some((u) => u._id === item.assignedTo._id) && (
                        <option value={item.assignedTo._id}>{item.assignedTo.name}</option>
                      )}
                      {salesUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <input value={ownerName} readOnly disabled className={cellInput(false, true)} />
                  )}
                </Cell>
              )}

              {cfDefs.map((d) => (
                <Cell key={d.fieldKey} label={d.label} required={d.required} changed={isChanged(`custom.${d.fieldKey}`)} wide={d.kind === 'textarea'}>
                  <InlineCustom
                    def={d}
                    value={form.custom[d.fieldKey]}
                    onChange={(v) => setCustom(d.fieldKey, v)}
                    disabled={readOnly}
                    changed={isChanged(`custom.${d.fieldKey}`)}
                  />
                </Cell>
              ))}
            </FieldGroup>

            <FieldGroup id={`${type}.description`} title="Description" count={unsaved.changedIn('content')}>
              <Cell label="Description" wide changed={isChanged('content')}>
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => set('content', e.target.value)}
                  disabled={readOnly}
                  placeholder="Agenda, notes, outcome..."
                  className={`${cellInput(isChanged('content'), !canEdit)} h-auto py-2 resize-y`}
                />
              </Cell>
            </FieldGroup>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 px-1">
            Created by {item.createdBy?.name || 'Unknown'} · {fmtDateTime(item.createdAt)}
            {item.assignedBy?.name ? ` · Assigned by ${item.assignedBy.name} on ${fmtDateTime(item.assignedAt)}` : ''}
            {' · '}Last modified {fmtDateTime(item.updatedAt)}
          </p>
        </div>

        {/* ---------- Right: related lead + its other activities ---------- */}
        <div className="xl:col-span-5 xl:sticky xl:top-[112px] space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800">Related Lead</h2>
              {lead && (
                <button
                  onClick={() => navigate(`/sales/leads?open=${lead._id}`)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  Open lead <ExternalLink size={11} />
                </button>
              )}
            </div>
            {lead ? (
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-black shrink-0">
                  {(leadName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{leadName}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate"><Building2 size={12} className="text-slate-400" /> {lead.companyName}</p>
                  {primary?.email && (
                    <a href={`mailto:${primary.email}`} className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1.5 truncate">
                      <Mail size={12} className="text-slate-400" /> {primary.email}
                    </a>
                  )}
                  {(primary?.phone || primary?.mobile) && (
                    <a href={`tel:${primary.phone || primary.mobile}`} className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400" /> {primary.phone || primary.mobile}
                    </a>
                  )}
                  {lead.website && (
                    <a href={/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1.5 truncate">
                      <Globe size={12} className="text-slate-400" /> {lead.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {lead.leadStatus && <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black uppercase">{lead.leadStatus}</span>}
                    {lead.leadOwner?.name && <span className="text-[11px] text-slate-500">Owner: {lead.leadOwner.name}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="px-5 py-4 text-xs font-semibold text-slate-400">Not linked to a lead.</p>
            )}
          </div>

          {lead && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col xl:max-h-[calc(100vh-340px)]">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800">Other activity on this lead</h2>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black">{related.length}</span>
              </div>
              <div className="p-3 overflow-y-auto space-y-2">
                {related.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-400 text-center py-4">Nothing else yet.</p>
                ) : related.map((r) => {
                  const RIcon = r.type === 'note' ? StickyNote : r.type === 'meeting' ? Video : r.type === 'call' ? (r.callDirection === 'Inbound' ? PhoneIncoming : PhoneOutgoing) : ListTodo;
                  const clickable = r.type !== 'note';
                  const rWhen = r.type === 'task' ? r.dueAt : r.type === 'note' ? r.createdAt : r.scheduledAt;
                  return (
                    <div
                      key={r._id}
                      onClick={clickable ? () => {
                        if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
                        navigate(`/sales/activity/${r._id}`);
                      } : undefined}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${r.type === 'note' ? 'border-amber-100 bg-amber-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer'} transition`}
                    >
                      <div className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0"><RIcon size={13} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{r.type === 'note' ? r.content : r.title || 'Untitled'}</p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          {r.type === 'note' ? 'Note' : META[r.type]?.label} · {r.type === 'task' ? `Due ${fmtDate(rWhen)}` : fmtDateTime(rWhen)}
                          {r.type !== 'note' && r.status ? ` · ${r.status}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <FloatingSaveBar
        show={canEdit && dirty}
        count={unsaved.count}
        saving={saving}
        onSave={save}
        onDiscard={discard}
        isCollapsed={isCollapsed}
      />
    </div>
  );
}
