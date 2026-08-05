// frontend/src/pages/TeamLeadDashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import {
  LayoutDashboard,
  FolderKanban,
  RefreshCw,
  Users,
  Ticket,
  Activity,
  TrendingUp,
  Briefcase,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquare,
  GitFork,
  Building2,
  Calendar,
  Filter,
  Loader2,
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  UserCheck,
  UserX,
  Eye,
  Star,
  Sparkles
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TeamLeadDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalFeeds: 0,
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0
  });
  const [expandedProject, setExpandedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  const authHeader = { 
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    } 
  };

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (userRole !== 'Team Lead') {
      console.error('User is not a Team Lead. Role:', userRole);
      setError('You do not have permission to view this page. Your role is: ' + userRole);
      setLoading(false);
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      
      const projectsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, authHeader);
      setProjects(projectsRes.data.projects || []);
      
      const ticketsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-tickets`, authHeader);
      setTickets(ticketsRes.data.tickets || []);
      
      const statsRes = await axios.get(`${API_BASE_URL}/api/teamlead/stats`, authHeader);
      setStats(statsRes.data.stats || {});
      
    } catch (err) {
      console.error('Error fetching data:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      let errorMessage = 'Failed to load dashboard data';
      
      if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => {
          localStorage.clear();
          navigate('/login');
        }, 2000);
      } else if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to access this page.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Open': return <AlertCircle size={10} className="text-blue-500" />;
      case 'In Progress': return <Clock size={10} className="text-yellow-500" />;
      case 'Resolved': return <CheckCircle size={10} className="text-green-500" />;
      case 'Closed': return <X size={10} className="text-gray-400" />;
      default: return <AlertCircle size={10} />;
    }
  };

  const getFeedTypeStyle = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Monthly': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={10} />;
      case 'Weekly': return <Calendar size={10} />;
      case 'Monthly': return <Calendar size={10} />;
      default: return <Activity size={10} />;
    }
  };

  const getProjectStatusColor = (status) => {
    switch(status) {
      case 'Closed': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'ON hold[Sales]': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ON hold[Technical]': return 'bg-red-100 text-red-700 border-red-200';
      case 'ON hold[Client]': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const filteredProjects = projects.filter(project =>
    project.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate additional metrics
  const activeProjects = projects.filter(p => p.projectStatus !== 'Closed').length;
  const onHoldProjects = projects.filter(p => p.projectStatus?.includes('ON hold')).length;
  const totalFeeds = projects.reduce((sum, p) => sum + (p.feeds?.length || 0), 0);
  const completionRate = stats.totalTickets > 0 
    ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) 
    : 0;

  if (error) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-red-200">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-red-600 mb-2">Access Error</h2>
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg shadow-indigo-100">
                <LayoutDashboard size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Team Lead Workspace
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">Manage your projects, teams, and tickets</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase">Active</span>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => navigate('/tickets/create')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Ticket</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Enhanced */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Projects</p>
              <p className="text-2xl font-black">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <FolderKanban size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-[9px] text-white/60">
            {activeProjects} active · {onHoldProjects} on hold
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Feeds</p>
              <p className="text-2xl font-black">{totalFeeds}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Activity size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-[9px] text-white/60">
            Across {stats.totalProjects} projects
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg shadow-purple-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Tickets</p>
              <p className="text-2xl font-black">{stats.totalTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-[9px] text-white/60">
            {stats.resolvedTickets} resolved
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg shadow-amber-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Open Tickets</p>
              <p className="text-2xl font-black">{stats.openTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <AlertCircle size={18} className="text-white" />
            </div>
          </div>
          <div className="mt-2 text-[9px] text-white/60">
            {stats.inProgressTickets} in progress
          </div>
        </div>
      </div>

  

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm bg-slate-50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-blue-600" />
            <h2 className="text-sm md:text-base font-black text-slate-800">Your Projects</h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredProjects.length}
            </span>
          </div>
          <button
            onClick={() => navigate('/teamlead/projects')}
            className="text-[9px] font-black text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            View All →
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Briefcase size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">No projects assigned to you yet</p>
            <p className="text-xs text-slate-400 mt-1">Projects will appear here once assigned by a Project Manager</p>
          </div>
        ) : (
          filteredProjects.slice(0, isMobile ? 3 : 5).map(project => {
            const isExpanded = expandedProject === project._id;
            const projectFeeds = project.feeds || [];
            const assignedDevs = projectFeeds.flatMap(f => f.assignedDevelopers || []);
            const uniqueDevs = [...new Set(assignedDevs.map(d => d._id || d))];
            const ticketCount = tickets.filter(t => t.projectId?._id === project._id).length;

            return (
              <div 
                key={project._id} 
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'border-blue-300 shadow-lg shadow-blue-100/50' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                {/* Project Header */}
                <div
                  className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-all"
                  onClick={() => setExpandedProject(isExpanded ? null : project._id)}
                >
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 ${
                      project.projectStatus === 'Closed' 
                        ? 'bg-slate-400 text-white' 
                        : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white'
                    }`}>
                      <Briefcase size={isMobile ? 14 : 16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{project.projectCustomId}</p>
                      <p className="text-[10px] text-slate-500 truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[8px] font-bold text-slate-400">
                          {projectFeeds.length} feed{projectFeeds.length !== 1 ? 's' : ''}
                        </span>
                        {project.teamLead && (
                          <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            TL: {project.teamLead.name}
                          </span>
                        )}
                        {uniqueDevs.length > 0 && (
                          <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            {uniqueDevs.length} dev{uniqueDevs.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    <span className={`text-[7px] md:text-[8px] font-black px-2 py-1 rounded-lg border ${getProjectStatusColor(project.projectStatus)}`}>
                      {project.projectStatus || 'Active'}
                    </span>
                    <div className="flex items-center gap-1">
                      {ticketCount > 0 && (
                        <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full hidden sm:inline">
                          {ticketCount} tickets
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={isMobile ? 16 : 18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={isMobile ? 16 : 18} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 md:px-6 pb-4 md:pb-6 pt-2 border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white animate-in slide-in-from-top-2 duration-200">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
                      <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-200 shadow-sm text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Feeds</p>
                        <p className="text-base md:text-lg font-black text-slate-800">{projectFeeds.length}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-200 shadow-sm text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Developers</p>
                        <p className="text-base md:text-lg font-black text-slate-800">{uniqueDevs.length}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-200 shadow-sm text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Tickets</p>
                        <p className="text-base md:text-lg font-black text-purple-600">{ticketCount}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-200 shadow-sm text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Status</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg inline-block ${getProjectStatusColor(project.projectStatus)}`}>
                          {project.projectStatus || 'Active'}
                        </span>
                      </div>
                    </div>

                    {/* Feeds List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                          <Activity size={12} />
                          Feeds ({projectFeeds.length})
                        </h3>
                        <button
                          onClick={() => navigate('/teamlead/feeds')}
                          className="text-[8px] font-black text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
                        >
                          Manage All →
                        </button>
                      </div>

                      {projectFeeds.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {projectFeeds.map(feed => {
                            const devs = feed.assignedDevelopers || [];
                            return (
                              <div key={feed._id} className="border border-slate-100 rounded-lg p-3 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                                        {getFeedTypeIcon(feed.feedType)}
                                        {feed.feedType || 'Daily'}
                                      </span>
                                      <p className="text-xs font-bold text-slate-800 truncate">{feed.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      {devs.slice(0, 2).map(dev => (
                                        <span key={dev._id} className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-lg text-[7px] font-bold">
                                          <UserCheck size={7} />
                                          {dev.name}
                                        </span>
                                      ))}
                                      {devs.length > 2 && (
                                        <span className="text-[7px] font-bold text-slate-400">+{devs.length - 2}</span>
                                      )}
                                      {devs.length === 0 && (
                                        <span className="text-[7px] font-bold text-slate-400 italic">Unassigned</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-lg flex-shrink-0">
                                    {devs.length} dev{devs.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          No feeds in this project
                        </p>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate('/teamlead/feeds')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <Activity size={12} />
                          Manage Feeds
                        </button>
                        <button
                          onClick={() => navigate('/tickets')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-purple-600 hover:text-white transition-all"
                        >
                          <Ticket size={12} />
                          View Tickets ({ticketCount})
                        </button>
                        <button
                          onClick={() => navigate('/teamlead/developers')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <Users size={12} />
                          Team ({uniqueDevs.length})
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          const projectId = project._id;
                          const projectName = project.projectCustomId;
                          navigate(`/tickets/create`, { 
                            state: { 
                              projectId: projectId,
                              projectName: projectName,
                              fromTeamLead: true
                            } 
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm"
                      >
                        <Plus size={12} />
                        New Ticket
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {filteredProjects.length > (isMobile ? 3 : 5) && (
          <div className="text-center pt-2">
            <button
              onClick={() => navigate('/teamlead/projects')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all {filteredProjects.length} projects →
            </button>
          </div>
        )}
      </div>

      
    </div>
  );
};

export default TeamLeadDashboard;