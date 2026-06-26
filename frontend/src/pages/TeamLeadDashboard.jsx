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
  AlertTriangle
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

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  
  console.log('Team Lead Dashboard - User Role:', userRole);
  console.log('Team Lead Dashboard - Token exists:', !!token);

  const authHeader = { 
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    } 
  };

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
      console.log('Fetching Team Lead data...');
      
      const projectsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, authHeader);
      console.log('Projects response:', projectsRes.data);
      setProjects(projectsRes.data.projects || []);
      
      const ticketsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-tickets`, authHeader);
      console.log('Tickets response:', ticketsRes.data);
      setTickets(ticketsRes.data.tickets || []);
      
      const statsRes = await axios.get(`${API_BASE_URL}/api/teamlead/stats`, authHeader);
      console.log('Stats response:', statsRes.data);
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
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700';
      case 'Resolved': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
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

  const filteredProjects = projects.filter(project =>
    project.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Team Lead Workspace
            </h1>
            <p className="text-slate-500 mt-1">Manage your projects, teams, and tickets</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            
            <button
              onClick={() => navigate('/tickets/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <Plus size={16} />
              New Ticket
            </button>
           
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Projects</p>
              <p className="text-2xl font-black text-white">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FolderKanban size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Feeds</p>
              <p className="text-2xl font-black text-white">{stats.totalFeeds}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Tickets</p>
              <p className="text-2xl font-black text-white">{stats.totalTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Open Tickets</p>
              <p className="text-2xl font-black text-white">{stats.openTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
          />
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <FolderKanban size={18} className="text-blue-600" />
            Your Projects
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredProjects.length}
            </span>
          </h2>
          <button
            onClick={() => navigate('/teamlead/projects')}
            className="text-[9px] font-black text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            View All →
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Briefcase size={40} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No projects assigned to you yet</p>
            <p className="text-xs text-slate-400 mt-1">Projects will appear here once assigned by a Project Manager</p>
          </div>
        ) : (
          filteredProjects.slice(0, 5).map(project => {
            const isExpanded = expandedProject === project._id;
            return (
              <div key={project._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Project Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all"
                  onClick={() => setExpandedProject(isExpanded ? null : project._id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{project.projectCustomId}</p>
                      <p className="text-xs text-slate-500">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold text-slate-400">Feeds: {project.feeds?.length || 0}</span>
                        {project.teamLead && (
                          <span className="text-[8px] font-bold text-blue-600">Team Lead: {project.teamLead.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${
                      project.projectStatus === 'Closed' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {project.projectStatus || 'Active'}
                    </span>
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                    {/* Feeds List - View Only */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                          <Activity size={12} />
                          Feeds
                        </h3>
                        <button
                          onClick={() => navigate('/teamlead/feeds')}
                          className="text-[8px] font-black text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
                        >
                          Manage All →
                        </button>
                      </div>

                      {project.feeds && project.feeds.length > 0 ? (
                        project.feeds.map(feed => (
                          <div key={feed._id} className="border border-slate-100 rounded-lg p-3 hover:border-blue-200 transition-all">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-800">{feed.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                                    {feed.feedType || 'Daily'}
                                  </span>
                                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                                    {feed.assignedDevelopers?.length || 0} Developers
                                  </span>
                                </div>
                              </div>
                              {/* View-only badge instead of assign button */}
                              <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                {feed.assignedDevelopers?.length || 0} assigned
                              </span>
                            </div>

                            {/* Assigned Developers */}
                            {feed.assignedDevelopers && feed.assignedDevelopers.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {feed.assignedDevelopers.slice(0, 3).map(dev => (
                                  <span key={dev._id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[8px] font-bold">
                                    <Users size={8} />
                                    {dev.name}
                                  </span>
                                ))}
                                {feed.assignedDevelopers.length > 3 && (
                                  <span className="text-[7px] font-bold text-slate-400">
                                    +{feed.assignedDevelopers.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">No feeds in this project</p>
                      )}
                    </div>

                    {/* Tickets Link */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => navigate('/tickets')}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Ticket size={14} />
                        <span className="text-sm font-medium">View Tickets</span>
                      </button>
                      <span className="text-[8px] font-bold text-slate-400">
                        {tickets.filter(t => t.projectId?._id === project._id).length} tickets
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {filteredProjects.length > 5 && (
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

      {/* Quick Stats Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Resolved Tickets</p>
              <p className="text-xl font-black text-slate-800">{stats.resolvedTickets}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Completion Rate</p>
              <p className="text-xl font-black text-slate-800">
                {stats.totalTickets > 0 
                  ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Active Projects</p>
              <p className="text-xl font-black text-slate-800">
                {projects.filter(p => p.projectStatus !== 'Closed').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;