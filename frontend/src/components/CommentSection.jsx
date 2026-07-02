// frontend/src/components/CommentSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Send, Trash2, User, Clock, Loader2, X, 
  Image, File, Paperclip, FileText,
  FileArchive, FileSpreadsheet,
  FileVideo, FileAudio,
  Download
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
  const commentsEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const token = localStorage.getItem('token');

  // Max file sizes
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Allowed file types (using extensions for better compatibility)
  const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.odt', '.ods',
  // Archives - ADDED
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  // Presentations
  '.ppt', '.pptx', '.odp',
  // Video
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg',
  // Audio
  '.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma',
  // Code/Config - ADDED
  '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.sass',
  '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.bat', '.ps1', '.cmd',
  // Executables - ADDED
  '.exe'
];

  // Allowed MIME types (fallback)
  const ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Video
    'video/mp4', 'video/avi', 'video/mkv', 'video/quicktime', 'video/x-ms-wmv',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac'
  ];

  const getFileExtension = (filename) => {
    return '.' + filename.split('.').pop()?.toLowerCase() || '';
  };

  const isImageFile = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.includes(getFileExtension(filename));
  };

  const isAllowedFile = (file) => {
    // Check by extension first
    const ext = getFileExtension(file.name);
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      return true;
    }
    // Fallback to MIME type check
    return ALLOWED_MIME_TYPES.includes(file.type);
  };

  const validateFile = (file) => {
    // Check file type
    if (!isAllowedFile(file)) {
      toast.error(`File type "${file.name}" is not supported. Please upload images, documents, or media files.`);
      return false;
    }

    // Check file size
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
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    
    // Image types
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <Image size={16} className="text-blue-500" />;
    }
    // Document types
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
    return <File size={16} className="text-slate-400" />;
  };

  const getFileTypeLabel = (file) => {
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const typeMap = {
      'pdf': 'PDF',
      'doc': 'Word',
      'docx': 'Word',
      'xls': 'Excel',
      'xlsx': 'Excel',
      'csv': 'CSV',
      'txt': 'Text',
      'zip': 'ZIP',
      'rar': 'RAR',
      '7z': '7Z',
      'jpg': 'Image',
      'jpeg': 'Image',
      'png': 'Image',
      'gif': 'Image',
      'webp': 'Image',
      'mp4': 'Video',
      'avi': 'Video',
      'mkv': 'Video',
      'mov': 'Video',
      'mp3': 'Audio',
      'wav': 'Audio',
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',
      'aac': 'Audio',
      'ogg': 'Audio',
      'flac': 'Audio',
      'm4a': 'Audio',
      'wmv': 'Video',
      'flv': 'Video',
      'webm': 'Video'
    };
    return typeMap[ext] || 'File';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
    // Reset the input so the same file can be selected again
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

  // Get token inside the function
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
      
      const res = await axios.post(`${API_BASE_URL}/api/tickets/${entityId}/comments`, payload, {
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
                    
                    {comment.text && (
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                        {comment.text}
                      </p>
                    )}
                    
                    {/* File Attachments */}
                    {hasFiles && (
                      <div className="mt-3 space-y-2">
                        {comment.files.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-all group">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                              {file.type === 'image' ? (
                                <img 
                                  src={file.url} 
                                  alt={file.originalName || 'Attachment'}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                getFileIcon({ name: file.originalName || file.filename })
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {file.originalName || file.filename}
                              </p>
                              <p className="text-[9px] text-slate-400 flex items-center gap-2">
                                <span>{formatFileSize(file.size)}</span>
                                <span>•</span>
                                <span>{getFileTypeLabel({ name: file.originalName || file.filename })}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all"
                                title="Download or view file"
                              >
                                <Download size={14} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
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