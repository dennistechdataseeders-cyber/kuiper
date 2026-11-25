import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Globe,
  Briefcase,
  LayoutGrid,
  Building2,
  Users,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const AdminProjectClients = () => {
  const [projects, setProjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Stats
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalOrganizations: 0,
    activeProjects: 0,
    closedProjects: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [projectsRes, orgsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/admin/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);

      const projectsData = projectsRes.data;
      const orgsData = orgsRes.data || [];
      
      setProjects(projectsData);
      setOrganizations(orgsData);

      // Calculate stats - using organizations field
      const totalOrganizations = projectsData.reduce((sum, p) => sum + (p.organizations?.length || 0), 0);
      const activeProjects = projectsData.filter(p => p.projectStatus !== 'Closed').length;
      const closedProjects = projectsData.filter(p => p.projectStatus === 'Closed').length;

      setStats({
        totalProjects: projectsData.length,
        totalOrganizations,
        activeProjects,
        closedProjects
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Get unique statuses for filter
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
        (project.organizations || []).some(org => {
          const orgName = typeof org === 'object' ? org?.companyName : organizations.find(o => o._id === org)?.companyName;
          return orgName?.toLowerCase().includes(search);
        })
      );
    }
    
    if (selectedStatus !== 'ALL') {
      result = result.filter(p => p.projectStatus === selectedStatus);
    }
    
    return result;
  }, [projects, organizations, searchTerm, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus]);

  // Helper function to get organization name
  const getOrgName = (org) => {
    if (typeof org === 'object') return org?.companyName;
    const found = organizations.find(o => o._id === org);
    return found?.companyName || 'Unknown Organization';
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-700';
      case 'Once off': return 'bg-purple-100 text-purple-700';
      case 'Ad hoc': return 'bg-amber-100 text-amber-700';
      case 'BAU Initiated': return 'bg-emerald-100 text-emerald-700';
      case 'BAU Not Initiated': return 'bg-gray-100 text-gray-700';
      case 'ON hold[Sales]': return 'bg-orange-100 text-orange-700';
      case 'ON hold[Technical]': return 'bg-red-100 text-red-700';
      case 'ON hold[Client]': return 'bg-yellow-100 text-yellow-700';
      case 'Closed': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('ALL');
  };

  if (loading) {
    return (
      <div className="page bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page bg-slate-50">
      
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="page-title">
              Project Clients
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              View all projects and their assigned client organizations
            </p>
          </div>
          <button
            onClick={fetchData}
            className="btn btn-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Total Projects</p>
              <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <LayoutGrid size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Organization Assignments</p>
              <p className="text-2xl font-bold text-white">{stats.totalOrganizations}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Active Projects</p>
              <p className="text-2xl font-bold text-white">{stats.activeProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Closed Projects</p>
              <p className="text-2xl font-bold text-white">{stats.closedProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Briefcase size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase text-slate-500">Filters</span>
          </div>
          {(searchTerm || selectedStatus !== 'ALL') && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <X size={12} />
              Clear all
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project ID, name, or client organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input cursor-pointer"
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Statuses' : status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Table - Updated to use organizations field */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="table-scroll table-sticky-first overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="th">Project</th>
                <th className="th">Client Organizations</th>
                <th className="th">Status</th>
                <th className="th">Industry</th>
                <th className="th">Country</th>
                <th className="th">Project Manager</th>
              </tr>
            </thead>
            <tbody>
              {currentProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mb-4 shrink-0">
                        <Briefcase size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-400">No projects found</p>
                      <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentProjects.map((project) => {
                  const orgList = project.organizations || [];
                  
                  return (
                    <tr key={project._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                            <Briefcase size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{project.projectCustomId}</p>
                            <p className="text-xs text-slate-400 md:truncate md:max-w-[200px]">{project.name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {orgList.length > 0 ? (
                            orgList.slice(0, 3).map((org, idx) => (
                              <span
                                key={idx}
                                className="badge bg-purple-50 text-purple-700"
                              >
                                <Building2 size={12} />
                                {getOrgName(org)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No organizations assigned</span>
                          )}
                          {orgList.length > 3 && (
                            <span className="text-xs font-semibold text-slate-400">+{orgList.length - 3} more</span>
                          )}
                        </div>
                      </td>

                      <td className="td">
                        <span className={`badge ${getStatusColor(project.projectStatus)}`}>
                          {project.projectStatus || 'New'}
                        </span>
                      </td>

                      <td className="td">
                        <span className="badge bg-blue-50 text-blue-700">
                          <Briefcase size={12} />
                          {project.industry || 'N/A'}
                        </span>
                      </td>

                      <td className="td">
                        <span className="badge bg-slate-100 text-slate-600">
                          <Globe size={12} />
                          {project.country || 'N/A'}
                        </span>
                      </td>

                      <td className="td">
                        <span className="text-xs font-medium text-slate-600">
                          {project.projectManager?.name || 'Unassigned'}
                        </span>
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
            className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
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
                return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">...</span>;
              }
              
              if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">...</span>;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`btn-icon ${
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
            className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminProjectClients;