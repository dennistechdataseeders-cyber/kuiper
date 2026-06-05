import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Globe,
  Briefcase,
  LayoutGrid,
  Users,
  Mail,
  CheckCircle,
  AlertCircle,
  UserPlus,
  UserMinus,
  X,
  Loader2,
  RefreshCw,
  Filter
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// ─── Assign Client Modal ───────────────────────────────────────────────────────
const AssignClientModal = ({ project, onClose, onAssigned }) => {
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAvailableClients();
  }, []);

  const fetchAvailableClients = async () => {
    try {
      setLoadingClients(true);
      const token = localStorage.getItem('token');
      // Fetch all users with role 'Client'
      const res = await axios.get(`${API_BASE_URL}/api/admin/users?role=Client`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allClients = res.data;
      // Filter out already-assigned clients
      const assignedIds = new Set((project.clients || []).map(c => c._id || c));
      const unassigned = allClients.filter(c => !assignedIds.has(c._id));
      setAvailableClients(unassigned);
    } catch (err) {
      console.error('Error fetching clients:', err);
      toast.error('Failed to load clients');
    } finally {
      setLoadingClients(false);
    }
  };

  const handleAssign = async (clientId) => {
    try {
      setAssigning(clientId);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/admin/project-client`,
        { projectId: project._id, clientId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Client assigned to ${project.projectCustomId}`);
      onAssigned();
    } catch (err) {
      console.error('Assign error:', err);
      toast.error(err.response?.data?.error || 'Failed to assign client');
    } finally {
      setAssigning(null);
    }
  };

  const filtered = availableClients.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg">Assign Client to Project</h2>
            <p className="text-white/70 text-xs mt-0.5 truncate max-w-[300px]">
              {project.projectCustomId} — {project.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Client List */}
        <div className="max-h-80 overflow-y-auto p-4 space-y-2">
          {loadingClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">
                {availableClients.length === 0
                  ? 'All clients already assigned to this project'
                  : 'No clients match your search'}
              </p>
            </div>
          ) : (
            filtered.map(client => (
              <div
                key={client._id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-sm flex-shrink-0">
                  {client.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{client.name}</p>
                  {client.email && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                      <Mail size={9} />
                      {client.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAssign(client._id)}
                  disabled={assigning === client._id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-black transition-colors flex-shrink-0"
                >
                  {assigning === client._id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <UserPlus size={12} />
                  )}
                  Assign
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-medium">
            {filtered.length} client{filtered.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const AdminProjectClients = () => {
  const { isCollapsed } = useSidebar();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [assignModal, setAssignModal] = useState(null);
  const [removingClient, setRemovingClient] = useState(null);
  const itemsPerPage = 5;

  const [stats, setStats] = useState({
    totalProjects: 0,
    totalClients: 0,
    totalFeeds: 0,
    activeProjects: 0,
    closedProjects: 0
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const projectsData = res.data;
      setProjects(projectsData);

      const totalClients = projectsData.reduce((sum, p) => sum + (p.clients?.length || 0), 0);
      const totalFeeds = projectsData.reduce((sum, p) => sum + (p.feeds?.length || 0), 0);
      const activeProjects = projectsData.filter(p => p.projectStatus !== 'Closed').length;
      const closedProjects = projectsData.filter(p => p.projectStatus === 'Closed').length;

      setStats({
        totalProjects: projectsData.length,
        totalClients,
        totalFeeds,
        activeProjects,
        closedProjects
      });
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClient = async (projectId, clientId, e) => {
    e.stopPropagation();
    if (!window.confirm('Remove this client from the project?')) return;
    try {
      setRemovingClient(`${projectId}_${clientId}`);
      const token = localStorage.getItem('token');
      
      // Call the delete endpoint to remove from ProjectClient table
      await axios.delete(`${API_BASE_URL}/api/admin/project-client`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { projectId, clientId }
      });
      
      toast.success('Client removed from project');
      fetchProjects(); // Refresh to update both tables
    } catch (err) {
      console.error('Remove error:', err);
      toast.error(err.response?.data?.error || 'Failed to remove client');
    } finally {
      setRemovingClient(null);
    }
  };

  // Get unique filter options
  const industries = useMemo(() => {
    const unique = [...new Set(projects.map(p => p.industry).filter(Boolean))];
    return ['ALL', ...unique];
  }, [projects]);

  const countries = useMemo(() => {
    const unique = [...new Set(projects.map(p => p.country).filter(Boolean))];
    return ['ALL', ...unique];
  }, [projects]);

  const statuses = useMemo(() => {
    const unique = [...new Set(projects.map(p => p.projectStatus).filter(Boolean))];
    return ['ALL', ...unique];
  }, [projects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(project =>
        project.projectCustomId?.toLowerCase().includes(search) ||
        project.name?.toLowerCase().includes(search) ||
        project.industry?.toLowerCase().includes(search) ||
        project.country?.toLowerCase().includes(search) ||
        project.projectManager?.name?.toLowerCase().includes(search) ||
        project.clients?.some(c => c?.name?.toLowerCase().includes(search))
      );
    }
    
    if (selectedIndustry !== 'ALL') {
      result = result.filter(p => p.industry === selectedIndustry);
    }
    
    if (selectedCountry !== 'ALL') {
      result = result.filter(p => p.country === selectedCountry);
    }
    
    if (selectedStatus !== 'ALL') {
      result = result.filter(p => p.projectStatus === selectedStatus);
    }
    
    return result;
  }, [projects, searchTerm, selectedIndustry, selectedCountry, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedIndustry, selectedCountry, selectedStatus]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Once off': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Ad hoc': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'BAU Initiated': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'BAU Not Initiated': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'ON hold[Sales]': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ON hold[Technical]': return 'bg-red-100 text-red-700 border-red-200';
      case 'ON hold[Client]': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Closed': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Closed') return <CheckCircle size={10} />;
    if (status?.startsWith('ON hold')) return <AlertCircle size={10} />;
    return <Activity size={10} />;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedIndustry('ALL');
    setSelectedCountry('ALL');
    setSelectedStatus('ALL');
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>

      {/* Assign Client Modal */}
      {assignModal && (
        <AssignClientModal
          project={assignModal}
          onClose={() => setAssignModal(null)}
          onAssigned={() => {
            setAssignModal(null);
            fetchProjects();
          }}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Project & Client Management
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Assign and manage clients across all projects
            </p>
          </div>
          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Projects</p>
              <p className="text-2xl font-black text-white">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <LayoutGrid size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Clients</p>
              <p className="text-2xl font-black text-white">{stats.totalClients}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Feeds</p>
              <p className="text-2xl font-black text-white">{stats.totalFeeds}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Active Projects</p>
              <p className="text-2xl font-black text-white">{stats.activeProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <CheckCircle size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Closed Projects</p>
              <p className="text-2xl font-black text-white">{stats.closedProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-[9px] font-black uppercase text-slate-500">Filters</span>
          </div>
          {(searchTerm || selectedIndustry !== 'ALL' || selectedCountry !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-700"
            >
              <X size={12} />
              Clear all
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project ID, name, client, PM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 transition-colors"
            />
          </div>

          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
          >
            {industries.map(industry => (
              <option key={industry} value={industry}>
                {industry === 'ALL' ? 'All Industries' : industry}
              </option>
            ))}
          </select>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
          >
            {countries.map(country => (
              <option key={country} value={country}>
                {country === 'ALL' ? 'All Countries' : country}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Statuses' : status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Table - No Expansion, Clients shown directly in table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Industry</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Country</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Assigned Clients</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Feeds</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project Manager</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Briefcase size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-400">No projects found</p>
                      <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentProjects.map((project) => {
                  const clients = project.clients || [];
                  
                  return (
                    <tr key={project._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                      {/* Project Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                            <Briefcase size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{project.projectCustomId}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{project.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Industry */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                          <Briefcase size={8} />
                          {project.industry || 'N/A'}
                        </span>
                      </td>

                      {/* Country */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                          <Globe size={8} />
                          {project.country || 'N/A'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getStatusColor(project.projectStatus)}`}>
                          {getStatusIcon(project.projectStatus)}
                          {project.projectStatus || 'New'}
                        </span>
                      </td>

                      {/* Clients List with Remove Buttons */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {clients.length > 0 ? (
                            clients.map((client, idx) => (
                              <div
                                key={idx}
                                className="group inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1"
                              >
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center text-[8px] font-black">
                                  {client.name?.charAt(0).toUpperCase() || 'C'}
                                </div>
                                <span className="text-[9px] font-bold text-purple-700 max-w-[100px] truncate">
                                  {client.name}
                                </span>
                                <button
                                  onClick={(e) => handleRemoveClient(project._id, client._id, e)}
                                  disabled={removingClient === `${project._id}_${client._id}`}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-purple-200 transition-all flex-shrink-0"
                                  title="Remove client"
                                >
                                  {removingClient === `${project._id}_${client._id}` ? (
                                    <Loader2 size={10} className="animate-spin text-purple-500" />
                                  ) : (
                                    <UserMinus size={10} className="text-purple-500" />
                                  )}
                                </button>
                              </div>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">No clients assigned</span>
                          )}
                        </div>
                      </td>

                      {/* Feeds Count */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Activity size={12} className="text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">{project.feeds?.length || 0}</span>
                        </div>
                      </td>

                      {/* PM */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-600">
                          {project.projectManager?.name || 'Unassigned'}
                        </span>
                      </td>

                      {/* Actions - Assign Client Button */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setAssignModal(project)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black transition-colors shadow-sm whitespace-nowrap"
                        >
                          <UserPlus size={11} />
                          Assign Client
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
                if (i === 4) pageNum = totalPages;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                if (i === 0) pageNum = 1;
                else if (i === 4) pageNum = totalPages;
                else pageNum = currentPage - 2 + i;
              }
              
              if (pageNum === 1 && i > 0 && currentPage > 3 && totalPages > 5) {
                return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">...</span>;
              }
              
              if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">...</span>;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminProjectClients;