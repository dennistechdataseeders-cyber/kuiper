import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Activity,
  Users,
  UserPlus,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Hash,
  Clock,
  Calendar,
  GitFork,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  Loader2,
  User
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TeamLeadFeeds = () => {
  const { isCollapsed } = useSidebar();
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [developers, setDevelopers] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [expandedFeed, setExpandedFeed] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const token = localStorage.getItem('token');
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch projects where user is Team Lead
      const projectsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, authHeader);
      const projectsData = projectsRes.data.projects || [];
      setProjects(projectsData);

      // Extract all feeds from projects
      const allFeeds = [];
      projectsData.forEach(project => {
        if (project.feeds && project.feeds.length > 0) {
          project.feeds.forEach(feed => {
            allFeeds.push({
              ...feed,
              projectName: project.name,
              projectCustomId: project.projectCustomId,
              projectId: project._id
            });
          });
        }
      });
      setFeeds(allFeeds);

      // Fetch developers for assignment
      const devsRes = await axios.get(`${API_BASE_URL}/api/teamlead/developers`, authHeader);
      setDevelopers(devsRes.data.developers || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load feed data');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (feed) => {
    setSelectedFeed(feed);
    // Get the first assigned developer or null
    const currentDev = feed.assignedDevelopers && feed.assignedDevelopers.length > 0 
      ? feed.assignedDevelopers[0]._id || feed.assignedDevelopers[0]
      : null;
    setSelectedDeveloper(currentDev);
    setShowAssignModal(true);
  };

  const handleAssignDeveloper = async () => {
    if (!selectedFeed) return;
    setAssigning(true);
    try {
      // Send as array with single developer
      const developerIds = selectedDeveloper ? [selectedDeveloper] : [];
      await axios.patch(
        `${API_BASE_URL}/api/teamlead/feeds/${selectedFeed._id}/assign-developers`,
        { developerIds: developerIds },
        authHeader
      );
      
      const developerName = selectedDeveloper 
        ? developers.find(d => d._id === selectedDeveloper)?.name || 'Developer'
        : 'No developer';
      
      toast.success(`Feed assigned to ${developerName} successfully!`);
      setShowAssignModal(false);
      fetchData();
    } catch (err) {
      console.error('Error assigning developer:', err);
      toast.error(err.response?.data?.error || 'Failed to assign developer');
    } finally {
      setAssigning(false);
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

  const filteredFeeds = feeds.filter(feed => {
    const matchesSearch = 
      feed.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === 'ALL' || feed.projectId === selectedProject;
    return matchesSearch && matchesProject;
  });

  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);
  const currentFeeds = filteredFeeds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading feeds...</p>
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
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl">
                <Activity size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">Feed Management</h1>
                <p className="text-slate-500 mt-1">View and assign developers to feeds in your projects</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Total Feeds</p>
              <p className="text-2xl font-black text-slate-800">{feeds.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Assigned Developers</p>
              <p className="text-2xl font-black text-slate-800">
                {feeds.reduce((sum, feed) => sum + (feed.assignedDevelopers?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Unassigned Feeds</p>
              <p className="text-2xl font-black text-slate-800">
                {feeds.filter(f => !f.assignedDevelopers || f.assignedDevelopers.length === 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search feeds by name or project..."
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
          
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm font-medium text-slate-700 cursor-pointer appearance-none"
            >
              <option value="ALL">All Projects</option>
              {projects.map(project => (
                <option key={project._id} value={project._id}>
                  {project.projectCustomId}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Feeds Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Feed</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Type</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Assigned Developer</th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentFeeds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Activity size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">No feeds found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentFeeds.map((feed) => {
                  const isExpanded = expandedFeed === feed._id;
                  const assignedDev = feed.assignedDevelopers && feed.assignedDevelopers.length > 0 
                    ? feed.assignedDevelopers[0] 
                    : null;
                  const assignedDevName = assignedDev?.name || 'Unassigned';

                  return (
                    <React.Fragment key={feed._id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                              assignedDev 
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' 
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Activity size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{feed.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                                  {getFeedTypeIcon(feed.feedType)}
                                  {feed.feedType}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={12} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">{feed.projectCustomId}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {feed.feedType}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {assignedDev ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold">
                                {assignedDevName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-slate-700">{assignedDevName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 italic flex items-center gap-1.5">
                              <AlertCircle size={12} />
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openAssignModal(feed)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider"
                            >
                              <UserPlus size={12} />
                              {assignedDev ? 'Reassign' : 'Assign'}
                            </button>
                            <button
                              onClick={() => setExpandedFeed(isExpanded ? null : feed._id)}
                              className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Feed Details */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                  <Hash size={12} />
                                  Feed Details
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">ID</span>
                                    <span className="font-mono text-xs text-slate-700">{feed._id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Type</span>
                                    <span className="font-medium text-slate-700">{feed.feedType}</span>
                                  </div>
                                  {feed.feedType === 'Weekly' && feed.weekDay && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Day</span>
                                      <span className="font-medium text-slate-700">{feed.weekDay}</span>
                                    </div>
                                  )}
                                  {feed.feedType === 'Monthly' && feed.monthDay && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Day of Month</span>
                                      <span className="font-medium text-slate-700">{feed.monthDay}</span>
                                    </div>
                                  )}
                                  {feed.feedPlatform && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Platform</span>
                                      <span className="font-medium text-slate-700">{feed.feedPlatform}</span>
                                    </div>
                                  )}
                                  {feed.webDomain && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Domain</span>
                                      <span className="font-medium text-slate-700 truncate max-w-[200px]">{feed.webDomain}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Assigned Developer Info */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                  <User size={12} />
                                  Assigned Developer
                                </h4>
                                {assignedDev ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                                        {assignedDevName.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-bold text-slate-800">{assignedDevName}</p>
                                        <p className="text-xs text-slate-500">{assignedDev.email}</p>
                                      </div>
                                    </div>
                                    {assignedDev.githubLinked && assignedDev.githubUsername && (
                                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                                        <GitFork size={12} />
                                        <span className="font-medium">GitHub: {assignedDev.githubUsername}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-slate-400">
                                    <User size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm font-medium">No developer assigned</p>
                                    <button
                                      onClick={() => openAssignModal(feed)}
                                      className="mt-3 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                                    >
                                      Assign a developer →
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
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

      {/* ASSIGN MODAL - Single Developer Selection */}
      {showAssignModal && selectedFeed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-800">Assign Developer</h2>
                <p className="text-xs text-slate-500">
                  Feed: <span className="font-bold text-indigo-600">{selectedFeed.name}</span>
                </p>
                <p className="text-[10px] text-slate-400">
                  Project: {selectedFeed.projectCustomId}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  Select Developer {selectedDeveloper ? `(Current: ${developers.find(d => d._id === selectedDeveloper)?.name || 'None'})` : ''}
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2">
                  <div
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedDeveloper === null
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedDeveloper(null)}
                  >
                    <input
                      type="radio"
                      checked={selectedDeveloper === null}
                      onChange={() => setSelectedDeveloper(null)}
                      className="w-4 h-4 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">Unassigned</p>
                      <p className="text-[10px] text-slate-500">Remove current assignment</p>
                    </div>
                  </div>
                  
                  {developers.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No developers found</p>
                  ) : (
                    developers.map(dev => (
                      <div
                        key={dev._id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedDeveloper === dev._id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedDeveloper(dev._id)}
                      >
                        <input
                          type="radio"
                          checked={selectedDeveloper === dev._id}
                          onChange={() => setSelectedDeveloper(dev._id)}
                          className="w-4 h-4 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{dev.name}</p>
                            {dev.githubLinked && dev.githubUsername && (
                              <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <GitFork size={8} />
                                GitHub
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">{dev.email}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleAssignDeveloper}
                disabled={assigning}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {selectedDeveloper ? 'Assign Developer' : 'Remove Assignment'}
                  </>
                )}
              </button>
              
              <p className="text-[8px] text-slate-400 text-center">
                Only one developer can be assigned per feed. Select a developer or choose "Unassigned" to remove.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeadFeeds;