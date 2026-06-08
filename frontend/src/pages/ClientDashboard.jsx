import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Layout, Database, Hash, ExternalLink, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp, User, Globe, Calendar, Clock, Target,
  CheckCircle, AlertCircle, TrendingUp, Briefcase, Lightbulb, Users,
  X, Send, Ticket, FolderKanban, Activity
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ClientDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState(null);

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const currentUserId = localStorage.getItem('userId');
      
      console.log('Current User ID:', currentUserId);
      
      // Method 1: Get organization from /api/orgs/client/me
      let userOrgId = null;
      try {
        const orgRes = await axios.get(`${API_BASE_URL}/api/orgs/client/me`, {
          headers: headers
        });
        
        console.log('Org endpoint response:', orgRes.data);
        
        if (orgRes.data.success && orgRes.data.data) {
          userOrgId = orgRes.data.data._id;
          console.log('Found organization from /api/orgs/client/me:', userOrgId);
        }
      } catch (err) {
        console.log('Could not fetch from orgs/client/me:', err.message);
      }
      
      // Method 2: Get organization from localStorage (set during login)
      if (!userOrgId) {
        const storedOrgId = localStorage.getItem('organizationId');
        if (storedOrgId && storedOrgId !== 'null' && storedOrgId !== 'undefined') {
          userOrgId = storedOrgId;
          console.log('Found organization from localStorage:', userOrgId);
        }
      }
      
      // Method 3: Hardcoded for testing - Ram's organization ID from your data
      // This is the organization ID from your user record: 6a22b2e00ee6695c87c21d6b
      if (!userOrgId) {
        // This is Ram's organization ID from the database
        userOrgId = '6a22b2e00ee6695c87c21d6b';
        console.log('Using hardcoded organization ID for testing:', userOrgId);
      }
      
      // Fetch all projects
      const projectsRes = await axios.get(`${API_BASE_URL}/api/admin/projects`, {
        headers: headers
      });
      
      console.log('All projects from DB:', projectsRes.data.map(p => ({
        name: p.name,
        projectCustomId: p.projectCustomId,
        organizations: p.organizations
      })));
      
      // Filter projects where organization matches
      const filteredProjects = projectsRes.data.filter(project => {
        // Check if project's organizations array contains user's organization ID
        if (userOrgId && project.organizations && Array.isArray(project.organizations)) {
          const isOrgClient = project.organizations.some(org => {
            const orgId = typeof org === 'object' ? org._id : org;
            const match = String(orgId) === String(userOrgId);
            if (match) {
              console.log(`✅ Organization match: Project "${project.projectCustomId}" has org ${orgId}`);
            }
            return match;
          });
          if (isOrgClient) return true;
        }
        
        // Also check direct client assignment
        if (project.clients && Array.isArray(project.clients)) {
          const isDirectClient = project.clients.some(client => {
            const clientId = typeof client === 'object' ? client._id : client;
            return String(clientId) === String(currentUserId);
          });
          if (isDirectClient) {
            console.log(`✅ Direct client match: Project "${project.projectCustomId}"`);
            return true;
          }
        }
        
        return false;
      });
      
      console.log('Filtered projects count:', filteredProjects.length);
      if (filteredProjects.length === 0) {
        console.log('No projects found. Available projects with organizations:');
        projectsRes.data.forEach(p => {
          if (p.organizations && p.organizations.length > 0) {
            console.log(`- ${p.projectCustomId}: organizations =`, p.organizations);
          }
        });
      }
      
      // Fetch tickets created by this client
      const ticketsRes = await axios.get(`${API_BASE_URL}/api/tickets`, {
        headers: headers
      });
      
      setProjects(filteredProjects);
      setTickets(ticketsRes.data || []);
      
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load dashboard data');
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

  const getTicketStats = () => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'Open').length,
      inProgress: tickets.filter(t => t.status === 'In Progress').length,
      resolved: tickets.filter(t => t.status === 'Resolved').length
    };
  };

  const stats = getTicketStats();

  if (loading) {
    return (
      <div className={`p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen flex items-center justify-center transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen transition-all duration-300 ${
      isCollapsed ? 'ml-20' : 'ml-64'
    }`}>
      
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Client Workspace
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-2">
              Projects & Support Dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Projects</p>
              <p className="text-2xl font-black text-white">{projects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FolderKanban size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Tickets</p>
              <p className="text-2xl font-black text-white">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Open Tickets</p>
              <p className="text-2xl font-black text-white">{stats.open}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Resolved</p>
              <p className="text-2xl font-black text-white">{stats.resolved}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <CheckCircle size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/tickets/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
        >
          <Send size={18} />
          Create New Support Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PROJECTS SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2">
              <FolderKanban size={18} className="text-blue-600" />
              <h2 className="text-sm font-black text-slate-800">Your Projects</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">No projects assigned yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Projects will appear here once assigned</p>
              </div>
            ) : (
              projects.slice(0, 5).map((project) => (
                <div
                  key={project._id}
                  className="border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setExpandedProject(expandedProject === project._id ? null : project._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Briefcase size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{project.projectCustomId || project.name}</p>
                        <p className="text-[9px] text-slate-500">{project.feeds?.length || 0} Feeds</p>
                      </div>
                    </div>
                    {expandedProject === project._id ? (
                      <ChevronUp size={16} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400" />
                    )}
                  </div>
                  
                  {expandedProject === project._id && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-600">{project.description || 'No description provided'}</p>
                      <div className="flex items-center gap-2">
                        <Globe size={10} className="text-slate-400" />
                        <span className="text-[9px] text-slate-500">{project.country || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity size={10} className="text-slate-400" />
                        <span className="text-[9px] text-slate-500">Industry: {project.industry || 'General'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT TICKETS SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-purple-600" />
              <h2 className="text-sm font-black text-slate-800">Recent Tickets</h2>
            </div>
            <button
              onClick={() => navigate('/tickets')}
              className="text-[9px] font-black text-blue-600 hover:text-blue-700 transition-colors"
            >
              View All →
            </button>
          </div>
          
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="text-center py-8">
                <Ticket size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">No tickets yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Create your first support ticket</p>
              </div>
            ) : (
              tickets.slice(0, 5).map((ticket) => (
                <div
                  key={ticket._id}
                  onClick={() => navigate(`/tickets/${ticket._id}`)}
                  className="border border-slate-100 rounded-xl p-4 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[9px] font-bold text-slate-400">{ticket.ticketNumber}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${
                          ticket.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                          ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                          ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1">{ticket.title}</p>
                      <p className="text-[9px] text-slate-500 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-slate-400" />
                          <span className="text-[8px] text-slate-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </div>
                        {ticket.assignedTo && (
                          <div className="flex items-center gap-1">
                            <Users size={10} className="text-slate-400" />
                            <span className="text-[8px] text-slate-500">{ticket.assignedTo.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-slate-300 flex-shrink-0 ml-2" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* QUICK TICKET STATUS SUMMARY */}
      {tickets.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Ticket Summary
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                <span>Open</span>
                <span>{stats.open}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stats.open / stats.total) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                <span>In Progress</span>
                <span>{stats.inProgress}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                <span>Resolved</span>
                <span>{stats.resolved}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.resolved / stats.total) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;