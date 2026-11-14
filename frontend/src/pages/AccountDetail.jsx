// frontend/src/pages/AccountDetail.jsx
// Sales → Accounts → click a row.  View + edit an account, its contacts and deals.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, UserPlus, Star } from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import AddContactModal from '../components/AddContactModal';
import { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from '../components/CustomFieldsSection';
import useRecordTags from '../utils/useRecordTags';
import { TagDialogs, useTagDialogs } from '../components/RecordTags';
import {
  DetailShell, DetailSection, FieldGrid, RelatedTable, DetailLoading,
  useSalesUsers, canEditSales, authHeader, apiError, customValuesOf, customFieldDefs, fmtDateTime, fmtDate,
} from '../components/RecordDetailKit';

const INDUSTRIES = [
  { value: 'ECOM', label: 'E-Commerce' },
  { value: 'IT', label: 'IT / Software' },
  { value: 'FOOD', label: 'Food & Beverage' },
  { value: 'FNC', label: 'Finance' },
];
const STATUSES = ['New', 'Contacted', 'Converted', 'Active', 'Inactive'];
const fmtAmount = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const toDraft = (a) => ({
  companyName: a.companyName || '',
  salesRepId: a.salesRepId?._id || a.salesRepId || '',
  phone: a.phone || '',
  website: a.website || '',
  industry: a.industry || '',
  noOfEmployees: a.noOfEmployees ?? '',
  status: a.status || 'New',
  address: a.address || '',
  ...Object.fromEntries(Object.entries(customValuesOf(a.customFields)).map(([k, v]) => [`cf:${k}`, v])),
});

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const canEdit = canEditSales();
  const users = useSalesUsers();
  const customDefs = useCustomFields('Accounts');
  const tagsApi = useRecordTags('Accounts');
  const tagDialogs = useTagDialogs();

  const [account, setAccount] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [addContact, setAddContact] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/orgs/${id}/detail`, authHeader()),
        axios.get(`${API_BASE_URL}/api/deals?organizationId=${id}`, authHeader()).catch(() => ({ data: { data: [] } })),
      ]);
      setAccount(a.data?.data);
      setDeals(d.data?.data || []);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load account'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const ownerOptions = useMemo(() => {
    const list = users.map((u) => ({ value: u._id, label: u.name }));
    const cur = account?.salesRepId;
    if (cur?._id && !list.some((o) => o.value === cur._id)) list.unshift({ value: cur._id, label: cur.name || 'Current owner' });
    return list;
  }, [users, account]);

  if (loading) return <DetailLoading isCollapsed={isCollapsed} message="Loading account..." />;
  if (!account) {
    return (
      <DetailShell isCollapsed={isCollapsed} onBack={() => navigate('/sales/accounts')} backLabel="Back to Accounts" title="Account not found" />
    );
  }

  const values = editing ? draft : toDraft(account);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const fields = [
    { key: 'companyName', label: 'Account Name', type: 'text', required: true },
    { key: 'salesRepId', label: 'Account Owner', type: 'select', options: ownerOptions },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'website', label: 'Website', type: 'url' },
    { key: 'industry', label: 'Industry', type: 'select', options: INDUSTRIES },
    { key: 'noOfEmployees', label: 'Employees', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, required: true },
    { key: 'address', label: 'Address', type: 'textarea', wide: true },
  ];
  const cfFields = customFieldDefs(customDefs);

  const save = async () => {
    if (!String(draft.companyName || '').trim()) return toast.error('Account Name is required');
    const custom = Object.fromEntries(customDefs.map((f) => [f.fieldKey, draft[`cf:${f.fieldKey}`]]));
    const cfErr = validateCustomFields(customDefs, custom);
    if (cfErr) return toast.error(cfErr);

    const payload = {
      companyName: draft.companyName,
      salesRepId: draft.salesRepId || null,
      phone: draft.phone,
      website: draft.website,
      industry: draft.industry,
      noOfEmployees: draft.noOfEmployees,
      status: draft.status,
      address: draft.address,
    };
    if (customDefs.length) payload.customFields = buildCustomFieldsPayload(customDefs, custom);

    try {
      setSaving(true);
      const res = await axios.patch(`${API_BASE_URL}/api/orgs/${id}`, payload, authHeader());
      setAccount(res.data?.data);
      setEditing(false);
      toast.success('Account updated');
    } catch (err) {
      toast.error(apiError(err, 'Failed to update account'));
    } finally {
      setSaving(false);
    }
  };

  const contacts = account.pointsOfContact || [];
  const tags = tagsApi.tagsOf(account._id);

  return (
    <DetailShell
      isCollapsed={isCollapsed}
      onBack={() => navigate('/sales/accounts')}
      backLabel="Back to Accounts"
      icon={Building2}
      title={account.companyName}
      subtitle={<>Owner: <b className="text-slate-700">{account.salesRepId?.name || 'Unassigned'}</b></>}
      badges={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600">{account.status || 'New'}</span>
      }
      tags={tags}
      onAddTags={canEdit ? () => tagDialogs.openTags('add', [account._id]) : undefined}
      onRemoveTag={canEdit ? (t) => tagsApi.removeOne(account._id, t._id) : undefined}
      canEdit={canEdit}
      editing={editing}
      saving={saving}
      onEdit={() => { setDraft(toDraft(account)); setEditing(true); }}
      onCancel={() => setEditing(false)}
      onSave={save}
    >
      <DetailSection title="Account Information">
        <FieldGrid fields={fields} values={values} editing={editing} onChange={set} />
      </DetailSection>

      {cfFields.length > 0 && (
        <DetailSection title="Additional Information">
          <FieldGrid fields={cfFields} values={values} editing={editing} onChange={set} />
        </DetailSection>
      )}

      <DetailSection
        title={`Contacts (${contacts.length})`}
        right={canEdit && (
          <button
            onClick={() => setAddContact(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100"
          >
            <UserPlus size={13} /> Add Contact
          </button>
        )}
      >
        <RelatedTable
          rows={contacts}
          empty="No contacts on this account yet."
          onRowClick={(c) => c._id && navigate(`/sales/contacts/${account._id}/${c._id}`)}
          columns={[
            {
              key: 'pocName', label: 'Name',
              render: (c) => (
                <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  {c.pocName}
                  {c.isPrimary && <Star size={11} className="text-amber-500" fill="currentColor" />}
                </span>
              ),
            },
            { key: 'title', label: 'Title', render: (c) => c.title || '—' },
            { key: 'pocEmail', label: 'Email', render: (c) => c.pocEmail || '—' },
            { key: 'pocPhone', label: 'Phone', render: (c) => c.pocPhone || c.mobile || '—' },
            { key: 'department', label: 'Department', render: (c) => c.department || '—' },
          ]}
        />
      </DetailSection>

      <DetailSection title={`Deals (${deals.length})`}>
        <RelatedTable
          rows={deals}
          empty="No deals for this account yet."
          onRowClick={(d) => navigate(`/sales/deals/${d._id}`)}
          columns={[
            { key: 'dealName', label: 'Deal Name', render: (d) => <span className="font-semibold text-slate-800">{d.dealName}</span> },
            { key: 'stage', label: 'Stage' },
            { key: 'amount', label: 'Amount', render: (d) => fmtAmount(d.amount) },
            { key: 'closingDate', label: 'Closing Date', render: (d) => fmtDate(d.closingDate) },
            { key: 'owner', label: 'Owner', render: (d) => d.owner?.name || '—' },
          ]}
        />
      </DetailSection>

      <p className="text-xs text-slate-400">
        Created {fmtDateTime(account.createdAt)} · Last modified {fmtDateTime(account.updatedAt)}
      </p>

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} />
      <AddContactModal
        open={addContact}
        onClose={() => setAddContact(false)}
        accounts={[account]}
        defaultAccountId={account._id}
        onSaved={load}
      />
    </DetailShell>
  );
}
