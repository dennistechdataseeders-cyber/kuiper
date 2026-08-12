// frontend/src/pages/TeamLeadProjects.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { 
  FolderKanban, Briefcase, Users, Activity,
  ChevronLeft, ChevronRight, Search, X,
  Filter, ChevronDown, Globe, LayoutGrid,
  MessageSquare, Eye, Send, Loader2, Clock,
  User, Paperclip, Image, File, Download, Trash2,
  CheckCircle, AlertCircle
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TeamLeadProjects = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate(); // Make sure navigate is imported
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Comment Modal State
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectComments, setProjectComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingComment, setDeletingComment] = useState(null);

  // File upload state for comments
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = React.useRef(null);

  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'Team Lead';

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ NEW: Navigate to TeamLeadFeeds with project filter
  // ============================================
  const navigateToFeedsWithProject = (project) => {
    navigate('/teamlead/feeds', {
      state: { 
        selectedProject: project._id,
        selectedProjectName: project.projectCustomId || project.name
      }
    });
  };

  // ============================================
  // COMMENT FUNCTIONS
  // ============================================

  const fetchProjectComments = async (projectId) => {
    setLoadingComments(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_BASE_URL}/api/comments/projects/${projectId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjectComments(res.data.comments || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const openCommentModal = async (project) => {
    setSelectedProject(project);
    setShowCommentModal(true);
    setNewComment('');
    setSelectedFiles([]);
    setFilePreviews([]);
    await fetchProjectComments(project._id);
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setSelectedProject(null);
    setProjectComments([]);
    setNewComment('');
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  // ============================================
  // FILE HANDLING FOR COMMENTS
  // ============================================

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.ppt', '.pptx', '.odp',
    '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
    '.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma',
    '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
    '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.sass',
    '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
    '.sh', '.bash', '.bat', '.ps1', '.cmd'
  ];

  const getFileExtension = (filename) => {
    if (!filename) return '';
    return '.' + filename.split('.').pop()?.toLowerCase() || '';
  };

  const isImageFile = (filename) => {
    if (!filename) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    return imageExtensions.includes(getFileExtension(filename));
  };

  const isAllowedFile = (file) => {
    const ext = getFileExtension(file.name);
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  const validateFile = (file) => {
    if (!isAllowedFile(file)) {
      toast.error(`File type "${file.name}" is not supported.`);
      return false;
    }

    const isImage = isImageFile(file.name);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    
    if (file.size > maxSize) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const maxSizeInMB = isImage ? '5MB' : '50MB';
      toast.error(`${file.name} (${sizeInMB}MB) exceeds the ${maxSizeInMB} size limit.`);
      return false;
    }

    return true;
  };

  const getFileIcon = (file) => {
    const filename = typeof file === 'string' ? file : (file?.originalName || file?.filename || file?.name || '');
    if (!filename) return <File size={16} className="text-slate-400" />;
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
      return <Image size={16} className="text-blue-500" />;
    }
    if (['pdf'].includes(ext)) return <FileText size={16} className="text-red-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileText size={16} className="text-blue-600" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={16} className="text-green-600" />;
    if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={16} className="text-amber-600" />;
    if (['txt'].includes(ext)) return <FileText size={16} className="text-slate-600" />;
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext)) {
      return <FileAudio size={16} className="text-pink-500" />;
    }
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return <FileVideo size={16} className="text-indigo-500" />;
    }
    if (['ppt', 'pptx'].includes(ext)) return <FileText size={16} className="text-orange-500" />;
    if (['js', 'py', 'java', 'json', 'xml'].includes(ext)) return <FileCode size={16} className="text-purple-500" />;
    return <File size={16} className="text-slate-400" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const getFileTypeLabel = (file) => {
    const filename = typeof file === 'string' ? file : (file?.originalName || file?.filename || file?.name || '');
    if (!filename) return 'File';
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap = {
      'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word',
      'xls': 'Excel', 'xlsx': 'Excel', 'csv': 'CSV',
      'txt': 'Text', 'zip': 'ZIP', 'rar': 'RAR',
      'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image',
      'gif': 'Image', 'webp': 'Image', 'mp4': 'Video',
      'avi': 'Video', 'mkv': 'Video', 'mov': 'Video',
      'mp3': 'Audio', 'wav': 'Audio', 'aac': 'Audio',
      'ppt': 'PowerPoint', 'pptx': 'PowerPoint'
    };
    return typeMap[ext] || 'File';
  };

  const processFiles = (files) => {
    const validFiles = [];
    const validPreviews = [];

    files.forEach(file => {
      if (validateFile(file)) {
        validFiles.push(file);
        
        let previewUrl = null;
        if (isImageFile(file.name)) {
          previewUrl = URL.createObjectURL(file);
        }
        
        validPreviews.push({
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: previewUrl,
          id: Date.now() + Math.random().toString(36).substr(2, 9)
        });
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...validPreviews]);
      
      const imageCount = validFiles.filter(f => isImageFile(f.name)).length;
      const docCount = validFiles.length - imageCount;
      
      let message = `${validFiles.length} file(s) added`;
      if (imageCount > 0 && docCount > 0) {
        message = `${imageCount} image(s) and ${docCount} document(s) added`;
      } else if (imageCount > 0) {
        message = `${imageCount} image(s) added`;
      } else {
        message = `${docCount} document(s) added`;
      }
      toast.success(message);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => {
      const removed = prev[index];
      if (removed && removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    
    const uploadedUrls = [];
    setUploadingFiles(true);
    const token = localStorage.getItem('token');

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/tickets/upload-file`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data.success) {
          uploadedUrls.push({
            url: response.data.url,
            filename: response.data.filename,
            originalName: response.data.originalName,
            size: response.data.size,
            type: response.data.type || (isImageFile(file.name) ? 'image' : 'document')
          });
        }
      } catch (error) {
        console.error('File upload failed:', error);
        toast.error(`Failed to upload ${file.name}: ${error.response?.data?.error || 'Unknown error'}`);
      }
    }

    setUploadingFiles(false);
    return uploadedUrls;
  };

  // ============================================
  // ADD COMMENT
  // ============================================

  const handleAddComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim() && selectedFiles.length === 0) {
      toast.error('Please enter a comment or attach a file');
      return;
    }

    setSubmittingComment(true);

    try {
      const token = localStorage.getItem('token');
      let uploadedFiles = [];

      if (selectedFiles.length > 0) {
        uploadedFiles = await uploadFiles();
      }

      const payload = {
        text: newComment.trim() || '📎 File(s) attached',
        files: uploadedFiles
      };

      const res = await axios.post(
        `${API_BASE_URL}/api/comments/projects/${selectedProject._id}/comments`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProjectComments(prev => [...prev, res.data.comment]);
      setNewComment('');
      setSelectedFiles([]);
      setFilePreviews([]);

      if (uploadedFiles.length > 0) {
        toast.success(`Comment added with ${uploadedFiles.length} attachment(s)`);
      } else {
        toast.success('Comment added successfully');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error(err.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ============================================
  // DELETE COMMENT
  // ============================================

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setDeletingComment(commentId);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE_URL}/api/comments/projects/${selectedProject._id}/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProjectComments(prev => prev.filter(c => c._id !== commentId));
      toast.success('Comment deleted successfully');
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error(err.response?.data?.error || 'Failed to delete comment');
    } finally {
      setDeletingComment(null);
    }
  };

  // ============================================
  // FORMAT HELPERS
  // ============================================

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const canDeleteComment = (comment) => {
    const commentUserId = comment.userId?._id || comment.userId;
    return userRole === 'Admin' || userRole === 'Project Manager' || userRole === 'Team Lead' || commentUserId === userId;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Once off': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Automation': return 'bg-teal-100 text-teal-700 border-teal-200';
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

  const filteredProjects = projects.filter(project => {
    const search = searchTerm.toLowerCase();
    return project.projectCustomId?.toLowerCase().includes(search) ||
           project.name?.toLowerCase().includes(search);
  });

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================
  // RENDER FILE ATTACHMENTS
  // ============================================

  const renderFileAttachments = (comment) => {
    const hasFiles = comment.files && comment.files.length > 0;
    if (!hasFiles) return null;

    return (
      <div className="mt-2 space-y-1.5">
        {comment.files.map((file, idx) => {
          const isImage = file.type === 'image' || 
                          (file.originalName && isImageFile(file.originalName)) ||
                          (file.filename && isImageFile(file.filename));
          const displayName = file.originalName || file.filename || 'Attachment';
          const fileUrl = file.url;

          if (!fileUrl) return null;

          return (
            <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-all group">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden">
                {isImage ? (
                  <img 
                    src={fileUrl} 
                    alt={displayName}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  getFileIcon(file)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-700 truncate" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[8px] text-slate-400 flex items-center gap-1">
                  {file.size && <span>{formatFileSize(file.size)}</span>}
                  {file.size && <span>•</span>}
                  <span>{getFileTypeLabel(file)}</span>
                </p>
              </div>
              <button
                onClick={() => window.open(fileUrl, '_blank')}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all"
                title={isImage ? "View image" : "Download file"}
              >
                {isImage ? <Eye size={12} /> : <Download size={12} />}
              </button>
            </div>
          );
        })}
      </div>
    );
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
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl">
            <FolderKanban size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">My Projects</h1>
            <p className="text-slate-500 mt-1">Projects where you are the Team Lead</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Projects</p>
              <p className="text-2xl font-black text-white">{projects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <LayoutGrid size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-black text-white">
                {projects.filter(p => p.projectStatus !== 'Closed').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">On Hold</p>
              <p className="text-2xl font-black text-white">
                {projects.filter(p => p.projectStatus?.includes('ON hold')).length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity size={18} className="text-white" />
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
            placeholder="Search by project ID or name..."
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

      {/* Projects Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Industry</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Country</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project Manager</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Feeds</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Comments</th>
              </tr>
            </thead>
            <tbody>
              {currentProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <FolderKanban size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">No projects found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentProjects.map((project) => (
                  <tr key={project._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                          <Briefcase size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{project.projectCustomId}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{project.name}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getStatusColor(project.projectStatus)}`}>
                        {project.projectStatus || 'New'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                        <Briefcase size={8} />
                        {project.industry || 'N/A'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                        <Globe size={8} />
                        {project.country || 'N/A'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">
                          {project.projectManager?.name || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div 
                        className="flex items-center gap-1.5 cursor-pointer group"
                        onClick={() => navigateToFeedsWithProject(project)}
                      >
                        <span className="text-sm font-black text-purple-600 group-hover:text-blue-600 transition-colors">
                          {project.feeds?.length || 0}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                          View Feeds →
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => openCommentModal(project)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider"
                      >
                        <MessageSquare size={14} />
                        Comments
                      </button>
                    </td>
                  </tr>
                ))
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
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
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

      {/* ============================================
          COMMENT MODAL
          ============================================ */}
      {showCommentModal && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[200] p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <MessageSquare size={20} className="text-purple-600" />
                  Project Comments
                </h2>
                <p className="text-sm text-slate-500 truncate max-w-[300px]">
                  {selectedProject.projectCustomId} • {selectedProject.name}
                </p>
              </div>
              <button
                onClick={closeCommentModal}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {/* Comments List */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-4">
                {loadingComments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="text-slate-400 animate-spin" />
                  </div>
                ) : projectComments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">No comments yet</p>
                    <p className="text-xs">Start the conversation</p>
                  </div>
                ) : (
                  projectComments.map((comment) => {
                    const commenterName = comment.userName || comment.userId?.name || 'Unknown User';
                    const isOwn = comment.userId?._id === userId || comment.userId === userId;
                    const canDelete = canDeleteComment(comment);
                    const hasFiles = comment.files && comment.files.length > 0;

                    return (
                      <div
                        key={comment._id}
                        className={`p-4 rounded-xl border ${isOwn ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'} transition-all`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${isOwn ? 'bg-purple-600' : 'bg-slate-400'}`}>
                                {getInitials(commenterName)}
                              </div>
                              <span className="font-bold text-sm text-slate-800">
                                {commenterName}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock size={10} />
                                {formatTime(comment.createdAt)}
                              </span>
                              {isOwn && (
                                <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                              {comment.userId?.role && !isOwn && (
                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${
                                  comment.userId.role === 'Project Manager' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : comment.userId.role === 'Developer'
                                    ? 'bg-blue-100 text-blue-700'
                                    : comment.userId.role === 'Team Lead'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {comment.userId.role}
                                </span>
                              )}
                            </div>
                            
                            {comment.text && (
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                {comment.text}
                              </div>
                            )}
                            
                            {hasFiles && renderFileAttachments(comment)}
                          </div>
                          
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              disabled={deletingComment === comment._id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0 disabled:opacity-50"
                              title="Delete comment"
                            >
                              {deletingComment === comment._id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Form */}
              <div className="border-t border-slate-100 pt-4">
                {filePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                    {filePreviews.map((preview, idx) => (
                      <div key={preview.id || idx} className="relative group">
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                            {preview.file.type?.startsWith('image/') || isImageFile(preview.name) ? (
                              <img 
                                src={preview.preview || URL.createObjectURL(preview.file)} 
                                alt={preview.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              getFileIcon({ name: preview.name })
                            )}
                          </div>
                          <div className="min-w-0 max-w-[120px]">
                            <p className="text-[10px] font-semibold text-slate-700 truncate">{preview.name}</p>
                            <p className="text-[8px] text-slate-400">{formatFileSize(preview.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md opacity-0 group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddComment} className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment... (attachments supported)"
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-purple-400 transition-all resize-none min-h-[48px] max-h-[100px]"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newComment.trim() || selectedFiles.length > 0) {
                            handleAddComment(e);
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFiles}
                      className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50"
                      title="Attach files (images up to 5MB, documents up to 50MB)"
                    >
                      <Paperclip size={18} />
                    </button>
                    
                    <button
                      type="submit"
                      disabled={submittingComment || uploadingFiles}
                      className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                    >
                      {submittingComment ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </form>
                
                <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-2">
                  <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
                  <span>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="text-purple-500 hover:underline"
                    >
                      Attach files
                    </button>
                    {' '}(Images: 5MB • Files: 50MB)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeadProjects;