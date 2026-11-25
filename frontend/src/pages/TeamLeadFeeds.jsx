// frontend/src/pages/TeamLeadFeeds.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  FileSpreadsheet,
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
  User,
  MessageSquare,
  Eye,
  Send,
  Paperclip,
  Image,
  File,
  Download,
  Trash2,
  Ticket,
  AlertTriangle,
  FileText, FileArchive, FileAudio, FileVideo, FileCode
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { isPMRole } from '../utils/roles';

const TeamLeadFeeds = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  // ============================================
  // 🆕 FEED STATUS STATE
  // ============================================
  const [feedStatusOptions, setFeedStatusOptions] = useState([]);
  const [updatingFeedStatus, setUpdatingFeedStatus] = useState({});

  // ============================================
  // 🆕 TICKET MODAL STATE
  // ============================================
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketFeed, setSelectedTicketFeed] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'Medium'
  });
  const [generatingTicket, setGeneratingTicket] = useState(false);

  // Comment Modal State
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedFeedForComments, setSelectedFeedForComments] = useState(null);
  const [feedComments, setFeedComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingComment, setDeletingComment] = useState(null);

  // File upload state for comments
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = React.useRef(null);

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // ============================================
  // 🆕 FEED STATUS FUNCTIONS
  // ============================================

  const getFeedStatusColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (status === 'New') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'In process') return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (status === 'Awaiting Client Approval') return 'bg-pink-100 text-pink-700 border-pink-200';
    if (status.includes('In progress')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status.includes('Delivered')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'BAU Initiated') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (status === 'Closed') return 'bg-slate-100 text-slate-700 border-slate-200';
    if (status.includes('ON hold')) {
      if (status.includes('Sales')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (status.includes('Technical')) return 'bg-red-100 text-red-700 border-red-200';
      if (status.includes('Client')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const fetchFeedStatusOptions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/feed-status-options`, authHeader);
      setFeedStatusOptions(res.data);
    } catch (err) {
      console.error('Error fetching feed status options:', err);
    }
  };

  const updateFeedStatus = async (feedId, newStatus) => {
    setUpdatingFeedStatus(prev => ({ ...prev, [feedId]: true }));
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/feeds/${feedId}/status`,
        { feedStatus: newStatus },
        authHeader
      );
      toast.success(`Feed status updated to ${newStatus}`);

      // Update local state
      setFeeds(prev => prev.map(feed =>
        feed._id === feedId ? { ...feed, feedStatus: newStatus } : feed
      ));
    } catch (err) {
      console.error('Error updating feed status:', err);
      toast.error(err.response?.data?.error || 'Failed to update feed status');
    } finally {
      setUpdatingFeedStatus(prev => ({ ...prev, [feedId]: false }));
    }
  };

  // ============================================
  // 🆕 TICKET FUNCTIONS
  // ============================================

  const openTicketModal = (feed) => {
    setSelectedTicketFeed(feed);
    setTicketForm({
      title: `Issue with feed: ${feed.name}`,
      description: `Feed: ${feed.name}\nProject: ${feed.projectCustomId || feed.projectName}\nFeed ID: ${feed._id}\n\nDescription :\n`,
      priority: 'Medium'
    });
    setShowTicketModal(true);
  };

  const closeTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicketFeed(null);
    setTicketForm({
      title: '',
      description: '',
      priority: 'Medium'
    });
  };

  const handleGenerateTicket = async () => {
    if (!ticketForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!ticketForm.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setGeneratingTicket(true);

    try {
      const payload = {
        title: ticketForm.title,
        description: ticketForm.description,
        priority: ticketForm.priority,
        projectId: selectedTicketFeed.projectId,
        feedId: selectedTicketFeed._id,
        category: 'Production',
        subcategory: 'Data Extraction',
        subItem: 'Feed Issue',
        isInternal: true
      };

      const response = await axios.post(`${API_BASE_URL}/api/tickets`, payload, authHeader);

      const ticketNumber = response.data.ticket?.ticketNumber || '';
      toast.success(`Ticket ${ticketNumber} generated successfully for feed: ${selectedTicketFeed.name}`);
      closeTicketModal();

      const ticketId = response.data.ticket?._id || selectedTicketFeed._id;
      navigate(`/tickets/${ticketId}`);

    } catch (err) {
      console.error('Error generating ticket:', err);
      toast.error(err.response?.data?.error || 'Failed to generate ticket');
    } finally {
      setGeneratingTicket(false);
    }
  };

  // ============================================
  // COMMENT FUNCTIONS
  // ============================================

  const fetchFeedComments = async (feedId) => {
    setLoadingComments(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/comments/feeds/${feedId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedComments(res.data.comments || []);
    } catch (err) {
      console.error('Error fetching feed comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const openCommentModal = async (feed) => {
    setSelectedFeedForComments(feed);
    setShowCommentModal(true);
    setNewComment('');
    setSelectedFiles([]);
    setFilePreviews([]);
    await fetchFeedComments(feed._id);
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setSelectedFeedForComments(null);
    setFeedComments([]);
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
        `${API_BASE_URL}/api/comments/feeds/${selectedFeedForComments._id}/comments`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setFeedComments(prev => [...prev, res.data.comment]);
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
        `${API_BASE_URL}/api/comments/feeds/${selectedFeedForComments._id}/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setFeedComments(prev => prev.filter(c => c._id !== commentId));
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
    return userRole === 'Admin' || isPMRole(userRole) || userRole === 'Team Lead' || commentUserId === userId;
  };

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
                <p className="text-xs font-semibold text-slate-700 truncate" title={displayName}>
                  {displayName}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  {file.size && <span>{formatFileSize(file.size)}</span>}
                  {file.size && <span>•</span>}
                  <span>{getFileTypeLabel(file)}</span>
                </p>
              </div>
              <button
                onClick={() => window.open(fileUrl, '_blank')}
                className="btn-icon hover:bg-slate-100 text-slate-400 hover:text-blue-600"
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

  // ============================================
  // MAIN COMPONENT FUNCTIONS
  // ============================================

  useEffect(() => {
    const projectIdFromState = location.state?.selectedProject;
    const projectNameFromState = location.state?.selectedProjectName;

    if (projectIdFromState) {
      console.log(`🔍 Filtering feeds for project: ${projectNameFromState || projectIdFromState}`);
      setSelectedProject(projectIdFromState);
    }

    fetchData();
    fetchFeedStatusOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projectsRes = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, authHeader);
      const projectsData = projectsRes.data.projects || [];
      setProjects(projectsData);

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
      case 'Daily': return <Clock size={12} />;
      case 'Weekly': return <Calendar size={12} />;
      case 'Monthly': return <Calendar size={12} />;
      default: return <Activity size={12} />;
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
      <div className="page bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl">
                <Activity size={24} className="text-white" />
              </div>
              <div>
                <h1 className="page-title">Feed Management</h1>
                <p className="text-sm text-slate-500 mt-1">View and assign developers to feeds in your projects</p>
              </div>
            </div>
          </div>

          {location.state?.selectedProjectName && selectedProject !== 'ALL' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                Filtered: {location.state.selectedProjectName}
              </span>
              <button
                onClick={() => {
                  setSelectedProject('ALL');
                  window.history.replaceState({}, document.title);
                }}
                className="btn-icon text-indigo-400 hover:text-indigo-600"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Feeds</p>
              <p className="text-2xl font-bold text-slate-800">{feeds.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Assigned Developers</p>
              <p className="text-2xl font-bold text-slate-800">
                {feeds.reduce((sum, feed) => sum + (feed.assignedDevelopers?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Unassigned Feeds</p>
              <p className="text-2xl font-bold text-slate-800">
                {feeds.filter(f => !f.assignedDevelopers || f.assignedDevelopers.length === 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 sm:mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search feeds by name or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="btn-icon absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 right-0 md:right-1"
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
              className="input pl-10 cursor-pointer appearance-none"
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
        <div className="table-scroll table-sticky-first overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <tr>
                <th className="th">Feed</th>
                <th className="th">Project</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Assigned Developer</th>
                <th className="th">Comments</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentFeeds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
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
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                              assignedDev
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Activity size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800">{feed.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`badge border ${getFeedTypeStyle(feed.feedType)}`}>
                                  {getFeedTypeIcon(feed.feedType)}
                                  {feed.feedType}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={12} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">{feed.projectCustomId}</span>
                          </div>
                        </td>

                        <td className="td">
                          <span className={`badge border ${getFeedTypeStyle(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {feed.feedType}
                          </span>
                        </td>

                        {/* 🆕 STATUS COLUMN */}
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          <div className="relative min-w-[120px]">
                            <select
                              value={feed.feedStatus || 'New'}
                              onChange={(e) => updateFeedStatus(feed._id, e.target.value)}
                              disabled={updatingFeedStatus[feed._id]}
                              className={`inline-flex w-full items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold uppercase border cursor-pointer transition-all appearance-none pr-6 ${getFeedStatusColor(feed.feedStatus)}`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 4px center',
                                backgroundSize: '8px'
                              }}
                            >
                              {feedStatusOptions.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            {updatingFeedStatus[feed._id] && (
                              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="td">
                          {assignedDev ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
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

                        <td className="td">
                          <button
                            onClick={() => openCommentModal(feed)}
                            className="btn btn-sm bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white"
                          >
                            <MessageSquare size={14} />
                            Comments
                          </button>
                        </td>

                        <td className="td">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openTicketModal(feed)}
                              className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                              title="Raise Ticket"
                            >
                              <Ticket size={14} />
                              Raise Ticket
                            </button>
                            <button
                              onClick={() => openAssignModal(feed)}
                              className="btn btn-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                            >
                              <UserPlus size={12} />
                              {assignedDev ? 'Reassign' : 'Assign'}
                            </button>
                            <button
                              onClick={() => setExpandedFeed(isExpanded ? null : feed._id)}
                              className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="td">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                              <div className="card">
                                <h4 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
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

                              <div className="card">
                                <h4 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                                  <User size={12} />
                                  Assigned Developer
                                </h4>
                                {assignedDev ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
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
                pageNum = currentPage - 2 + i;
                if (i === 0) pageNum = 1;
                if (i === 4) pageNum = totalPages;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`btn-icon ${
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
            className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* RAISE TICKET MODAL */}
      {showTicketModal && selectedTicketFeed && (
        <div className="modal-backdrop z-[220]">
          <div className="modal-panel max-w-lg">
            <div className="modal-header !block">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="section-title">Raise Ticket</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Feed: <span className="font-bold text-amber-600">{selectedTicketFeed.name}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Project: {selectedTicketFeed.projectCustomId}
                  </p>
                </div>
                <button onClick={closeTicketModal} className="btn-icon bg-slate-100 hover:bg-slate-200">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="label block mb-1.5">
                  Ticket Title *
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of the issue"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  className="input bg-slate-50"
                />
              </div>

              <div>
                <label className="label block mb-1.5">
                  Priority
                </label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  className="input bg-slate-50 cursor-pointer"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="label block mb-1.5">
                  Description *
                </label>
                <textarea
                  placeholder="Detailed description of the issue..."
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="input bg-slate-50 resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    This ticket will be created with <strong>Production</strong> category and
                    assigned to the developer assigned to this feed (if any).
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer [&>button]:flex-1">
              <button onClick={closeTicketModal} className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={handleGenerateTicket}
                disabled={generatingTicket}
                className="btn btn-md flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-md disabled:opacity-50"
              >
                {generatingTicket ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Ticket size={14} />
                    Raise Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedFeed && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="modal-header">
              <div>
                <h2 className="section-title">Assign Developer</h2>
                <p className="text-xs text-slate-500">
                  Feed: <span className="font-bold text-indigo-600">{selectedFeed.name}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Project: {selectedFeed.projectCustomId}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="btn-icon bg-slate-100 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="label block mb-1.5">
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
                      <p className="text-xs text-slate-500">Remove current assignment</p>
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
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{dev.name}</p>
                            {dev.githubLinked && dev.githubUsername && (
                              <span className="badge rounded-full text-green-600 bg-green-50">
                                <GitFork size={12} />
                                GitHub
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 break-words">{dev.email}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleAssignDeveloper}
                disabled={assigning}
                className="btn btn-md w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md disabled:opacity-50"
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

              <p className="text-xs text-slate-400 text-center">
                Only one developer can be assigned per feed. Select a developer or choose "Unassigned" to remove.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FEED COMMENT MODAL */}
      {showCommentModal && selectedFeedForComments && (
        <div className="modal-backdrop z-[210]">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <MessageSquare size={20} className="text-purple-600" />
                  Feed Comments
                </h2>
                <p className="text-sm text-slate-500 truncate sm:max-w-[300px]">
                  {selectedFeedForComments.name} • {selectedFeedForComments.projectCustomId}
                </p>
              </div>
              <button
                onClick={closeCommentModal}
                className="btn-icon bg-slate-100 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Comments List */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-4">
                {loadingComments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="text-slate-400 animate-spin" />
                  </div>
                ) : feedComments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">No comments yet</p>
                    <p className="text-xs">Start the conversation</p>
                  </div>
                ) : (
                  feedComments.map((comment) => {
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
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${isOwn ? 'bg-purple-600' : 'bg-slate-400'}`}>
                                {getInitials(commenterName)}
                              </div>
                              <span className="font-bold text-sm text-slate-800">
                                {commenterName}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock size={12} />
                                {formatTime(comment.createdAt)}
                              </span>
                              {isOwn && (
                                <span className="badge rounded-full text-purple-600 bg-purple-100">
                                  You
                                </span>
                              )}
                              {comment.userId?.role && !isOwn && (
                                <span className={`badge rounded-full ${
                                  isPMRole(comment.userId.role)
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
                              className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 disabled:opacity-50"
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
                            <p className="text-xs font-semibold text-slate-700 truncate">{preview.name}</p>
                            <p className="text-xs text-slate-400">{formatFileSize(preview.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="btn-icon absolute -top-1 -right-1 bg-red-500 text-white hover:bg-red-600 shadow-md md:opacity-0 md:group-hover:opacity-100 rounded-full"
                        >
                          <X size={12} />
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
                      className="input bg-slate-50 resize-none min-h-[48px]"
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
                      className="btn-icon bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                      title="Attach files (images up to 5MB, documents up to 50MB)"
                    >
                      <Paperclip size={18} />
                    </button>

                    <button
                      type="submit"
                      disabled={submittingComment || uploadingFiles}
                      className="btn-icon bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 shadow-sm"
                    >
                      {submittingComment ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-400 px-1 mt-2">
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

export default TeamLeadFeeds;