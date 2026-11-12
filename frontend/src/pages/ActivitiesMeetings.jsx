// frontend/src/pages/ActivitiesMeetings.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Calendar,
  MapPin,
  Users,
  Loader2,
  X,
  Save,
  Pencil,
  Clock,
  User,
  Video,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import AlphabetFilter from '../components/AlphabetFilter';
import Pagination from '../components/Pagination';
import useAlphaPagination, { getActivityLeadName } from '../utils/useAlphaPagination';
import useDashboardFilter, { filterActivities } from '../utils/useDashboardFilter';
import DashboardFilterBanner from '../components/DashboardFilterBanner';

// ============================================
// HELPERS
// ============================================
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed';

const CLOSED_STATUSES = ['Completed', 'Cancelled'];
const isClosed = (status) => CLOSED_STATUSES.includes(status);

const statusBadgeCls = (status) => {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'Cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

const priorityBadgeCls = (priority) => {
  switch (priority) {
    case 'High':
      return 'bg-red-100 text-red-700';
    case 'Low':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-amber-100 text-amber-700';
  }
};

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// datetime-local input wants "YYYY-MM-DDTHH:mm" in LOCAL time
const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

const EMPTY_FORM = {
  title: '',
  content: '',
  scheduledAt: '',
  durationMinutes: '',
  location: '',
  attendees: '',
  status: 'Open',
  priority: 'Medium',
};

// ============================================
// SMALL PRESENTATIONAL PIECES
// ============================================
function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 block mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-32 flex-shrink-0">
        <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
          {icon}
          {label}
        </p>
      </div>
      <div className="flex-1 text-sm text-slate-700 break-words">{value}</div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
const ActivitiesMeetings = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');
  const currentRole = localStorage.getItem('role') || '';

  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const canEdit = ['Admin', 'Super Admin', 'Sales', 'Sales Manager', 'Project Manager'].includes(
    currentRole
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const dash = useDashboardFilter(); // ?rep=…&focus=today&team=1 (set by the Sales Command dashboard)
  const visibleItems = useMemo(() => filterActivities(items, dash), [items, dash]);
  const list = useAlphaPagination(visibleItems); // A–Z filter + pagination

  // ---------------- modal state ----------------
  const [detail, setDetail] = useState(null); // the meeting being viewed
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // ============================================
  // FETCH
  // ============================================
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/lead-activities?type=meeting&scope=${dash.team ? 'team' : 'mine'}`,
        authHeader
      );
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [authHeader, dash.team]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ============================================
  // OPEN / CLOSE
  // ============================================
  const openDetail = (meeting) => {
    setDetail(meeting);
    setEditing(false);
    setErrors({});
    setForm({
      title: meeting.title || '',
      content: meeting.content || '',
      scheduledAt: toLocalInputValue(meeting.scheduledAt),
      durationMinutes: meeting.durationMinutes ?? '',
      location: meeting.location || '',
      attendees: Array.isArray(meeting.attendees) ? meeting.attendees.join(', ') : '',
      status: meeting.status || 'Open',
      priority: meeting.priority || 'Medium',
    });
  };

  const closeDetail = () => {
    if (saving) return;
    setDetail(null);
    setEditing(false);
    setErrors({});
    setForm(EMPTY_FORM);
  };

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  // ============================================
  // VALIDATE + SAVE
  // ============================================
  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Meeting title is required';
    if (!form.scheduledAt) e.scheduledAt = 'Meeting date & time is required';
    if (form.durationMinutes !== '' && Number(form.durationMinutes) < 0) {
      e.durationMinutes = 'Duration cannot be negative';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (ev) => {
    ev.preventDefault();
    if (saving || !validate()) return;

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      durationMinutes:
        form.durationMinutes === '' ? null : Number(form.durationMinutes),
      location: form.location.trim(),
      attendees: form.attendees
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status: form.status,
      priority: form.priority,
    };

    try {
      setSaving(true);
      const res = await axios.patch(
        `${API_BASE_URL}/api/lead-activities/${detail._id}`,
        payload,
        authHeader
      );
      const updated = res.data.data;

      // update list + reopen in view mode
      setItems((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      setDetail(updated);
      setEditing(false);
      toast.success('Meeting updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // QUICK ACTIONS (mark completed / delete)
  // ============================================
  const markCompleted = async () => {
    if (!detail) return;
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/lead-activities/${detail._id}`,
        { status: 'Completed' },
        authHeader
      );
      const updated = res.data.data;
      setItems((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      setDetail(updated);
      toast.success('Meeting marked as completed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const deleteMeeting = async () => {
    if (!detail) return;
    if (!window.confirm('Delete this meeting?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/lead-activities/${detail._id}`, authHeader);
      setItems((prev) => prev.filter((m) => m._id !== detail._id));
      toast.success('Meeting deleted');
      closeDetail();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete meeting');
    }
  };

  // only show delete / quick-complete for the creator, admin, super admin
  const canDeleteDetail =
    detail &&
    (String(detail.createdBy?._id || detail.createdBy) === String(currentUserId) ||
      currentRole === 'Admin' ||
      currentRole === 'Super Admin');

  // ============================================
  // RENDER
  // ============================================
  return (
    <div
      className={`min-h-screen bg-white transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* sticky top bar */}
      <div
        className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm ${
          isCollapsed ? 'left-20' : 'left-64'
        }`}
      >
        <div className="pl-10 pr-6 py-4">
          <h1 className="text-3xl font-black text-slate-900">Meetings</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            Scheduled meetings with prospects
          </p>
        </div>
      </div>

      <div className="pl-10 pr-6 pt-[88px] pb-12">
        <DashboardFilterBanner filter={dash} label={dash.focus === 'today' ? 'Meetings today' : ''} className="mb-4" />
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-blue-600 animate-spin" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
            <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">{dash.active ? 'No meetings match this filter' : 'No meetings yet'}</p>
            <p className="text-xs text-slate-400 mt-1">
              Open a lead and use <b>Activity → Add meeting</b> to schedule one.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <AlphabetFilter value={list.letter} onChange={list.setLetter} />
              <div className="ml-auto text-xs font-bold text-slate-400">
                {list.totalItems} of {visibleItems.length} meetings
              </div>
            </div>

            {list.totalItems === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
                <p className="text-sm font-bold text-slate-500">
                  No meetings for leads starting with “{list.letter}”
                </p>
                <button
                  onClick={() => list.setLetter('All')}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {list.paged.map((item) => {
                  const leadName = getActivityLeadName(item);
                  const company = item.leadId?.companyName;
                  return (
                    <div
                      key={item._id}
                      onClick={() => openDetail(item)}
                      className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">
                              {item.title}
                            </span>
                            {item.status && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusBadgeCls(
                                  item.status
                                )}`}
                              >
                                {item.status}
                              </span>
                            )}
                            {item.priority && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${priorityBadgeCls(
                                  item.priority
                                )}`}
                              >
                                {item.priority}
                              </span>
                            )}
                          </div>
                          {item.content && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {item.content}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-semibold text-slate-400">
                            <span>
                              Lead: {leadName}
                              {company && company !== leadName ? ` · ${company}` : ''}
                            </span>
                            {item.scheduledAt && (
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(item.scheduledAt).toLocaleString()}
                              </span>
                            )}
                            {item.durationMinutes ? (
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {item.durationMinutes} min
                              </span>
                            ) : null}
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} /> Meeting URL
                              </span>
                            )}
                            {item.attendees?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users size={10} /> {item.attendees.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Pencil
                          size={14}
                          className="text-slate-300 group-hover:text-blue-500 transition flex-shrink-0 mt-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {list.totalItems > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
                <Pagination
                  page={list.page}
                  pageSize={list.pageSize}
                  totalItems={list.totalItems}
                  onPageChange={list.setPage}
                  onPageSizeChange={list.setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================
          DETAIL / EDIT MODAL
          ============================================ */}
      {detail && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Video size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-800 truncate">
                    {editing ? 'Edit Meeting' : detail.title}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Lead: {getActivityLeadName(detail)}
                    {detail.leadId?.companyName && ` · ${detail.leadId.companyName}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!editing && canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button
                  onClick={closeDetail}
                  disabled={saving}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ---------- VIEW MODE ---------- */}
            {!editing ? (
              <div className="px-6 py-5 space-y-4">
                <DetailRow
                  label="Status"
                  value={
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusBadgeCls(
                        detail.status
                      )}`}
                    >
                      {detail.status}
                    </span>
                  }
                />
                <DetailRow
                  label="Priority"
                  value={
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${priorityBadgeCls(
                        detail.priority
                      )}`}
                    >
                      {detail.priority}
                    </span>
                  }
                />
                <DetailRow
                  label="Scheduled For"
                  icon={<Calendar size={12} />}
                  value={fmtDateTime(detail.scheduledAt)}
                />
                <DetailRow
                  label="Duration"
                  icon={<Clock size={12} />}
                  value={detail.durationMinutes ? `${detail.durationMinutes} minutes` : '—'}
                />
                <DetailRow
                  label="Location/Meeting URL"
                  icon={<MapPin size={12} />}
                  value={detail.location || '—'}
                />
                <DetailRow
                  label="Attendees"
                  icon={<Users size={12} />}
                  value={
                    detail.attendees?.length ? detail.attendees.join(', ') : '—'
                  }
                />
                {detail.content && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                      {detail.content}
                    </p>
                  </div>
                )}
                <DetailRow
                  label="Created By"
                  icon={<User size={12} />}
                  value={detail.createdBy?.name || '—'}
                />
                <DetailRow
                  label="Created At"
                  value={new Date(detail.createdAt).toLocaleString()}
                />

                {/* quick actions */}
                {(canEdit || canDeleteDetail) && (
                  <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
                    {canEdit && !isClosed(detail.status) && (
                      <button
                        onClick={markCompleted}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={12} /> Mark Completed
                      </button>
                    )}
                    {canDeleteDetail && (
                      <button
                        onClick={deleteMeeting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ---------- EDIT MODE ---------- */
              <form onSubmit={save} className="px-6 py-5 space-y-4">
                <Field label="Title" required>
                  <input
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={inputCls}
                    disabled={saving}
                    autoFocus
                  />
                  {errors.title && (
                    <p className="text-xs text-red-500 font-semibold mt-1">{errors.title}</p>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date & Time" required>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => set('scheduledAt', e.target.value)}
                      className={inputCls}
                      disabled={saving}
                    />
                    {errors.scheduledAt && (
                      <p className="text-xs text-red-500 font-semibold mt-1">
                        {errors.scheduledAt}
                      </p>
                    )}
                  </Field>
                  <Field label="Duration (min)">
                    <input
                      type="number"
                      min="0"
                      value={form.durationMinutes}
                      onChange={(e) => set('durationMinutes', e.target.value)}
                      className={inputCls}
                      disabled={saving}
                    />
                    {errors.durationMinutes && (
                      <p className="text-xs text-red-500 font-semibold mt-1">
                        {errors.durationMinutes}
                      </p>
                    )}
                  </Field>
                </div>

                <Field label="Location / Link">
                  <input
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    className={inputCls}
                    disabled={saving}
                    placeholder="Office, Google Meet link..."
                  />
                </Field>

                <Field label="Attendees">
                  <input
                    value={form.attendees}
                    onChange={(e) => set('attendees', e.target.value)}
                    className={inputCls}
                    disabled={saving}
                    placeholder="Comma-separated emails or names"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => set('status', e.target.value)}
                      className={inputCls}
                      disabled={saving}
                    >
                      <option value="Open">Open</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(e) => set('priority', e.target.value)}
                      className={inputCls}
                      disabled={saving}
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    rows={3}
                    value={form.content}
                    onChange={(e) => set('content', e.target.value)}
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
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
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} /> Save changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesMeetings;