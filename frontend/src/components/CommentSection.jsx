// frontend/src/components/CommentSection.jsx - UPDATED with file download fix

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Send, Trash2, User, Clock, Loader2, X, 
  Image, File, Paperclip, FileText,
  FileArchive, FileSpreadsheet,
  FileVideo, FileAudio,
  Download, Eye, Link as LinkIcon
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const CommentSection = ({ 
  type, // 'project' or 'feed'
  entityId, 
  userRole, 
  userId,
  currentUserName,
  canComment = true,
  refreshTrigger = 0
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const commentsEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const token = localStorage.getItem('token');

  // Max file sizes
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Allowed file types (using extensions for better compatibility)
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

  // ============================================
  // FILE DOWNLOAD FUNCTION - FIXED
  // ============================================
  const handleFileDownload = async (file) => {
    if (!file || !file.url) {
      toast.error('File URL not available');
      return;
    }

    setDownloading(file.url);
    
    try {
      // If the file URL is a full URL, use it directly
      if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
        // Open in new tab for view/download
        window.open(file.url, '_blank');
        toast.success('File opened in new tab');
        setDownloading(null);
        return;
      }

      // For relative URLs, construct the full URL
      const baseUrl = API_BASE_URL || window.location.origin;
      const fileUrl = file.url.startsWith('/') ? `${baseUrl}${file.url}` : `${baseUrl}/${file.url}`;
      
      // For images, open in new tab
      if (file.type === 'image' || isImageFile(file.originalName || file.filename || '')) {
        window.open(fileUrl, '_blank');
        toast.success('Image opened in new tab');
        setDownloading(null);
        return;
      }

      // For other files, download using fetch
      const response = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      // Use the original filename or generate one from the URL
      const filename = file.originalName || file.filename || file.url.split('/').pop() || 'download';
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('File downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // Determine the API endpoint based on type
  const getEndpoint = () => {
    if (type === 'project') {
      return `${API_BASE_URL}/api/comments/projects/${entityId}/comments`;
    }
    return `${API_BASE_URL}/api/comments/feeds/${entityId}/comments`;
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(getEndpoint(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📝 Fetched comments:', res.data.comments);
      
      // Debug: Check if any comments have files
      res.data.comments?.forEach((comment, idx) => {
        if (comment.files && comment.files.length > 0) {
          console.log(`📎 Comment ${idx} has ${comment.files.length} file(s):`, comment.files);
        }
      });
      
      setComments(res.data.comments || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [entityId, refreshTrigger]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

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

  const addComment = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim() && selectedFiles.length === 0) {
      toast.error('Please enter a comment or attach a file');
      return;
    }
    
    setSubmitting(true);
    
    try {
      let uploadedFiles = [];
      
      if (selectedFiles.length > 0) {
        uploadedFiles = await uploadFiles();
      }
      
      const payload = {
        text: newComment.trim() || '📎 File(s) attached',
        files: uploadedFiles
      };
      
      const res = await axios.post(getEndpoint(), payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(prev => [...prev, res.data.comment]);
      setNewComment('');
      setSelectedFiles([]);
      setFilePreviews([]);
      
      if (uploadedFiles.length > 0) {
        toast.success(`Comment added with ${uploadedFiles.length} attachment(s)`);
      } else {
        toast.success('Comment added');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    setDeleting(commentId);
    try {
      await axios.delete(`${getEndpoint()}/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(prev => prev.filter(c => c._id !== commentId));
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error(err.response?.data?.error || 'Failed to delete comment');
    } finally {
      setDeleting(null);
    }
  };

  const canDeleteComment = (comment) => {
    if (userRole === 'Admin') return true;
    if (userRole === 'Project Manager') return true;
    if (userRole === 'Team Lead') return true;
    return comment.userId?._id === userId || comment.userId === userId;
  };

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

  const getCommenterClass = (comment) => {
    const isOwn = comment.userId?._id === userId || comment.userId === userId;
    return isOwn ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200';
  };

  // ============================================
  // RENDER FILE ATTACHMENTS WITH DOWNLOAD FIX
  // ============================================
  const renderFileAttachments = (comment) => {
    const hasFiles = comment.files && comment.files.length > 0;
    
    if (!hasFiles) return null;
    
    console.log(`📎 Rendering ${comment.files.length} file(s) for comment:`, comment.files);
    
    return (
      <div className="mt-3 space-y-2">
        {comment.files.map((file, idx) => {
          // Determine if it's an image
          const isImage = file.type === 'image' || 
                          (file.originalName && isImageFile(file.originalName)) ||
                          (file.filename && isImageFile(file.filename));
          
          const displayName = file.originalName || file.filename || 'Attachment';
          const fileUrl = file.url;
          
          // If no URL, skip this file
          if (!fileUrl) {
            console.warn(`⚠️ File ${idx} has no URL:`, file);
            return null;
          }

          const isDownloading = downloading === fileUrl;

          // Construct full URL if needed
          let fullUrl = fileUrl;
          if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
            const baseUrl = API_BASE_URL || window.location.origin;
            fullUrl = fileUrl.startsWith('/') ? `${baseUrl}${fileUrl}` : `${baseUrl}/${fileUrl}`;
          }
          
          return (
            <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-all group">
              {/* File Icon / Preview */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden">
                {isImage ? (
                  <img 
                    src={fullUrl} 
                    alt={displayName}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                      }
                    }}
                  />
                ) : (
                  getFileIcon(file)
                )}
              </div>
              
              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate" title={displayName}>
                  {displayName}
                </p>
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  {file.size && <span>{formatFileSize(file.size)}</span>}
                  {file.size && <span>•</span>}
                  <span>{getFileTypeLabel(file)}</span>
                </div>
              </div>
              
              {/* Actions - Download for everyone */}
              <div className="flex items-center gap-1">
                {isImage && (
                  <button
                    onClick={() => handleFileDownload(file)}
                    disabled={isDownloading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all disabled:opacity-50"
                    title="View image"
                  >
                    {isDownloading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Eye size={14} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleFileDownload(file)}
                  disabled={isDownloading}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all disabled:opacity-50"
                  title="Download file"
                >
                  {isDownloading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs">Start the conversation</p>
          </div>
        ) : (
          comments.map((comment) => {
            const commenterName = comment.userName || comment.userId?.name || 'Unknown User';
            const isOwn = comment.userId?._id === userId || comment.userId === userId;
            const hasFiles = comment.files && comment.files.length > 0;
            
            return (
              <div
                key={comment._id}
                className={`p-4 rounded-xl border ${getCommenterClass(comment)} transition-all`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* User Info */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                        isOwn ? 'bg-blue-600' : 'bg-slate-400'
                      }`}>
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
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    
                    {/* Comment Text */}
                    {comment.text && (
                      <div 
                        className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{ __html: comment.text.replace(/\n/g, '<br />') }}
                      />
                    )}
                    
                    {/* ============================================
                        RENDER FILE ATTACHMENTS WITH DOWNLOAD
                        ============================================ */}
                    {hasFiles && renderFileAttachments(comment)}
                  </div>
                  
                  {/* Delete Button */}
                  {canDeleteComment(comment) && (
                    <button
                      onClick={() => handleDelete(comment._id)}
                      disabled={deleting === comment._id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0 disabled:opacity-50"
                      title="Delete comment"
                    >
                      {deleting === comment._id ? (
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
        <div ref={commentsEndRef} />
      </div>
      
      {/* Comment Input */}
      {canComment && (
        <form onSubmit={addComment} className="space-y-3">
          {/* File Preview */}
          {filePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
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
          
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment... (attachments supported)"
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-all resize-none min-h-[48px] max-h-[100px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim() || selectedFiles.length > 0) addComment(e);
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
                onClick={() => fileInputRef.current.click()}
                disabled={uploadingFiles}
                className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50"
                title="Attach files (images up to 5MB, documents up to 50MB)"
              >
                <Paperclip size={18} />
              </button>
              
              <button
                type="submit"
                disabled={submitting || uploadingFiles}
                className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex justify-between text-[10px] text-slate-400 px-1">
            <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
            <span>
              <button 
                type="button" 
                onClick={() => fileInputRef.current.click()} 
                className="text-blue-500 hover:underline"
              >
                Attach files
              </button>
              {' '}(Images: 5MB • Files: 50MB)
            </span>
          </div>
        </form>
      )}
    </div>
  );
};

export default CommentSection;