// frontend/src/pages/DealDetail.jsx
// Sales → Deals → click a card (Kanban) or a row (List).  Route: /sales/deals/:id
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Handshake, Building2, User } from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from '../components/CustomFieldsSection';
import useRecordTags from '../utils/useRecordTags';
import { TagDialogs, useTagDialogs } from '../components/RecordTags';
import {
  DetailShell, DetailSection, FieldGrid, DetailLoading,
  useSalesUsers, canEditSales, authHeader, apiError, customValuesOf, customFieldDefs, fmtDateTime, toInputDate,
} from '../components/RecordDetailKit';

// same list as backend/models/Deal.js CONTACT_ROLES
const CONTACT_ROLES = [
  'Developer/Evaluator', 'Decision Maker', 'Purchasing',
  'Executive Sponsor', 'Engineering Lead', 'Economic Decision Maker',
  'Product Management',
];
const CLOSED = ['Closed Won', 'Closed Lost', 'Closed Lost to Competition'];
const fmtAmount = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDraft = (d) => ({
  dealName: d.dealName || '',
  owner: d.owner?._id || d.owner || '',
  amount: d.amount ?? '',
  closingDate: toInputDate(d.closingDate),
  stage: d.stage || '',
  contactRole: d.contactRole || '',
  ...Object.fromEntries(Object.entries(customValuesOf(d.customFields)).map(([k, v]) => [`cf:${k}`, v])),
});

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const canEdit = canEditSales();
  const users = useSalesUsers();
  const customDefs = useCustomFields('Deals');
  const tagsApi = useRecordTags('Deals');
  const tagDialogs = useTagDialogs();

  const [deal, setDeal] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/deals/${id}`, authHeader()),
        axios.get(`${API_BASE_URL}/api/deal-stages`, authHeader()).catch(() => ({ data: { data: [] } })),
      ]);
      setDeal(d.data?.data);
      setStages(s.data?.data || []);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load deal'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const ownerOptions = useMemo(() => {
    const list = users.map((u) => ({ value: u._id, label: u.name }));
    const cur = deal?.owner;
    if (cur?._id && !list.some((o) => o.value === cur._id)) list.unshift({ value: cur._id, label: cur.name || 'Current owner' });
    return list;
  }, [users, deal]);

  if (loading) return <DetailLoading isCollapsed={isCollapsed} message="Loading deal..." />;
  if (!deal) {
    return <DetailShell isCollapsed={isCollapsed} onBack={() => navigate('/sales/deals')} backLabel="Back to Deals" title="Deal not found" />;
  }

  const org = deal.organizationId;
  const values = editing ? draft : toDraft(deal);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const stage = stages.find((s) => s.name === deal.stage);
  const overdue = deal.closingDate && !CLOSED.includes(deal.stage) && new Date(deal.closingDate).setHours(23, 59, 59, 999) < Date.now();

  const fields = [
    { key: 'dealName', label: 'Deal Name', type: 'text', required: true },
    { key: 'owner', label: 'Deal Owner', type: 'select', options: ownerOptions, required: true },
    { key: 'amount', label: 'Amount (Rs.)', type: 'number', render: (v) => fmtAmount(v) },
    { key: 'closingDate', label: 'Closing Date', type: 'date', required: true,
      render: (v) => (
        <span className={overdue ? 'text-red-600 font-semibold' : ''}>
          {v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          {overdue && ' · overdue'}
        </span>
      ) },
    { key: 'stage', label: 'Stage', type: 'select', options: stages.map((s) => s.name), required: true },
    { key: '_prob', label: 'Probability', readOnly: true, render: () => `${stage?.probability ?? 0}%` },
    { key: '_account', label: 'Account Name', readOnly: true,
      render: () => (org?._id ? (
        <button onClick={() => navigate(`/sales/accounts/${org._id}`)} className="text-blue-600 hover:underline inline-flex items-center gap-1">
          <Building2 size={13} /> {org.companyName}
        </button>
      ) : '—') },
    { key: '_contact', label: 'Contact Name', readOnly: true,
      render: () => {
        if (!deal.contactName) return '—';
        if (org?._id && deal.contactId) {
          return (
            <button onClick={() => navigate(`/sales/contacts/${org._id}/${deal.contactId}`)} className="text-blue-600 hover:underline inline-flex items-center gap-1">
              <User size={13} /> {deal.contactName}
            </button>
          );
        }
        return deal.contactName;
      } },
    { key: 'contactRole', label: 'Contact Role', type: 'select', options: CONTACT_ROLES },
  ];
  const cfFields = customFieldDefs(customDefs);

  const save = async () => {
    if (!String(draft.dealName || '').trim()) return toast.error('Deal Name is required');
    if (!draft.closingDate) return toast.error('Closing Date cannot be empty');
    if (!draft.owner) return toast.error('Deal Owner is required');
    if (draft.amount !== '' && Number(draft.amount) < 0) return toast.error('Amount cannot be negative');
    const custom = Object.fromEntries(customDefs.map((f) => [f.fieldKey, draft[`cf:${f.fieldKey}`]]));
    const cfErr = validateCustomFields(customDefs, custom);
    if (cfErr) return toast.error(cfErr);

    const payload = {
      dealName: draft.dealName.trim(),
      owner: draft.owner,
      amount: draft.amount === '' ? 0 : Number(draft.amount),
      closingDate: draft.closingDate,
      stage: draft.stage,
      contactRole: draft.contactRole || '',
    };
    if (customDefs.length) payload.customFields = buildCustomFieldsPayload(customDefs, custom);

    try {
      setSaving(true);
      await axios.put(`${API_BASE_URL}/api/deals/${id}`, payload, authHeader());
      await load(); // GET returns the fully populated deal (account, contact, owner)
      setEditing(false);
      toast.success('Deal updated');
    } catch (err) {
      toast.error(apiError(err, 'Failed to update deal'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailShell
      isCollapsed={isCollapsed}
      onBack={() => navigate('/sales/deals')}
      backLabel="Back to Deals"
      icon={Handshake}
      title={deal.dealName}
      subtitle={<>{org?.companyName || '—'} · <b className="text-slate-700">{fmtAmount(deal.amount)}</b></>}
      badges={
        <>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-teal-100 text-teal-800">{deal.stage}</span>
          {overdue && <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700">Overdue</span>}
        </>
      }
      tags={tagsApi.tagsOf(deal._id)}
      onAddTags={canEdit ? () => tagDialogs.openTags('add', [deal._id]) : undefined}
      onRemoveTag={canEdit ? (t) => tagsApi.removeOne(deal._id, t._id) : undefined}
      canEdit={canEdit}
      editing={editing}
      saving={saving}
      onEdit={() => { setDraft(toDraft(deal)); setEditing(true); }}
      onCancel={() => setEditing(false)}
      onSave={save}
    >
      <DetailSection title="Deal Information">
        <FieldGrid fields={fields} values={values} editing={editing} onChange={set} />
      </DetailSection>

      {cfFields.length > 0 && (
        <DetailSection title="Additional Information">
          <FieldGrid fields={cfFields} values={values} editing={editing} onChange={set} />
        </DetailSection>
      )}

      <p className="text-xs text-slate-400">
        Created {fmtDateTime(deal.createdAt)}{deal.createdBy?.name ? ` by ${deal.createdBy.name}` : ''} · Last modified {fmtDateTime(deal.updatedAt)}
      </p>

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} />
    </DetailShell>
  );
}
