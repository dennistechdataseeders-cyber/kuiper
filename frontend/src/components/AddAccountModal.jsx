// frontend/src/components/AddAccountModal.jsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Building2 } from 'lucide-react';
import API_BASE_URL from '../config';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from './CustomFieldsSection';

const EMPTY = {
  companyName: '', website: '', phone: '', industry: '',
  firstName: '', lastName: '', email: '', contactPhone: '', title: ''
};

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500';
const labelCls = 'text-xs font-bold text-slate-600 block mb-1';

export default function AddAccountModal({ open, onClose, onSaved }) {
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  // Fields created in Customize Modules → Accounts
  const customFields = useCustomFields('Accounts', open);
  const [custom, setCustom] = useState({});

  if (!open) return null;

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setCustomVal = (k, v) => setCustom((prev) => ({ ...prev, [k]: v }));
  const close = () => { setForm(EMPTY); setCustom({}); onClose(); };

  const save = async () => {
    if (!form.companyName.trim()) return toast.error('Company name is required');
    const cfErr = validateCustomFields(customFields, custom);
    if (cfErr) return toast.error(cfErr);

    const hasContact = form.firstName.trim() || form.lastName.trim();
    if (hasContact && !form.firstName.trim()) return toast.error('Contact first name is required');

    setSaving(true);
    try {
      const pointsOfContact = hasContact
        ? [{
            pocName: [form.firstName, form.lastName].map(v => v.trim()).filter(Boolean).join(' '),
            pocEmail: form.email.trim() || undefined,
            pocPhone: form.contactPhone.trim() || undefined,
            title: form.title.trim() || undefined,
            isPrimary: true
          }]
        : [];

      const res = await axios.post(`${API_BASE_URL}/api/orgs`, {
        companyName: form.companyName.trim(),
        website: form.website.trim() || undefined,
        phone: form.phone.trim() || undefined,
        industry: form.industry || undefined,
        pointsOfContact,
        customFields: buildCustomFieldsPayload(customFields, custom)
      }, authHeader);

      toast.success('Account created');
      onSaved?.(res.data);
      close();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            <h2 className="text-lg font-black text-slate-800">Add Account</h2>
          </div>
          <button onClick={close} className="p-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input name="companyName" value={form.companyName} onChange={set} className={inputCls} placeholder="e.g. Acme Corp" autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Website</label>
              <input name="website" value={form.website} onChange={set} className={inputCls} placeholder="acme.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input name="phone" value={form.phone} onChange={set} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Industry</label>
              <select name="industry" value={form.industry} onChange={set} className={inputCls}>
                <option value="">Select Industry</option>
                <option value="ECOM">E-Commerce</option>
                <option value="IT">IT / Software</option>
                <option value="FOOD">Food &amp; Beverage</option>
                <option value="FNC">Finance</option>
              </select>
            </div>
          </div>

          <CustomFieldsSection
            fields={customFields}
            values={custom}
            onChange={setCustomVal}
            disabled={saving}
          />

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Primary contact (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name</label>
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
                <input name="contactPhone" value={form.contactPhone} onChange={set} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Job Title</label>
                <input name="title" value={form.title} onChange={set} className={inputCls} placeholder="e.g. CEO, Manager" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={close} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-70 transition">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
