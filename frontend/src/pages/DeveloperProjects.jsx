import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  Layout, Briefcase, Globe, Calendar, Clock, Users,
  ChevronLeft, ChevronRight, Search, X, ExternalLink,
  Activity, Hash, Database
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DeveloperProjects = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/dev/my-projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const search = searchTerm.toLowerCase();
    return (
      project.projectCustomId?.toLowerCase().includes(search) ||
      project.name?.toLowerCase().includes(search) ||
      project.industry?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getFeedCount = (project) => {
    return project.feeds?.length || 0;
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
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
                <Layout size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">My Projects</h1>
                <p className="text-slate-500 mt-1">View all projects you're assigned to</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Layout size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Total Projects</p>
              <p className="text-2xl font-black text-slate-800">{projects.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Database size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Total Feeds</p>
              <p className="text-2xl font-black text-slate-800">
                {projects.reduce((acc, p) => acc + (p.feeds?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Globe size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Active Projects</p>
              <p className="text-2xl font-black text-slate-800">{projects.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by ID, name, or industry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
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

      {/* Projects Grid */}
      {currentProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Layout size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-500">No projects found</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentProjects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                      <Briefcase size={20} />
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-full">
                      {getFeedCount(project)} Feeds
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-black text-slate-800 mb-1">{project.projectCustomId}</h3>
                  <p className="text-[10px] text-slate-500 mb-3 line-clamp-2">{project.name}</p>
                  
                  <div className="space-y-2 mb-4">
                    {project.industry && (
                      <div className="flex items-center gap-2">
                        <Activity size={12} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-600">Industry: {project.industry}</span>
                      </div>
                    )}
                    {project.country && (
                      <div className="flex items-center gap-2">
                        <Globe size={12} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-600">Country: {project.country}</span>
                      </div>
                    )}
                    {project.projectManager && (
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-600">PM: {project.projectManager.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* View Details button removed */}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
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
                    pageNum = currentPage - 2 + i;
                    if (i === 0) pageNum = 1;
                    if (i === 4) pageNum = totalPages;
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
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeveloperProjects;