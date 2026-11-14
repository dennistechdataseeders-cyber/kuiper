// frontend/src/pages/ContactDetail.jsx
// Sales → Contacts → click a row.  Route: /sales/contacts/:accountId/:pocId
// A contact is a Point of Contact stored on an Account (Organization).
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, Building2, Star } from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from '../components/CustomFieldsSection';
import useRecordTags from '../utils/useRecordTags';
import { TagDialogs, useTagDialogs } from '../components/RecordTags';
import {
  DetailShell, DetailSection, FieldGrid, RelatedTable, DetailLoading,
  canEditSales, authHeader, apiError, customValuesOf, customFieldDefs, fmtDateTime, fmtDate,
} from '../components/RecordDetailKit';

const DEPARTMENTS = ['CEO', 'CTO', 'Sales', 'Marketing', 'Support', 'Developer', 'Other'];
const fmtAmount = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const toDraft = (c) => ({
  pocName: c.pocName || '',
  title: c.title || '',
  pocEmail: c.pocEmail || '',
  pocPhone: c.pocPhone || '',
  mobile: c.mobile || '',
  linkedin: c.linkedin || '',
  department: c.department || 'Other',
  isPrimary: !!c.isPrimary,
  notes: c.notes || '',
  ...Object.fromEntries(Object.entries(customValuesOf(c.customFields)).map(([k, v]) => [`cf:${k}`, v])),
});

export default function ContactDetail() {
  const { accountId, pocId } = useParams();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const canEdit = canEditSales();
  const customDefs = useCustomFields('Contacts');
  const tagsApi = useRecordTags('Contacts');
  const tagDialogs = useTagDialogs();
  const recordId = `${accountId}-${pocId}`; // same id the Contacts table uses for tags

  const [account, setAccount] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/orgs/${accountId}/detail`, authHeader()),
        axios.get(`${API_BASE_URL}/api/deals?organizationId=${accountId}`, authHeader()).catch(() => ({ data: { data: [] } })),
      ]);
      setAccount(a.data?.data);
      setDeals((d.data?.data || []).filter((x) => String(x.contactId || '') === String(pocId)));
    } catch (err) {
      toast.error(apiError(err, 'Failed to load contact'));
    } finally {
      setLoading(false);
    }
  }, [accountId, pocId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DetailLoading isCollapsed={isCollapsed} message="Loading contact..." />;

  const contact = (account?.pointsOfContact || []).find((p) => String(p._id) === String(pocId));
  if (!contact) {
    return (
      <DetailShell isCollapsed={isCollapsed} onBack={() => navigate('/sales/contacts')} backLabel="Back to Contacts" title="Contact not found" />
    );
  }

  const values = editing ? draft : toDraft(contact);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const fields = [
    { key: 'pocName', label: 'Contact Name', type: 'text', required: true },
    { key: '_account', label: 'Account Name', readOnly: true,
      render: () => (
        <button onClick={() => navigate(`/sales/accounts/${account._id}`)} className="text-blue-600 hover:underline inline-flex items-center gap-1">
          <Building2 size={13} /> {account.companyName}
        </button>
      ) },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'department', label: 'Department', type: 'select', options: DEPARTMENTS, required: true },
    { key: 'pocEmail', label: 'Email', type: 'email' },
    { key: 'pocPhone', label: 'Phone', type: 'phone' },
    { key: 'mobile', label: 'Mobile', type: 'phone' },
    { key: 'linkedin', label: 'LinkedIn', type: 'url' },
    { key: 'isPrimary', label: 'Primary Contact', type: 'checkbox', checkboxLabel: 'Primary contact of this account' },
    { key: '_owner', label: 'Contact Owner', readOnly: true, render: () => account.salesRepId?.name || '—' },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ];
  const cfFields = customFieldDefs(customDefs);

  const save = async () => {
    if (!String(draft.pocName || '').trim()) return toast.error('Contact Name is required');
    const custom = Object.fromEntries(customDefs.map((f) => [f.fieldKey, draft[`cf:${f.fieldKey}`]]));
    const cfErr = validateCustomFields(customDefs, custom);
    if (cfErr) return toast.error(cfErr);

    const payload = {
      pocName: draft.pocName, title: draft.title, department: draft.department,
      pocEmail: draft.pocEmail, pocPhone: draft.pocPhone, mobile: draft.mobile,
      linkedin: draft.linkedin, isPrimary: !!draft.isPrimary, notes: draft.notes,
    };
    if (customDefs.length) payload.customFields = buildCustomFieldsPayload(customDefs, custom);

    try {
      setSaving(true);
      const res = await axios.patch(`${API_BASE_URL}/api/orgs/${accountId}/pocs/${pocId}`, payload, authHeader());
      setAccount(res.data?.data);
      setEditing(false);
      toast.success('Contact updated');
    } catch (err) {
      toast.error(apiError(err, 'Failed to update contact'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailShell
      isCollapsed={isCollapsed}
      onBack={() => navigate('/sales/contacts')}
      backLabel="Back to Contacts"
      icon={User}
      title={contact.pocName}
      subtitle={<>{contact.title ? `${contact.title} · ` : ''}{account.companyName}</>}
      badges={contact.isPrimary && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-700">
          <Star size={10} fill="currentColor" /> Primary
        </span>
      )}
      tags={tagsApi.tagsOf(recordId)}
      onAddTags={canEdit ? () => tagDialogs.openTags('add', [recordId]) : undefined}
      onRemoveTag={canEdit ? (t) => tagsApi.removeOne(recordId, t._id) : undefined}
      canEdit={canEdit}
      editing={editing}
      saving={saving}
      onEdit={() => { setDraft(toDraft(contact)); setEditing(true); }}
      onCancel={() => setEditing(false)}
      onSave={save}
    >
      <DetailSection title="Contact Information">
        <FieldGrid fields={fields} values={values} editing={editing} onChange={set} />
      </DetailSection>

      {cfFields.length > 0 && (
        <DetailSection title="Additional Information">
          <FieldGrid fields={cfFields} values={values} editing={editing} onChange={set} />
        </DetailSection>
      )}

      <DetailSection title={`Deals (${deals.length})`}>
        <RelatedTable
          rows={deals}
          empty="No deals linked to this contact."
          onRowClick={(d) => navigate(`/sales/deals/${d._id}`)}
          columns={[
            { key: 'dealName', label: 'Deal Name', render: (d) => <span className="font-semibold text-slate-800">{d.dealName}</span> },
            { key: 'stage', label: 'Stage' },
            { key: 'amount', label: 'Amount', render: (d) => fmtAmount(d.amount) },
            { key: 'closingDate', label: 'Closing Date', render: (d) => fmtDate(d.closingDate) },
          ]}
        />
      </DetailSection>

      <p className="text-xs text-slate-400">Added {fmtDateTime(contact.addedAt)}</p>

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} />
    </DetailShell>
  );
}
