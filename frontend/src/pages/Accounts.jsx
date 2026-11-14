import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, ExternalLink, Users, Loader2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import Pagination from '../components/Pagination';
import AddAccountModal from '../components/AddAccountModal';
import AddContactModal from '../components/AddContactModal';
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

const DAY = 24 * 60 * 60 * 1000;
const within7Days = (d) => !!d && Date.now() - new Date(d).getTime() <= 7 * DAY;

// ---- Zoho-style filter panel definitions ----
const ACCOUNT_SYSTEM_FILTERS = [
  { key: 'withContacts',    label: 'Accounts With Contacts',    test: (a) => (a.pointsOfContact || []).length > 0 },
  { key: 'withoutContacts', label: 'Accounts Without Contacts', test: (a) => (a.pointsOfContact || []).length === 0 },
  { key: 'recentCreated',   label: 'Recently Created Records',  test: (a) => within7Days(a.createdAt) },
  { key: 'recentModified',  label: 'Recently Modified Records', test: (a) => within7Days(a.updatedAt) },
];

const primaryOf = (a) => (a.pointsOfContact || []).find((c) => c.isPrimary) || (a.pointsOfContact || [])[0];

const ACCOUNT_FILTER_FIELDS = [
  { key: 'companyName', label: 'Account Name',     type: 'text',   getValue: (a) => a.companyName },
  { key: 'website',     label: 'Website',          type: 'text',   getValue: (a) => a.website },
  { key: 'phone',       label: 'Phone',            type: 'text',   getValue: (a) => a.phone || primaryOf(a)?.pocPhone },
  { key: 'owner',       label: 'Account Owner',    type: 'select', getValue: (a) => a.salesRepId?.name },
  { key: 'industry',    label: 'Industry',         type: 'select', getValue: (a) => a.industry },
  { key: 'status',      label: 'Status',           type: 'select', options: ['New', 'Contacted', 'Converted', 'Active', 'Inactive'], getValue: (a) => a.status },
  { key: 'employees',   label: 'No. of Employees', type: 'number', getValue: (a) => a.noOfEmployees },
  { key: 'contacts',    label: 'No. of Contacts',  type: 'number', getValue: (a) => (a.pointsOfContact || []).length },
  { key: 'createdAt',   label: 'Created Time',     type: 'date',   getValue: (a) => a.createdAt },
];

// ---- Zoho-style per-column menu (sort / pin / filter by / hide) ----
const ACCOUNT_COLUMNS = [
  {
    key: 'companyName', label: 'Account Name', type: 'text', width: 240,
    getValue: (a) => a.companyName,
    render: (a) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Building2 size={16} />
        </div>
        <span className="font-bold text-slate-800 group-hover:text-blue-600 transition truncate">
          {a.companyName}
        </span>
      </div>
    ),
  },
  {
    key: 'phone', label: 'Phone', type: 'phone',
    getValue: (a) => a.phone || primaryOf(a)?.pocPhone,
    tdClass: 'text-sm text-slate-600',
    render: (a) => a.phone || primaryOf(a)?.pocPhone || '—',
  },
  {
    key: 'website', label: 'Website', type: 'text',
    getValue: (a) => a.website,
    tdClass: 'text-sm text-blue-500',
    render: (a) => (a.website ? (
      <a href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="hover:underline">
        {a.website}
      </a>
    ) : '—'),
  },
  {
    key: 'owner', label: 'Account Owner', type: 'select',
    getValue: (a) => a.salesRepId?.name,
    tdClass: 'text-sm text-slate-600',
    render: (a) => a.salesRepId?.name || '—',
  },
  {
    key: 'contacts', label: 'Contacts', type: 'number',
    getValue: (a) => (a.pointsOfContact || []).length,
    render: (a) => (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        <Users size={14} className="text-slate-400" />
        {(a.pointsOfContact || []).length} POC(s)
      </div>
    ),
  },
];

