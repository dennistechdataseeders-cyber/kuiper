import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FolderPlus,
  Activity,
  X,
  Plus,
  Hash,
  Edit3,
  Settings2,
  Globe,
  Briefcase,
  Send,
  ShoppingBag,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Users,
  UserPlus,
  Trash2
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

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
  const [developers, setDevelopers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [clients, setClients] = useState([]); // New state for clients
  const { isCollapsed } = useSidebar();
  
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

  // --- Client Search State ---
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = React.useRef(null);

  // --- Developer Selection State ---
  const [developerSearchTerm, setDeveloperSearchTerm] = useState('');
  const [isDeveloperDropdownOpen, setIsDeveloperDropdownOpen] = useState(false);
  const developerDropdownRef = React.useRef(null);

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const [searchTerm, setSearchTerm] = useState('');

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

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

  const weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  // --- Forms ---
  const [projectForm, setProjectForm] = useState({
    name: '',
    projectManager: '',
    description: '',
    country: 'United States',
    industry: 'Tech',
    clients: [] // Array of client objects or IDs
  });

  const [feedForm, setFeedForm] = useState({
    name: '',
    assignedDevelopers: [],
    feedType: 'Daily',
    weekDay: ''
  });

  const [taskText, setTaskText] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch clients (users with role 'Client')
  const fetchClients = async () => {
    try {
      const res = await axios.get(`${ADMIN_BASE}/users/clients`, authHeader);
      setClients(res.data);
    } catch (err) {
      console.error("Error fetching clients:", err);
      toast.error("Failed to load clients");
    }
  };

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return clients;
    const search = clientSearchTerm.toLowerCase();
    return clients.filter(client => 
      client.name?.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search)
    );
  }, [clients, clientSearchTerm]);

  // Close client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (developerDropdownRef.current && !developerDropdownRef.current.contains(event.target)) {
        setIsDeveloperDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchInitialData();
    fetchClients(); // Fetch clients on mount
  }, []);

  const fetchInitialData = async () => {
    try {
      const [projRes, devRes, pmRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/projects`, authHeader),
        axios.get(`${ADMIN_BASE}/users/developers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/project-managers`, authHeader)
      ]);

      setProjects(projRes.data);
      setDevelopers(devRes.data);
      setProjectManagers(pmRes.data);

    } catch (err) {
      console.error("Data fetch failed:", err);
      toast.error("Failed to load data");
    }
  };

  // Filter developers based on search term
  const filteredDevelopers = useMemo(() => {
    if (!developerSearchTerm.trim()) return developers;
    const search = developerSearchTerm.toLowerCase();
    return developers.filter(dev => 
      dev.name?.toLowerCase().includes(search) ||
      dev.email?.toLowerCase().includes(search)
    );
  }, [developers, developerSearchTerm]);

  // Toggle client selection
  const toggleClientSelection = (clientId) => {
    setProjectForm(prev => {
      const isSelected = prev.clients.includes(clientId);
      return {
        ...prev,
        clients: isSelected 
          ? prev.clients.filter(id => id !== clientId)
          : [...prev.clients, clientId]
      };
    });
  };

  // Remove client from selection
  const removeClient = (clientId) => {
    setProjectForm(prev => ({
      ...prev,
      clients: prev.clients.filter(id => id !== clientId)
    }));
  };

  const filteredProjects = useMemo(() => {
  let result = [...projects];

  // FILTER PROJECTS FOR CURRENT PM
  result = result.filter(
    (p) =>
      p.projectManager?._id === currentUserId ||
      p.projectManager === currentUserId
  );

  // FILTER BY ASSIGNED / UNASSIGNED
  if (activeFilter === 'Assigned') {
    result = result.filter(
      (p) =>
        p.country &&
        p.country.trim() !== '' &&
        p.country !== 'Not Specified'
    );
  } else if (activeFilter === 'Unassigned') {
    result = result.filter(
      (p) =>
        !p.country ||
        p.country.trim() === '' ||
        p.country === 'Not Specified'
    );
  }

  // SEARCH FILTER
  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase().trim();

    result = result.filter((project) => {
      const clientNames = project.clients?.map(c => c?.name || '').join(' ') || '';
      const searchableFields = [
        project.projectCustomId,
        project.name,
        project.industry,
        project.country,
        project.projectManager?.name,
        clientNames
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableFields.includes(search);
    });
  }

  // SORT PROJECTS
  result.sort((a, b) => {
    const aId = a.projectCustomId || '';
    const bId = b.projectCustomId || '';

    return aId.localeCompare(bId, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return result;
}, [
  projects,
  activeFilter,
  currentUserId,
  searchTerm
]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjectSlice = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);

  // --- Project Handlers ---
  const handleProjectSubmit = async (e) => {
    e.preventDefault();

    // Validate at least one client is selected
    if (projectForm.clients.length === 0) {
      toast.error("Please select at least one client for this project");
      return;
    }

    let customId = projectForm.projectCustomId;
    let finalName = projectForm.name;

    if (isEditing || projectForm.name.includes('PRJ') || projectForm.name.includes('TDS')) {
      const sequenceMatch = projectForm.name.match(/TDS(\d{4})/) || projectForm.name.match(/PRJ(\d{4})/);
      const sequence = sequenceMatch ? sequenceMatch[1] : "0000";
      const prefix = projectForm.name.includes('PRJ') ? 'PRJ' : 'TDS';

      const selectedCountryObj = POPULAR_COUNTRIES.find(c => c.label === projectForm.country);
      const countryCode = selectedCountryObj ? selectedCountryObj.value : (projectForm.country?.substring(0, 2).toUpperCase() || "XX");
      const industryCode = (projectForm.industry || 'GEN').toUpperCase().substring(0, 4);
      const nameParts = projectForm.name.split('|');
      const companyName = nameParts[nameParts.length - 1].trim();
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
        toast.success("Project updated successfully");
      } else {
        await axios.post(`${ADMIN_BASE}/projects`, finalData, authHeader);
        toast.success("Project created successfully");
      }

      setShowProjectModal(false);
      await fetchInitialData();

      setProjectForm({
        name: '',
        projectManager: '',
        description: '',
        country: '',
        industry: '',
        clients: []
      });
      setClientSearchTerm('');
      setIsClientDropdownOpen(false);

    } catch (err) {
      toast.error(err.response?.data?.error || "Project save failed");
    }
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setIsEditing(false);
    setProjectForm({
      name: '',
      projectManager: '',
      description: '',
      country: 'United States',
      industry: 'Tech',
      clients: []
    });
    setClientSearchTerm('');
    setIsClientDropdownOpen(false);
  };

  const handleEditClick = (project) => {
    setIsEditing(true);
    setActiveProjectId(project._id);
    setProjectForm({
      name: project.name,
      projectManager: project.projectManager?._id || project.projectManager || '',
      description: project.description || '',
      country: project.country || 'United States',
      industry: project.industry || 'Tech',
      clients: project.clients?.map(c => c._id || c) || [] // Extract client IDs
    });
    setShowProjectModal(true);
  };

  // Toggle developer selection
  const toggleDeveloperSelection = (developerId) => {
    setFeedForm(prev => {
      const isSelected = prev.assignedDevelopers.includes(developerId);
      return {
        ...prev,
        assignedDevelopers: isSelected 
          ? prev.assignedDevelopers.filter(id => id !== developerId)
          : [...prev.assignedDevelopers, developerId]
      };
    });
  };

  const handleFeedSubmit = async (e) => {
    e.preventDefault();

    if (feedForm.feedType === 'Weekly' && !feedForm.weekDay) {
      toast.error('Please select a day for weekly feed');
      return;
    }

    try {
      const payload = {
        ...feedForm,
        weekDay: feedForm.feedType === 'Weekly' ? feedForm.weekDay : '',
        projectId: activeProjectId,
        adminId: currentUserId
      };

      if (isEditingFeed) {
        await axios.put(`${ADMIN_BASE}/feeds/${activeFeedId}`, payload, authHeader);
        toast.success("Feed updated successfully");
      } else {
        await axios.post(`${ADMIN_BASE}/feeds`, payload, authHeader);
        toast.success("Feed added successfully");
      }

      closeFeedModal();
      fetchInitialData();

    } catch (err) {
      toast.error("Feed save failed");
    }
  };

  const closeFeedModal = () => {
    setShowFeedModal(false);
    setIsEditingFeed(false);
    setDeveloperSearchTerm('');
    setIsDeveloperDropdownOpen(false);
    setFeedForm({
      name: '',
      assignedDevelopers: [],
      feedType: 'Daily',
      weekDay: ''
    });
  };

  const handleEditFeedClick = (project, feed) => {
    setIsEditingFeed(true);
    setActiveProjectId(project._id);
    setActiveFeedId(feed._id);
    setFeedForm({
      name: feed.name,
      assignedDevelopers: feed.assignedDevelopers?.map(d => typeof d === 'object' ? d._id : d) || [],
      feedType: feed.feedType || 'Daily',
      weekDay: feed.weekDay || ''
    });
    setShowFeedModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskText.trim()) {
      toast.error("Please enter task details");
      return;
    }

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
      toast.success("Task pushed to developers");
      fetchInitialData();

    } catch (err) {
      toast.error("Failed to push task");
    }
  };

  const customDropdownStyles = {
    control: (base) => ({
      ...base,
      padding: '8px',
      borderRadius: '1.25rem',
      border: '1px solid #f1f5f9',
      backgroundColor: '#f8fafc',
      fontWeight: '700',
      boxShadow: 'none',
      '&:hover': { border: '1px solid #3b82f6' }
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '1rem',
      overflow: 'hidden',
      padding: '5px',
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1e293b',
      fontWeight: '600',
      borderRadius: '0.5rem',
      cursor: 'pointer'
    })
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[#1B2559]">
            Workspace Project
          </h1>
          <p className="text-[#A3AED0] font-bold text-sm mt-1">
            Manage system flows and feeds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
          <div className="relative">
           <input
              type="text"
              placeholder="Search by project ID, name, client..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-64 pl-4 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-200 outline-none font-bold text-sm focus:border-blue-400 transition-all"
            />
          </div>
          <div className="h-6 w-px bg-slate-100 mx-2" />
          <button
            onClick={() => {
              setIsEditing(false);
              setShowProjectModal(true);
            }}
            className="bg-[#111C44] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
          >
            <FolderPlus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-8">
        <div className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-slate-100 shadow-sm flex-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <LayoutGrid size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Projects</p>
            <p className="text-xl font-black text-[#1B2559]">{projects.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl flex items-center gap-4 border border-slate-100 shadow-sm flex-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Feeds</p>
            <p className="text-xl font-black text-[#1B2559]">
              {projects.reduce((acc, curr) => acc + (curr.feeds?.length || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-[#F8FAFC] border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Project</th>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Clients</th>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</th>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Country</th>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Feeds</th>
                <th className="text-right px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentProjectSlice.map((project) => {
                const isFromSales = project.projectCustomId?.includes('PRJ');
                const clientList = project.clients || [];
                return (
                  <tr key={project._id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                          isFromSales ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {isFromSales ? <ShoppingBag size={20} /> : <Activity size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#1B2559]">{project.projectCustomId || 'NO_ID'}</p>
                          <p className="text-xs font-bold text-slate-400 mt-1">{project.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {clientList.length > 0 ? (
                          clientList.slice(0, 2).map((client, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-[9px] font-bold">
                              <Users size={8} />
                              {client.name || client}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[9px]">No clients</span>
                        )}
                        {clientList.length > 2 && (
                          <span className="text-[9px] font-bold text-slate-400">+{clientList.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                        <Briefcase size={12} />
                        {project.industry}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
                        <Globe size={12} />
                        {POPULAR_COUNTRIES.find(c => c.label === project.country)?.value ||
                         (project.country?.substring(0, 2).toUpperCase()) || 'XX'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-slate-400" />
                        <span className="text-sm font-black text-[#1B2559]">{project.feeds?.length || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditClick(project)} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all">
                          <Settings2 size={16} />
                        </button>
                        <button onClick={() => { setActiveProjectId(project._id); setIsEditingFeed(false); setShowFeedModal(true); }} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                          <Plus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex justify-center items-center gap-3">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30">
            <ChevronLeft size={20} />
          </button>
          <div className="flex gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 shadow-sm">
            {[...Array(totalPages)].map((_, i) => (
              <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30">
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* PROJECT MODAL WITH CLIENTS */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[100] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditing ? 'Modify Workspace' : 'Launch New Project'}
              </h2>
              <button onClick={closeProjectModal} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Brief Title</label>
                <input type="text" placeholder="Title" required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              </div>
              
              {/* CLIENTS SELECTION SECTION */}
              <div className="space-y-2" ref={clientDropdownRef}>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <Users size={12} />
                  Assign Clients (Select at least one) *
                </label>
                
                {/* Selected Clients Display */}
                {projectForm.clients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    {projectForm.clients.map(clientId => {
                      const client = clients.find(c => c._id === clientId);
                      return client ? (
                        <span key={clientId} className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          <Users size={10} />
                          {client.name}
                          <button
                            type="button"
                            onClick={() => removeClient(clientId)}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Search Input for Clients */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search clients by name or email..."
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    className="w-full h-11 rounded-xl border border-slate-200 pl-9 pr-8 font-medium text-sm outline-none focus:border-purple-500 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {isClientDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Dropdown List for Clients */}
                {isClientDropdownOpen && (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto z-50">
                    {filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">No clients found</div>
                    ) : (
                      filteredClients.map(client => {
                        const isSelected = projectForm.clients.includes(client._id);
                        return (
                          <div
                            key={client._id}
                            onClick={() => toggleClientSelection(client._id)}
                            className={`flex items-center justify-between p-3 cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-purple-50' : ''}`}
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-800">{client.name}</p>
                              <p className="text-[9px] text-slate-400">{client.email}</p>
                            </div>
                            {isSelected && <CheckCircle size={14} className="text-purple-600" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                
                <p className="text-[8px] text-slate-400 mt-1">
                  {projectForm.clients.length} client(s) selected
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <CreatableSelect isClearable options={POPULAR_COUNTRIES} placeholder="Select Country" value={POPULAR_COUNTRIES.find(opt => opt.label === projectForm.country) || { label: projectForm.country, value: projectForm.country }} onChange={(v) => setProjectForm({ ...projectForm, country: v?.label || '' })} styles={customDropdownStyles} />
                <CreatableSelect isClearable options={industries} value={industries.find(opt => opt.value === projectForm.industry) || { label: projectForm.industry, value: projectForm.industry }} onChange={(v) => setProjectForm({ ...projectForm, industry: v?.value || '' })} styles={customDropdownStyles} />
              </div>
              <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" value={projectForm.projectManager} onChange={(e) => setProjectForm({ ...projectForm, projectManager: e.target.value })}>
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

      {/* FEED MODAL WITH SEARCHABLE DROPDOWN */}
      {showFeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[110] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditingFeed ? 'Update Stream' : 'New Feed'}
              </h2>
              <button onClick={closeFeedModal} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleFeedSubmit} className="space-y-6">
              <input
                type="text"
                placeholder="Stream Name"
                required
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold"
                value={feedForm.name}
                onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
              />

              <select
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-slate-700"
                value={feedForm.feedType}
                onChange={(e) => setFeedForm({ ...feedForm, feedType: e.target.value, weekDay: e.target.value !== 'Weekly' ? '' : feedForm.weekDay })}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Once off">Once off</option>
              </select>

              {feedForm.feedType === 'Weekly' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Select Weekly Day</label>
                  <select required value={feedForm.weekDay} onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-slate-700">
                    <option value="">Choose Day</option>
                    {weekDays.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
              )}

              {/* SEARCHABLE DEVELOPER DROPDOWN */}
              <div className="space-y-2" ref={developerDropdownRef}>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <UserCheck size={12} />
                  Assign Developers
                </label>
                
                {/* Selected Developers Display */}
                {feedForm.assignedDevelopers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    {feedForm.assignedDevelopers.map(devId => {
                      const dev = developers.find(d => d._id === devId);
                      return dev ? (
                        <span key={devId} className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          {dev.name}
                          <button
                            type="button"
                            onClick={() => toggleDeveloperSelection(devId)}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search developers by name or email..."
                    value={developerSearchTerm}
                    onChange={(e) => {
                      setDeveloperSearchTerm(e.target.value);
                      setIsDeveloperDropdownOpen(true);
                    }}
                    onFocus={() => setIsDeveloperDropdownOpen(true)}
                    className="w-full h-11 rounded-xl border border-slate-200 pl-9 pr-8 font-medium text-sm outline-none focus:border-blue-500 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setIsDeveloperDropdownOpen(!isDeveloperDropdownOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {isDeveloperDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Dropdown List */}
                {isDeveloperDropdownOpen && (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto z-50">
                    {filteredDevelopers.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">No developers found</div>
                    ) : (
                      filteredDevelopers.map(dev => {
                        const isSelected = feedForm.assignedDevelopers.includes(dev._id);
                        return (
                          <div
                            key={dev._id}
                            onClick={() => toggleDeveloperSelection(dev._id)}
                            className={`flex items-center justify-between p-3 cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-800">{dev.name}</p>
                              <p className="text-[9px] text-slate-400">{dev.email}</p>
                            </div>
                            {isSelected && <CheckCircle size={14} className="text-blue-600" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                
                <p className="text-[8px] text-slate-400 mt-1">
                  {feedForm.assignedDevelopers.length} developer(s) selected
                </p>
              </div>

              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-[#111C44] transition-all uppercase text-xs tracking-widest shadow-xl">
                {isEditingFeed ? 'Save Configuration' : 'Connect Stream'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[120] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">Deploy Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-6">
              <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                <Hash size={12} />
                Stream: {activeFeed?.name}
              </p>
              <textarea required placeholder="Enter specific instructions for developers..." className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 min-h-[150px] focus:border-blue-300" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
              <button type="submit" className="w-full py-5 bg-[#111C44] text-white font-black rounded-2xl uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl">
                Push to Bucket
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* SUCCESS POPUP */}
      {showSuccessPopup && (
        <div className="fixed top-6 right-6 z-[200] animate-in slide-in-from-top-5 duration-300">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl border border-emerald-400 min-w-[280px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Success</p>
                <p className="text-sm font-bold mt-1">{successMessage}</p>
              </div>
              <button onClick={() => setShowSuccessPopup(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;