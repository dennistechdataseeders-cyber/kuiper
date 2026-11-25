import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  FolderGit2, FileCode, FolderOpen, GitBranch, 
  ExternalLink, RefreshCw, ChevronRight, Home,
  GitFork, Copy, CheckCircle, Users, Mail, X,
  Send, Link as LinkIcon, AlertCircle, Info,
  UserPlus, Rocket, Search, ChevronLeft,
  Clock, Hash
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { isPMRole } from '../utils/roles';

const GitManager = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [repoContents, setRepoContents] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [repoCollaborators, setRepoCollaborators] = useState([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showDirectInviteModal, setShowDirectInviteModal] = useState(false);
  const [directInviteEmail, setDirectInviteEmail] = useState('');
  const [directInvitePermission, setDirectInvitePermission] = useState('push');
  const [sendingDirectInvite, setSendingDirectInvite] = useState(false);
  
  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const userRole = localStorage.getItem('role');
  const isManagerOrAdmin = isPMRole(userRole) || userRole === 'Admin';

  // Helper function to format date as dd/mm/yyyy
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return 'N/A';
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepoContents = async (projectId, path = '') => {
    setLoadingContents(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/projects/${projectId}/repo-contents`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path }
      });
      
      if (res.data.success) {
        setRepoContents(res.data.contents);
        setCurrentPath(path);
      } else {
        toast.error(res.data.error || 'Failed to load repository contents');
      }
    } catch (error) {
      console.error('Error fetching repo contents:', error);
      toast.error('Failed to load repository contents');
    } finally {
      setLoadingContents(false);
    }
  };

  const fetchCollaborators = async (projectId) => {
    setLoadingCollaborators(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/projects/${projectId}/collaborators`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setRepoCollaborators(res.data.collaborators || []);
      } else {
        setRepoCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      setRepoCollaborators([]);
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setCurrentPage(1);
    if (project.gitRepoUrl) {
      fetchRepoContents(project._id, '');
      
      if (isManagerOrAdmin) {
        try {
          const token = localStorage.getItem('token');
          const [inviteRes, collabRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/admin/projects/${project._id}/invite-link`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get(`${API_BASE_URL}/api/admin/projects/${project._id}/collaborators`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ]);
          
          if (inviteRes.data.success) {
            setInviteLink(inviteRes.data.inviteLink);
          }
          
          if (collabRes.data.success) {
            setRepoCollaborators(collabRes.data.collaborators || []);
          }
        } catch (error) {
          console.error('Error fetching project data:', error);
          setInviteLink(null);
        }
      }
    } else {
      toast.info('No Git repository linked to this project');
      setRepoContents([]);
      setInviteLink(null);
    }
  };

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopiedInviteLink(true);
        toast.success('Invite link copied to clipboard!');
        setTimeout(() => setCopiedInviteLink(false), 2000);
      } catch (err) {
        toast.error('Failed to copy link');
      }
    }
  };

  const openDirectInviteModal = () => {
    setDirectInviteEmail('');
    setDirectInvitePermission('push');
    setShowDirectInviteModal(true);
  };

  const sendDirectInvite = async () => {
    if (!directInviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(directInviteEmail)) {
      toast.error('Invalid email format');
      return;
    }

    setSendingDirectInvite(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/admin/projects/${selectedProject._id}/add-collaborator`, {
        email: directInviteEmail,
        permission: directInvitePermission
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        toast.success(`Invitation sent to ${directInviteEmail}`);
        setShowDirectInviteModal(false);
        setDirectInviteEmail('');
        await fetchCollaborators(selectedProject._id);
      } else if (res.data.inviteLink) {
        toast.info(`Could not auto-invite ${directInviteEmail}. Please share this invite link with them.`);
        await navigator.clipboard.writeText(res.data.inviteLink);
        toast.success('Invite link copied to clipboard!');
      } else {
        toast.error(res.data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending direct invite:', error);
      toast.error(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSendingDirectInvite(false);
    }
  };

  const handleNavigate = (item) => {
    if (item.type === 'folder') {
      const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      fetchRepoContents(selectedProject._id, newPath);
    }
  };

  const navigateUp = () => {
    const newPath = currentPath.split('/').slice(0, -1).join('/');
    fetchRepoContents(selectedProject._id, newPath);
  };

  const getIcon = (type, name) => {
    if (type === 'folder') return <FolderOpen size={18} className="text-yellow-500" />;
    if (name.endsWith('.js') || name.endsWith('.jsx')) return <FileCode size={18} className="text-blue-500" />;
    if (name.endsWith('.md')) return <FileCode size={18} className="text-green-500" />;
    if (name.endsWith('.json')) return <FileCode size={18} className="text-purple-500" />;
    if (name.endsWith('.css') || name.endsWith('.scss')) return <FileCode size={18} className="text-pink-500" />;
    return <FileCode size={18} className="text-gray-500" />;
  };

  // Get projects with Git repositories
  const projectsWithGit = projects.filter(p => p.gitRepoUrl);

  // Filter projects based on search term
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projectsWithGit;
    
    const search = searchTerm.toLowerCase().trim();
    return projectsWithGit.filter(project => {
      const projectId = project.projectCustomId?.toLowerCase() || '';
      const projectName = project.name?.toLowerCase() || '';
      const repoName = project.gitRepoName?.toLowerCase() || '';
      
      return projectId.includes(search) || 
             projectName.includes(search) || 
             repoName.includes(search);
    });
  }, [projectsWithGit, searchTerm]);

  // Pagination for projects
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="page bg-gray-70">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gray-900 rounded-xl">
              <GitFork size={24} className="text-white" />
            </div>
            <div>
              <h1 className="page-title">Git Repository Manager</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your project repositories and invite developers</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-6">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by project ID (e.g., 0016) or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="btn-icon absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 right-0 md:right-1"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Info Banner for Developers */}
        {!isManagerOrAdmin && selectedProject && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 sm:mb-6">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Repository Access</p>
                <p className="text-xs mt-1">
                  You have been added as a collaborator. Check your email (the one associated with your GitHub account) 
                  for an invitation from GitHub (noreply@github.com). Click the link to accept and start contributing.
                </p>
                <p className="text-xs mt-2">
                  If you don't see the email, check your spam folder or ask your Project Manager to resend the invitation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Project Selection */}
        <div className="card mb-4 sm:mb-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="section-title flex items-center gap-2">
              <GitBranch size={16} />
              Select Project
              {searchTerm && (
                <span className="text-xs text-gray-400 font-normal ml-2">
                  (Filtered: {filteredProjects.length} projects)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {isManagerOrAdmin && selectedProject && (
                <button
                  onClick={openDirectInviteModal}
                  className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  <GitFork size={12} />
                  Quick Invite
                </button>
              )}
              {isManagerOrAdmin && selectedProject && repoCollaborators.length > 0 && (
                <button
                  onClick={() => setShowCollaboratorsModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Users size={12} />
                  {repoCollaborators.length} Collaborator(s)
                </button>
              )}
            </div>
          </div>
          
          {projectsWithGit.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FolderGit2 size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No projects with Git repositories yet</p>
              <p className="text-sm mt-1">Create a project to automatically create a GitHub repository</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No projects match your search</p>
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {paginatedProjects.map(project => (
                  <div
                    key={project._id}
                    onClick={() => handleProjectSelect(project)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedProject?._id === project._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <FolderGit2 size={20} className="text-gray-700" />
                      {project.gitRepoUrl && (
                        <a
                          href={project.gitRepoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {project.projectCustomId || project.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {project.gitRepoName}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>Updated: {formatDate(project.updatedAt || project.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <>
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="btn-icon border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div className="flex gap-1">
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
                          return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-gray-400 text-xs shrink-0">...</span>;
                        }
                        
                        if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                          return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-gray-400 text-xs shrink-0">...</span>;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`btn-icon ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-icon border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  <div className="mt-3 text-center text-xs text-gray-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProjects.length)} of {filteredProjects.length} projects
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Repository Browser */}
        {selectedProject && selectedProject.gitRepoUrl && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <FolderGit2 size={18} className="text-gray-600" />
                  <span className="font-semibold text-gray-800">
                    {selectedProject.projectCustomId || selectedProject.name}
                  </span>
                  {currentPath && (
                    <div className="flex items-center text-gray-400 text-sm ml-2">
                      <ChevronRight size={14} />
                      <span className="ml-1 text-gray-600">{currentPath}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {isManagerOrAdmin && inviteLink && (
                    <button
                      onClick={copyInviteLink}
                      className="btn btn-sm border border-gray-300 hover:bg-gray-70"
                    >
                      {copiedInviteLink ? <CheckCircle size={14} className="text-green-600" /> : <LinkIcon size={14} />}
                      {copiedInviteLink ? 'Copied!' : 'Copy Invite Link'}
                    </button>
                  )}
                  
                  {currentPath && (
                    <button
                      onClick={navigateUp}
                      className="btn btn-sm text-gray-600 hover:bg-gray-100"
                    >
                      <Home size={14} />
                      Up
                    </button>
                  )}
                  <button
                    onClick={() => fetchRepoContents(selectedProject._id, currentPath)}
                    className="btn btn-sm text-gray-600 hover:bg-gray-100"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                  <a
                    href={selectedProject.gitRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm bg-gray-900 text-white hover:bg-gray-800"
                  >
                    <ExternalLink size={14} />
                    Open on GitHub
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4">
              {loadingContents ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : repoContents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen size={48} className="mx-auto mb-3 text-gray-300" />
                  <p>No files or folders found</p>
                  {!currentPath && (
                    <p className="text-sm mt-1">Feeds will appear as folders when created</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {repoContents.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleNavigate(item)}
                      className={`flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                        item.type === 'folder' ? 'hover:border-yellow-200' : 'hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getIcon(item.type, item.name)}
                        <span className="text-sm text-gray-700 font-medium min-w-0 break-all">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.type === 'folder' && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(item.updated_at || item.created_at)}
                          </span>
                        )}
                        {item.type === 'folder' && (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
              <div className="flex items-start gap-2">
                <Rocket size={14} className="shrink-0" />
                <span>
                  When you invite a developer by email, GitHub will send them an invitation link.
                  The invitation email comes from <strong>noreply@github.com</strong>. 
                  The correct invite link format is: <strong>https://github.com/OWNER/REPO/invitations</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Direct Invite Modal */}
      {showDirectInviteModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="modal-header">
              <h3 className="section-title flex items-center gap-2">
                <GitFork size={20} />
                Quick Invite Developer
              </h3>
              <button
                onClick={() => setShowDirectInviteModal(false)}
                className="btn-icon text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold">GitHub will send an invitation email to:</p>
                    <p className="mt-1">
                      The developer must have a GitHub account with the same email address.
                      If not, share the invite link manually.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label block mb-1.5">
                  Developer Email
                </label>
                <input
                  type="email"
                  value={directInviteEmail}
                  onChange={(e) => setDirectInviteEmail(e.target.value)}
                  placeholder="developer@example.com"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="label block mb-1.5">
                  Permission Level
                </label>
                <select
                  value={directInvitePermission}
                  onChange={(e) => setDirectInvitePermission(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="push">Write (Push) - Can push to branches</option>
                  <option value="pull">Read (Pull) - Can only view and clone</option>
                  <option value="admin">Admin - Full repository access</option>
                </select>
              </div>

              <button
                onClick={sendDirectInvite}
                disabled={sendingDirectInvite}
                className="btn btn-md w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingDirectInvite ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Invitation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {showCollaboratorsModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="modal-header">
              <h3 className="section-title flex items-center gap-2">
                <Users size={20} />
                Repository Collaborators
              </h3>
              <button
                onClick={() => setShowCollaboratorsModal(false)}
                className="btn-icon text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
            {loadingCollaborators ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : repoCollaborators.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-3 text-gray-300" />
                <p>No collaborators yet</p>
                <p className="text-sm mt-1">Invite developers using the buttons above</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {repoCollaborators.map((collab, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{collab.username}</p>
                      <p className="text-xs text-gray-500">
                        Permissions: {Object.keys(collab.permissions).filter(k => collab.permissions[k]).join(', ')}
                      </p>
                    </div>
                    <CheckCircle size={16} className="text-green-600" />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowCollaboratorsModal(false)}
              className="btn btn-md mt-4 w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitManager;