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

export default function Accounts() {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [contactForAccount, setContactForAccount] = useState(null); // account id for the Add Contact modal

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
    return accounts.filter(a =>
      (a.companyName || '').toLowerCase().includes(s) ||
      (a.website || '').toLowerCase().includes(s) ||
      (a.salesRepId?.name || '').toLowerCase().includes(s)
    );
  }, [accounts, q]);

  // Back to page 1 whenever the search text changes
  useEffect(() => { setPage(1); }, [q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );

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

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Account Name</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Website</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Account Owner</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Contacts</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 size={32} className="animate-spin text-blue-600" />
                      <span className="text-sm font-semibold">Loading accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10 text-slate-400">No accounts found.</td></tr>
              ) : (
                paged.map((acc) => {
                  // Find primary contact to show their phone in the account row
                  const pocs = acc.pointsOfContact || [];
                  const primaryContact = pocs.find(c => c.isPrimary) || pocs[0];

                  return (
                    <tr key={acc._id} className="hover:bg-slate-50 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <Building2 size={16} />
                          </div>
                          <span className="font-bold text-slate-800 group-hover:text-blue-600 transition">
                            {acc.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {acc.phone || primaryContact?.pocPhone || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-blue-500">
                        {acc.website ? (
                          <a href={acc.website.startsWith('http') ? acc.website : `https://${acc.website}`} target="_blank" rel="noreferrer" className="hover:underline">
                            {acc.website}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {acc.salesRepId?.name || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                          <Users size={14} className="text-slate-400" />
                          {pocs.length} POC(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

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