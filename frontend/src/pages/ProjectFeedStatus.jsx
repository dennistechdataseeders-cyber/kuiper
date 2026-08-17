// frontend/src/pages/ProjectFeedStatus.jsx
// (Renamed from ClientProjectFeeds.jsx to reflect multi-role support)

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, Activity, Clock, CheckCircle, XCircle, AlertCircle, 
  Filter, Info, ChevronDown, ChevronUp, Copy, Check, Hash, 
  Paperclip, UploadCloud, File, FileText, FileSpreadsheet, 
  FileArchive, FileVideo, FileAudio, FileCode, X, Image,
  FolderOpen, HardDrive, Database, Hourglass
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

const getStatusColor = (status) => {
  switch(status) {
    case 'Completed': return 'bg-green-100 text-green-700';
    case 'In Progress': return 'bg-blue-100 text-blue-700';
    case 'Failed': return 'bg-red-100 text-red-700';
    case 'Not Started': return 'bg-slate-100 text-slate-600';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// All stages in order for the progress bar (5 stages)
const STAGES = [
  { key: 'extraction_done', label: 'Extraction Done' },
  { key: 'file_generated', label: 'File Generated' },
  { key: 'file_integrity', label: 'Integrity Check' },
  { key: 'upload_path', label: 'Uploading' },
  { key: 'process_complete', label: 'Completed' }
];

// Frontend-only stage shown at the very start of the stepper.
const DISPLAY_STAGES = [
  { key: '__in_progress__', label: 'In Progress', virtual: true },
  ...STAGES
];

const STATUS_FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Failed', 'Not Started'];

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.odt', '.ods',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  // Presentations
  '.ppt', '.pptx', '.odp',
  // Video
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg',
  // Audio
  '.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma',
  // Code/Config
  '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.sass',
  '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.bat', '.ps1', '.cmd',
  '.exe'
];

const getFileExtension = (filename) => {
  if (!filename) return '';
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? '.' + ext : '';
};

const isImageFile = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
  return imageExtensions.includes(getFileExtension(filename));
};

const isAllowedFile = (file) => {
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
};

const getFileIcon = (file) => {
  const ext = file.name?.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <Image size={16} className="text-blue-500" />;
  }
  if (['pdf'].includes(ext)) return <FileText size={16} className="text-red-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText size={16} className="text-blue-600" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={16} className="text-green-600" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={16} className="text-amber-600" />;
  if (['mp4', 'avi', 'mkv'].includes(ext)) return <FileVideo size={16} className="text-indigo-500" />;
  if (['mp3', 'wav', 'aac'].includes(ext)) return <FileAudio size={16} className="text-pink-500" />;
  if (['js', 'py', 'java', 'json', 'xml'].includes(ext)) return <FileCode size={16} className="text-purple-500" />;
  return <File size={16} className="text-slate-400" />;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
};

// ============================================
// Helper function to extract file info from feed
// ============================================
const getFileInfo = (feed) => {
  const outputPath = feed.output_path;
  
  // Case 1: Single file object with path and size
  if (outputPath && typeof outputPath === 'object' && !Array.isArray(outputPath)) {
    if (outputPath.path) {
      return {
        type: 'single',
        files: [{
          path: outputPath.path,
          size: outputPath.size || null,
          size_bytes: outputPath.size_bytes || null
        }],
        total_files: 1,
        total_size: outputPath.size || null
      };
    }
  }
  
  // Case 2: Array of file objects with path and size
  if (Array.isArray(outputPath) && outputPath.length > 0) {
    if (typeof outputPath[0] === 'object' && outputPath[0].path) {
      return {
        type: 'multiple',
        files: outputPath.map(f => ({
          path: f.path,
          size: f.size || null,
          size_bytes: f.size_bytes || null
        })),
        total_files: outputPath.length,
        total_size: outputPath.reduce((total, f) => {
          if (f.size) return total + ' + ' + f.size;
          return total;
        }, '').replace(/^ \+ /, '') || null
      };
    }
    
    // Case 3: Array of strings (legacy)
    return {
      type: 'legacy',
      files: outputPath.map(p => ({
        path: p,
        size: null,
        size_bytes: null
      })),
      total_files: outputPath.length,
      total_size: null
    };
  }
  
  // Case 4: Single string (legacy)
  if (typeof outputPath === 'string' && outputPath.trim()) {
    return {
      type: 'legacy',
      files: [{ path: outputPath, size: null, size_bytes: null }],
      total_files: 1,
      total_size: null
    };
  }
  
  return null;
};

