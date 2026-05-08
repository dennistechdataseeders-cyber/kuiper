import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  FolderPlus, Activity, X, Plus, Hash, Edit3, Settings2, 
  Globe, Briefcase, Send, ChevronDown, ChevronUp, ShoppingBag, LayoutGrid,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import API_BASE_URL from '../config';

// 1. Define the abbreviation mapping dictionary
const POPULAR_COUNTRIES = [
  { label: "Afghanistan", value: "AF" }, { label: "Albania", value: "AL" }, { label: "Algeria", value: "DZ" },
  { label: "Australia", value: "AU" }, { label: "Brazil", value: "BR" }, { label: "Canada", value: "CA" },
  { label: "China", value: "CN" }, { label: "France", value: "FR" }, { label: "Germany", value: "DE" },
  { label: "India", value: "IN" }, { label: "Indonesia", value: "ID" }, { label: "Italy", value: "IT" },
  { label: "Japan", value: "JP" }, { label: "Mexico", value: "MX" }, { label: "Netherlands", value: "NL" },
  { label: "Nigeria", value: "NG" }, { label: "Pakistan", value: "PK" }, { label: "Russia", value: "RU" },
  { label: "Saudi Arabia", value: "SA" }, { label: "Singapore", value: "SG" }, { label: "South Africa", value: "ZA" },
  { label: "South Korea", value: "KR" }, { label: "Spain", value: "ES" }, { label: "Turkey", value: "TR" },
  { label: "United Arab Emirates", value: "AE" }, { label: "United Kingdom", value: "GB" }, 
  { label: "United States", value: "US" }, { label: "Vietnam", value: "VN" }
];