export default function Accounts() {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [contactForAccount, setContactForAccount] = useState(null); // account id for the Add Contact modal

  // ---- Zoho-style tags ----
  const tagsApi = useRecordTags('Accounts');
  const sel = useRowSelection();
  const tagDialogs = useTagDialogs();
  const { namesOf, tagNames } = tagsApi;
  const filterFields = useMemo(
    () => [...ACCOUNT_FILTER_FIELDS, tagFilterField({ namesOf, tagNames }, (a) => a._id)],
    [namesOf, tagNames]
  );

  const loadAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // Accounts = Organizations (created automatically when a Lead is saved)
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      // Hide the internal placeholder org used by Feasibility tasks
      setAccounts(list.filter(o => (o.companyName || '').toLowerCase() !== 'feasibility'));
    } catch (err) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // Filter based on search
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    const searched = accounts.filter(a =>
      (a.companyName || '').toLowerCase().includes(s) ||
      (a.website || '').toLowerCase().includes(s) ||
      (a.salesRepId?.name || '').toLowerCase().includes(s)
    );
    return applyAllFilters(searched, ACCOUNT_SYSTEM_FILTERS, filterFields, filters);
  }, [accounts, q, filters, filterFields]);

  // Column actions are added per page (they need navigate / modal setters)
  const columns = [
    selectionColumn({
      sel, tagsApi, getId: (a) => a._id, getPageRows: () => paged,
      openTags: tagDialogs.openTags, openManage: tagDialogs.openManage,
    }),
    tagsColumn(tagsApi, (a) => a._id), // Tag column first (after the checkbox / quick-action columns)
    ...ACCOUNT_COLUMNS,
    {
      key: 'actions', label: '', menu: false, fixed: 'end', thClass: 'px-6 py-4 text-right',
      tdClass: 'text-right whitespace-nowrap',
      render: (acc) => (
        <>
          <button
            onClick={() => setContactForAccount(acc._id)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-lg transition mr-2"
          >
            <UserPlus size={12} /> Add Contact
          </button>
          <button
            onClick={() => navigate(`/sales/contacts?accountId=${acc._id}`)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition"
          >
            View Contacts <ExternalLink size={12} />
          </button>
        </>
      ),
    },
  ];

  // Left-side filters first, then the per-column sort / filters
  const ct = useColumnTable('accounts', columns, filtered, tagsApi.version);
  const rows = ct.rows;

  // Back to page 1 whenever search / filters / column sort change
  useEffect(() => { setPage(1); }, [q, filters, ct.stateKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize]
  );
  const colCount = ct.visibleColumns.length;

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Accounts</h1>
          <p className="text-sm text-slate-500">Companies and Organizations</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <FilterToggleButton open={showFilters} onClick={() => setShowFilters(v => !v)} count={countActiveFilters(filters)} />
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search accounts..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowAddAccount(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition whitespace-nowrap"
          >
            + Add Account
          </button>
          <button
            onClick={() => navigate('/sales/accounts/new')}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition whitespace-nowrap"
            title="Open the full form with multiple contacts"
          >
            Full Form
          </button>
        </div>
      </div>

      {/* Filter panel + Data Table */}
      <FilterLayout
        open={showFilters}
        sidebar={
          <ZohoFilterSidebar
            title="Accounts"
            systemFilters={ACCOUNT_SYSTEM_FILTERS}
            fields={filterFields}
            rows={accounts}
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
          <table className="w-full text-left min-w-[800px]">
            <ColumnHead ct={ct} />
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 size={32} className="animate-spin text-blue-600" />
                      <span className="text-sm font-semibold">Loading accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-10 text-slate-400">No accounts found.</td></tr>
              ) : (
                paged.map((acc) => (
                  <tr
                    key={acc._id}
                    onClick={rowClickHandler(() => navigate(`/sales/accounts/${acc._id}`))}
                    className={`hover:bg-slate-50 transition group cursor-pointer ${sel.isSelected(acc._id) ? 'bg-blue-50/60' : ''}`}
                  >
                    {ct.visibleColumns.map((col) => (
                      <td key={col.key} {...ct.cellProps(col, `${col.tdBase || 'px-6 py-4'} ${col.tdClass || ''}`)}>
                        {col.render(acc)}
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
      <AddAccountModal
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSaved={loadAccounts}
      />
      <AddContactModal
        open={!!contactForAccount}
        onClose={() => setContactForAccount(null)}
        accounts={accounts}
        defaultAccountId={contactForAccount || ''}
        onSaved={loadAccounts}
      />
    </div>
  );
}