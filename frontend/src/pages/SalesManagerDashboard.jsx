import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, Target, Award, Mail, Layers, Calendar, Search, ClipboardCheck,
  Clock, FileText, Briefcase, ChevronDown, ChevronLeft, ChevronRight, User, Loader2, BarChart2, TrendingUp, Filter
} from 'lucide-react';
import API_BASE_URL from '../config';

// Reusable Lead Detail Card (Read-Only)
const LeadDetailCard = ({ lead }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Follow-up Scheduled': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Feasibility': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Production Ready': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  return (
    <div className="p-4 rounded-3xl border border-slate-100 bg-blue-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-900 text-slate-100 rounded-2xl">
            <User size={20} />
          </div>
          <div className="overflow-hidden">
            <h4 className="font-bold text-slate-800 text-sm truncate w-32">{lead.pocName || "Unnamed POC"}</h4>
            <div className="flex gap-2 mt-1">
              <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase border ${getStatusStyle(lead.status)}`}>
                {lead.status || 'New'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
          <ChevronDown className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} size={18}/>
        </button>
      </div>
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-2">
           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Company</p>
           <p className="text-[10px] font-bold text-slate-700 truncate mb-2">
              {lead.organizationId?.companyName || lead.companyName || 'General'}
           </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Contact</p>
              <p className="text-[10px] font-bold text-slate-700">{lead.pocPhone || 'No Phone'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Rep</p>
              <p className="text-[10px] font-bold text-slate-700 truncate">{lead.salesRepId?.name || 'Unassigned'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Pagination = ({ total, current, onChange, itemsPerPage = 5 }) => {
  const totalPages = Math.ceil(total / itemsPerPage);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pg {current}/{totalPages}</p>
      <div className="flex gap-1">
        <button disabled={current === 1} onClick={() => onChange(current - 1)} className="p-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
          <ChevronLeft size={14}/>
        </button>
        <button disabled={current === totalPages} onClick={() => onChange(current + 1)} className="p-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
          <ChevronRight size={14}/>
        </button>
      </div>
    </div>
  );
};

const SalesManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [teamStats, setTeamStats] = useState([]);
  const [repsList, setRepsList] = useState([]); // List of unique reps for the filter
  const [selectedRep, setSelectedRep] = useState("All"); // Global Filter State
  
  const [rawPipeline, setRawPipeline] = useState([]);
  const [rawFollowUps, setRawFollowUps] = useState([]);
  const [rawFeasibility, setRawFeasibility] = useState([]);
  const [rawApproaches, setRawApproaches] = useState([]);

  const [pages, setPages] = useState({ pipe: 1, follow: 1, feas: 1, appr: 1 });
  const [searchTerms, setSearchTerms] = useState({ pipe: "", follow: "", feas: "", appr: "" });
  const itemsPerPage = 5;

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [leadRes, prospectRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/lead-generation`, { headers }),
        axios.get(`${API_BASE_URL}/api/prospects`, { headers })
      ]);
      const allLeads = Array.isArray(leadRes.data) ? leadRes.data : [];
      const allProspects = Array.isArray(prospectRes.data) ? prospectRes.data : [];
      const todayStr = new Date().toLocaleDateString('en-CA');
      const normalizeDate = (d) => d ? (d.$date ? new Date(d.$date) : new Date(d)).toLocaleDateString('en-CA') : null;

      // Store raw data
      setRawPipeline(allLeads.filter(l => normalizeDate(l.createdAt) === todayStr));
      setRawFollowUps(allLeads.filter(l => l.status === 'Follow-up Scheduled' && normalizeDate(l.followUpDate) === todayStr));
      setRawFeasibility(allLeads.filter(l => l.status === 'Feasibility' && normalizeDate(l.followUpDate) === todayStr));
      setRawApproaches(allProspects.filter(p => p.status === 'Approached'));

      // Calculate Stats & Rep List
      const statsMap = {};
      const reps = new Set(["All"]);
      [...allLeads, ...allProspects].forEach(item => {
        let repName = item.salesRepId?.name || 'Unassigned';
        reps.add(repName);
        if (!statsMap[repName]) statsMap[repName] = { name: repName, total: 0, converted: 0 };
        statsMap[repName].total++;
        if (item.status === 'Production Ready' || item.projectId) statsMap[repName].converted++;
      });
      setRepsList(Array.from(reps));
      setTeamStats(Object.values(statsMap).map(s => ({
        ...s,
        rate: s.total > 0 ? ((s.converted / s.total) * 100).toFixed(1) : "0.0"
      })));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Filtering Logic based on Search + Selected Rep
  const filterAndPaginate = (data, searchTerm, page) => {
    const filtered = data.filter(item => {
      const matchesSearch = item.pocName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.organizationId?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRep = selectedRep === "All" || (item.salesRepId?.name || 'Unassigned') === selectedRep;
      
      return matchesSearch && matchesRep;
    });

    return {
      displayData: filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage),
      totalCount: filtered.length
    };
  };

  return (
    <div className="p-4 lg:p-8 lg:ml-64 bg-blue-100 min-h-screen">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Sales Command</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time team performance oversight.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sales Person Filter Dropdown */}
          <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 px-4 py-2 shadow-sm">
            <Filter size={16} className="text-blue-600 mr-2" />
            <select 
              value={selectedRep}
              onChange={(e) => {
                setSelectedRep(e.target.value);
                setPages({ pipe: 1, follow: 1, feas: 1, appr: 1 }); // Reset pages on filter
              }}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-4"
            >
              {repsList.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>

          <button onClick={() => fetchData()} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-blue-600 hover:bg-blue-50 transition-all">
            <TrendingUp size={20}/>
          </button>
        </div>
      </div>

      {/* TEAM STATS SECTION */}
      <div className="mb-10 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowStats(!showStats)} className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users size={20}/></div>
            <div className="text-left">
              <h2 className="text-lg font-black text-slate-800">Team Performance Overview</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Conversion Rates</p>
            </div>
          </div>
          <ChevronDown className={showStats ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {showStats && (
          <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
            {teamStats
              .filter(stat => selectedRep === "All" || stat.name === selectedRep)
              .map((stat, i) => (
                <div key={i} className="p-4 rounded-3xl border border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 text-xs truncate">{stat.name}</h3>
                    <span className="text-[9px] font-black text-blue-600">{stat.rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${stat.rate}%` }}></div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* FOUR BUCKETS IN ONE ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Bucket 
          title="Pipeline" icon={<Layers size={18} className="text-blue-600"/>} 
          search={searchTerms.pipe}
          onSearchChange={(val) => setSearchTerms({...searchTerms, pipe: val})}
          {...filterAndPaginate(rawPipeline, searchTerms.pipe, pages.pipe)}
          page={pages.pipe} onPageChange={(p) => setPages({...pages, pipe: p})} 
        />
        <Bucket 
          title="Follow-ups" icon={<Calendar size={18} className="text-orange-600"/>} 
          search={searchTerms.follow}
          onSearchChange={(val) => setSearchTerms({...searchTerms, follow: val})}
          {...filterAndPaginate(rawFollowUps, searchTerms.follow, pages.follow)}
          page={pages.follow} onPageChange={(p) => setPages({...pages, follow: p})} 
        />
        <Bucket 
          title="Feasibility" icon={<ClipboardCheck size={18} className="text-purple-600"/>} 
          search={searchTerms.feas}
          onSearchChange={(val) => setSearchTerms({...searchTerms, feas: val})}
          {...filterAndPaginate(rawFeasibility, searchTerms.feas, pages.feas)}
          page={pages.feas} onPageChange={(p) => setPages({...pages, feas: p})} 
        />
        <Bucket 
          title="Prospects" icon={<Search size={18} className="text-emerald-600"/>} 
          search={searchTerms.appr}
          onSearchChange={(val) => setSearchTerms({...searchTerms, appr: val})}
          {...filterAndPaginate(rawApproaches, searchTerms.appr, pages.appr)}
          page={pages.appr} onPageChange={(p) => setPages({...pages, appr: p})} 
        />
      </div>
    </div>
  );
};

const Bucket = ({ title, icon, displayData, totalCount, page, onPageChange, search, onSearchChange }) => (
  <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-200 flex flex-col h-[650px]">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">{icon} {title}</h2>
      <span className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] font-black text-slate-400">{totalCount}</span>
    </div>

    {/* BUCKET SEARCH BAR */}
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
      <input 
        type="text"
        placeholder={`Search ${title}...`}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
      />
    </div>

    <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
      {displayData.length === 0 ? <EmptyState /> : displayData.map(l => <LeadDetailCard key={l._id} lead={l} />)}
    </div>
    <Pagination total={totalCount} current={page} onChange={onPageChange} />
  </div>
);

const EmptyState = () => <div className="text-center py-10 text-slate-400 text-[10px] italic font-medium">No records found.</div>;

export default SalesManagerDashboard;