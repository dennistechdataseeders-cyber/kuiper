import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  FolderGit2, FileCode, FolderOpen, GitBranch, 
  ExternalLink, RefreshCw, ChevronRight, Home,
  GitFork, Copy, CheckCircle, Users, Mail, X,
  Send, Link as LinkIcon, AlertCircle, Info,
  UserPlus, Rocket
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const GitManager = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [repoContents, setRepoContents] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [developerEmails, setDeveloperEmails] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResults, setInviteResults] = useState([]);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [repoCollaborators, setRepoCollaborators] = useState([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showDirectInviteModal, setShowDirectInviteModal] = useState(false);
  const [directInviteEmail, setDirectInviteEmail] = useState('');
  const [directInvitePermission, setDirectInvitePermission] = useState('push');
  const [sendingDirectInvite, setSendingDirectInvite] = useState(false);
  
  const { isCollapsed } = useSidebar();
  const userRole = localStorage.getItem('role');
  const isManagerOrAdmin = userRole === 'Project Manager' || userRole === 'Admin';

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
    if (project.gitRepoUrl) {
      fetchRepoContents(project._id, '');
      
      // Only fetch invite link and collaborators for PM/Admin
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

  const openInviteModal = () => {
    setDeveloperEmails('');
    setCustomMessage('');
    setInviteResults([]);
    setShowInviteModal(true);
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
        // Refresh collaborators list
        await fetchCollaborators(selectedProject._id);
      } else if (res.data.inviteLink) {
        // If automatic addition failed, provide the invite link
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

  const sendBulkInvites = async () => {
    if (!developerEmails.trim()) {
      toast.error('Please enter at least one email address');
      return;
    }
    
    const emails = developerEmails.split(',').map(e => e.trim()).filter(e => e);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email format: ${invalidEmails.join(', ')}`);
      return;
    }
    
    setSendingInvites(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/admin/projects/${selectedProject._id}/bulk-invite`, {
        developerEmails: emails,
        customMessage: customMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInviteResults(res.data.results || []);
      const successCount = (res.data.results || []).filter(r => r.success).length;
      
      if (successCount > 0) {
        toast.success(`GitHub invitations sent to ${successCount} developer(s)`);
        // Refresh collaborators list
        await fetchCollaborators(selectedProject._id);
      }
      
      const failedCount = emails.length - successCount;
      if (failedCount > 0) {
        toast.error(`${failedCount} invitation(s) failed. Check results for details.`);
      }
      
    } catch (error) {
      console.error('Error sending invites:', error);
      toast.error(error.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSendingInvites(false);
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

  const projectsWithGit = projects.filter(p => p.gitRepoUrl);

  return (
    <div className={`min-h-screen bg-gray-70 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gray-900 rounded-xl">
              <GitFork size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Git Repository Manager</h1>
              <p className="text-gray-500 mt-1">Manage your project repositories and invite developers</p>
            </div>
          </div>
        </div>

        {/* Info Banner for Developers */}
        {!isManagerOrAdmin && selectedProject && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <GitBranch size={16} />
              Select Project
            </h2>
            <div className="flex items-center gap-2">
              {isManagerOrAdmin && selectedProject && (
                <button
                  onClick={openDirectInviteModal}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectsWithGit.map(project => (
                <div
                  key={project._id}
                  onClick={() => handleProjectSelect(project)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedProject?._id === project._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Repository Browser */}
        {selectedProject && selectedProject.gitRepoUrl && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Browser Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
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
                
                <div className="flex items-center gap-2">
                  {/* Invite buttons - only for PM/Admin */}
                  {isManagerOrAdmin && inviteLink && (
                    <>
                      <button
                        onClick={copyInviteLink}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                        title="Copy invite link"
                      >
                        {copiedInviteLink ? <CheckCircle size={14} className="text-green-600" /> : <LinkIcon size={14} />}
                        {copiedInviteLink ? 'Copied!' : 'Copy Invite Link'}
                      </button>
                      
                      <button
                        onClick={openInviteModal}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Mail size={14} />
                        Bulk Invite
                      </button>
                    </>
                  )}
                  
                  {currentPath && (
                    <button
                      onClick={navigateUp}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Home size={14} />
                      Up
                    </button>
                  )}
                  <button
                    onClick={() => fetchRepoContents(selectedProject._id, currentPath)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                  <a
                    href={selectedProject.gitRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Open on GitHub
                  </a>
                </div>
              </div>
            </div>

            {/* Contents List */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {repoContents.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleNavigate(item)}
                      className={`flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                        item.type === 'folder' ? 'hover:border-yellow-200' : 'hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getIcon(item.type, item.name)}
                        <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                      </div>
                      {item.type === 'folder' && (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Banner */}
            <div className="px-6 py-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
              <div className="flex items-center gap-2">
                <Rocket size={14} />
                <span>
                  When you invite a developer by email, GitHub will send them an invitation link.
                  The invitation email comes from <strong>noreply@github.com</strong>. 
                  The correct invite link format is: <strong>https://github.com/OWNER/REPO/invite</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Direct Invite Modal */}
      {showDirectInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <GitFork size={20} />
                Quick Invite Developer
              </h3>
              <button
                onClick={() => setShowDirectInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* Bulk Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Invite Developers</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Important Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-semibold">How it works:</p>
                    <p className="mt-1">
                      GitHub will send an invitation email to the developer directly. 
                      They must have a GitHub account with the same email address.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Invite Link Section */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 mb-2">Or share this link:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded border border-gray-200 truncate font-mono">
                    {inviteLink}
                  </code>
                  <button
                    onClick={copyInviteLink}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    {copiedInviteLink ? <CheckCircle size={14} /> : <Copy size={14} />}
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Developers can visit this link after logging into GitHub to accept the invitation.
                  Correct format: <strong>https://github.com/OWNER/REPO/invite</strong>
                </p>
              </div>

              <div className="border-t border-gray-200 my-2"></div>

              {/* Bulk Invite Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Developer Emails (comma separated)
                </label>
                <textarea
                  value={developerEmails}
                  onChange={(e) => setDeveloperEmails(e.target.value)}
                  placeholder="developer1@example.com, developer2@example.com"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate multiple emails with commas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal message to the invitation..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Results Display */}
              {inviteResults.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Send Results:</p>
                  {inviteResults.map((result, idx) => (
                    <div key={idx} className="text-xs py-1 flex items-center justify-between">
                      <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                        {result.success ? '✓' : '✗'} {result.email}
                      </span>
                      {!result.success && (
                        <span className="text-red-500 text-xs ml-2">({result.error || 'Failed'})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Info Note */}
              {inviteResults.length === 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      <strong>What developers need:</strong>
                      <br />• A GitHub account with the same email address
                      <br />• Check their email inbox (including spam) for GitHub's invitation
                      <br />• The invitation email comes from <strong>noreply@github.com</strong>
                      <br />• Invite link format: <strong>https://github.com/OWNER/REPO/invite</strong>
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={sendBulkInvites}
                disabled={sendingInvites}
                className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingInvites ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send GitHub Invitations
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                GitHub will send the invitation emails directly to the developers.
                The email will come from <strong>noreply@github.com</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {showCollaboratorsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users size={20} />
                Repository Collaborators
              </h3>
              <button
                onClick={() => setShowCollaboratorsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

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
              className="mt-4 w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitManager;