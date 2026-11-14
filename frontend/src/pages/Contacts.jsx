// frontend/src/pages/Contacts.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, Phone, Building2, Search, Star, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import Pagination from '../components/Pagination';
import AddContactModal from '../components/AddContactModal';
import AddAccountModal from '../components/AddAccountModal';
import { useCustomFields } from '../components/CustomFieldsSection';
import ZohoFilterSidebar, {
  FilterLayout, FilterToggleButton, EMPTY_FILTERS, applyAllFilters, countActiveFilters,
} from '../components/ZohoFilterSidebar';
import useColumnTable from '../utils/useColumnTable';
import { ColumnHead, ColumnToolbar } from '../components/ColumnTable';
import { rowClickHandler } from '../components/RecordDetailKit';
import useRecordTags, { useRowSelection } from '../utils/useRecordTags';
import {
  selectionColumn, tagsColumn, tagFilterField, TagToolbar, TagDialogs, useTagDialogs,
} from '../components/RecordTags';

// Display helper for a saved custom-field value
const formatCustomValue = (v) => {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

// ---- Zoho-style filter panel definitions ----
const CONTACT_SYSTEM_FILTERS = [
  { key: 'primary',   label: 'Primary Contacts',       test: (r) => !!r.isPrimary },
  { key: 'hasEmail',  label: 'Contacts With Email',    test: (r) => !!r.email },
  { key: 'noEmail',   label: 'Contacts Without Email', test: (r) => !r.email },
  { key: 'hasPhone',  label: 'Contacts With Phone',    test: (r) => !!r.phone },
  { key: 'noPhone',   label: 'Contacts Without Phone', test: (r) => !r.phone },
];

export default function Contacts() {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accountId = params.get('accountId');

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Fields created in Customize Modules → Contacts (shown as extra columns)
  const customFields = useCustomFields('Contacts');

  // ---- Zoho-style tags (contact id = `${accountId}-${pocId}`) ----
  const tagsApi = useRecordTags('Contacts');
  const sel = useRowSelection();
  const tagDialogs = useTagDialogs();
  const { namesOf, tagNames } = tagsApi;

  const loadContacts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // Contacts = Points of Contact stored on each Account (Organization)
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setLeads(list.filter(o => (o.companyName || '').toLowerCase() !== 'feasibility'));
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // every contact (before search / filter panel) — also feeds the panel's value lists
  const baseRows = useMemo(() => {
    const rows = [];
    for (const lead of leads) {
      if (accountId && lead._id !== accountId) continue;

      for (const c of lead.pointsOfContact || []) {
        const [firstName = '', ...rest] = (c.pocName || '').trim().split(' ');
        rows.push({
          _id: `${lead._id}-${c._id || c.pocName}`,
          leadId: lead._id,
          pocId: c._id,
          companyName: lead.companyName,
          firstName,
          lastName: rest.join(' '),
          email: c.pocEmail,
          phone: c.pocPhone || c.mobile,
          title: c.title,
          owner: lead.salesRepId?.name || '',
          addedAt: c.addedAt,
          isPrimary: c.isPrimary,
          custom: Object.fromEntries((c.customFields || []).map(f => [f.fieldKey, f.value]))
        });
      }
    }
    return rows;
  }, [leads, accountId]);

  const customFieldDefs = useMemo(
    () => customFields.map((f) => ({
      key: `cf_${f.fieldKey}`,
      label: f.label,
      type: 'text',
      getValue: (r) => {
        const v = r.custom?.[f.fieldKey];
        return Array.isArray(v) ? v.join(', ') : (v ?? '');
      },
    })),
    [customFields]
  );

  const filterFields = useMemo(() => [
    { key: 'companyName', label: 'Account Name',  type: 'select' },
    { key: 'firstName',   label: 'First Name',    type: 'text' },
    { key: 'lastName',    label: 'Last Name',     type: 'text' },
    { key: 'email',       label: 'Email',         type: 'text' },
    { key: 'phone',       label: 'Phone',         type: 'text' },
    { key: 'title',       label: 'Title',         type: 'select' },
    { key: 'owner',       label: 'Contact Owner', type: 'select' },
    { key: 'addedAt',     label: 'Created Time',  type: 'date' },
    ...customFieldDefs,
    tagFilterField({ namesOf, tagNames }, (r) => r._id),
  ], [customFieldDefs, namesOf, tagNames]);

  const contactRows = useMemo(() => {
    let rows = baseRows;

    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(r =>
        r.firstName?.toLowerCase().includes(s) ||
        r.lastName?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.phone?.toLowerCase().includes(s) ||
        r.companyName?.toLowerCase().includes(s)
      );
    }
    return applyAllFilters(rows, CONTACT_SYSTEM_FILTERS, filterFields, filters);
  }, [baseRows, q, filters, filterFields]);

  // ---- Zoho-style per-column menu (sort / pin / filter by / hide) ----
  const columns = [
    selectionColumn({
      sel, tagsApi, getId: (r) => r._id, getPageRows: () => pagedRows,
      openTags: tagDialogs.openTags, openManage: tagDialogs.openManage,
    }),
    tagsColumn(tagsApi, (r) => r._id), // Tag column first (after the checkbox / quick-action columns)
    {
      key: 'name', label: 'Contact Name', type: 'text', width: 240,
      getValue: (r) => `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
            {row.firstName?.charAt(0)}{row.lastName?.charAt(0)}
          </div>
          <span className="font-bold text-slate-800 truncate">
            {row.firstName} {row.lastName}
          </span>
          {row.isPrimary && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1 shrink-0">
              <Star size={8} fill="currentColor" /> Primary
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'companyName', label: 'Account Name', type: 'select',
      getValue: (r) => r.companyName,
      render: (row) => (
        <button
          onClick={() => navigate(`/sales/contacts?accountId=${row.leadId}`)}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
        >
          <Building2 size={14} />
          {row.companyName}
        </button>
      ),
    },
    {
      key: 'email', label: 'Email', type: 'text',
      getValue: (r) => r.email,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Mail size={14} className="text-slate-400" />
          {row.email ? <a href={`mailto:${row.email}`} className="hover:text-blue-600">{row.email}</a> : '—'}
        </div>
      ),
    },
    {
      key: 'phone', label: 'Phone', type: 'phone',
      getValue: (r) => r.phone,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Phone size={14} className="text-slate-400" />
          {row.phone ? <a href={`tel:${row.phone}`} className="hover:text-blue-600">{row.phone}</a> : '—'}
        </div>
      ),
    },
    {
      key: 'title', label: 'Title', type: 'select',
      getValue: (r) => r.title,
      tdClass: 'text-sm text-slate-600',
      render: (row) => row.title || '—',
    },
    {
      key: 'owner', label: 'Contact Owner', type: 'select',
      getValue: (r) => r.owner,
      tdClass: 'text-sm text-slate-600',
      render: (row) => row.owner || '—',
    },
    ...customFields.map((f) => ({
      key: `cf_${f.fieldKey}`, label: f.label, type: 'text',
      getValue: (r) => {
        const v = r.custom?.[f.fieldKey];
        return Array.isArray(v) ? v.join(', ') : (v ?? '');
      },
      tdClass: 'text-sm text-slate-600',
      render: (row) => formatCustomValue(row.custom?.[f.fieldKey]),
    })),
  ];

  // Left-side filters first, then the per-column sort / filters
  const ct = useColumnTable('contacts', columns, contactRows, tagsApi.version);
  const rows = ct.rows;
  const colCount = ct.visibleColumns.length;

  // Back to page 1 when search / account / filters / column sort change
  useEffect(() => { setPage(1); }, [q, accountId, filters, ct.stateKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize]
  );

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const activeAccount = leads.find(l => l._id === accountId)?.companyName;

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          {accountId && (
            <button onClick={() => navigate('/sales/contacts')} className="p-2 bg-white rounded-lg shadow-sm border hover:bg-slate-100 transition">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {accountId ? `Contacts: ${activeAccount ?? ''}` : 'All Contacts'}
            </h1>
            <p className="text-sm text-slate-500">Points of Contact across all Accounts</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <FilterToggleButton open={showFilters} onClick={() => setShowFilters(v => !v)} count={countActiveFilters(filters)} />
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowAddContact(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition whitespace-nowrap"
          >
            <UserPlus size={14} /> Add Contact
          </button>
          <button
            onClick={() => setShowAddAccount(true)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition whitespace-nowrap"
          >
            + Add Account
          </button>
        </div>
      </div>

      <FilterLayout
        open={showFilters}
        sidebar={
          <ZohoFilterSidebar
            title="Contacts"
            systemFilters={CONTACT_SYSTEM_FILTERS}
            fields={filterFields}
            rows={baseRows}
            value={filters}
            onChange={setFilters}
          />
        }
      >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TagToolbar sel={sel} openTags={tagDialogs.openTags} openManage={tagDialogs.openManage} />
        <ColumnToolbar ct={ct} className="flex-1" />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <ColumnHead ct={ct} />
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 size={32} className="animate-spin text-blue-600" />
                      <span className="text-sm font-semibold">Loading contacts...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-10 text-slate-400">No contacts found.</td></tr>
              ) : (
                pagedRows.map((row) => (
                  <tr
                    key={row._id}
                    onClick={rowClickHandler(() => row.pocId && navigate(`/sales/contacts/${row.leadId}/${row.pocId}`))}
                    className={`hover:bg-slate-50 transition group ${row.pocId ? 'cursor-pointer' : ''} ${sel.isSelected(row._id) ? 'bg-blue-50/60' : ''}`}
                  >
                    {ct.visibleColumns.map((col) => (
                      <td key={col.key} {...ct.cellProps(col, `${col.tdBase || 'px-6 py-4'} ${col.tdClass || ''}`)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
      </FilterLayout>

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} onDone={sel.clear} />
      <AddContactModal
        open={showAddContact}
        onClose={() => setShowAddContact(false)}
        accounts={leads}
        defaultAccountId={accountId || ''}
        onSaved={loadContacts}
      />
      <AddAccountModal
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSaved={loadContacts}
      />
    </div>
  );
}