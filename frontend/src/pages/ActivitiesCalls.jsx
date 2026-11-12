// frontend/src/pages/ActivitiesCalls.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Phone, PhoneIncoming, PhoneOutgoing, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import AlphabetFilter from '../components/AlphabetFilter';
import Pagination from '../components/Pagination';
import useAlphaPagination, { getActivityLeadName } from '../utils/useAlphaPagination';
import useDashboardFilter, { filterActivities } from '../utils/useDashboardFilter';
import DashboardFilterBanner from '../components/DashboardFilterBanner';

const ActivitiesCalls = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const dash = useDashboardFilter(); // ?rep=…&focus=today&team=1 (set by the Sales Command dashboard)
  const visibleItems = useMemo(() => filterActivities(items, dash), [items, dash]);
  const list = useAlphaPagination(visibleItems); // A–Z filter + pagination

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/lead-activities?type=call&scope=${dash.team ? 'team' : 'mine'}`,
        authHeader
      );
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load calls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [dash.team]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`min-h-screen bg-white transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="pl-10 pr-6 py-4">
          <h1 className="text-3xl font-black text-slate-900">Calls</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">All logged calls</p>
        </div>
      </div>

      <div className="pl-10 pr-6 pt-[88px] pb-12">
        <DashboardFilterBanner filter={dash} label={dash.focus === 'today' ? 'Calls today' : ''} className="mb-4" />
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-blue-600 animate-spin" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
            <Phone size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">{dash.active ? 'No calls match this filter' : 'No calls logged yet'}</p>
            <p className="text-xs text-slate-400 mt-1">
              Open a lead and use <b>Activity → Add call</b> to log one.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <AlphabetFilter value={list.letter} onChange={list.setLetter} />
              <div className="ml-auto text-xs font-bold text-slate-400">
                {list.totalItems} of {visibleItems.length} calls
              </div>
            </div>

            {list.totalItems === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
                <p className="text-sm font-bold text-slate-500">
                  No calls for leads starting with “{list.letter}”
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
            {list.paged.map(item => {
              const leadName = getActivityLeadName(item);
              const company = item.leadId?.companyName;
              const Icon = item.callDirection === 'Inbound' ? PhoneIncoming : PhoneOutgoing;
              return (
                <div key={item._id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{item.title}</span>
                        {item.callDirection && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                            {item.callDirection}
                          </span>
                        )}
                        {item.callOutcome && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">
                            {item.callOutcome}
                          </span>
                        )}
                      </div>
                      {item.content && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.content}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold text-slate-400">
                        <span>Lead: {leadName}{company && company !== leadName ? ` · ${company}` : ''}</span>
                        {item.scheduledAt && (
                          <span>{new Date(item.scheduledAt).toLocaleString()}</span>
                        )}
                        {item.durationMinutes ? (
                          <span>{item.durationMinutes} min</span>
                        ) : null}
                      </div>
                    </div>
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
    </div>
  );
};

export default ActivitiesCalls;