const ProjectManagement = () => {
  // --- Data State ---
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 6;

  // --- Filter State ---
  const [activeFilter, setActiveFilter] = useState('All'); 

  // --- UI State ---
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeFeed, setActiveFeed] = useState(null); 
  const [activeFeedId, setActiveFeedId] = useState(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingFeed, setIsEditingFeed] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const industries = useMemo(() => [
   { label: "ECOM", value: "ECOM" },
  { label: "FOOD", value: "FOOD" },
  { label: "HTL", value: "HTL" },
  { label: "TRVL", value: "TRVL" },
  { label: "FNC", value: "FNC" },
  { label: "SCLM", value: "SCLM" },
  { label: "JOB", value: "JOB" },
  { label: "AUTO", value: "AUTO" }
  ], []);

  // --- Forms ---
  const [projectForm, setProjectForm] = useState({ 
    name: '', clients: [], projectManager: '', description: '', country: 'United States', industry: 'Tech' 
  });

  const [feedForm, setFeedForm] = useState({ 
    name: '', assignedDevelopers: [], feedType: 'Daily' 
  });

  const [taskText, setTaskText] = useState("");

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      const [projRes, clientRes, devRes, pmRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/projects`, authHeader),
        axios.get(`${ADMIN_BASE}/users/clients`, authHeader),
        axios.get(`${ADMIN_BASE}/users/developers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/project-managers`, authHeader)
      ]);
      setProjects(projRes.data);
      setClients(clientRes.data);
      setDevelopers(devRes.data);
      setProjectManagers(pmRes.data);
    } catch (err) { console.error("Data fetch failed:", err); }
  };

  const filteredProjects = useMemo(() => {
    let result = projects;
    result = result.filter(p => p.projectManager?._id === currentUserId || p.projectManager === currentUserId);
    if (activeFilter === 'Assigned') {
      result = result.filter(p => p.country && p.country.trim() !== "" && p.country !== 'Not Specified');
    } else if (activeFilter === 'Unassigned') {
      result = result.filter(p => !p.country || p.country.trim() === "" || p.country === 'Not Specified');
    }
    return result;
  }, [projects, activeFilter, currentUserId]);

  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjectSlice = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);

  const toggleExpand = (projectId) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // --- Project Handlers ---
  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    
    let customId = projectForm.projectCustomId; 
    let finalName = projectForm.name;

    // Logic for formatting the Project Name with Abbreviations
    if (isEditing || projectForm.name.includes('PRJ') || projectForm.name.includes('TDS')) { 
      const sequenceMatch = projectForm.name.match(/TDS(\d{4})/) || projectForm.name.match(/PRJ(\d{4})/);
      const sequence = sequenceMatch ? sequenceMatch[1] : "0000"; 
      const prefix = projectForm.name.includes('PRJ') ? 'PRJ' : 'TDS';

      // LOOKUP ABBREVIATION
      const selectedCountryObj = POPULAR_COUNTRIES.find(c => c.label === projectForm.country);
      const countryCode = selectedCountryObj ? selectedCountryObj.value : (projectForm.country?.substring(0, 2).toUpperCase() || "XX");
      
      const industryCode = (projectForm.industry || 'GEN').toUpperCase().substring(0, 4);
      
      const nameParts = projectForm.name.split('|');
      const companyName = nameParts[nameParts.length - 1].trim();

      // RECONSTRUCT SAVED NAME
      const updatedFormattedString = `${prefix}${sequence}-${industryCode} | ${countryCode} | ${companyName}`;
      
      customId = updatedFormattedString;
      finalName = updatedFormattedString;
    }

    const finalData = { 
      ...projectForm, 
      name: finalName,
      projectCustomId: customId, 
      projectManager: projectForm.projectManager || currentUserId,
      adminId: currentUserId 
    };

    try {
      if (isEditing) {
        await axios.put(`${ADMIN_BASE}/projects/${activeProjectId}`, finalData, authHeader);
      } else {
        await axios.post(`${ADMIN_BASE}/projects`, finalData, authHeader);
      }
     setShowProjectModal(false);
    
    // 3. CRITICAL: Re-fetch data to update the UI without a refresh
    await fetchInitialData(); 
    
    // 4. Reset the form
    setProjectForm({ name: '', clients: [], projectManager: '', description: '', country: '', industry: '' });
    } catch (err) { alert(err.response?.data?.error || "Project save failed"); }
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setIsEditing(false);
    setProjectForm({ name: '', clients: [], projectManager: '', description: '', country: 'United States', industry: 'Tech' });
  };

  const handleEditClick = (project) => {
    setIsEditing(true);
    setActiveProjectId(project._id);
    setProjectForm({
      name: project.name,
      clients: project.clients?.map(c => typeof c === 'object' ? c._id : c) || [],
      projectManager: project.projectManager?._id || project.projectManager || '',
      description: project.description,
      country: project.country || 'United States',
      industry: project.industry || 'Tech'
    });
    setShowProjectModal(true);
  };

  const handleFeedSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...feedForm, projectId: activeProjectId, adminId: currentUserId };
      if (isEditingFeed) {
        await axios.put(`${ADMIN_BASE}/feeds/${activeFeedId}`, payload, authHeader);
      } else {
        await axios.post(`${ADMIN_BASE}/feeds`, payload, authHeader);
      }
      closeFeedModal();
      fetchInitialData();
    } catch (err) { alert("Feed save failed"); }
  };

  const closeFeedModal = () => {
    setShowFeedModal(false);
    setIsEditingFeed(false);
    setFeedForm({ name: '', assignedDevelopers: [], feedType: 'Daily' });
  };

  const handleEditFeedClick = (project, feed) => {
    setIsEditingFeed(true);
    setActiveProjectId(project._id);
    setActiveFeedId(feed._id);
    setFeedForm({
      name: feed.name,
      assignedDevelopers: feed.assignedDevelopers?.map(d => typeof d === 'object' ? d._id : d) || [],
      feedType: feed.feedType || 'Daily'
    });
    setShowFeedModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskText.trim()) return;
    try {
      await axios.post(`${ADMIN_BASE}/tasks/create`, {
        projectId: activeProjectId,
        feedId: activeFeed?._id,
        performerId: currentUserId,
        details: taskText,
        assignedDevelopers: activeFeed?.assignedDevelopers?.map(d => d._id || d)
      }, authHeader);
      setTaskText("");
      setShowTaskModal(false);
      fetchInitialData();
    } catch (err) { alert("Failed to push task"); }
  };

  const customDropdownStyles = {
    control: (base) => ({
      ...base, padding: '8px', borderRadius: '1.25rem', border: '1px solid #f1f5f9',
      backgroundColor: '#f8fafc', fontWeight: '700', boxShadow: 'none', '&:hover': { border: '1px solid #3b82f6' }
    }),
    menu: (base) => ({ ...base, borderRadius: '1rem', overflow: 'hidden', padding: '5px', zIndex: 50 }),
    option: (base, state) => ({
      ...base, backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1e293b', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer'
    })
  };

  return (
    <div className="ml-64 p-10 bg-[#F4F7FE] min-h-screen font-sans text-slate-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[#1B2559]">Workspace Hub</h1>
          <p className="text-[#A3AED0] font-bold text-sm mt-1">Manage system flows and data streams.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
            {['All', 'Assigned', 'Unassigned'].map((filter) => (
                <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-6 py-2.5 rounded-2xl text-xs font-black transition-all ${
                        activeFilter === filter 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    {filter === 'Unassigned' && <ShoppingBag size={12} className="inline mr-2 mb-0.5" />}
                    {filter}
                </button>
            ))}
            <div className="h-6 w-px bg-slate-100 mx-2" />
            <button 
                onClick={() => { setIsEditing(false); setShowProjectModal(true); }} 
                className="bg-[#111C44] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
            >
                <FolderPlus size={16} /> New Project
            </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
         <div className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-slate-100 shadow-sm flex-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><LayoutGrid size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hubs</p>
                <p className="text-xl font-black text-[#1B2559]">{projects.length}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-slate-100 shadow-sm flex-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><ShoppingBag size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sales Leads</p>
                <p className="text-xl font-black text-[#1B2559]">{projects.filter(p => p.projectCustomId?.includes('PRJ')).length}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-slate-100 shadow-sm flex-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Feeds</p>
                <p className="text-xl font-black text-[#1B2559]">{projects.reduce((acc, curr) => acc + (curr.feeds?.length || 0), 0)}</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {currentProjectSlice.map((project) => {
          const isExpanded = expandedProjects[project._id];
          const isFromSales = project.projectCustomId?.includes('PRJ');

          return (
            <div 
              key={project._id} 
              className={`bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative ${isExpanded ? 'ring-2 ring-blue-500/20' : ''}`}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full -mr-16 -mt-16 ${isFromSales ? 'bg-amber-500' : 'bg-blue-500'}`} />

              <div className="p-7">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${isFromSales ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
                    {isFromSales ? <ShoppingBag size={22} /> : <Activity size={22} />}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(project)} className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100">
                      <Settings2 size={16} />
                    </button>
                    <button 
                      onClick={() => toggleExpand(project._id)} 
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${isExpanded ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 hover:bg-slate-50 border-slate-100'}`}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-[#1B2559] tracking-tight truncate max-w-[70%]">
                      {project.projectCustomId || 'NO_ID'}
                    </h3>
                    {isFromSales && (
                        <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest border border-amber-200">
                            Sales
                        </span>
                    )}
                  </div>  
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                      <Briefcase size={10} /> {project.industry}
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Globe size={10} /> 
                      {/* UPDATED: Lookup abbreviation for the badge */}
                      {
                        POPULAR_COUNTRIES.find(c => c.label === project.country)?.value || 
                        (project.country?.length === 2 ? project.country : project.country?.substring(0, 2).toUpperCase()) || 
                        'XX'
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-7 py-4 bg-[#F8FAFC] border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {project.clients?.slice(0, 3).map((client, idx) => (
                      <div key={idx} className="w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-[9px] font-black text-blue-600 shadow-sm overflow-hidden">
                        {typeof client === 'object' ? client.name?.substring(0, 2).toUpperCase() : 'CL'}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{project.clients?.length || 0} Clients</span>
                </div>
                
                <button 
                   onClick={() => toggleExpand(project._id)} 
                   className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isExpanded ? 'text-slate-900' : 'text-blue-600 hover:gap-3'}`}
                >
                  {isExpanded ? 'Hide Streams' : `${project.feeds?.length || 0} Data Streams`}
                  {!isExpanded && <Send size={12} className="rotate-45" />}
                </button>
              </div>

              {isExpanded && (
                <div className="px-7 pb-7 bg-white animate-in slide-in-from-top-4 duration-500">
                  <div className="pt-6 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Channels</h4>
                        <button 
                          onClick={() => { setActiveProjectId(project._id); setIsEditingFeed(false); setShowFeedModal(true); }}
                          className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <Plus size={10} strokeWidth={3} /> Add Feed
                        </button>
                    </div>
                    {project.feeds?.length > 0 ? project.feeds.map(feed => (
                      <div key={feed._id} className="flex justify-between items-center bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group/feed">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover/feed:text-blue-600 group-hover/feed:shadow-sm transition-all border border-slate-50">
                            <Hash size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#1B2559]">{feed.name}</p>
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{feed.feedType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => handleEditFeedClick(project, feed)} className="p-2 text-slate-300 hover:text-slate-600">
                              <Edit3 size={14} />
                            </button>
                           <button 
                            onClick={() => { setActiveProjectId(project._id); setActiveFeed(feed); setShowTaskModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#111C44] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                          >
                            Push Task
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-10 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No active streams configured</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-12 flex justify-center items-center gap-3">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 shadow-sm">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                  currentPage === i + 1 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                  : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[100] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditing ? 'Modify Workspace' : 'Launch New Hub'}
              </h2>
              <button onClick={closeProjectModal} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleProjectSubmit} className="space-y-6">
              <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Brief Title</label>
                  <input type="text" placeholder="Title" required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold" value={projectForm.name} onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <CreatableSelect 
                  isClearable 
                  options={POPULAR_COUNTRIES} 
                  placeholder="Select Country"
                  // Value mapping to ensure dropdown shows Full Name while state might store code
                  value={POPULAR_COUNTRIES.find(opt => opt.label === projectForm.country) || {label: projectForm.country, value: projectForm.country}} 
                  onChange={(v) => setProjectForm({...projectForm, country: v?.label || ''})} 
                  styles={customDropdownStyles} 
                />
                <CreatableSelect isClearable options={industries} value={industries.find(opt => opt.value === projectForm.industry) || {label: projectForm.industry, value: projectForm.industry}} onChange={(v) => setProjectForm({...projectForm, industry: v?.value || ''})} styles={customDropdownStyles} />
              </div>
              <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" value={projectForm.projectManager} onChange={(e) => setProjectForm({...projectForm, projectManager: e.target.value})}>
                <option value="">Select Manager</option>
                {projectManagers.map(pm => <option key={pm._id} value={pm._id}>{pm.name}</option>)}
              </select>
             
              <button type="submit" className="w-full py-5 bg-[#111C44] text-white font-black rounded-2xl hover:bg-blue-600 transition-all uppercase text-xs tracking-widest shadow-xl">
                {isEditing ? 'Save Changes' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showFeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[110] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditingFeed ? 'Update Stream' : 'New Data Stream'}
              </h2>
              <button onClick={closeFeedModal} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleFeedSubmit} className="space-y-6">
              <input type="text" placeholder="Stream Name" required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold" value={feedForm.name} onChange={(e) => setFeedForm({...feedForm, name: e.target.value})} />
              <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-slate-700" value={feedForm.feedType} onChange={(e) => setFeedForm({ ...feedForm, feedType: e.target.value })}>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Once off">Once off</option>
              </select>
              <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {developers.map(dev => (
                  <label key={dev._id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${feedForm.assignedDevelopers.includes(dev._id) ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={feedForm.assignedDevelopers.includes(dev._id)} onChange={(e) => {
                      const newDevs = e.target.checked ? [...feedForm.assignedDevelopers, dev._id] : feedForm.assignedDevelopers.filter(id => id !== dev._id);
                      setFeedForm({...feedForm, assignedDevelopers: newDevs});
                    }} />
                    <span className="text-slate-700 font-black text-[9px] uppercase truncate">{dev.name}</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-[#111C44] transition-all uppercase text-xs tracking-widest shadow-xl">
                {isEditingFeed ? 'Save Configuration' : 'Connect Stream'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[120] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">Deploy Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-6">
              <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                <Hash size={12} /> Stream: {activeFeed?.name}
              </p>
              <textarea 
                required placeholder="Enter specific instructions for developers..." 
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 min-h-[150px] focus:border-blue-300"
                value={taskText} onChange={(e) => setTaskText(e.target.value)}
              />
              <button type="submit" className="w-full py-5 bg-[#111C44] text-white font-black rounded-2xl uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl">
                Push to Bucket
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;