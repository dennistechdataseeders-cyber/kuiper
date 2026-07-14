import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MessageSquare, Send, Users, 
  CheckCircle, XCircle, Clock, Image, X, AlertCircle, 
  Loader2, Eye, Download, UploadCloud, GitFork, Paperclip,
  File, FileText, FileArchive, FileSpreadsheet, FileVideo, FileAudio,
  FileCode, FileJson, Tag, Layers, Building2, Briefcase
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
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
  const { isCollapsed } = useSidebar();
  const socketRef = useRef();
  const commentsEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');
  const currentUserName = localStorage.getItem('userName');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ============================================
  // FILE CONFIGURATION
  // ============================================

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.tsv', '.rtf', '.odt', '.ods',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.ppt', '.pptx', '.odp',
    '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg',
    '.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma',
    '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
    '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.sass',
    '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
    '.sh', '.bash', '.bat', '.ps1', '.cmd',
    '.exe'
  ];

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

  const isAllowedFile = (file) => {
    const ext = getFileExtension(file.name);
    return ALLOWED_EXTENSIONS.includes(ext);
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
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
    
    const isCreator = ticketData.createdBy?._id === currentUserId || ticketData.createdBy === currentUserId;
    const isAssignee = ticketData.assignedTo?._id === currentUserId || ticketData.assignedTo === currentUserId;
    
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
        body: `${commentAuthor} commented${attachmentText}: "${ticketData.title.substring(0, 50)}"`,
        icon: '/images/login_img.png',
        tag: `comment-${ticketData._id}`,
        data: { ticketId: ticketData._id, type: 'ticket' },
        onClick: () => {
          window.focus();
          navigate(`/tickets/${ticketData._id}`);
        }
      });
    }
  };

  useEffect(() => {
    fetchTicketDetails();
    fetchDevelopers();
    
    notificationManager.initAudio();
    
    socketRef.current = io(API_BASE_URL);
    socketRef.current.emit('join-ticket-room', id);
    socketRef.current.emit('join-user-room', currentUserId);
    
    socketRef.current.on('ticket_updated', (updatedTicket) => {
      if (updatedTicket._id === id) {
        const oldStatus = ticket?.status;
        setTicket(updatedTicket);
        if (oldStatus && oldStatus !== updatedTicket.status) {
          if (updatedTicket.createdBy?._id === currentUserId || updatedTicket.assignedTo?._id === currentUserId) {
            notificationManager.notifyStatusUpdate(updatedTicket, oldStatus, updatedTicket.status, () => {
              navigate(`/tickets/${updatedTicket._id}`);
            });
          }
        }
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
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to load ticket details');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevelopers = async () => {
    if (userRole === 'HR' || userRole === 'Finance') return;
    if (userRole !== 'Project Manager' && userRole !== 'Admin' && userRole !== 'Team Lead') return;
    
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
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

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
      toast.error('Failed to close ticket');
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
      toast.success('Developer assigned successfully');
    } catch (error) {
      console.error('Error assigning developer:', error);
      toast.error('Failed to assign developer');
    } finally {
      setAssigning(false);
    }
  };

  const processFiles = (files) => {
    const validFiles = [];
    const validPreviews = [];

    files.forEach(file => {
      if (isAllowedFile(file)) {
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
      } else {
        toast.error(`File type "${file.name}" is not supported.`);
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...validPreviews]);
      toast.success(`${validFiles.length} file(s) added`);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
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

  // OPTIMIZED: Upload files with concurrency (max 3 at a time)
  const uploadFilesWithConcurrency = async (files) => {
    if (files.length === 0) return [];
    
    const uploadedUrls = [];
    const token = localStorage.getItem('token');
    const concurrencyLimit = 3;
    let completed = 0;
    
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
        
        axios.post(`${API_BASE_URL}/api/tickets/upload-file`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
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
          }
        })
        .catch(error => {
          console.error(`File upload failed for ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}: ${error.response?.data?.error || 'Unknown error'}`);
        })
        .finally(() => {
          completed++;
          // Start the next upload in the queue
          uploadNext(concurrencyLimit + index - 1);
        });
      };
      
      // Start the first batch of uploads
      for (let i = 0; i < Math.min(concurrencyLimit, files.length); i++) {
        uploadNext(i);
      }
    });
  };

  // OPTIMIZED: Debounced comment submission
  const addComment = async (e) => {
    if (e) e.preventDefault();
    
    // Prevent multiple submissions
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
      }
      
      const payload = {
        text: newComment.trim() || '📎 File(s) attached',
        files: uploadedFiles
      };
      
      const res = await axios.post(`${API_BASE_URL}/api/tickets/${id}/comments`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTicket(res.data);
      setNewComment('');
      setSelectedFiles([]);
      setFilePreviews([]);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      if (uploadedFiles.length > 0) {
        toast.success(`Comment added with ${uploadedFiles.length} attachment(s)`);
      } else {
        toast.success('Comment added');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.response?.data?.error || 'Failed to add comment');
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

  const isTicketCreator = ticket && ticket.createdBy && (ticket.createdBy._id === currentUserId || ticket.createdBy === currentUserId);

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

  const canAssignDeveloper = 
    userRole !== 'HR' && 
    userRole !== 'Finance' && 
    (userRole === 'Admin' || userRole === 'Project Manager' || userRole === 'Team Lead');

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((newComment.trim() || selectedFiles.length > 0) && !isSending) {
        addComment();
      }
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setNewComment(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const hasTicketAttachments = ticket.files && ticket.files.length > 0;

  return (
    <div className={`min-h-screen bg-gray-50 p-3 sm:p-6 transition-all duration-300 ${isCollapsed ? 'ml-10' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/tickets')}
          className="mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-xs sm:text-sm"
        >
          <ArrowLeft size={isMobile ? 16 : 18} />
          Back to Tickets
        </button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm font-medium text-gray-500">{ticket.ticketNumber}</span>
              <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-md ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
              <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-md ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              {ticket.isInternal && (
                <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-md bg-purple-100 text-purple-700">
                  Internal
                </span>
              )}
              {ticket.category === 'Production' && ticket.subcategory === 'Feasibility' && (
                <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-md bg-indigo-100 text-indigo-700">
                  🔬 Feasibility
                </span>
              )}
              {hasTicketAttachments && (
                <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-md bg-blue-100 text-blue-700">
                  {ticket.files.length} file(s)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight break-words">{ticket.title}</h1>
          </div>

          <div className="flex gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
            {isTicketCreator && ticket.status !== 'Closed' && (
              <button onClick={closeTicket} disabled={updating} className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-sm">
                <XCircle size={isMobile ? 14 : 16} /> Close
              </button>
            )}
            {(userRole === 'Project Manager' || userRole === 'Admin' || userRole === 'Developer' || userRole === 'Team Lead' || isTicketCreator) && 
            ticket.status !== 'Closed' && (
              <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto">
                {ticket.status !== 'In Progress' && (
                  <button 
                    onClick={() => updateStatus('In Progress')} 
                    disabled={updating} 
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-[10px] sm:text-sm font-medium transition-all shadow-sm"
                  >
                    Start
                  </button>
                )}
                {ticket.status !== 'Resolved' && (
                  <button 
                    onClick={() => updateStatus('Resolved')} 
                    disabled={updating} 
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] sm:text-sm font-medium transition-all shadow-sm"
                  >
                    Resolve
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Category & Subcategory Info Cards - Stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <Layers size={isMobile ? 14 : 16} className="text-blue-600" />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</span>
          </div>
          {ticket.category ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold border ${getCategoryColor(ticket.category)}`}>
                {ticket.category}
              </span>
              {ticket.subcategory && (
                <>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                    {ticket.subcategory}
                  </span>
                </>
              )}
              {ticket.subItem && (
                <>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {ticket.subItem}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400 italic">No category</span>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <Briefcase size={isMobile ? 14 : 16} className="text-blue-600" />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Project & Feed</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {ticket.projectId ? (
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Building2 size={isMobile ? 12 : 14} />
                {ticket.projectId.name || ticket.projectId.projectCustomId}
              </span>
            ) : (
              <span className="text-sm text-gray-400 italic">No project</span>
            )}
            {ticket.feedId && (
              <>
                <span className="text-gray-400 text-xs">/</span>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Tag size={isMobile ? 12 : 14} />
                  {ticket.feedId.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Attachments Section - Stack on mobile */}
      {hasTicketAttachments && (
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4 flex items-center gap-2">
            <Paperclip size={isMobile ? 14 : 16} className="text-blue-600" />
            Attachments ({ticket.files.length})
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {ticket.files.map((file, index) => {
              const isImage = isImageFile(file.originalName || file.filename);
              const fileUrl = file.url || `${API_BASE_URL}/uploads/tickets/${file.filename}`;
              
              return (
                <div key={index} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all group w-full sm:w-auto">
                  <div className="flex-shrink-0 w-8 sm:w-10 h-8 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
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
                    <p className="text-[9px] sm:text-xs font-semibold text-gray-700 truncate max-w-[120px] sm:max-w-[200px]">
                      {file.originalName || file.filename}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="text-[7px] sm:text-[8px] text-gray-400">{formatFileSize(file.size)}</span>
                      <span className="text-[7px] sm:text-[8px] text-gray-400 hidden sm:inline">•</span>
                      <span className="text-[7px] sm:text-[8px] text-gray-400 hidden sm:inline">{getFileTypeLabel(file)}</span>
                    </div>
                  </div>
                  {isImage && (
                    <button
                      onClick={() => setShowImageViewer(fileUrl)}
                      className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-all"
                      title="View image"
                    >
                      <Eye size={isMobile ? 12 : 14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleFileDownload(file)}
                    className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-all"
                    title="Download file"
                  >
                    <Download size={isMobile ? 12 : 14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Progress Map - Responsive */}
      <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 overflow-x-auto">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-4 sm:mb-6 flex items-center gap-2">
          <CheckCircle size={isMobile ? 14 : 16} className="text-blue-600" />
          Ticket Progress
        </h3>
        
        <div className="relative px-1 sm:px-2 min-w-[300px]">
          <div className="absolute top-3 sm:top-4 left-4 sm:left-6 right-4 sm:right-6 h-1 sm:h-1.5 bg-gray-200 rounded-full" />
          <div 
            className="absolute top-3 sm:top-4 left-4 sm:left-6 h-1 sm:h-1.5 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
            style={{ 
              width: `calc(${Math.min((currentStatusIndex / (statusFlow.length - 1)) * 100, 100)}% - ${isMobile ? 8 : 12}px)` 
            }}
          />
          
          <div className="flex justify-between items-start relative">
            {statusFlow.map((status, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = status === ticket.status;
              
              let statusDate = null;
              if (status === 'Open' && ticket.createdAt) {
                statusDate = ticket.createdAt;
              } else if (status === 'In Progress' && ticket.startedAt) {
                statusDate = ticket.startedAt;
              } else if (status === 'Resolved' && ticket.resolvedAt) {
                statusDate = ticket.resolvedAt;
              } else if (status === 'Closed' && ticket.closedAt) {
                statusDate = ticket.closedAt;
              }
              
              const formattedDate = statusDate 
                ? new Date(statusDate).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : null;
              
              return (
                <div 
                  key={status} 
                  className="flex flex-col items-center relative group"
                  style={{ 
                    minWidth: isMobile ? '40px' : '60px',
                    flex: '1 1 0%'
                  }}
                >
                  <div className="relative z-10">
                    <div 
                      className={`
                        w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center 
                        text-[10px] sm:text-sm font-bold transition-all duration-300 cursor-pointer
                        ${isCompleted 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-200' 
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }
                        ${isCurrent 
                          ? 'ring-2 sm:ring-4 ring-blue-100 ring-offset-1 sm:ring-offset-2 border-2 border-blue-500 shadow-lg shadow-blue-200' 
                          : ''
                        }
                        hover:scale-110 hover:shadow-xl
                      `}
                    >
                      {isCompleted ? <CheckCircle size={isMobile ? 10 : 16} className="text-white" /> : index + 1}
                    </div>
                  </div>
                  
                  <div className="mt-1 sm:mt-2 text-center min-h-[30px] sm:min-h-[40px] flex flex-col items-center">
                    <p className={`
                      text-[8px] sm:text-xs font-semibold transition-colors
                      ${isCompleted ? 'text-green-700' : 'text-gray-400'}
                      ${isCurrent ? 'text-blue-600 font-bold' : ''}
                    `}>
                      {isMobile ? status.substring(0, 1) : status}
                    </p>
                    {isCurrent && (
                      <span className="mt-0.5 text-[5px] sm:text-[8px] font-bold text-blue-600 uppercase tracking-wide animate-pulse">
                        ●
                      </span>
                    )}
                  </div>
                  {formattedDate && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none bg-gray-900 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-medium whitespace-nowrap shadow-lg z-20 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{status}</span>
                        <span className="text-gray-300 text-[7px] sm:text-[9px]">{formattedDate}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content Side */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Description Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">{ticket.description}</p>
          </div>
          
          {/* Chat Container Window - Full width on mobile */}
          <div 
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 z-50 flex flex-col items-center justify-center transition-all pointer-events-none p-4">
                <div className="bg-white p-3 sm:p-4 rounded-full shadow-lg flex items-center justify-center animate-bounce mb-2">
                  <UploadCloud size={isMobile ? 24 : 32} className="text-blue-600" />
                </div>
                <p className="text-sm sm:text-lg font-bold text-blue-700 text-center">Drop files here</p>
                <p className="text-blue-600/80 text-[10px] sm:text-xs text-center">Images, documents, archives, code, media (Max 50MB)</p>
              </div>
            )}

            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-2">
                <MessageSquare size={isMobile ? 16 : 20} className="text-gray-500" />
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                  Conversation ({ticket.comments?.length || 0})
                </h2>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 hidden sm:block">Discuss this ticket with the team or drag files to upload</p>
            </div>
            
            <div className="flex-1 max-h-[300px] sm:max-h-[400px] overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 bg-gray-50/50">
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
                        <div className={`flex-shrink-0 w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-sm shadow-sm ${
                          isCurrentUser ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {userInitial}
                        </div>
                        
                        <div className={`flex-1 max-w-[75%] sm:max-w-[70%] ${isCurrentUser ? 'items-end' : ''}`}>
                          <div className={`rounded-lg p-2 sm:p-3 shadow-sm ${
                            isCurrentUser ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'
                          }`}>
                            <div className={`text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                              {commentUser}
                            </div>
                            
                            {comment.text && (
                              <div className={`text-xs sm:text-sm leading-relaxed ${isCurrentUser ? 'text-white' : 'text-gray-700'} break-words`}>
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
                              <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                                {comment.images.map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group">
                                    <img
                                      src={img}
                                      alt={`Attachment ${imgIdx + 1}`}
                                      className="max-w-[120px] sm:max-w-[200px] max-h-[100px] sm:max-h-[150px] rounded-lg cursor-pointer border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                                      onClick={() => setShowImageViewer(img)}
                                    />
                                    <button
                                      onClick={() => setShowImageViewer(img)}
                                      className="absolute top-0.5 sm:top-1 right-0.5 sm:right-1 p-0.5 sm:p-1 bg-black/60 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Eye size={isMobile ? 8 : 12} className="text-white" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {hasFiles && (
                              <div className="mt-1.5 sm:mt-2 space-y-1.5 sm:space-y-2">
                                {comment.files.map((file, fileIdx) => (
                                  <div key={fileIdx} className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 bg-white/10 rounded-lg border border-gray-200/20 hover:bg-white/20 transition-all group">
                                    <div className="flex-shrink-0 w-6 sm:w-8 h-6 sm:h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
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
                                      <p className="text-[9px] sm:text-xs font-semibold text-gray-700 truncate">
                                        {file.originalName || file.filename}
                                      </p>
                                      <p className="text-[7px] sm:text-[8px] text-gray-400 flex flex-wrap items-center gap-1 sm:gap-2">
                                        <span>{formatFileSize(file.size)}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="hidden sm:inline">{getFileTypeLabel(file)}</span>
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleFileDownload(file)}
                                      className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-all"
                                      title="Download file"
                                    >
                                      <Download size={isMobile ? 12 : 14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 sm:mt-1 text-[8px] sm:text-[10px] text-gray-400 ${isCurrentUser ? 'justify-end' : ''}`}>
                            <Clock size={isMobile ? 8 : 10} />
                            <span>{commentTime}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                  <MessageSquare size={isMobile ? 32 : 48} className="text-gray-300 mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">No comments yet</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 max-w-xs mx-auto">Start the conversation by typing a message below or dropping a file.</p>
                </div>
              )}
            </div>
            
            {/* Form Box - Responsive */}
            <div className="border-t border-gray-200 bg-white p-2 sm:p-4">
              {filePreviews.length > 0 && (
                <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-gray-50 rounded-lg border border-gray-200">
                  {filePreviews.map((preview, idx) => (
                    <div key={preview.id || idx} className="relative group">
                      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex-shrink-0 w-6 sm:w-8 h-6 sm:h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                          {preview.file.type?.startsWith('image/') || isImageFile(preview.name) ? (
                            <img 
                              src={preview.preview || URL.createObjectURL(preview.file)} 
                              alt={preview.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            getFileIcon(preview.file)
                          )}
                        </div>
                        <div className="min-w-0 max-w-[80px] sm:max-w-[120px]">
                          <p className="text-[8px] sm:text-[10px] font-semibold text-gray-700 truncate">{preview.name}</p>
                          <p className="text-[6px] sm:text-[8px] text-gray-400">{formatFileSize(preview.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md opacity-0 group-hover:opacity-100"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-1.5 sm:gap-2 w-full bg-gray-50 border border-gray-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                <textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={handleTextareaChange}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={isMobile ? "Write..." : "Write your message..."}
                  className="flex-1 bg-transparent px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 outline-none resize-none self-center min-h-[32px] sm:min-h-[38px] max-h-[80px] sm:max-h-[120px]"
                  rows={1}
                  disabled={isSending}
                />
                
                <div className="flex items-center self-center h-full px-0.5 sm:px-1 gap-0.5 sm:gap-1">
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
                    disabled={uploadingFiles || isSending}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200/70 rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
                    title="Attach files"
                  >
                    <Paperclip size={isMobile ? 14 : 18} />
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => addComment()}
                  disabled={(!newComment.trim() && selectedFiles.length === 0) || uploadingFiles || isSending}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-md transition-all flex items-center gap-1 font-medium text-[10px] sm:text-sm shadow-sm h-[28px] sm:h-[36px] self-center disabled:shadow-none"
                >
                  {isSending ? <Loader2 size={isMobile ? 12 : 16} className="animate-spin" /> : <Send size={isMobile ? 12 : 15} />}
                  <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
              
              <div className="flex flex-wrap justify-between text-[9px] sm:text-[11px] text-gray-400 mt-1 sm:mt-2 px-0.5 sm:px-1">
                <span className="hidden sm:inline">Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
                <span className="text-[8px] sm:text-[11px]">
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-blue-500 hover:underline">
                    Attach
                  </button>
                  {' '}(5MB images • 50MB files)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Info Sidebar Segment - Stack on mobile */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-xs sm:text-sm uppercase tracking-wider">Ticket Metadata</h3>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</p>
                <div className="flex items-center gap-2 mt-1">
                  <User size={isMobile ? 13 : 15} className="text-gray-400" />
                  <span className="text-xs sm:text-sm text-gray-800 font-medium">{ticket.createdBy?.name}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Created At</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar size={isMobile ? 13 : 15} className="text-gray-400" />
                  <span className="text-xs sm:text-sm text-gray-800 font-medium">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ticket.category ? (
                    <>
                      <span className={`inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-xs font-semibold ${getCategoryColor(ticket.category)}`}>
                        {ticket.category}
                      </span>
                      {ticket.subcategory && (
                        <span className="inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                          {ticket.subcategory}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not specified</span>
                  )}
                </div>
              </div>

              {userRole !== 'Client' && (
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Assigned To</p>
                  <div className="mt-1.5">
                    {ticket.assignedTo ? (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                        <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-[8px] sm:text-xs font-bold">
                          {ticket.assignedTo.name?.charAt(0).toUpperCase() || 'D'}
                        </div>
                        <div>
                          <p className="text-[11px] sm:text-sm font-semibold text-gray-800">{ticket.assignedTo.name}</p>
                          <p className="text-[9px] sm:text-xs text-gray-500 truncate max-w-[140px] sm:max-w-none">{ticket.assignedTo.email}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle size={isMobile ? 14 : 16} className="text-amber-600" />
                        <span className="text-[11px] sm:text-sm text-amber-700 font-medium">Unassigned</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Scope</p>
                <p className="text-xs sm:text-sm text-gray-800 font-medium mt-1.5 bg-gray-50 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md border border-gray-200 break-words">
                  {ticket.projectId?.name || (ticket.category === 'Production' && ticket.subcategory === 'Feasibility' ? '🔬 General (Feasibility)' : 'General')}
                </p>
              </div>
              {ticket.feedId && (
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Related Feed</p>
                  <p className="text-xs sm:text-sm text-gray-800 font-medium mt-1.5">{ticket.feedId?.name}</p>
                </div>
              )}
              {ticket.resolvedAt && (
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-green-600 uppercase tracking-wider">Resolved At</p>
                  <p className="text-xs sm:text-sm text-gray-800 font-medium mt-1">{new Date(ticket.resolvedAt).toLocaleString()}</p>
                </div>
              )}
              {ticket.closedAt && (
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-red-600 uppercase tracking-wider">Closed At</p>
                  <p className="text-xs sm:text-sm text-gray-800 font-medium mt-1">{new Date(ticket.closedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Assignment Management - Responsive */}
          {userRole !== 'Client' && canAssignDeveloper && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider">
                <Users size={isMobile ? 14 : 16} className="text-gray-500" /> Assignment
              </h3>
              {ticket.assignedTo ? (
                <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-green-50/70 border border-green-200 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-green-700 font-semibold mb-0.5 sm:mb-1">Current:</p>
                  <p className="font-semibold text-gray-900 text-xs sm:text-sm">{ticket.assignedTo.name}</p>
                  <p className="text-[9px] sm:text-xs text-gray-500 mt-0.5 truncate">{ticket.assignedTo.email}</p>
                  {ticket.assignedTo.githubUsername && (
                    <div className="flex items-center gap-1 mt-1 text-[9px] sm:text-xs text-gray-500">
                      <GitFork size={isMobile ? 10 : 12} />
                      <span>GitHub: {ticket.assignedTo.githubUsername}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-xs rounded-lg font-medium">
                  {ticket.category === 'Production' && ticket.subcategory === 'Feasibility' 
                    ? 'Feasibility ticket needs a developer.' 
                    : 'Ticket is unassigned.'}
                </div>
              )}
              {(userRole === 'Project Manager' || userRole === 'Admin' || userRole === 'Team Lead') && (
                <select 
                  onChange={(e) => assignDeveloper(e.target.value)} 
                  disabled={assigning} 
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer" 
                  defaultValue=""
                >
                  <option value="">{ticket.assignedTo ? 'Reassign...' : 'Assign...'}</option>
                  {developers.map(dev => (
                    <option key={dev._id} value={dev._id}>{dev.name}</option>
                  ))}
                </select>
              )}
              {userRole === 'Developer' && ticket.assignedTo?._id === currentUserId && (
                <div className="mt-2 text-[10px] sm:text-xs text-green-600 font-medium flex items-center gap-1.5">
                  <CheckCircle size={isMobile ? 12 : 14} /> You are assigned.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Image Viewer */}
      {showImageViewer && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4" onClick={() => setShowImageViewer(null)}>
          <div className="relative max-w-[95vw] sm:max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img src={showImageViewer} alt="Full size view" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            
            <div className="absolute -top-10 sm:-top-12 right-0 flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  const file = { 
                    filename: showImageViewer.split('/').pop(),
                    originalName: showImageViewer.split('/').pop()
                  };
                  handleFileDownload(file);
                }}
                className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1 text-white text-[10px] sm:text-xs font-medium backdrop-blur-sm"
              >
                <Download size={isMobile ? 12 : 15} /> Download
              </button>
              <button 
                type="button"
                onClick={() => setShowImageViewer(null)} 
                className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors backdrop-blur-sm"
              >
                <X size={isMobile ? 16 : 18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetails;