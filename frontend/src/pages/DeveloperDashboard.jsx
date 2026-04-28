import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Layout, Database, Hash, ExternalLink, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp, User, Globe 
} from 'lucide-react';
import API_BASE_URL from '../config';

const DeveloperDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Track expanded items
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [expandedFeedId, setExpandedFeedId] = useState(null);

  // Pagination State
  const [projectPage, setProjectPage] = useState(1);
  const [feedPage, setFeedPage] = useState(1);
  const itemsPerPage = 4; // Increased slightly because cards are smaller

  useEffect(() => {
    const loadDevData = async () => {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [projRes, feedRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/dev/my-projects`, { headers }),
          axios.get(`${API_BASE_URL}/api/dev/my-feeds`, { headers })
        ]);
        setProjects(projRes.data);
        setFeeds(feedRes.data);
      } catch (err) { console.error("Fetch Error:", err); } 
      finally { setLoading(false); }
    };
    loadDevData();
  }, []);

  // Pagination Logic
  const currentProjects = projects.slice((projectPage - 1) * itemsPerPage, projectPage * itemsPerPage);
  const currentFeeds = feeds.slice((feedPage - 1) * itemsPerPage, feedPage * itemsPerPage);
  const totalProjectPages = Math.ceil(projects.length / itemsPerPage);
  const totalFeedPages = Math.ceil(feeds.length / itemsPerPage);

  if (loading) return (
    <div className="lg:ml-64 p-8 flex items-center justify-center min-h-screen font-black text-slate-300 animate-pulse text-xs tracking-widest">
      MOUNTING_RESOURCES...
    </div>
  );

  return (
    <div className="lg:ml-64 p-8 bg-blue-100 min-h-screen font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-[1000] tracking-tight text-slate-900">Workspace</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Developer Environment</p>
      </header>

      {/* STATS - Slimmed Down */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Projects', val: projects.length, icon: <Layout size={16}/>, color: 'blue' },
          { label: 'Feeds', val: feeds.length, icon: <Database size={16}/>, color: 'emerald' }
        ].map((stat, i) => (
          <div key={i} className="bg-blue-300 p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-8 h-8 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-lg font-black leading-none">{stat.val}</p>
              <p className="text-[9px] text-slate-900 uppercase font-black tracking-tighter">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PROJECTS SECTION */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Assigned Projects</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setProjectPage(p => Math.max(1, p - 1))} disabled={projectPage === 1} className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded-lg"><ChevronLeft size={16}/></button>
              <button onClick={() => setProjectPage(p => Math.min(totalProjectPages, p + 1))} disabled={projectPage === totalProjectPages} className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded-lg"><ChevronRight size={16}/></button>
            </div>
          </div>

          <div className="space-y-2">
            {currentProjects.map(proj => {
              const isExpanded = expandedProjectId === proj._id;
              return (
                <div key={proj._id} className={`bg-white border rounded-2xl transition-all ${isExpanded ? 'border-blue-200 shadow-lg' : 'border-slate-100'}`}>
                  <div 
                    onClick={() => setExpandedProjectId(isExpanded ? null : proj._id)}
                    className="p-3 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500">
                        <Globe size={14} />
                      </div>
                      <span className="text-sm font-black text-slate-700 truncate">{proj.projectCustomId}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-300"/> : <ChevronDown size={14} className="text-slate-300"/>}
                  </div>
                  
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 animate-in fade-in slide-in-from-top-1">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-3">{proj.description}</p>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-1.5">
                             <User size={10} className="text-blue-500"/>
                             <span className="text-[9px] font-black uppercase text-slate-400">{proj.projectManager?.name || 'No PM'}</span>
                           </div>
                           <button className="p-1.5 bg-white border border-slate-200 rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                             <ExternalLink size={10}/>
                           </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* FEEDS SECTION */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Feeds</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setFeedPage(p => Math.max(1, p - 1))} disabled={feedPage === 1} className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded-lg"><ChevronLeft size={16}/></button>
              <button onClick={() => setFeedPage(p => Math.min(totalFeedPages, p + 1))} disabled={feedPage === totalFeedPages} className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded-lg"><ChevronRight size={16}/></button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            {currentFeeds.map((feed, idx) => {
              const isExpanded = expandedFeedId === feed._id;
              return (
                <div key={feed._id} className={`border-slate-50 ${idx !== currentFeeds.length - 1 ? 'border-b' : ''}`}>
                  <div 
                    onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                    className={`p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isExpanded ? 'bg-blue-600 animate-pulse' : 'bg-slate-200'}`} />
                      <span className="text-sm font-black text-slate-700">{feed.name}</span>
                    </div>
                    <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md uppercase">
                      {feed.feedType}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-white animate-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Parent Project</p>
                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Hash size={12} className="text-blue-500"/> {feed.projectId?.projectCustomId || "Global"}
                          </p>
                        </div>
                        <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                          Monitor
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};

export default DeveloperDashboard;