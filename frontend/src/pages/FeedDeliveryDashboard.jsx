// frontend/src/pages/FeedDeliveryDashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Activity, Search, ChevronRight } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const FeedDeliveryDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      
      // Determine which endpoint to use based on role
      if (userRole === 'Client') {
        endpoint = '/api/client/projects';
      } else if (userRole === 'Project Manager') {
        endpoint = '/api/admin/projects';
      } else if (userRole === 'Developer') {
        endpoint = '/api/dev/my-projects';
      } else if (userRole === 'Team Lead') {
        endpoint = '/api/teamlead/my-projects';
      } else {
        endpoint = '/api/admin/projects';
      }
      
      const res = await axios.get(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle different response formats
      let projectsData = res.data;
      if (userRole === 'Developer') {
        projectsData = res.data;
      } else if (userRole === 'Team Lead') {
        projectsData = res.data.projects || [];
      } else {
        projectsData = res.data || [];
      }
      
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects by search term
  const filteredProjects = projects.filter(project =>
    project.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get role-specific display text
  const getDisplayText = () => {
    switch(userRole) {
      case 'Client': return 'Monitor feed delivery for your projects';
      case 'Project Manager': return 'Monitor feed delivery for your managed projects';
      case 'Developer': return 'Monitor feed delivery for your assigned feeds';
      case 'Team Lead': return 'Monitor feed delivery for your team projects';
      default: return 'Monitor feed delivery status';
    }
  };

  // Get navigation path based on role
  const getProjectFeedPath = (projectId) => {
    switch(userRole) {
      case 'Client':
        return `/client/projects/${projectId}/feeds`;
      case 'Project Manager':
        return `/pm/projects/${projectId}/feeds`;
      case 'Developer':
        return `/developer/projects/${projectId}/feeds`;
      case 'Team Lead':
        return `/teamlead/projects/${projectId}/feeds`;
      default:
        return `/client/projects/${projectId}/feeds`;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feed Delivery Status</h1>
          <p className="text-gray-500 mt-1">{getDisplayText()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
          />
        </div>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => {
            const projectId = project._id || project.id;
            
            return (
              <div
                key={projectId}
                onClick={() => {
                  const path = getProjectFeedPath(projectId);
                  console.log('🔍 Navigating to:', path);
                  navigate(path, { 
                    state: { 
                      projectName: project.projectCustomId || project.name,
                      projectCustomId: project.projectCustomId,
                      userRole: userRole 
                    } 
                  });
                }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                    <FolderKanban size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {project.projectCustomId || project.name}
                    </p>
                    <p className="text-xs text-slate-500">{project.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Click to view feeds</span>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No projects available for your role.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedDeliveryDashboard;