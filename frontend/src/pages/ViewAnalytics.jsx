import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Clock, User as UserIcon, Activity, ChevronLeft, 
  ChevronRight, ChevronDown, ChevronUp, Zap 
} from 'lucide-react';
import API_BASE_URL from '../config';

const ViewAnalytics = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLog, setExpandedLog] = useState(null);
  
  const fetchLogs = async (page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/analytics?page=${page}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages);
      setCurrentPage(res.data.currentPage);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage]);

  const toggleExpand = (id) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  const getBadgeColor = (type) => {
    if (type?.includes('CREATED')) return 'bg-emerald-500 text-white border-emerald-100';
    if (type?.includes('DELETE')) return 'bg-rose-500 text-white border-rose-100';
    if (type?.includes('UPDATE')) return 'bg-amber-500 text-white border-amber-100';
    return 'bg-blue-500 text-white border-blue-100';
  };

  return (
    <div className="lg:ml-64 p-6 bg-blue-100 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Activity size={24} className="text-blue-600" /> Timeline
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Audit Logs & Activity</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Live Updates</span>
          </div>
        </div>

        {/* Timeline Container */}
        <div className="space-y-4">
          {loading && logs.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100">
               <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-sm font-bold text-slate-400 uppercase">Syncing Activity...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100">
               <Zap size={40} className="mx-auto text-slate-200 mb-4" />
               <p className="text-sm font-bold text-slate-400 uppercase">No logs recorded</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log._id} className="flex gap-4 items-start group">
                {/* External Time Column */}
              <div className="w-32 pt-4 flex-shrink-0"> {/* Increased width to fit everything on one line */}
                <span className="flex items-center justify-end gap-1.5 text-[10px] font-black text-slate-900 tabular-nums whitespace-nowrap">
                  <Clock size={11} className="text-slate-900" />
                  <span>{new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short',year:'numeric' })}</span>
                  <span className="text-slate-300 mx-0.5">|</span>
                  <span className="text-slate-900">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </span>
              </div>

                {/* Log Card */}
                <div 
                  className={`flex-1 bg-white border transition-all duration-200 overflow-hidden ${
                    expandedLog === log._id 
                    ? 'rounded-[1.5rem] border-blue-200 shadow-md ring-4 ring-blue-50/50' 
                    : 'rounded-xl border-slate-100 hover:border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Card Header */}
                  <div 
                    onClick={() => toggleExpand(log._id)}
                    className="px-5 py-3 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`
                      text-[7px] font-black px-2 py-0.5 rounded-md border uppercase 
                      tracking-[0.15em] whitespace-nowrap flex-shrink-0 
                      backdrop-blur-md transition-all duration-300
                      ${getBadgeColor(log.actionType)}
                    `}>
                      {log.actionType?.replace('_', ' ')}
                    </div>
                    
                    <h4 className={`text-sm font-bold truncate transition-colors ${expandedLog === log._id ? 'text-blue-600' : 'text-slate-600'}`}>
                      {log.details}
                    </h4>
                  </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <UserIcon size={12} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">{log.performerId?.name?.split(' ')[0] || "Sys"}</span>
                      </div>
                      {expandedLog === log._id ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-slate-300" />}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {expandedLog === log._id && (
                    <div className="px-5 pb-5 pt-2 bg-blue-50/30 border-t border-blue-50 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-xl border border-blue-100/50 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Full Description</p>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed">{log.details}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-blue-100/50 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Performer Context</p>
                          <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                                {log.performerId?.name?.charAt(0) || 'S'}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700">{log.performerId?.name || "System Process"}</p>
                                <p className="text-[10px] font-bold text-blue-500 uppercase">{log.performerId?.role || "Automated"}</p>
                              </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 px-1 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Date: {new Date(log.timestamp).toLocaleDateString()}</span>
                        <span>ID: {log._id.slice(-6)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Minimalist Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between px-2 pl-20"> {/* Added padding-left to align with cards */}
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Page {currentPage} <span className="mx-2 text-slate-200">/</span> {totalPages}
              </span>
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewAnalytics;