// frontend/src/pages/TicketDetails.jsx - COMPACT WITH WATCHERS IN RIGHT SIDEBAR
// FIXED: Better error handling for file uploads and connection issues
// FIXED: Attachments "+X more" is now clickable and expands to show all files

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MessageSquare, Send, Users, 
  CheckCircle, XCircle, Clock, Image, X, AlertCircle, 
  Loader2, Eye, Download, UploadCloud, GitFork, Paperclip,
  File, FileText, FileArchive, FileSpreadsheet, FileVideo, FileAudio,
  FileCode, FileJson, Tag, Layers, Building2, Briefcase, Lock,
  UserPlus, Search, ChevronDown, ChevronRight, ChevronUp, Pencil
} from 'lucide-react';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';
import { canActOnTicket as canActOn, canReassignTicket, canSeeTicketActions as canSeeActions, isTicketAssignee } from '../utils/ticketPermissions';
import useIsMobile from '../utils/useIsMobile';
import { Badge, Button, Card, Modal, PageHeader } from '../components/ui';

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [managesProject, setManagesProject] = useState(false); // viewer is PM / coordinator / TL of the ticket's project
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [developers, setDevelopers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const socketRef = useRef();
  const commentsEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');
  const currentUserName = localStorage.getItem('userName');
  const isMobile = useIsMobile();

  // ============================================
  // ✅ NEW: Attachments expand/collapse state
  // ============================================
  const [showAllAttachments, setShowAllAttachments] = useState(false);

  // ============================================
  // WATCHERS STATE
  // ============================================
  const [watchers, setWatchers] = useState([]);
  const [showWatcherModal, setShowWatcherModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [addingWatcher, setAddingWatcher] = useState(false);
  const [watcherSearchTerm, setWatcherSearchTerm] = useState('');
  const watcherSearchInputRef = useRef(null);
  
  // ============================================
  // EXPANDABLE WATCHERS
  // ============================================
  const [isWatchersExpanded, setIsWatchersExpanded] = useState(true);

  // ============================================
  // ✅ CHECK IF TICKET IS CLOSED - SAFE WITH NULL CHECK
  // ============================================
  const isTicketClosed = ticket?.status === 'Closed';

  // ============================================
  // FILE CONFIGURATION
  // ============================================

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // ✅ SAFE: Only calculate statusFlow if ticket exists
  const statusFlow = ['Open', 'In Progress', 'Resolved', 'Closed'];
  const currentStatusIndex = ticket ? statusFlow.indexOf(ticket.status) : -1;

  const getFileExtension = (filename) => {
    if (!filename) return '';
    const name = typeof filename === 'string' ? filename : (filename?.originalName || filename?.filename || filename?.name || '');
    const ext = name.split('.').pop()?.toLowerCase();
    return ext ? '.' + ext : '';
  };

  const isImageFile = (filename) => {
    const name = typeof filename === 'string' ? filename : (filename?.originalName || filename?.filename || filename?.name || '');
    if (!name) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    return imageExtensions.includes(getFileExtension(name));
  };

  const getFileIcon = (file) => {
    const filename = typeof file === 'string' ? file : (file?.originalName || file?.filename || file?.name || '');
    if (!filename) return <File size={16} className="text-slate-400" />;
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
      return <Image size={16} className="text-blue-500" />;
    }
    if (['pdf'].includes(ext)) return <FileText size={16} className="text-red-500" />;
    if (['doc', 'docx', 'odt'].includes(ext)) return <FileText size={16} className="text-blue-600" />;
    if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext)) return <FileSpreadsheet size={16} className="text-green-600" />;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return <FileArchive size={16} className="text-amber-600" />;
    if (['txt', 'json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf'].includes(ext)) {
      return <FileCode size={16} className="text-slate-600" />;
    }
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'sass'].includes(ext)) {
      return <FileCode size={16} className="text-purple-500" />;
    }
    if (['py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs'].includes(ext)) {
      return <FileCode size={16} className="text-orange-500" />;
    }
    if (['sh', 'bash', 'bat', 'ps1', 'cmd'].includes(ext)) {
      return <FileCode size={16} className="text-green-700" />;
    }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'].includes(ext)) {
      return <FileAudio size={16} className="text-pink-500" />;
    }
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
      return <FileVideo size={16} className="text-indigo-500" />;
    }
    if (['ppt', 'pptx', 'odp'].includes(ext)) {
      return <FileText size={16} className="text-orange-600" />;
    }
    return <File size={16} className="text-slate-400" />;
  };

  const getFileTypeLabel = (file) => {
    const filename = typeof file === 'string' ? file : (file?.originalName || file?.filename || file?.name || '');
    if (!filename) return 'File';
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap = {
      'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 
      'webp': 'Image', 'bmp': 'Image', 'svg': 'Image', 'ico': 'Icon',
      'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word', 'odt': 'Word',
      'xls': 'Excel', 'xlsx': 'Excel', 'csv': 'CSV', 'tsv': 'TSV', 'ods': 'Excel',
      'txt': 'Text', 'rtf': 'Rich Text',
      'zip': 'ZIP', 'rar': 'RAR', '7z': '7Z', 'tar': 'TAR', 'gz': 'GZ', 'bz2': 'BZ2',
      'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML',
      'ini': 'Config', 'cfg': 'Config', 'conf': 'Config',
      'js': 'JavaScript', 'jsx': 'React', 'ts': 'TypeScript', 'tsx': 'React TS',
      'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'sass': 'SASS',
      'py': 'Python', 'java': 'Java', 'cpp': 'C++', 'c': 'C', 'h': 'C Header',
      'php': 'PHP', 'rb': 'Ruby', 'go': 'Go', 'rs': 'Rust',
      'sh': 'Shell', 'bash': 'Bash', 'bat': 'Batch', 'ps1': 'PowerShell', 'cmd': 'Command',
      'mp4': 'Video', 'avi': 'Video', 'mkv': 'Video', 'mov': 'Video',
      'wmv': 'Video', 'flv': 'Video', 'webm': 'Video', 'm4v': 'Video',
      'mpg': 'Video', 'mpeg': 'Video',
      'mp3': 'Audio', 'wav': 'Audio', 'aac': 'Audio', 'ogg': 'Audio',
      'flac': 'Audio', 'm4a': 'Audio', 'wma': 'Audio',
      'ppt': 'PowerPoint', 'pptx': 'PowerPoint', 'odp': 'Presentation'
    };
    return typeMap[ext] || 'File';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const handleFileDownload = (file) => {
    const token = localStorage.getItem('token');
    const filename = file.filename || file.url?.split('/').pop();
    
    if (!filename) {
      toast.error('Invalid file');
      return;
    }

    const downloadUrl = `${API_BASE_URL}/api/tickets/download/${encodeURIComponent(filename)}`;
    
    toast.loading('Downloading file...', { id: 'download' });
    
    fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      toast.dismiss('download');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName || file.filename || filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('File downloaded successfully!');
    })
    .catch(error => {
      console.error('Download error:', error);
      toast.dismiss('download');
      toast.error('Failed to download file');
      window.open(downloadUrl, '_blank');
    });
  };

  const showCommentNotification = (ticketData, commentAuthor, fileCount = 0, imageCount = 0) => {
    if (commentAuthor === currentUserName || commentAuthor === currentUserId) return;
    
    const isCreator = ticketData?.createdBy?._id === currentUserId || ticketData?.createdBy === currentUserId;
    const isAssignee = isTicketAssignee(ticketData, currentUserId);
    
    if (isCreator || isAssignee) {
      let attachmentText = '';
      if (fileCount > 0) {
        const parts = [];
        if (imageCount > 0) parts.push(`📷 ${imageCount} image(s)`);
        const docCount = fileCount - imageCount;
        if (docCount > 0) parts.push(`📎 ${docCount} file(s)`);
        attachmentText = ` (${parts.join(', ')})`;
      }
      
      notificationManager.show({
        title: '💬 New Comment on Ticket',
        body: `${commentAuthor} commented${attachmentText}: "${ticketData?.title?.substring(0, 50) || 'Ticket'}"`,
        icon: '/images/login_img_192.png',
        tag: `comment-${ticketData?._id}`,
        data: { ticketId: ticketData?._id, type: 'ticket' },
        onClick: () => {
          window.focus();
          navigate(`/tickets/${ticketData?._id}`);
        }
      });
    }
  };

  // ============================================
  // FETCH WATCHERS
  // ============================================
  const fetchWatchers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/${id}/watchers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWatchers(res.data.watchers || []);
    } catch (error) {
      console.error('Error fetching watchers:', error);
    }
  };

  // ============================================
  // FETCH AVAILABLE USERS FOR WATCHERS - EXCLUDE SUPER ADMIN
  // ============================================
  const fetchAvailableUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/users/watchers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter out current watchers, super admin, and client users
      const watcherIds = watchers.map(w => w._id);
      
      setAvailableUsers(res.data.users.filter(u => 
        !watcherIds.includes(u._id) && 
        u._id !== currentUserId && // Exclude self
        u.role !== 'Admin' && // Exclude Admin
        u.role !== 'Client' // Exclude Client
      ));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // ============================================
  // ADD WATCHER
  // ============================================
  const handleAddWatcher = async (userId) => {
    setAddingWatcher(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/tickets/${id}/watchers`, 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Watcher added successfully');
      fetchWatchers();
      setShowWatcherModal(false);
      setWatcherSearchTerm('');
    } catch (error) {
      console.error('Error adding watcher:', error);
      toast.error(error.response?.data?.error || 'Failed to add watcher');
    } finally {
      setAddingWatcher(false);
    }
  };

  // ============================================
  // REMOVE WATCHER
  // ============================================
  const handleRemoveWatcher = async (userId) => {
    if (!canRemoveWatchers) {
      toast.error('Only the ticket creator or an Admin can remove watchers');
      return;
    }
    if (!window.confirm('Remove this watcher from the ticket?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/tickets/${id}/watchers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Watcher removed');
      fetchWatchers();
    } catch (error) {
      console.error('Error removing watcher:', error);
      toast.error(error.response?.data?.error || 'Failed to remove watcher');
    }
  };

  useEffect(() => {
    fetchTicketDetails();
    fetchDevelopers();
    fetchWatchers();
    
    notificationManager.initAudio();
    
    socketRef.current = io(API_BASE_URL);
    socketRef.current.emit('join-ticket-room', id);
    socketRef.current.emit('join-user-room', currentUserId);
    
    socketRef.current.on('ticket_updated', (updatedTicket) => {
      if (updatedTicket._id === id) {
        const oldStatus = ticket?.status;
        setTicket(updatedTicket);
        fetchWatchers();
        if (oldStatus && oldStatus !== updatedTicket.status) {
          if (updatedTicket.createdBy?._id === currentUserId || updatedTicket.assignedTo?._id === currentUserId) {
            notificationManager.notifyStatusUpdate(updatedTicket, oldStatus, updatedTicket.status, () => {
              navigate(`/tickets/${updatedTicket._id}`);
            });
          }
        }
      }
    });
    
    // A message was edited: just refresh the ticket (no "new comment" toast)
    socketRef.current.on('ticket_comment_edited', (updatedTicket) => {
      if (updatedTicket._id === id) {
        setTicket(updatedTicket);
      }
    });

    socketRef.current.on('ticket_commented', (updatedTicket) => {
      if (updatedTicket._id === id) {
        const comments = updatedTicket.comments || [];
        const lastComment = comments[comments.length - 1];
        
        if (lastComment) {
          const commentUserId = typeof lastComment.userId === 'object' ? lastComment.userId._id : lastComment.userId;
          const commentUserName = lastComment.userName || lastComment.userId?.name || 'Someone';
          
          setTicket(updatedTicket);
          
          if (commentUserId !== currentUserId) {
            const fileCount = lastComment.files?.length || 0;
            const imageCount = lastComment.images?.length || 0;
            const totalAttachments = fileCount || imageCount;
            
            let attachmentText = '';
            if (totalAttachments > 0) {
              const parts = [];
              if (imageCount > 0) parts.push(`📷 ${imageCount} image(s)`);
              const docCount = fileCount - imageCount;
              if (docCount > 0) parts.push(`📎 ${docCount} file(s)`);
              attachmentText = ` ${parts.join(', ')}`;
            }
            
            toast(`${commentUserName} commented${attachmentText}: ${lastComment.text?.substring(0, 50) || ''}`, {
              icon: '💬',
              duration: 4000
            });
            
            showCommentNotification(updatedTicket, commentUserName, totalAttachments, imageCount);
          }
        }
      }
    });
    
    socketRef.current.on('ticket_assigned', (assignedTicket) => {
      if (assignedTicket._id === id) {
        setTicket(assignedTicket);
        fetchWatchers();
        if (assignedTicket.assignedTo?._id === currentUserId) {
          toast.success(`Ticket assigned to you: ${assignedTicket.title}`);
          notificationManager.notifyTicketAssigned(assignedTicket, () => {
            navigate(`/tickets/${assignedTicket._id}`);
          });
        }
      }
    });
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.comments]);

  const fetchTicketDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTicket(res.data);
      setManagesProject(!!res.data.viewerManagesProject);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to load ticket details');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevelopers = async () => {
    if (userRole === 'Client') return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/developers/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevelopers(res.data);
    } catch (error) {
      console.error('Error fetching developers:', error);
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // ============================================
  // CLOSE TICKET - assignee only (see utils/ticketPermissions)
  // ============================================
  const closeTicket = async () => {
    if (!window.confirm('Are you sure you want to close this ticket? This action cannot be undone.')) {
      return;
    }
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/status`, 
        { status: 'Closed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      toast.success('Ticket closed successfully');
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to close ticket');
    } finally {
      setUpdating(false);
    }
  };

  const assignDeveloper = async (developerId) => {
    if (!developerId) return;
    
    setAssigning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/assign`,
        { assignedTo: developerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      setShowAssignModal(false);
      setAssignSearchTerm('');
      toast.success('Ticket assigned successfully');
    } catch (error) {
      console.error('Error assigning developer:', error);
      toast.error(error.response?.data?.error || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  // ============================================
  // ENHANCED FILE PROCESSING WITH PASTE SUPPORT
  // ============================================

  const processFiles = (files) => {
    const validFiles = [];
    const validPreviews = [];

    files.forEach(file => {
      const isImage = isImageFile(file.name);
      
      if (isImage) {
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`Image "${file.name}" exceeds 5MB limit`);
          return;
        }
        
        validFiles.push(file);
        
        const previewUrl = URL.createObjectURL(file);
        validPreviews.push({
          file: file,
          name: file.name || 'pasted-image.png',
          size: file.size,
          type: file.type || 'image/png',
          preview: previewUrl,
          id: Date.now() + Math.random().toString(36).substr(2, 9)
        });
      } else {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File "${file.name}" exceeds 50MB limit`);
          return;
        }
        
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

  // ============================================
  // IMAGE PASTE HANDLER
  // ============================================

  useEffect(() => {
    const handlePaste = (e) => {
      if (isTicketClosed) {
        toast.error('Cannot add comments to a closed ticket');
        return;
      }
      
      if (document.activeElement !== textareaRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const pastedFiles = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      
      if (pastedFiles.length > 0) {
        e.preventDefault();
        processFiles(pastedFiles); // checks the size limits and shows the toasts
      }
    };
    
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isTicketClosed]);

  const handleFileSelect = (e) => {
    if (isTicketClosed) {
      toast.error('Cannot add files to a closed ticket');
      e.target.value = '';
      return;
    }
    
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    if (isTicketClosed) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    if (isTicketClosed) {
      toast.error('Cannot add files to a closed ticket');
      return;
    }
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
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

  // ============================================
  // FIXED: Upload files with better error handling
  // ============================================
  const uploadFilesWithConcurrency = async (files) => {
    if (files.length === 0) return [];
    
    const uploadedUrls = [];
    const token = localStorage.getItem('token');
    const concurrencyLimit = 3;
    let completed = 0;
    let hasError = false;
    
    setUploadingFiles(true);
    
    return new Promise((resolve) => {
      const uploadNext = (index) => {
        if (index >= files.length) {
          if (completed === files.length) {
            setUploadingFiles(false);
            resolve(uploadedUrls);
          }
          return;
        }
        
        const file = files[index];
        const formData = new FormData();
        formData.append('file', file);
        
        console.log(`📤 Uploading file ${index + 1}/${files.length}: ${file.name} (${formatFileSize(file.size)})`);
        
        axios.post(`${API_BASE_URL}/api/tickets/upload-file`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000
        })
        .then(response => {
          if (response.data.success) {
            uploadedUrls.push({
              url: response.data.url,
              filename: response.data.filename,
              originalName: response.data.originalName,
              size: response.data.size,
              type: response.data.type || (isImageFile(file.name) ? 'image' : 'document')
            });
            console.log(`✅ Uploaded: ${file.name}`);
          }
        })
        .catch(error => {
          hasError = true;
          console.error(`❌ File upload failed for ${file.name}:`, error.message);
          
          if (error.code === 'ECONNABORTED') {
            toast.error(`Upload timeout for ${file.name}. The server may be busy.`);
          } else if (error.response?.status === 413) {
            toast.error(`${file.name}: ${error.response?.data?.error || 'File too large. Maximum size is 50MB.'}`);
          } else if (error.response?.status === 401) {
            toast.error('Authentication failed. Please refresh and try again.');
          } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
            toast.error(`Network error uploading ${file.name}. Please check your connection.`);
          } else {
            toast.error(`Failed to upload ${file.name}: ${error.response?.data?.error || 'Unknown error'}`);
          }
        })
        .finally(() => {
          completed++;
          uploadNext(concurrencyLimit + index);
        });
      };
      
      for (let i = 0; i < Math.min(concurrencyLimit, files.length); i++) {
        uploadNext(i);
      }
    });
  };

  // ============================================
  // Edit own messages
  const startEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditCommentText(comment.text || '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const saveEditedComment = async (commentId) => {
    const original = ticket?.comments?.find(c => c._id === commentId);
    const text = editCommentText.trim();
    const hasAttachments = (original?.images?.length || 0) + (original?.files?.length || 0) > 0;

    if (!text && !hasAttachments) {
      toast.error('Message cannot be empty');
      return;
    }
    if (text === (original?.text || '')) {
      cancelEditComment();
      return;
    }

    try {
      setSavingEdit(true);
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `${API_BASE_URL}/api/tickets/${id}/comments/${commentId}`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      cancelEditComment();
      toast.success('Message updated');
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error(error.response?.data?.error || 'Failed to edit message');
    } finally {
      setSavingEdit(false);
    }
  };

  // FIXED: Comment submission with better error handling
  // ============================================
  const addComment = async (e) => {
    if (e) e.preventDefault();
    
    if (isTicketClosed) {
      toast.error('Cannot add comments to a closed ticket');
      return;
    }
    
    if (isSending) return;
    
    if (!newComment.trim() && selectedFiles.length === 0) {
      toast.error('Please enter a comment or attach a file');
      return;
    }
    
    setIsSending(true);
    
    try {
      const token = localStorage.getItem('token');
      let uploadedFiles = [];
      
      if (selectedFiles.length > 0) {
        uploadedFiles = await uploadFilesWithConcurrency(selectedFiles);
        
        if (uploadedFiles.length === 0 && selectedFiles.length > 0) {
          toast.error('Files could not be uploaded. Comment will be sent without attachments.');
        }
      }
      
      const payload = {
        text: newComment.trim() || '📎 File(s) attached',
        files: uploadedFiles
      };
      
      console.log(`📝 Sending comment with ${uploadedFiles.length} file(s)`);
      
      const res = await axios.post(`${API_BASE_URL}/api/tickets/${id}/comments`,
        payload,
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000
        }
      );
      
      setTicket(res.data);
      setNewComment('');
      setSelectedFiles([]);
      setFilePreviews([]);
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      if (uploadedFiles.length > 0) {
        toast.success(`Comment added with ${uploadedFiles.length} attachment(s)`);
      } else if (selectedFiles.length > 0) {
        toast.success('Comment added (files could not be uploaded)');
      } else {
        toast.success('Comment added');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        toast.error('Network error: Could not connect to server. Please check your connection and try again.');
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please refresh the page and try again.');
      } else if (error.response?.status === 413) {
        toast.error('Comment or attachments are too large. Please reduce the size and try again.');
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. The server may be busy. Please try again.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to add comment. Please try again.');
      }
    } finally {
      setIsSending(false);
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

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Finance': 'bg-green-100 text-green-700 border-green-200',
      'HR': 'bg-pink-100 text-pink-700 border-pink-200',
      'Payroll': 'bg-blue-100 text-blue-700 border-blue-200',
      'Sales': 'bg-orange-100 text-orange-700 border-orange-200',
      'Production': 'bg-red-100 text-red-700 border-red-200',
      'Admin': 'bg-gray-100 text-gray-700 border-gray-200',
      'IT': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Development': 'bg-violet-100 text-violet-700 border-violet-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // Anyone can add watchers; only the ticket creator or an Admin can remove them
  const canRemoveWatchers =
    userRole === 'Admin' || userRole === 'Super Admin' ||
    String(ticket?.createdBy?._id || ticket?.createdBy) === String(currentUserId);

  const formatCommentTime = (date) => {
    if (!date) return 'Unknown';
    
    try {
      const commentDate = new Date(date);
      if (isNaN(commentDate.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffMs = now - commentDate;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffSeconds < 5) return 'Just now';
      if (diffMins < 1) return diffSeconds + ' seconds ago';
      if (diffMins === 1) return '1 minute ago';
      if (diffMins < 60) return diffMins + ' minutes ago';
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return diffHours + ' hours ago';
      if (diffDays === 1) return 'Yesterday';
      return diffDays + ' days ago';
    } catch (error) {
      return 'Unknown';
    }
  };

  // Assign / reassign: assignee, creator or Admin (plus the project's managers while unassigned);
  // other non-Client users see the button disabled
  const canAssignDeveloper = canReassignTicket(ticket, currentUserId, userRole, managesProject);

  const handleTextareaKeyDown = (e) => {
    if (isTicketClosed) {
      e.preventDefault();
      toast.error('Cannot add comments to a closed ticket');
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((newComment.trim() || selectedFiles.length > 0) && !isSending) {
        addComment();
      }
    }
  };

  const handleTextareaChange = (e) => {
    setNewComment(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  // Any non-Client user can add watchers (the Watchers panel itself is hidden for Clients)
  const canAddWatcher = 
    ticket &&
    userRole !== 'Client' &&
    ticket.status !== 'Closed';

  // Start / Resolve / Close: every non-Client user sees them, only the assignee can use them
  const canSeeTicketActions = canSeeActions(userRole);
  const canActOnTicket = canActOn(ticket, currentUserId, userRole);
  const actionButtonClass = (activeColors) =>
    canActOnTicket ? `${activeColors} text-white` : 'bg-gray-300 text-gray-500 cursor-not-allowed';

  if (loading) {
    return (
      <div className="page bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="page bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="page-title">Ticket Not Found</h2>
          <p className="text-sm text-gray-500 mt-2">The ticket you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/tickets')} className="mt-4">
            Back to Tickets
          </Button>
        </div>
      </div>
    );
  }

  const hasTicketAttachments = ticket.files && ticket.files.length > 0;

  // ============================================
  // ✅ NEW: Calculate displayed attachments
  // ============================================
  const displayedAttachments = hasTicketAttachments
    ? (showAllAttachments ? ticket.files : ticket.files.slice(0, 3))
    : [];
  const hasMoreAttachments = hasTicketAttachments && ticket.files.length > 3;

  return (
    <div className="page bg-gray-50">
      <div className="stack">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/tickets')}
            className="mb-2 sm:mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Tickets
          </button>

          <PageHeader
            title={ticket.title}
            above={
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-sm font-medium text-gray-500">{ticket.ticketNumber}</span>
                <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                {ticket.isInternal && <Badge className="bg-purple-100 text-purple-700">Internal</Badge>}
                {ticket.category === 'Production' && ticket.subcategory === 'Feasibility' && (
                  <Badge className="bg-indigo-100 text-indigo-700">🔬 Feasibility</Badge>
                )}
                {hasTicketAttachments && (
                  <Badge className="bg-blue-100 text-blue-700">{ticket.files.length} file(s)</Badge>
                )}
                {isTicketClosed && <Badge className="bg-red-600 text-white">🔒 CLOSED</Badge>}
              </div>
            }
            actionsTitle={canSeeTicketActions && !canActOnTicket && ticket.status !== 'Closed' ? 'Only the assigned person can update this ticket' : undefined}
            actions={canSeeTicketActions && ticket.status !== 'Closed' && (
              <>
                <Button
                  variant="plain"
                  onClick={closeTicket}
                  disabled={updating || !canActOnTicket}
                  className={`flex-1 lg:flex-none shadow-sm ${actionButtonClass('bg-red-600 hover:bg-red-700')}`}
                >
                  <XCircle size={16} /> Close
                </Button>
                {ticket.status !== 'In Progress' && (
                  <Button
                    variant="plain"
                    onClick={() => updateStatus('In Progress')}
                    disabled={updating || !canActOnTicket}
                    className={`flex-1 lg:flex-none shadow-sm ${actionButtonClass('bg-yellow-600 hover:bg-yellow-700')}`}
                  >
                    Start
                  </Button>
                )}
                {ticket.status !== 'Resolved' && (
                  <Button
                    variant="plain"
                    onClick={() => updateStatus('Resolved')}
                    disabled={updating || !canActOnTicket}
                    className={`flex-1 lg:flex-none shadow-sm ${actionButtonClass('bg-green-600 hover:bg-green-700')}`}
                  >
                    Resolve
                  </Button>
                )}
              </>
            )}
          />
        </div>

        {/* ============================================
            COMPACT ROW: Project | Category | Attachments
            ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Project */}
          <Card className="min-w-0">
            <div className="label flex items-center gap-1.5 uppercase tracking-wider">
              <Briefcase size={14} className="text-blue-600 shrink-0" /> Project
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {ticket.projectId ? (
                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Building2 size={12} className="shrink-0" />
                  {ticket.projectId.name || ticket.projectId.projectCustomId}
                </Badge>
              ) : (
                <span className="text-sm text-gray-400 italic">No project</span>
              )}
              {ticket.feedId && (
                <>
                  <span className="text-gray-400 text-xs">/</span>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 min-w-0 [overflow-wrap:anywhere]">
                    <Tag size={12} className="shrink-0" />
                    {ticket.feedId.name}
                  </Badge>
                </>
              )}
            </div>
          </Card>

          {/* Category */}
          <Card className="min-w-0">
            <div className="label flex items-center gap-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-blue-600 shrink-0" /> Category
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {ticket.category ? (
                <>
                  <Badge className={`border ${getCategoryColor(ticket.category)}`}>{ticket.category}</Badge>
                  {ticket.subcategory && (
                    <>
                      <span className="text-gray-400 text-xs">→</span>
                      <Badge className="bg-gray-100 text-gray-700 border border-gray-200">{ticket.subcategory}</Badge>
                    </>
                  )}
                  {ticket.subItem && (
                    <>
                      <span className="text-gray-400 text-xs">→</span>
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200">{ticket.subItem}</Badge>
                    </>
                  )}
                </>
              ) : (
                <span className="text-sm text-gray-400 italic">No category</span>
              )}
            </div>
          </Card>

          {/* ✅ FIXED: Attachments - Now expandable */}
          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="label flex items-center gap-1.5 uppercase tracking-wider">
                <Paperclip size={14} className="text-blue-600 shrink-0" />
                Attachments{hasTicketAttachments ? ` (${ticket.files.length})` : ''}
              </div>
              {hasMoreAttachments && (
                <button
                  onClick={() => setShowAllAttachments(!showAllAttachments)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors shrink-0"
                >
                  {showAllAttachments ? (
                    <>
                      <ChevronUp size={14} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show All
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Expanded: Show all as list. Collapsed: Show 3 as compact chips */}
            {!hasTicketAttachments ? (
              <p className="text-sm text-gray-400 italic mt-2">No attachments</p>
            ) : showAllAttachments ? (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 mt-2">
                {displayedAttachments.map((file, index) => {
                  const isImage = isImageFile(file.originalName || file.filename);
                  const fileUrl = file.url || `${API_BASE_URL}/uploads/tickets/${file.filename}`;

                  return (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                        {isImage ? (
                          <img
                            src={fileUrl}
                            alt={file.originalName || 'Attachment'}
                            className="w-full h-full object-cover rounded-lg cursor-pointer"
                            onClick={() => setShowImageViewer(fileUrl)}
                          />
                        ) : (
                          getFileIcon(file)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate" title={file.originalName || file.filename}>
                          {file.originalName || file.filename}
                        </p>
                        <p className="meta">
                          {formatFileSize(file.size)} • {getFileTypeLabel(file)}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0">
                        {isImage && (
                          <button
                            onClick={() => setShowImageViewer(fileUrl)}
                            className="btn-icon text-gray-400 hover:bg-gray-200 hover:text-blue-600"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleFileDownload(file)}
                          className="btn-icon text-gray-400 hover:bg-gray-200 hover:text-blue-600"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {displayedAttachments.map((file, index) => {
                  const isImage = isImageFile(file.originalName || file.filename);
                  const fileUrl = file.url || `${API_BASE_URL}/uploads/tickets/${file.filename}`;

                  return (
                    <div key={index} className="flex items-center gap-2 pl-2 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all group max-w-full min-w-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                        {isImage ? (
                          <img
                            src={fileUrl}
                            alt={file.originalName || 'Attachment'}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setShowImageViewer(fileUrl)}
                          />
                        ) : (
                          getFileIcon(file)
                        )}
                      </div>
                      <p
                        className="text-xs font-semibold text-gray-700 truncate min-w-0 max-w-[180px] lg:max-w-[110px]"
                        title={file.originalName || file.filename}
                      >
                        {file.originalName || file.filename}
                      </p>
                      <button
                        onClick={() => handleFileDownload(file)}
                        className="btn-icon text-gray-400 hover:bg-gray-200 hover:text-blue-600"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  );
                })}
                {hasMoreAttachments && (
                  <button
                    onClick={() => setShowAllAttachments(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold self-center px-2 py-1 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    +{ticket.files.length - 3} more
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Ticket Progress */}
        {ticket && <TicketProgress ticket={ticket} statusFlow={statusFlow} currentStatusIndex={currentStatusIndex} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content Side */}
          <div className="lg:col-span-2 stack min-w-0">
            {/* Description Card */}
            <Card title="Description">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">{ticket.description}</p>
            </Card>

            {/* Chat Container Window */}
            <div
              className="card !p-0 overflow-hidden flex flex-col relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && !isTicketClosed && (
                <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 z-50 flex flex-col items-center justify-center transition-all pointer-events-none p-4">
                  <div className="bg-white p-4 rounded-full shadow-lg flex items-center justify-center animate-bounce mb-2">
                    <UploadCloud size={32} className="text-blue-600" />
                  </div>
                  <p className="text-base sm:text-lg font-bold text-blue-700 text-center">Drop files here</p>
                  <p className="text-blue-600/80 text-xs text-center">Images, documents, archives, code, media (Max 50MB)</p>
                </div>
              )}

              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="section-title flex items-center gap-2">
                  <MessageSquare size={20} className="text-gray-500 shrink-0" />
                  Conversation ({ticket.comments?.length || 0})
                </h2>
                <p className="meta mt-1">
                  {isTicketClosed ? '🔒 This ticket is closed. No new comments can be added.' : 'Discuss this ticket with the team or drag files to upload'}
                </p>
              </div>

              <div className="flex-1 max-h-[60vh] sm:max-h-[400px] overflow-y-auto p-3 sm:p-5 space-y-4 bg-gray-50/50">
                {ticket.comments && ticket.comments.length > 0 ? (
                  <>
                    {ticket.comments.map((comment, idx) => {
                      const isCurrentUser = comment.userId?._id === currentUserId || comment.userId === currentUserId;
                      const commentUser = comment.userName || comment.userId?.name || 'Unknown User';
                      const userInitial = commentUser.charAt(0).toUpperCase();
                      const commentTime = formatCommentTime(comment.createdAt);
                      const hasImages = comment.images && comment.images.length > 0;
                      const hasFiles = comment.files && comment.files.length > 0;

                      return (
                        <div key={idx} className={`flex gap-2 sm:gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm ${isCurrentUser ? 'bg-blue-600' : 'bg-gray-400'}`}>
                            {userInitial}
                          </div>

                          <div className={`flex-1 min-w-0 max-w-[85%] sm:max-w-[70%] ${isCurrentUser ? 'items-end' : ''}`}>
                            <div className={`rounded-lg p-3 shadow-sm ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
                              <div className={`text-xs font-bold mb-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                                {commentUser}
                              </div>

                              {editingCommentId === comment._id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') cancelEditComment();
                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEditedComment(comment._id);
                                    }}
                                    autoFocus
                                    rows={3}
                                    className="w-full text-sm text-gray-800 bg-white border border-blue-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-200 resize-y"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="plain"
                                      size="sm"
                                      onClick={cancelEditComment}
                                      disabled={savingEdit}
                                      className="bg-white/20 hover:bg-white/30 text-white disabled:opacity-50"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="plain"
                                      size="sm"
                                      onClick={() => saveEditedComment(comment._id)}
                                      disabled={savingEdit}
                                      className="bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                    >
                                      {savingEdit && <Loader2 size={14} className="animate-spin" />}
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : comment.text && (
                                <div className={`text-sm leading-relaxed ${isCurrentUser ? 'text-white' : 'text-gray-700'} break-words`}>
                                  <div className="whitespace-pre-wrap comment-content" style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontFamily: 'inherit'
                                  }}>
                                    {comment.text}
                                  </div>
                                </div>
                              )}

                              {hasImages && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {comment.images.map((img, imgIdx) => (
                                    <div key={imgIdx} className="relative group">
                                      <img
                                        src={img}
                                        alt={`Attachment ${imgIdx + 1}`}
                                        className="max-w-full sm:max-w-[200px] max-h-[150px] rounded-lg cursor-pointer border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                                        onClick={() => setShowImageViewer(img)}
                                      />
                                      <button
                                        onClick={() => setShowImageViewer(img)}
                                        aria-label="View image"
                                        className="absolute top-1 right-1 p-1 flex items-center justify-center bg-black/60 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                      >
                                        <Eye size={14} className="text-white" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {hasFiles && (
                                <div className="mt-2 space-y-2">
                                  {comment.files.map((file, fileIdx) => (
                                    <div key={fileIdx} className={`flex items-center gap-2 p-2 rounded-lg border transition-all group ${isCurrentUser ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                                        {file.type === 'image' ? (
                                          <img
                                            src={file.url}
                                            alt={file.originalName || 'Attachment'}
                                            className="w-full h-full object-cover rounded-lg"
                                          />
                                        ) : (
                                          getFileIcon(file)
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-semibold truncate ${isCurrentUser ? 'text-white' : 'text-gray-700'}`} title={file.originalName || file.filename}>
                                          {file.originalName || file.filename}
                                        </p>
                                        <p className={`text-xs flex flex-wrap items-center gap-x-1.5 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                                          <span>{formatFileSize(file.size)}</span>
                                          <span>•</span>
                                          <span>{getFileTypeLabel(file)}</span>
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleFileDownload(file)}
                                        className={`btn-icon ${isCurrentUser ? 'text-blue-100 hover:bg-white/20 hover:text-white' : 'text-gray-400 hover:bg-gray-200 hover:text-blue-600'}`}
                                        title="Download file"
                                      >
                                        <Download size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className={`flex flex-wrap items-center gap-1 mt-1 text-xs text-gray-500 ${isCurrentUser ? 'justify-end' : ''}`}>
                              <Clock size={12} />
                              <span>{commentTime}</span>
                              {comment.editedAt && <span className="italic">(edited)</span>}
                              {isCurrentUser && !isTicketClosed && comment._id && comment.text && editingCommentId !== comment._id && (
                                <button
                                  onClick={() => startEditComment(comment)}
                                  className="ml-1 flex items-center justify-center gap-1 hover:text-blue-600 transition-colors"
                                  title="Edit message"
                                >
                                  <Pencil size={12} />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={commentsEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                    <MessageSquare size={40} className="text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500 font-semibold">No comments yet</p>
                    <p className="meta max-w-xs mx-auto mt-1">
                      {isTicketClosed ? 'This ticket is closed.' : 'Start the conversation by typing a message below or dropping a file.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Comment Form */}
              <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
                {filePreviews.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 max-h-[200px] overflow-y-auto">
                    {filePreviews.map((preview, idx) => (
                      <div key={preview.id || idx} className="flex items-center gap-2 pl-2 py-1 bg-white rounded-lg border border-gray-200 shadow-sm max-w-full min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 overflow-hidden">
                          {isImageFile(preview.name) ? (
                            <img
                              src={preview.preview || URL.createObjectURL(preview.file)}
                              alt={preview.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            getFileIcon(preview.file)
                          )}
                        </div>
                        <div className="min-w-0 max-w-[140px]">
                          <p className="text-xs font-semibold text-gray-700 truncate" title={preview.name}>{preview.name}</p>
                          <p className="meta">{formatFileSize(preview.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${preview.name}`}
                          title="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 sm:gap-2 w-full bg-gray-50 border border-gray-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextareaChange}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={isTicketClosed ? "🔒 This ticket is closed" : isMobile ? "Write..." : "Write your message... (paste images directly)"}
                    className={`flex-1 min-w-0 bg-transparent px-2 sm:px-3 py-2 text-sm text-gray-700 outline-none resize-none self-center min-h-[40px] max-h-[120px] ${
                      isTicketClosed ? 'opacity-50 cursor-not-allowed text-gray-400' : ''
                    }`}
                    rows={1}
                    disabled={isSending || isTicketClosed}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    disabled={uploadingFiles || isSending || isTicketClosed}
                    className={`btn-icon ${
                      isTicketClosed
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/70'
                    }`}
                    title={isTicketClosed ? "Cannot attach files to closed ticket" : "Attach files"}
                  >
                    <Paperclip size={18} />
                  </button>

                  <Button
                    variant="plain"
                    size="sm"
                    onClick={() => addComment()}
                    disabled={(!newComment.trim() && selectedFiles.length === 0) || uploadingFiles || isSending || isTicketClosed}
                    aria-label={isSending ? 'Sending' : 'Send'}
                    className={`shrink-0 ${
                      isTicketClosed
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white shadow-sm'
                    }`}
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span>
                  </Button>
                </div>

                {isTicketClosed && (
                  <div className="mt-2 text-center">
                    <span className="text-xs font-medium text-red-600 flex items-center justify-center gap-1.5">
                      <Lock size={14} />
                      This ticket is closed. Comments are disabled.
                    </span>
                  </div>
                )}

                {!isTicketClosed && (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 meta mt-2 px-1">
                    <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
                    <span>
                      <button
                        type="button"
                        onClick={() => !isTicketClosed && fileInputRef.current.click()}
                        className={`min-w-0 ${isTicketClosed ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:underline'}`}
                      >
                        Attach
                      </button>
                      {' '}(5MB images • 50MB files • <strong>Paste images with Ctrl+V</strong>)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Info Sidebar Segment */}
          <div className="stack min-w-0">
            {/* Metadata */}
            <Card title="Ticket Metadata">
              <div className="divide-y divide-gray-100">
                <MetaRow label="Created By">
                  <User size={14} className="text-gray-400 shrink-0" />
                  <span className="min-w-0 break-words">{ticket.createdBy?.name}</span>
                </MetaRow>
                <MetaRow label="Created At">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                </MetaRow>

                {userRole !== 'Client' && (
                  <MetaRow label="Assigned To">
                    {ticket.assignedTo ? (
                      <>
                        <span className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                          {ticket.assignedTo.name?.charAt(0).toUpperCase() || 'D'}
                        </span>
                        <span className="min-w-0 break-words">{ticket.assignedTo.name}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} className="text-amber-600 shrink-0" />
                        <span className="text-amber-700">Unassigned</span>
                      </>
                    )}
                  </MetaRow>
                )}

                <MetaRow label="Priority">
                  <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                </MetaRow>

                {ticket.resolvedAt && (
                  <MetaRow label="Resolved At" labelClass="text-green-600">
                    <span>{new Date(ticket.resolvedAt).toLocaleString()}</span>
                  </MetaRow>
                )}
                {ticket.closedAt && (
                  <MetaRow label="Closed At">
                    <span>{new Date(ticket.closedAt).toLocaleString()}</span>
                  </MetaRow>
                )}
              </div>
            </Card>

            {/* WATCHERS SECTION - Hidden for Client users */}
            {userRole !== 'Client' && (
              <Card>
                <div
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  onClick={() => setIsWatchersExpanded(!isWatchersExpanded)}
                >
                  <h2 className="section-title flex items-center gap-2 min-w-0">
                    <Users size={18} className="text-gray-500 shrink-0" />
                    Watchers
                    {watchers.length > 0 && (
                      <Badge className="text-purple-600 bg-purple-50 rounded-full">{watchers.length}</Badge>
                    )}
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    {canAddWatcher && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchAvailableUsers();
                          setShowWatcherModal(true);
                          setWatcherSearchTerm('');
                        }}
                      >
                        <UserPlus size={16} />
                        Add
                      </Button>
                    )}
                    <button
                      className="btn-icon text-gray-400 hover:bg-gray-100"
                      aria-label={isWatchersExpanded ? 'Collapse watchers' : 'Expand watchers'}
                      aria-expanded={isWatchersExpanded}
                    >
                      {isWatchersExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {isWatchersExpanded && (
                  <>
                    {watchers.length === 0 ? (
                      <p className="text-sm text-gray-400 italic mt-2">No watchers</p>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 mt-3">
                        {watchers.map(watcher => {
                          const isCurrentUser = watcher._id === currentUserId;
                          const canRemove = canRemoveWatchers && ticket.status !== 'Closed';
                          return (
                            <div key={watcher._id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {watcher.name?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 truncate" title={watcher.name}>
                                    {watcher.name}
                                    {isCurrentUser && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                                  </p>
                                  <p className="meta truncate">{watcher.role || 'Watcher'}</p>
                                </div>
                              </div>
                              {canRemove && (
                                <button
                                  onClick={() => handleRemoveWatcher(watcher._id)}
                                  className="btn-icon text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  title="Remove watcher"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Assignment Management */}
            {userRole !== 'Client' && ticket.status !== 'Closed' && (
              <Card
                title="Assignment"
                icon={<Users size={18} className="text-gray-500 shrink-0" />}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowAssignModal(true); setAssignSearchTerm(''); }}
                    disabled={assigning || !canAssignDeveloper}
                    title={canAssignDeveloper ? undefined : 'Only the assignee, the creator or an Admin can reassign this ticket'}
                  >
                    <UserPlus size={16} />
                    {ticket.assignedTo ? 'Change' : 'Assign'}
                  </Button>
                }
              >
                {ticket.assignedTo ? (
                  <div className="p-3 bg-green-50/70 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold">Current:</p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{ticket.assignedTo.name}</p>
                    <p className="meta break-all">{ticket.assignedTo.email}</p>
                    {ticket.assignedTo.githubUsername && (
                      <div className="meta flex items-center gap-1 mt-1">
                        <GitFork size={12} className="shrink-0" />
                        <span className="min-w-0 break-all">GitHub: {ticket.assignedTo.githubUsername}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg font-medium">
                    {ticket.category === 'Production' && ticket.subcategory === 'Feasibility'
                      ? 'Feasibility ticket needs a developer.'
                      : 'Ticket is unassigned.'}
                  </div>
                )}
                {ticket.assignedTo?._id === currentUserId && (
                  <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle size={14} /> You are assigned.
                  </div>
                )}
              </Card>
            )}

            {/* Show closed message in sidebar */}
            {isTicketClosed && (
              <div className="card !bg-red-50 !border-red-200">
                <h2 className="section-title !text-red-700 flex items-center gap-2 mb-1">
                  <Lock size={18} className="text-red-600 shrink-0" /> Ticket Closed
                </h2>
                <p className="text-sm text-red-600">
                  This ticket has been closed. No further comments or changes can be made.
                </p>
                {ticket.closedAt && (
                  <p className="text-xs text-red-500 mt-1">
                    Closed on: {new Date(ticket.closedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD WATCHER MODAL WITH SEARCH */}
      {showWatcherModal && (
        <Modal
          title="Add Watcher"
          subtitle="Select users to watch this ticket"
          onClose={() => {
            setShowWatcherModal(false);
            setWatcherSearchTerm('');
          }}
        >
          <SearchBox
            inputRef={watcherSearchInputRef}
            value={watcherSearchTerm}
            onChange={setWatcherSearchTerm}
          />

          <div className="max-h-[50dvh] sm:max-h-72 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {watcherSearchTerm ? (
                  <>No users found matching "<span className="font-medium">{watcherSearchTerm}</span>"</>
                ) : (
                  'No available users to add as watchers'
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {availableUsers
                  .filter(user => {
                    const search = watcherSearchTerm.toLowerCase().trim();
                    if (!search) return true;
                    return (
                      user.name?.toLowerCase().includes(search) ||
                      user.email?.toLowerCase().includes(search) ||
                      user.role?.toLowerCase().includes(search)
                    );
                  })
                  .map(user => (
                    <div
                      key={user._id}
                      onClick={() => handleAddWatcher(user._id)}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                    >
                      <UserSummary user={user} />
                      <UserPlus size={16} className="text-blue-600 flex-shrink-0" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {availableUsers.length > 0 && watcherSearchTerm && (
            <p className="meta mt-2 text-center">
              {availableUsers.filter(u => {
                const search = watcherSearchTerm.toLowerCase().trim();
                return (
                  u.name?.toLowerCase().includes(search) ||
                  u.email?.toLowerCase().includes(search) ||
                  u.role?.toLowerCase().includes(search)
                );
              }).length} user(s) found
            </p>
          )}
        </Modal>
      )}

      {/* ASSIGN MODAL WITH SEARCH (same pattern as Add Watcher) */}
      {showAssignModal && (
        <Modal
          title={ticket.assignedTo ? 'Reassign Ticket' : 'Assign Ticket'}
          subtitle="Select who should handle this ticket"
          onClose={() => { setShowAssignModal(false); setAssignSearchTerm(''); }}
        >
          <SearchBox autoFocus value={assignSearchTerm} onChange={setAssignSearchTerm} />

          {(() => {
            const search = assignSearchTerm.toLowerCase().trim();
            const matches = developers.filter(u =>
              !search ||
              u.name?.toLowerCase().includes(search) ||
              u.email?.toLowerCase().includes(search) ||
              u.role?.toLowerCase().includes(search)
            );
            return (
              <div className="max-h-[50dvh] sm:max-h-72 overflow-y-auto">
                {matches.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    {search ? <>No users found matching "<span className="font-medium">{assignSearchTerm}</span>"</> : 'No users available'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {matches.map(user => {
                      const isCurrent = ticket.assignedTo?._id === user._id;
                      return (
                        <div
                          key={user._id}
                          onClick={() => { if (!isCurrent && !assigning) assignDeveloper(user._id); }}
                          className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-all ${
                            isCurrent
                              ? 'border-green-300 bg-green-50 cursor-default'
                              : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <UserSummary user={user} />
                          {isCurrent
                            ? <Badge className="text-green-700 shrink-0">Current</Badge>
                            : <UserPlus size={16} className="text-blue-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Full Screen Image Viewer: its buttons have their own row, so they are always visible */}
      {showImageViewer && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex flex-col p-2 sm:p-4" onClick={() => setShowImageViewer(null)}>
          <div className="shrink-0 flex items-center justify-end gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="plain"
              onClick={() => {
                const file = {
                  filename: showImageViewer.split('/').pop(),
                  originalName: showImageViewer.split('/').pop()
                };
                handleFileDownload(file);
              }}
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <Download size={16} /> Download
            </Button>
            <Button
              variant="plain"
              onClick={() => setShowImageViewer(null)}
              aria-label="Close"
              className="bg-white/10 hover:bg-white/25 text-white !px-0 w-10"
            >
              <X size={18} />
            </Button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <img
              src={showImageViewer}
              alt="Full size view"
              className="max-w-full sm:max-w-4xl max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetails;

// ============================================
// Small layout pieces of this page
// ============================================
// Label on the left, value on the right; the value drops to the next line when it does not fit
function MetaRow({ label, labelClass = '', children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
      <span className={`label ${labelClass}`}>{label}</span>
      <div className="flex items-center gap-2 min-w-0 text-sm font-medium text-gray-800">{children}</div>
    </div>
  );
}

function SearchBox({ value, onChange, inputRef, autoFocus }) {
  return (
    <div className="relative mb-3">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        placeholder="Search by name, email, or role..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-9 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="btn-icon absolute right-0 md:right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function UserSummary({ user }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {user.name?.charAt(0) || '?'}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
        <p className="meta truncate">{user.email}</p>
        <p className="meta truncate">{user.role}</p>
      </div>
    </div>
  );
}

// ============================================
// Progress bar (each step is an equal-width column, so the line always
// lines up with the circles). Hover a step to see when it happened.
// ============================================
const fmtStageTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const fmtGap = (from, to) => {
  if (!from || !to) return '';
  let mins = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
  const d = Math.floor(mins / 1440); mins -= d * 1440;
  const h = Math.floor(mins / 60); const m = mins - h * 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

// When did the ticket (last) enter each stage?
function stageTimes(ticket, statusFlow) {
  const hist = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const lastIn = (status) => {
    for (let i = hist.length - 1; i >= 0; i -= 1) if (hist[i].status === status) return hist[i];
    return null;
  };
  const fallback = {
    'Open': ticket.createdAt,
    'In Progress': ticket.startedAt,
    'Resolved': ticket.resolvedAt,
    'Closed': ticket.closedAt,
  };
  return statusFlow.map((status) => {
    const h = lastIn(status);
    if (h) return { at: h.at, by: h.byName || '' };
    if (status === 'Open') return { at: ticket.createdAt, by: ticket.createdBy?.name || '' };
    return { at: fallback[status] || null, by: '' };
  });
}

function TicketProgress({ ticket, statusFlow, currentStatusIndex }) {
  const times = stageTimes(ticket, statusFlow);
  const n = statusFlow.length;

  return (
    <Card
      title="Progress"
      icon={<CheckCircle size={18} className="text-blue-600 shrink-0" />}
      actions={<span className="label">{currentStatusIndex + 1}/{n}</span>}
    >

      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {statusFlow.map((status, index) => {
          const isCompleted = index <= currentStatusIndex;
          const isCurrent = status === ticket.status;
          const leftDone = index <= currentStatusIndex;          // line coming into this step
          const rightDone = index < currentStatusIndex;          // line going to the next step
          const t = times[index];
          // only show a time for steps the ticket has actually reached
          const when = isCompleted ? t.at : null;
          const prevAt = index > 0 && isCompleted ? times[index - 1].at : null;
          const align = index === 0 ? 'left-0' : index === n - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';

          return (
            <div key={status} className="relative flex flex-col items-center group">
              {/* connector halves */}
              {index > 0 && (
                <div className={`absolute top-[13px] left-0 right-1/2 h-1 ${leftDone ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
              {index < n - 1 && (
                <div className={`absolute top-[13px] left-1/2 right-0 h-1 ${rightDone ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}

              {/* circle */}
              <div
                tabIndex={0}
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 cursor-default outline-none
                  ${isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}
                  ${isCurrent ? 'ring-4 ring-blue-100 ring-offset-1 border-2 border-blue-500' : ''}
                `}
              >
                {isCompleted ? <CheckCircle size={14} className="text-white" /> : index + 1}
              </div>

              <p className={`text-xs font-semibold mt-1.5 text-center ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-700' : 'text-gray-400'}`}>
                {status}
              </p>

              {/* hover / focus tooltip */}
              <div
                className={`pointer-events-none absolute bottom-full mb-2 ${align} z-30 w-max max-w-[240px] rounded-lg bg-slate-900 text-white px-3 py-2 shadow-xl
                  opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition`}
              >
                <p className="text-xs font-bold">{status}</p>
                {when ? (
                  <>
                    <p className="text-xs text-slate-200 mt-0.5">{fmtStageTime(when)}</p>
                    {t.by && <p className="text-xs text-slate-400 mt-0.5">by {t.by}</p>}
                    {prevAt && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtGap(prevAt, when)} after {statusFlow[index - 1]}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isCompleted ? 'Time not recorded' : 'Not reached yet'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}