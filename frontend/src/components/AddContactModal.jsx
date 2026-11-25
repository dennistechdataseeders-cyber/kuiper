// frontend/src/components/AddContactModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, UserPlus } from 'lucide-react';
import API_BASE_URL from '../config';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from './CustomFieldsSection';

const NEW_ACCOUNT = '__new__';
const EMPTY = { accountId: '', newCompany: '', firstName: '', lastName: '', email: '', phone: '', title: '', isPrimary: false };

const inputCls = 'input';
const labelCls = 'label block mb-1.5';

/**
 * accounts:         list of organizations (for the dropdown)
 * defaultAccountId: pre-selects an account (e.g. when Contacts page is filtered by account)
 */
export default function AddContactModal({ open, onClose, accounts = [], defaultAccountId = '', onSaved }) {
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  // Fields created in Customize Modules → Contacts
  const customFields = useCustomFields('Contacts', open);
  const [custom, setCustom] = useState({});

  // Re-apply the default account each time the modal opens
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, accountId: defaultAccountId || '' });
      setCustom({});
    }
  }, [open, defaultAccountId]);

  if (!open) return null;

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const creatingNew = form.accountId === NEW_ACCOUNT;

  const save = async () => {
    if (!form.accountId) return toast.error('Select an account');
    if (creatingNew && !form.newCompany.trim()) return toast.error('Company name is required');
    if (!form.firstName.trim()) return toast.error('First name is required');
    const cfErr = validateCustomFields(customFields, custom);
    if (cfErr) return toast.error(cfErr);

    const poc = {
      pocName: [form.firstName, form.lastName].map(v => v.trim()).filter(Boolean).join(' '),
      pocEmail: form.email.trim() || undefined,
      pocPhone: form.phone.trim() || undefined,
      title: form.title.trim() || undefined,
      isPrimary: form.isPrimary,
      customFields: buildCustomFieldsPayload(customFields, custom)
    };

    setSaving(true);
    try {
      if (creatingNew) {
        // New account + this contact in one request (contact becomes primary)
        await axios.post(`${API_BASE_URL}/api/orgs`, {
          companyName: form.newCompany.trim(),
          pointsOfContact: [{ ...poc, isPrimary: true }]
        }, authHeader);
      } else {
        await axios.post(`${API_BASE_URL}/api/orgs/${form.accountId}/add-poc`, poc, authHeader);
      }
      toast.success('Contact added');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-600" />
            <h2 className="section-title">Add Contact</h2>
          </div>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          <div>
            <label className={labelCls}>Account *</label>
            <select name="accountId" value={form.accountId} onChange={set} className={inputCls}>
              <option value="">Select account</option>
              <option value={NEW_ACCOUNT}>+ Create new account…</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.companyName}</option>)}
            </select>
          </div>

          {creatingNew && (
            <div>
              <label className={labelCls}>New Company Name *</label>
              <input name="newCompany" value={form.newCompany} onChange={set} className={inputCls} placeholder="e.g. Acme Corp" autoFocus />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={labelCls}>First Name *</label>
              <input name="firstName" value={form.firstName} onChange={set} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input name="lastName" value={form.lastName} onChange={set} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" name="email" value={form.email} onChange={set} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input name="phone" value={form.phone} onChange={set} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Job Title</label>
              <input name="title" value={form.title} onChange={set} className={inputCls} placeholder="e.g. CEO, Manager" />
            </div>
          </div>

          <CustomFieldsSection
            fields={customFields}
            values={custom}
            onChange={(k, v) => setCustom((prev) => ({ ...prev, [k]: v }))}
            disabled={saving}
          />

          {!creatingNew && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              Make this the primary contact
            </label>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-md text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