const ProjectFeedStatus = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedFeed, setExpandedFeed] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const { isCollapsed } = useSidebar();
  const socketRef = useRef(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [copiedPath, setCopiedPath] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // ============================================
  // NEW: State for total project feeds count from main Feed table
  // ============================================
  const [totalProjectFeeds, setTotalProjectFeeds] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(true);
  
  // ============================================
  // NEW: State for Not Started feeds
  // ============================================
  const [notStartedFeeds, setNotStartedFeeds] = useState([]);
  const [allProjectFeeds, setAllProjectFeeds] = useState([]);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ============================================
  // FILE UPLOAD STATE
  // ============================================
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Get user role for determining navigation
  const userRole = localStorage.getItem('role');

  // ============================================
  // FILE HANDLERS
  // ============================================

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
      const docCount = validFiles.filter(f => !isImageFile(f.name)).length;
      
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

  // Helper to safely unpack nested MongoDB $date values or flat ISO string timestamps
  const unpackDate = (dateObj) => {
    if (!dateObj) return null;
    if (typeof dateObj === 'object' && dateObj.$date) return dateObj.$date;
    return dateObj;
  };

  // Get the actual project ID with better validation
  const getProjectId = () => {
    if (projectId && projectId !== 'undefined' && projectId !== 'null') {
      return projectId;
    }
    if (location.state?.projectId && 
        location.state?.projectId !== 'undefined' && 
        location.state?.projectId !== 'null') {
      return location.state.projectId;
    }
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    if (projectsIndex !== -1 && projectsIndex + 1 < pathParts.length) {
      const idFromPath = pathParts[projectsIndex + 1];
      if (idFromPath && idFromPath !== 'undefined' && idFromPath !== 'null') {
        return idFromPath;
      }
    }
    return null;
  };

  const actualProjectId = getProjectId();

  // Helper function to normalize output path to an array of non-empty strings (supports comma separation)
  const getNormalizedPaths = (outputPath) => {
    if (!outputPath) return [];
    if (Array.isArray(outputPath)) {
      return outputPath.filter(p => typeof p === 'string' && p.trim() !== '');
    }
    if (typeof outputPath === 'string' && outputPath.trim() !== '') {
      if (outputPath.includes(',')) {
        return outputPath.split(',').map(p => p.trim()).filter(p => p !== '');
      }
      return [outputPath.trim()];
    }
    return [];
  };

  // Fallback copy method using a temporary textarea
  const fallbackCopy = (text, identifier, pathData) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setCopiedPath(identifier);
        toast.success(Array.isArray(pathData) && pathData.length > 1 ? 'All paths copied!' : 'Path copied to clipboard!');
        setTimeout(() => setCopiedPath(null), 2000);
      } else {
        toast.error('Failed to copy path. Please copy manually.');
      }
    } catch (err) {
      toast.error('Failed to copy path. Please copy manually.');
    }
  };

  // Copy single or multi paths to clipboard with fallback
  const copyToClipboard = (pathData, identifier) => {
    if (!pathData) return;
    const textToCopy = Array.isArray(pathData) ? pathData.join('\n') : pathData;

    // Try using the modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopiedPath(identifier);
          toast.success(Array.isArray(pathData) && pathData.length > 1 ? 'All paths copied!' : 'Path copied to clipboard!');
          setTimeout(() => setCopiedPath(null), 2000);
        })
        .catch(() => {
          // Fallback for clipboard errors
          fallbackCopy(textToCopy, identifier, pathData);
        });
    } else {
      // Fallback for browsers that don't support Clipboard API
      fallbackCopy(textToCopy, identifier, pathData);
    }
  };

  // ============================================
  // WEB SOCKET SETUP
  // ============================================

  // Setup WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !actualProjectId) return;

    let newSocket = null;

    const connectSocket = () => {
      try {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        newSocket = io(API_BASE_URL, {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
          autoConnect: true
        });

        socketRef.current = newSocket;

        newSocket.on('connect', () => {
          setIsSocketConnected(true);
          reconnectAttempts.current = 0;
          newSocket.emit('join-project-room', actualProjectId);
        });

        newSocket.on('connect_error', (error) => {
          setIsSocketConnected(false);
          reconnectAttempts.current += 1;
          if (reconnectAttempts.current >= maxReconnectAttempts) {
            if (newSocket) {
              newSocket.io.opts.transports = ['polling'];
              newSocket.connect();
            }
          }
        });

        newSocket.on('disconnect', (reason) => {
          setIsSocketConnected(false);
          if (reason === 'io server disconnect') {
            setTimeout(() => { if (newSocket) newSocket.connect(); }, 2000);
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          setIsSocketConnected(true);
          reconnectAttempts.current = 0;
          if (newSocket) {
            newSocket.emit('join-project-room', actualProjectId);
          }
        });

        newSocket.on('feed_status_updated', (data) => {
          setFeeds(prevFeeds => {
            return prevFeeds.map(feed => {
              const feedName = feed.feed_name || feed.name;
              const dataFeedName = data.feed_name || data.feedName;
              const matchesName = feedName === dataFeedName;
              const matchesId = feed._id === data.feed_id || feed._id === data.feedId || feed._id === dataFeedName;
              
              if (matchesName || matchesId) {
                const stages = data.stages || feed.stages || {};
                const totalStages = STAGES.length;
                const completedStages = STAGES.filter(stage => stages[stage.key]?.completed === true).length;
                const calculatedProgress = data.progress !== undefined ? data.progress : Math.round((completedStages / totalStages) * 100);
                
                let calculatedStatus = data.status || feed.status || 'Pending';
                if (data.failed === true) {
                  calculatedStatus = 'Failed';
                } else if (calculatedProgress === 100) {
                  calculatedStatus = 'Completed';
                } else if (calculatedProgress > 0) {
                  calculatedStatus = 'In Progress';
                } else {
                  calculatedStatus = 'Pending';
                }

                const inboundCount = data.record_count !== undefined ? data.record_count : (data.count !== undefined ? data.count : null);
                
                return {
                  ...feed,
                  status: calculatedStatus,
                  progress: calculatedProgress,
                  stages: stages,
                  failed: data.failed || false,
                  error_message: data.error_message || '',
                  updated_at: unpackDate(data.updated_at) || new Date().toISOString(),
                  feed_name: data.feed_name || feed.feed_name,
                  date: data.date || feed.date,
                  project: data.project || feed.project,
                  client: data.client || feed.client,
                  feed_type: data.feed_type || feed.feed_type,
                  output_path: data.path !== undefined ? data.path : (data.output_path !== undefined ? data.output_path : feed.output_path || null),
                  record_count: inboundCount !== null ? inboundCount : feed.record_count
                };
              }
              return feed;
            });
          });
        });

        newSocket.on('feed_stage_updated', (data) => {
          setFeeds(prevFeeds => {
            return prevFeeds.map(feed => {
              const feedName = feed.feed_name || feed.name;
              const dataFeedName = data.feed_name || data.feedName;
              const matchesName = feedName === dataFeedName;
              const matchesId = feed._id === data.feed_id || feed._id === data.feedId;
              if (matchesName || matchesId) {
                const updatedStages = { ...(feed.stages || {}) };
                if (data.stage && data.completed !== undefined) {
                  updatedStages[data.stage] = {
                    completed: data.completed,
                    completed_at: unpackDate(data.timestamp || data.completed_at) || new Date().toISOString()
                  };
                }
                
                const totalStages = STAGES.length;
                const completedStages = STAGES.filter(stage => updatedStages[stage.key]?.completed === true).length;
                const calculatedProgress = Math.round((completedStages / totalStages) * 100);
                
                let calculatedStatus = feed.status || 'Pending';
                if (calculatedProgress === 100) {
                  calculatedStatus = 'Completed';
                } else if (calculatedProgress > 0) {
                  calculatedStatus = 'In Progress';
                } else {
                  calculatedStatus = 'Pending';
                }

                const inboundCount = data.record_count !== undefined ? data.record_count : (data.count !== undefined ? data.count : null);
                
                return {
                  ...feed,
                  stages: updatedStages,
                  progress: calculatedProgress,
                  status: calculatedStatus,
                  output_path: data.path !== undefined ? data.path : (data.output_path !== undefined ? data.output_path : feed.output_path || null),
                  record_count: inboundCount !== null ? inboundCount : feed.record_count,
                  updated_at: new Date().toISOString()
                };
              }
              return feed;
            });
          });
        });

      } catch (error) {
        setIsSocketConnected(false);
      }
    };

    const initialConnectTimer = setTimeout(() => {
      connectSocket();
    }, 500);

    return () => {
      clearTimeout(initialConnectTimer);
      if (socketRef.current) {
        socketRef.current.emit('leave-project-room', actualProjectId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [actualProjectId]);

  // ============================================
  // FETCH FEEDS
  // ============================================

  // Fetch feeds on mount and when project changes
  useEffect(() => {
    if (!actualProjectId) {
      toast.error('Invalid project URL');
      setLoading(false);
      return;
    }

    if (location.state?.projectName) {
      setProjectName(location.state.projectName);
    } else if (location.state?.projectCustomId) {
      setProjectName(location.state.projectCustomId);
    }

    fetchFeeds(actualProjectId);
    
    const interval = setInterval(() => {
      if (!isSocketConnected) {
        fetchFeeds(actualProjectId);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [projectId, location]);

  // ============================================
  // NEW: Fetch total project feeds and not-started feeds from main Feed table
  // ============================================
  const fetchProjectFeedsFromMainTable = async () => {
    setLoadingTotal(true);
    try {
      const token = localStorage.getItem('token');
      
      // Use the admin projects endpoint to get all projects with feeds
      const res = await axios.get(`${API_BASE_URL}/api/admin/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Find the project with matching ID
      const project = res.data.find(p => p._id === actualProjectId);
      
      if (project) {
        // Get all feeds from the main Feed table
        const allFeeds = project.feeds || [];
        setAllProjectFeeds(allFeeds);
        
        // Filter out On Hold (all types) and Closed feeds for total count
        const activeFeeds = allFeeds.filter(feed => {
          const status = feed.feedStatus || '';
          return status !== 'Closed' && !status.includes('ON hold');
        });
        setTotalProjectFeeds(activeFeeds.length);
        
        // ============================================
        // NEW: Find feeds that are "Not Started"
        // A feed is "Not Started" if it:
        // 1. Has NO entry in the FeedStatus collection for today
        // 2. OR has status 'Pending' with no progress
        // ============================================
        const feedStatusNames = new Set(feeds.map(f => f.feed_name));
        
        const notStarted = allFeeds.filter(feed => {
          const status = feed.feedStatus || '';
          // Skip if feed is Closed or On Hold
          if (status === 'Closed' || status.includes('ON hold')) return false;
          
          // Check if this feed has any status data in the current feeds array
          // (feeds array contains data from FeedStatus collection)
          const hasStatusData = feedStatusNames.has(feed.name);
          
          // If no status data, it's not started
          return !hasStatusData;
        });
        
        setNotStartedFeeds(notStarted);
        
        console.log(`📊 Total feeds: ${allFeeds.length}, Active: ${activeFeeds.length}, Not Started: ${notStarted.length}`);
      } else {
        setTotalProjectFeeds(0);
        setNotStartedFeeds([]);
        setAllProjectFeeds([]);
      }
    } catch (error) {
      console.error('Error fetching project feeds from main table:', error);
      // Fallback: try to get from current feeds data
      if (feeds && feeds.length > 0) {
        const uniqueFeeds = new Set(feeds.map(f => f.feed_name || f.name));
        setTotalProjectFeeds(uniqueFeeds.size || feeds.length);
      } else {
        setTotalProjectFeeds(0);
      }
      setNotStartedFeeds([]);
      setAllProjectFeeds([]);
    } finally {
      setLoadingTotal(false);
    }
  };

  // Fetch project feeds from main table when project ID is available
  useEffect(() => {
    if (actualProjectId) {
      fetchProjectFeedsFromMainTable();
    }
  }, [actualProjectId]);

  // Also fetch when feeds data changes (to detect not-started feeds)
  useEffect(() => {
    if (actualProjectId && feeds.length > 0) {
      fetchProjectFeedsFromMainTable();
    }
  }, [feeds]);

  const fetchFeeds = async (id) => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Determine which endpoint to use based on role
      let endpoint = `/api/client/projects/${id}/feeds`;
      
      const res = await axios.get(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const transformedFeeds = res.data.map((feed, index) => {
        const feedId = feed.feed_name || feed._id || feed.id || `feed_${index}_${Date.now()}`;
        const stages = feed.stages || {};
        const totalStages = STAGES.length;
        const completedStages = STAGES.filter(stage => stages[stage.key]?.completed === true).length;
        const calculatedProgress = feed.progress !== undefined ? feed.progress : Math.round((completedStages / totalStages) * 100);
        
        let calculatedStatus = feed.status || feed.feedStatus || 'Pending';
        if (feed.failed) {
          calculatedStatus = 'Failed';
        } else if (calculatedProgress === 100) {
          calculatedStatus = 'Completed';
        } else if (calculatedProgress > 0) {
          calculatedStatus = 'In Progress';
        } else {
          calculatedStatus = 'Pending';
        }
        
        const parsedUpdatedAt = unpackDate(feed.updated_at || feed.updatedAt || feed.created_at || feed.createdAt);

        let recordCount = null;
        if (feed.record_count !== undefined && feed.record_count !== null) {
          recordCount = feed.record_count;
        } else if (feed.count !== undefined && feed.count !== null) {
          recordCount = feed.count;
        }

        return {
          feed_name: feed.feed_name || feed.name || 'Unnamed Feed',
          _id: feedId,
          id: feedId,
          status: calculatedStatus,
          progress: calculatedProgress,
          stages: stages,
          failed: feed.failed || false,
          error_message: feed.error_message || '',
          updated_at: parsedUpdatedAt,
          date: feed.date || new Date().toISOString().split('T')[0],
          project: feed.project || 'Unknown Project',
          client: feed.client || 'Client',
          feed_type: feed.feed_type || 'Daily',
          feedType: feed.feed_type || feed.feedType || 'N/A',
          projectName: feed.project || feed.projectName || 'Unknown Project',
          projectCustomId: feed.projectCustomId || feed.project || 'Project',
          projectId: feed.projectId || feed.project || id,
          output_path: feed.output_path || feed.path || null,
          record_count: recordCount,
          ...feed
        };
      });
      
      setFeeds(transformedFeeds);
      
      if (transformedFeeds.length > 0) {
        setProjectName(transformedFeeds[0].projectCustomId || transformedFeeds[0].project || 'Project');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load feeds');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const formatISTTime = (dateString) => {
    const usableDateStr = unpackDate(dateString);
    if (!usableDateStr) return 'N/A';
    try {
      const date = new Date(usableDateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return 'N/A';
    }
  };

  const getProgressColor = (feed) => {
    if (feed.failed) return 'bg-red-500';
    if (feed.progress === 100) return 'bg-green-500';
    return 'bg-blue-500';
  };

  // Get navigation path based on role
  const getBackPath = () => {
    switch(userRole) {
      case 'Client': return '/client';
      case 'Project Manager': return '/pm/feed-status';
      case 'Developer': return '/developer/feed-status';
      case 'Team Lead': return '/teamlead/feed-status';
      default: return '/client';
    }
  };

  // Filter feeds including Not Started
  const getFilteredFeeds = () => {
    if (statusFilter === 'All') {
      return feeds;
    }
    if (statusFilter === 'Not Started') {
      // Return the not-started feeds from the main table
      return notStartedFeeds.map(feed => ({
        feed_name: feed.name,
        _id: feed._id,
        id: feed._id,
        status: 'Not Started',
        progress: 0,
        stages: {},
        failed: false,
        error_message: '',
        date: new Date().toISOString().split('T')[0],
        project: projectName,
        client: 'Client',
        feed_type: feed.feedType || 'Daily',
        feedType: feed.feedType || 'Daily',
        projectName: projectName,
        projectCustomId: projectName,
        projectId: actualProjectId,
        output_path: null,
        record_count: null,
        isNotStarted: true,
        feedStatus: feed.feedStatus || 'New'
      }));
    }
    return feeds.filter(feed => feed.status === statusFilter);
  };

  const filteredFeeds = getFilteredFeeds();
  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFeeds = filteredFeeds.slice(startIndex, endIndex);

  useEffect(() => { setCurrentPage(1); }, [statusFilter]);

  // Update stats to include Not Started count
  const stats = {
    total: feeds.length,
    completed: feeds.filter(f => f.status === 'Completed').length,
    inProgress: feeds.filter(f => f.status === 'In Progress').length,
    failed: feeds.filter(f => f.failed).length,
    pending: feeds.filter(f => f.status === 'Pending' || !f.status).length,
    notStarted: notStartedFeeds.length,
    completionPercentage: feeds.length > 0 ? Math.round((feeds.filter(f => f.status === 'Completed').length / feeds.length) * 100) : 0
  };

  const toggleExpand = (feedId) => {
    setExpandedFeed(expandedFeed === feedId ? null : feedId);
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-3 sm:p-4 transition-all duration-300 ${isCollapsed ? 'ml-7 sm:ml-20' : 'ml-64'}`}>
      {/* Header Controls */}
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate(getBackPath(), { state: { returnTo: 'projects' } })}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors text-xs sm:text-sm"
          >
            <ChevronLeft size={isMobile ? 16 : 18} />
            <span className="font-medium hidden xs:inline">Back</span>
          </button>
          <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate max-w-[120px] sm:max-w-[250px]">
            {projectName || 'Project Feeds'}
          </h1>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          {/* Filter Buttons - Horizontal scroll on mobile */}
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 shadow-sm px-1.5 sm:px-2 py-1 overflow-x-auto max-w-[180px] sm:max-w-none">
            <Filter size={isMobile ? 12 : 14} className="text-slate-400 flex-shrink-0 mr-0.5 sm:mr-1" />
            <div className="flex items-center gap-0.5">
              {STATUS_FILTERS.slice(0, isMobile ? 4 : 6).map(filter => {
                let count = 0;
                if (filter === 'All') {
                  count = feeds.length + notStartedFeeds.length;
                } else if (filter === 'Not Started') {
                  count = notStartedFeeds.length;
                } else {
                  count = feeds.filter(f => f.status === filter).length;
                }
                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-1 sm:px-2 py-0.5 rounded-md text-[6px] sm:text-[8px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      statusFilter === filter ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {filter === 'All' ? 'All' : filter === 'In Progress' ? 'Prog' : filter === 'Not Started' ? 'NotStrt' : filter}
                    {filter !== 'All' && `(${count})`}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Items Per Page - Hidden on very small screens */}
          <div className="hidden xs:flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 shadow-sm px-1.5 sm:px-2 py-1">
            <span className="text-[6px] sm:text-[8px] font-black text-slate-500">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-[8px] sm:text-[10px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[40px] sm:max-w-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          {/* Connection Status - Hidden on very small screens */}
          <div className={`hidden sm:flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border transition-colors ${isSocketConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <span className="relative flex h-1.5 sm:h-2 w-1.5 sm:w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full ${isSocketConnected ? 'animate-ping bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 sm:h-2 w-1.5 sm:w-2 ${isSocketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className={`text-[6px] sm:text-[8px] font-bold uppercase tracking-wider ${isSocketConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isSocketConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row - Clickable cards with filter functionality */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-0.5 sm:gap-1 mb-1.5 sm:mb-2">
        {/* Total Feeds in Project - Shows all feeds from the main Feed table */}
        <div 
          className="bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm"
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-purple-500">Total Feeds</p>
          <p className="text-sm sm:text-base font-black text-purple-600">
            {loadingTotal ? '...' : totalProjectFeeds}
          </p>
        </div>

        {/* Not Started */}
        <div 
          onClick={() => setStatusFilter('Not Started')}
          className={`bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'Not Started' ? 'border-slate-500 ring-1 sm:ring-2 ring-slate-200' : 'border-slate-200'
          }`}
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-slate-500">
            <Hourglass size={isMobile ? 8 : 10} className="inline mr-0.5" />
            Not Started
          </p>
          <p className="text-sm sm:text-base font-black text-slate-600">{stats.notStarted}</p>
        </div>

        {/* Total - Shows all feeds from today's FeedStatus */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'All' ? 'border-blue-500 ring-1 sm:ring-2 ring-blue-200' : 'border-slate-200'
          }`}
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-slate-400">Today</p>
          <p className="text-sm sm:text-base font-black text-slate-800">{stats.total}</p>
        </div>

        {/* Done/Completed */}
        <div 
          onClick={() => setStatusFilter('Completed')}
          className={`bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'Completed' ? 'border-emerald-500 ring-1 sm:ring-2 ring-emerald-200' : 'border-slate-200'
          }`}
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-emerald-500">Done</p>
          <p className="text-sm sm:text-base font-black text-emerald-600">{stats.completed}</p>
        </div>

        {/* In Progress */}
        <div 
          onClick={() => setStatusFilter('In Progress')}
          className={`bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'In Progress' ? 'border-blue-500 ring-1 sm:ring-2 ring-blue-200' : 'border-slate-200'
          }`}
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-blue-500">In Prog</p>
          <p className="text-sm sm:text-base font-black text-blue-600">{stats.inProgress}</p>
        </div>

        {/* Failed */}
        <div 
          onClick={() => setStatusFilter('Failed')}
          className={`bg-white rounded-lg border p-1 sm:p-2 text-center shadow-sm cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'Failed' ? 'border-red-500 ring-1 sm:ring-2 ring-red-200' : 'border-slate-200'
          }`}
        >
          <p className="text-[6px] sm:text-[7px] font-black uppercase text-red-500">Failed</p>
          <p className="text-sm sm:text-base font-black text-red-600">{stats.failed}</p>
        </div>

        {/* Completion Percentage */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`bg-white rounded-lg border p-1 sm:p-2 shadow-sm flex flex-col justify-center cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'All' ? 'border-blue-500 ring-1 sm:ring-2 ring-blue-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-0.5">
            <span className="text-[6px] sm:text-[7px] font-black uppercase text-slate-400">Comp</span>
            <span className="text-[8px] sm:text-[10px] font-black text-emerald-600">{stats.completionPercentage}%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
            <div className={`h-full rounded-full transition-all duration-500 ${stats.completionPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${stats.completionPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* Feeds Table - Responsive with mobile card view */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isMobile ? (
          // Mobile Card View - Path after progress bar
          <div className="divide-y divide-slate-100">
            {currentFeeds.length > 0 ? (
              currentFeeds.map((feed) => {
                const hasRecordCount = feed.record_count !== null && feed.record_count !== undefined;
                const isExpanded = expandedFeed === (feed._id || feed.feed_name);
                const fileInfo = getFileInfo(feed);
                const hasFileInfo = fileInfo && fileInfo.files && fileInfo.files.length > 0;
                const normalizedPaths = getNormalizedPaths(feed.output_path);
                const hasPaths = normalizedPaths.length > 0;
                const isNotStarted = feed.isNotStarted || false;
                
                return (
                  <div key={feed._id || feed.feed_name} className="p-2 sm:p-4 hover:bg-slate-50/60 transition-all">
                    {/* Feed Header */}
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => toggleExpand(feed._id || feed.feed_name)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={`w-1.5 sm:w-2 h-4 sm:h-5 rounded-full flex-shrink-0 ${
                            isNotStarted ? 'bg-slate-300' :
                            feed.failed ? 'bg-red-500' : 
                            feed.status === 'Completed' ? 'bg-green-500' : 
                            feed.status === 'In Progress' ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">
                            {feed.feed_name || feed.name}
                            {isNotStarted && (
                              <span className="ml-1 text-[7px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded">Not Started</span>
                            )}
                          </span>
                        </div>
                        {hasRecordCount && (
                          <span className="text-[7px] sm:text-[9px] font-mono font-semibold text-emerald-600 mt-0.5 flex items-center gap-0.5 sm:gap-1">
                            <Hash size={isMobile ? 8 : 10} className="text-emerald-500" />
                            {Number(feed.record_count).toLocaleString('en-IN')} records
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
                        <span className={`px-1.5 sm:px-2 py-0.5 text-[7px] sm:text-[8px] font-semibold rounded-md ${getStatusColor(feed.status)}`}>
                          {feed.status || 'Pending'}
                        </span>
                        {isExpanded ? <ChevronUp size={isMobile ? 12 : 14} className="text-slate-400" /> : <ChevronDown size={isMobile ? 12 : 14} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2">
                      <div className="flex-1 h-1 sm:h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(feed)}`} 
                             style={{ width: `${isNotStarted ? 0 : Math.min(feed.progress, 100)}%` }} />
                      </div>
                      <span className="text-[7px] sm:text-[9px] font-bold text-slate-600 min-w-[20px] sm:min-w-[30px]">
                        {isNotStarted ? '0%' : `${feed.progress}%`}
                      </span>
                    </div>

                    {/* File Info with Copy Button */}
                    {!isNotStarted && hasFileInfo && (
                      <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                        {fileInfo.files.slice(0, isMobile ? 1 : 3).map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg p-1 sm:p-1.5 border border-slate-200">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
                              <HardDrive size={isMobile ? 8 : 10} className="text-slate-400 flex-shrink-0" />
                              <code className="text-[6px] sm:text-[7px] font-mono text-slate-600 truncate flex-1">
                                {file.path}
                              </code>
                            </div>
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                              {file.size && (
                                <span className="text-[6px] sm:text-[7px] font-bold text-blue-600 whitespace-nowrap">
                                  {file.size}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(file.path, `${feed._id}-file-${idx}`);
                                }}
                                className="p-0.5 sm:p-1 rounded hover:bg-slate-200 transition-colors"
                                title="Copy file path"
                              >
                                {copiedPath === `${feed._id}-file-${idx}` ? (
                                  <Check size={isMobile ? 8 : 12} className="text-green-600" />
                                ) : (
                                  <Copy size={isMobile ? 8 : 12} className="text-slate-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                        {hasFileInfo && fileInfo.files.length > (isMobile ? 1 : 3) && (
                          <span className="text-[6px] sm:text-[7px] font-bold text-slate-400 ml-1">
                            +{fileInfo.files.length - (isMobile ? 1 : 3)} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Legacy Paths (if no file info but has paths) */}
                    {!isNotStarted && !hasFileInfo && hasPaths && (
                      <div className="mt-1.5 sm:mt-2 flex items-center justify-between bg-slate-50 rounded-lg p-1 sm:p-2 border border-slate-200">
                        <code className="text-[6px] sm:text-[8px] font-mono text-slate-600 truncate flex-1">
                          {normalizedPaths.length === 1 
                            ? normalizedPaths[0] 
                            : `${normalizedPaths.length} output files`}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(normalizedPaths, `${feed._id}-mobile`);
                          }}
                          className="p-1 sm:p-1.5 rounded hover:bg-slate-200 transition-colors flex-shrink-0 ml-1 sm:ml-2"
                          title={normalizedPaths.length > 1 ? "Copy all paths" : "Copy path"}
                        >
                          {copiedPath === `${feed._id}-mobile` ? (
                            <Check size={isMobile ? 10 : 14} className="text-green-600" />
                          ) : (
                            <Copy size={isMobile ? 10 : 14} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-100 space-y-1.5 sm:space-y-2">
                        {!isNotStarted ? (
                          <>
                            {/* Stages */}
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                              {DISPLAY_STAGES.map((stage, idx) => {
                                const stageData = stage.virtual ? null : feed.stages?.[stage.key];
                                const isCompleted = stage.virtual ? true : stageData?.completed === true;
                                const isFailed = feed.failed && idx === DISPLAY_STAGES.length - 1 && !isCompleted;
                                
                                return (
                                  <React.Fragment key={`${feed._id || feed.feed_name}-mobile-${stage.key}`}>
                                    <div className={`w-3 sm:w-4 h-3 sm:h-4 rounded-full flex items-center justify-center border transition-all ${
                                      isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                                      isFailed ? 'bg-red-500 border-red-500 text-white' : 
                                      'bg-white border-gray-300 text-gray-300'
                                    }`}>
                                      {isCompleted ? <CheckCircle size={isMobile ? 4 : 6} /> : isFailed ? <XCircle size={isMobile ? 4 : 6} /> : null}
                                    </div>
                                    {idx < DISPLAY_STAGES.length - 1 && (
                                      <div className={`w-2 sm:w-3 h-0.5 ${isCompleted ? 'bg-green-400' : 'bg-gray-300'}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>

                            {/* File Details in Expanded View */}
                            {hasFileInfo && fileInfo.files.length > 0 && (
                              <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                                <p className="text-[5px] sm:text-[6px] font-bold text-slate-500 uppercase tracking-wider">Files ({fileInfo.files.length}):</p>
                                {fileInfo.files.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-slate-100 rounded-lg p-1 sm:p-1.5">
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
                                      <HardDrive size={isMobile ? 8 : 10} className="text-slate-400 flex-shrink-0" />
                                      <code className="text-[5px] sm:text-[6px] font-mono text-slate-600 truncate flex-1">
                                        {file.path}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                      {file.size && (
                                        <span className="text-[5px] sm:text-[6px] font-bold text-blue-600 whitespace-nowrap">
                                          {file.size}
                                        </span>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(file.path, `${feed._id}-expanded-${idx}`);
                                        }}
                                        className="p-0.5 sm:p-1 rounded hover:bg-slate-200 transition-colors"
                                        title="Copy file path"
                                      >
                                        {copiedPath === `${feed._id}-expanded-${idx}` ? (
                                          <Check size={isMobile ? 8 : 10} className="text-green-600" />
                                        ) : (
                                          <Copy size={isMobile ? 8 : 10} className="text-slate-400" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                            <Hourglass size={isMobile ? 20 : 24} className="text-slate-400 mx-auto mb-1" />
                            <p className="text-xs font-semibold text-slate-500">Feed not started yet</p>
                            <p className="text-[8px] text-slate-400">No status data has been recorded for this feed</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 sm:p-12 text-center">
                <Activity size={isMobile ? 24 : 32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No feeds found</p>
              </div>
            )}
          </div>
        ) : (
          // Desktop Table View
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Feed Name</th>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Stages</th>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Progress</th>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Records</th>
                  <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">File(s)</th>
                </tr>
              </thead>
              <tbody>
                {currentFeeds.length > 0 ? (
                  currentFeeds.map((feed) => {
                    const totalStages = STAGES.length;
                    const completedStages = STAGES.filter(stage => feed.stages?.[stage.key]?.completed === true).length;
                    const calculatedProgress = Math.round((completedStages / totalStages) * 100);
                    const isExpanded = expandedFeed === (feed._id || feed.feed_name);
                    const isNotStarted = feed.isNotStarted || false;
                    
                    const fileInfo = getFileInfo(feed);
                    const hasFileInfo = fileInfo && fileInfo.files && fileInfo.files.length > 0;
                    const normalizedPaths = getNormalizedPaths(feed.output_path);
                    const hasPaths = normalizedPaths.length > 0;

                    const stageStates = DISPLAY_STAGES.map((stage) => {
                      const isVirtual = !!stage.virtual;
                      const stageData = isVirtual ? null : feed.stages?.[stage.key];
                      return { isCompleted: isVirtual ? true : stageData?.completed === true, completedAt: stageData?.completed_at };
                    });
                    const currentStageIndex = stageStates.reduce((acc, s, idx) => (s.isCompleted ? idx : acc), -1);
                    const activeStageIndex = feed.status === 'Completed' ? DISPLAY_STAGES.length - 1 : Math.min(currentStageIndex + 1, DISPLAY_STAGES.length - 1);
                    const failedStageIndex = feed.failed ? activeStageIndex : -1;
                    
                    const hasRecordCount = feed.record_count !== null && feed.record_count !== undefined;
                    
                    const displayFiles = hasFileInfo ? fileInfo.files.slice(0, 2) : [];
                    const hasMoreFiles = hasFileInfo && fileInfo.files.length > 2;
                    
                    return (
                      <React.Fragment key={feed._id || feed.feed_name}>
                        <tr 
                          className="border-b border-slate-100 hover:bg-slate-50/60 transition-all cursor-pointer"
                          onClick={() => toggleExpand(feed._id || feed.feed_name)}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-6 rounded-full ${
                                isNotStarted ? 'bg-slate-300' :
                                feed.failed ? 'bg-red-500' : 
                                feed.status === 'Completed' ? 'bg-green-500' : 
                                feed.status === 'In Progress' ? 'bg-blue-500' : 'bg-gray-300'
                              }`}></div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-slate-800 truncate">{feed.feed_name || feed.name}</span>
                                  {isNotStarted && (
                                    <span className="text-[7px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Not Started</span>
                                  )}
                                </div>
                                {hasRecordCount && (
                                  <span className="text-[9px] font-mono font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                                    <Hash size={10} className="text-emerald-500" />
                                    {Number(feed.record_count).toLocaleString('en-IN')} records
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            {isNotStarted ? (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Hourglass size={14} />
                                <span className="text-[8px] font-medium">Not started</span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                {DISPLAY_STAGES.map((stage, idx) => {
                                  const isVirtual = !!stage.virtual;
                                  const { isCompleted, completedAt } = stageStates[idx];
                                  const isInProgress = isVirtual ? false : (!isCompleted && (idx - 1) <= completedStages);
                                  const isFailed = feed.failed && idx === DISPLAY_STAGES.length - 1 && !isCompleted;
                                  const timeStr = completedAt ? formatISTTime(completedAt) : null;
                                  
                                  return (
                                    <React.Fragment key={`${feed._id || feed.feed_name}-stage-${stage.key}`}>
                                      <div className="relative group flex items-center">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all cursor-default ${isCompleted ? 'bg-green-500 border-green-500 text-white' : isFailed ? 'bg-red-500 border-red-500 text-white' : isInProgress ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-300'}`}>
                                          {isCompleted ? <CheckCircle size={8} /> : isFailed ? <XCircle size={8} /> : isInProgress ? <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> : <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>}
                                        </div>
                                        {timeStr && (
                                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                            <div className="bg-gray-900 text-white text-[7px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">{stage.label}: {timeStr}</div>
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                          </div>
                                        )}
                                      </div>
                                      {idx < DISPLAY_STAGES.length - 1 && <div className={`w-4 h-0.5 mx-0.5 ${isCompleted ? 'bg-green-400' : isInProgress ? 'bg-blue-300' : 'bg-gray-300'}`}></div>}
                                    </React.Fragment>
                                  );
                                })}
                                <div className="ml-2">{isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}</div>
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2">
                            {isNotStarted ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-slate-300" style={{ width: '0%' }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 min-w-[30px]">0%</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(feed)}`} style={{ width: `${Math.min(calculatedProgress, 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 min-w-[30px]">{calculatedProgress}%</span>
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 text-[8px] font-semibold rounded-md ${getStatusColor(feed.status)}`}>
                                {feed.status || 'Pending'}
                              </span>
                              {feed.failed && <AlertCircle size={10} className="text-red-500" />}
                            </div>
                          </td>

                          <td className="px-3 py-2 font-medium">
                            {hasRecordCount ? (
                              <span className="text-[10px] font-mono text-slate-700 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/40">
                                {Number(feed.record_count).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 select-none">—</span>
                            )}
                          </td>

                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            {!isNotStarted && hasFileInfo ? (
                              <div className="space-y-0.5">
                                {displayFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between group max-w-[200px]">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <HardDrive size={10} className="text-slate-400 flex-shrink-0" />
                                      <code className="text-[7px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600 truncate flex-1">
                                        {file.path.split('/').pop() || file.path}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {file.size && (
                                        <span className="text-[7px] font-bold text-blue-600 whitespace-nowrap">
                                          {file.size}
                                        </span>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(file.path, `${feed._id}-row-${idx}`);
                                        }}
                                        className="p-1 rounded hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Copy file path"
                                      >
                                        {copiedPath === `${feed._id}-row-${idx}` ? (
                                          <Check size={10} className="text-green-600" />
                                        ) : (
                                          <Copy size={10} className="text-slate-400" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {hasMoreFiles && (
                                  <span className="text-[7px] font-bold text-slate-400">
                                    +{fileInfo.files.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : !isNotStarted && hasPaths ? (
                              <div className="flex items-center gap-1.5 group justify-between max-w-[180px]">
                                <code className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 truncate flex-1 text-left">
                                  {normalizedPaths.length === 1 
                                    ? normalizedPaths[0] 
                                    : `📦 ${normalizedPaths.length} Output Files`}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(normalizedPaths, `${feed._id}-row`)}
                                  className="p-0.5 rounded hover:bg-slate-200 transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
                                  title={normalizedPaths.length > 1 ? "Copy all paths" : "Copy path"}
                                >
                                  {copiedPath === `${feed._id}-row` ? (
                                    <Check size={12} className="text-green-600" />
                                  ) : (
                                    <Copy size={12} className="text-slate-400" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[8px] text-slate-400 italic">—</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={6} className="px-3 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div className="md:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
                                  <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-5 flex items-center gap-1.5">
                                    <CheckCircle size={12} className="text-blue-600" />
                                    {isNotStarted ? 'Feed Status' : 'Feed Progress'}
                                  </h4>

                                  {isNotStarted ? (
                                    <div className="flex flex-col items-center justify-center py-6">
                                      <Hourglass size={32} className="text-slate-300 mb-2" />
                                      <p className="text-sm font-bold text-slate-500">Not Started</p>
                                      <p className="text-[10px] text-slate-400">This feed has not been started yet</p>
                                      <p className="text-[8px] text-slate-400 mt-1">Status: {feed.feedStatus || 'New'}</p>
                                    </div>
                                  ) : (
                                    <div className="relative px-2">
                                      <div className="absolute top-3 left-4 right-4 h-1 bg-gray-200 rounded-full" />
                                      <div className="absolute top-3 left-4 h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500" style={{ width: `calc(${Math.min((Math.max(currentStageIndex, 0) / (DISPLAY_STAGES.length - 1)) * 100, 100)}% - 8px)` }} />

                                      <div className="flex justify-between items-start relative">
                                        {DISPLAY_STAGES.map((stage, idx) => {
                                          const { isCompleted, completedAt } = stageStates[idx];
                                          const isCurrent = !isCompleted && idx === activeStageIndex && (feed.status !== 'Pending' || stage.virtual);
                                          const isFailed = failedStageIndex === idx && !isCompleted;
                                          const timeStr = completedAt ? formatISTTime(completedAt) : null;

                                          return (
                                            <div key={`${feed._id || feed.feed_name}-expanded-${stage.key}`} className="flex flex-col items-center relative group" style={{ minWidth: '48px', flex: '1 1 0%' }}>
                                              <div className="relative z-10">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 cursor-default ${isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md' : isFailed ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'} ${isCurrent ? 'ring-4 ring-blue-100 ring-offset-1 border-2 border-blue-500 shadow-md' : ''}`}>
                                                  {isCompleted ? <CheckCircle size={13} /> : isFailed ? <XCircle size={13} /> : idx + 1}
                                                </div>
                                              </div>
                                              <div className="mt-2 text-center min-h-[28px] flex flex-col items-center">
                                                <p className={`text-[7px] font-bold leading-tight transition-colors ${isCompleted ? 'text-green-700' : isFailed ? 'text-red-600' : 'text-gray-400'} ${isCurrent ? 'text-blue-600' : ''}`}>{stage.label}</p>
                                                {isCurrent && <span className="mt-0.5 text-[6px] font-bold text-blue-600 uppercase tracking-wide animate-pulse">● Current</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col justify-between">
                                  <div>
                                    <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Database size={12} className="text-blue-600" />
                                      Pipeline Metrics
                                    </h4>
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                      {isNotStarted 
                                        ? 'This feed is not started. No metrics available yet.' 
                                        : 'Data verification metrics captured during file integrity step cycles.'}
                                    </p>
                                  </div>
                                  <div className="my-auto py-2">
                                    {hasRecordCount ? (
                                      <div>
                                        <span className="text-2xl font-black text-slate-800 font-mono tracking-tight">
                                          {Number(feed.record_count).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-400 italic">
                                        {isNotStarted ? 'No data yet' : 'No counting metrics calculated yet.'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* File Details in Expanded View */}
                              {!isNotStarted && hasFileInfo && fileInfo.files.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">
                                      Files ({fileInfo.files.length}):
                                    </span>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                    {fileInfo.files.map((file, idx) => (
                                      <div key={idx} className="flex items-center justify-between group/item bg-slate-50 border border-slate-200/60 p-1.5 rounded">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <HardDrive size={10} className="text-slate-400 flex-shrink-0" />
                                          <code className="text-[7px] font-mono text-slate-700 truncate flex-1 text-left select-all">
                                            {file.path}
                                          </code>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {file.size && (
                                            <span className="text-[7px] font-bold text-blue-600 whitespace-nowrap">
                                              {file.size}
                                            </span>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboard(file.path, `${feed._id}-expanded-${idx}`);
                                            }}
                                            className="p-1 rounded hover:bg-slate-200 transition-colors opacity-0 group-hover/item:opacity-100"
                                            title="Copy file path"
                                          >
                                            {copiedPath === `${feed._id}-expanded-${idx}` ? (
                                              <Check size={10} className="text-green-600" />
                                            ) : (
                                              <Copy size={10} className="text-slate-400" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Activity size={32} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 font-medium">No feeds found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFeedStatus;