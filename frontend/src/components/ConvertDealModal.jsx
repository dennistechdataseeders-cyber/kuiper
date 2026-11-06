// frontend/src/components/ConvertDealModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Handshake } from 'lucide-react';
import API_BASE_URL from '../config';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from './CustomFieldsSection';

// ✅ DEAL_STAGES is no longer a hardcoded enum — it comes from
//    /api/deal-stages. Export remains for the Deals page to reuse.
export const CONTACT_ROLES = [
  'Developer/Evaluator',
  'Decision Maker',
  'Purchasing',
  'Executive Sponsor',
  'Engineering Lead',
  'Economic Decision Maker',
  'Product Management',
];

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100';
const errCls = 'border-red-400 focus:border-red-500 focus:ring-red-100';

const LOGGED_IN_USER_ID = localStorage.getItem('userId') || '';
const LOGGED_IN_USER_NAME = localStorage.getItem('userName') || '';

export default function ConvertDealModal({ lead, onClose, onConverted }) {
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const primary = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0] || null;
  const contactName =
    (primary && `${primary.firstName || ''} ${primary.lastName === '-' ? '' : primary.lastName || ''}`.trim()) || '—';

  // Old leads (created before Deals existed) already have an Account linked
  const legacyOrgId = lead.organizationId?._id || lead.organizationId || '';

  const [accountMode, setAccountMode] = useState(legacyOrgId ? 'existing' : 'new');
  const [accountId, setAccountId] = useState(legacyOrgId || '');
  const [accounts, setAccounts] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [stages, setStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  // Fields created in Customize Modules → Deals
  const customFields = useCustomFields('Deals');
  const [custom, setCustom] = useState({});

  const [form, setForm] = useState({
    amount: '',
    dealName: lead.companyName || '',
    closingDate: '',
    stage: '', // filled after stages load
    contactRole: '',
    ownerId: lead.leadOwner?._id || LOGGED_IN_USER_ID,
  });
  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  // owners + (for "choose existing") accounts + stage options
  useEffect(() => {
    (async () => {
      try {
        const [u, o, s] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/admin/users?role=Sales`, authHeader),
          axios.get(`${API_BASE_URL}/api/orgs`, authHeader),
          axios.get(`${API_BASE_URL}/api/deal-stages`, authHeader),
        ]);
        setSalesUsers(Array.isArray(u.data) ? u.data : u.data?.data || []);
        const orgs = Array.isArray(o.data) ? o.data : o.data?.data || [];
        setAccounts(orgs.filter((x) => (x.companyName || '').toLowerCase() !== 'feasibility'));

        const stageList = s.data?.data || [];
        setStages(stageList);

        // Default to the first non-locked stage
        const firstOpen = stageList.find((st) => !st.locked);
        if (firstOpen) setForm((p) => ({ ...p, stage: firstOpen.name }));
      } catch (e) {
        console.error(e);
      } finally {
        setStagesLoading(false);
      }
    })();
  }, [authHeader]);

  // make sure the selected owner is always present in the dropdown
  const ownerOptions = useMemo(() => {
    const list = [...salesUsers];
    if (form.ownerId && !list.some((u) => u._id === form.ownerId)) {
      list.unshift({ _id: form.ownerId, name: lead.leadOwner?.name || LOGGED_IN_USER_NAME || 'Me' });
    }
    return list;
  }, [salesUsers, form.ownerId, lead.leadOwner]);

  const validate = () => {
    const e = {};
    if (!form.closingDate) e.closingDate = 'Closing Date cannot be empty.';
    if (!form.dealName.trim()) e.dealName = 'Deal Name is required.';
    if (accountMode === 'existing' && !accountId) e.accountId = 'Please choose an Account.';
    if (form.amount !== '' && Number(form.amount) < 0) e.amount = 'Amount cannot be negative.';
    if (!form.stage) e.stage = 'Please select a stage.';
    const cfErr = validateCustomFields(customFields, custom);
    if (cfErr) e.custom = cfErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (saving || !validate()) return;
    try {
      setSaving(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/deals/convert/${lead._id}`,
        {
          ...form,
          accountMode,
          accountId: accountMode === 'existing' ? accountId : undefined,
          customFields: buildCustomFieldsPayload(customFields, custom)
        },
        authHeader
      );
      toast.success('Lead converted to Deal');
      onConverted?.(res.data?.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Handshake size={16} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Convert Lead</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          {/* ---------- ACCOUNT ---------- */}
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="radio" checked={accountMode === 'new'} onChange={() => setAccountMode('new')} disabled={saving} />
              Create New Account <span className="font-black text-slate-900">{lead.companyName}</span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="radio" checked={accountMode === 'existing'} onChange={() => setAccountMode('existing')} disabled={saving} />
              Choose Existing Account
            </label>
            {accountMode === 'existing' && (
              <>
                <select
                  value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); setErrors((p) => ({ ...p, accountId: undefined })); }}
                  className={`${inputCls} ${errors.accountId ? errCls : ''}`}
                  disabled={saving}
                >
                  <option value="">-None-</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.companyName}</option>)}
                </select>
                {errors.accountId && <p className="text-xs text-red-500 font-semibold">{errors.accountId}</p>}
              </>
            )}
          </div>

          {/* ---------- CONTACT ---------- */}
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">
              Create New Contact <span className="font-black text-slate-900">{contactName}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Added to the Account's contacts (skipped if the same person already exists there).
            </p>
          </div>

          {/* ---------- DEAL ---------- */}
          <div>
            <p className="text-sm font-black text-slate-800 mb-3">Create a new Deal for this Account</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" error={errors.amount}>
                <input type="number" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)}
                  className={`${inputCls} ${errors.amount ? errCls : ''}`} disabled={saving} />
              </Field>
              <Field label="Deal Name" required error={errors.dealName}>
                <input value={form.dealName} onChange={(e) => set('dealName', e.target.value)}
                  className={`${inputCls} ${errors.dealName ? errCls : ''}`} disabled={saving} />
              </Field>
              <Field label="Closing Date" required error={errors.closingDate}>
                <input type="date" value={form.closingDate} onChange={(e) => set('closingDate', e.target.value)}
                  className={`${inputCls} ${errors.closingDate ? errCls : ''}`} disabled={saving} />
              </Field>

              {/* ✅ Stage dropdown now driven by /api/deal-stages */}
              <Field label="Stage" required error={errors.stage}>
                <select
                  value={form.stage}
                  onChange={(e) => set('stage', e.target.value)}
                  className={`${inputCls} ${errors.stage ? errCls : ''}`}
                  disabled={saving || stagesLoading || stages.length === 0}
                >
                  {stagesLoading ? (
                    <option value="">Loading stages...</option>
                  ) : stages.length === 0 ? (
                    <option value="">No stages available</option>
                  ) : (
                    stages.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                        {s.locked ? ' 🔒' : ''}
                      </option>
                    ))
                  )}
                </select>
              </Field>

              <Field label="Contact Role">
                <select value={form.contactRole} onChange={(e) => set('contactRole', e.target.value)} className={inputCls} disabled={saving}>
                  <option value="">-None-</option>
                  {CONTACT_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* ---------- CUSTOM FIELDS (Customize Modules → Deals) ---------- */}
          <CustomFieldsSection
            fields={customFields}
            values={custom}
            onChange={(k, v) => {
              setCustom((prev) => ({ ...prev, [k]: v }));
              if (errors.custom) setErrors((prev) => ({ ...prev, custom: undefined }));
            }}
            disabled={saving}
          />
          {errors.custom && <p className="text-xs text-red-500 font-semibold -mt-3">{errors.custom}</p>}

          {/* ---------- OWNER ---------- */}
          <Field label="Owner of the New Records">
            <select value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)} className={inputCls} disabled={saving}>
              {ownerOptions.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || stagesLoading || stages.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-70 shadow-lg shadow-emerald-200">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Converting...</> : 'Convert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 block mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 font-semibold mt-1">{error}</p>}
    </div>
  );
}
