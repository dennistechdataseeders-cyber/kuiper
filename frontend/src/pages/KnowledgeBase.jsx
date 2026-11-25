import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, X, Search, FolderOpen, Download, Trash2, 
  Upload, File, FileText, Image, FolderPlus,
  ChevronLeft, ChevronRight, Filter, Loader2,
  Users, Clock, AlertCircle, CheckCircle,
  Folder, ExternalLink, Grid3x3, List,
  SortAsc, SortDesc, ArrowLeft, Home,
  FileArchive, FileVideo, FileAudio, FileCode,
  FileSpreadsheet, FileJson, Eye
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const KnowledgeBase = () => {
  const [entries, setEntries] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadPreviews, setUploadPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // View state
  const [viewMode, setViewMode] = useState('grid');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'Admin';
  const token = localStorage.getItem('token');
  
  const fileInputRef = React.useRef(null);

  // ============================================
  // FETCH DATA
  // ============================================

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/knowledge`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEntries(res.data.entries || []);
      setFolders(res.data.folders || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ============================================
  // FILE HANDLING
  // ============================================

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
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 50MB limit`);
        return;
      }
      
      validFiles.push(file);
      
      const isImage = file.type.startsWith('image/');
      validPreviews.push({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: isImage ? URL.createObjectURL(file) : null,
        id: Date.now() + Math.random().toString(36).substr(2, 9)
      });
    });

    if (validFiles.length > 0) {
      setUploadFiles(prev => [...prev, ...validFiles]);
      setUploadPreviews(prev => [...prev, ...validPreviews]);
      toast.success(`${validFiles.length} file(s) added`);
    }
  };

  const removeFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
    setUploadPreviews(prev => {
      const removed = prev[index];
      if (removed && removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const getFileIcon = (file) => {
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const fileType = file.type || '';
    
    if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      return <Image size={20} className="text-blue-500" />;
    }
    if (['pdf'].includes(ext)) return <FileText size={20} className="text-red-500" />;
    if (['doc', 'docx', 'odt'].includes(ext)) return <FileText size={20} className="text-blue-600" />;
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={20} className="text-green-600" />;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return <FileArchive size={20} className="text-amber-600" />;
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return <FileVideo size={20} className="text-indigo-500" />;
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext)) return <FileAudio size={20} className="text-pink-500" />;
    if (['js', 'py', 'java', 'json', 'xml', 'html', 'css', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs'].includes(ext)) {
      return <FileCode size={20} className="text-purple-500" />;
    }
    if (['ppt', 'pptx', 'odp'].includes(ext)) return <FileText size={20} className="text-orange-500" />;
    if (['txt', 'rtf'].includes(ext)) return <FileText size={20} className="text-slate-600" />;
    return <File size={20} className="text-slate-400" />;
  };

  // ============================================
  // UPLOAD HANDLER
  // ============================================

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    if (!selectedFolderForUpload && !newFolderName) {
      toast.error('Please select or create a folder');
      return;
    }
    
    if (uploadFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    
    const folderName = selectedFolderForUpload || newFolderName;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('folder', folderName);
      
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });
      
      const res = await axios.post(`${API_BASE_URL}/api/knowledge`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Knowledge entry created successfully!');
      resetUploadForm();
      fetchData();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setShowUploadModal(false);
    setUploadTitle('');
    setSelectedFolderForUpload('');
    setNewFolderName('');
    setShowNewFolderInput(false);
    setUploadFiles([]);
    setUploadPreviews([]);
  };

  // ============================================
  // DELETE HANDLER
  // ============================================

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry? All associated files will be deleted.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/api/knowledge/${entryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Entry deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete entry');
    }
  };

  // ============================================
  // DOWNLOAD HANDLER
  // ============================================

  const handleDownload = (entryId, fileIndex, fileName) => {
    const downloadUrl = `${API_BASE_URL}/api/knowledge/${entryId}/download/${fileIndex}`;
    
    toast.loading('Downloading...', { id: 'download' });
    
    fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error('Download failed');
      return response.blob();
    })
    .then(blob => {
      toast.dismiss('download');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download complete!');
    })
    .catch(error => {
      console.error('Download error:', error);
      toast.dismiss('download');
      toast.error('Failed to download file');
    });
  };

  // ============================================
  // FOLDER VIEW HELPERS
  // ============================================

  const getFolderEntries = (folderName) => {
    return entries.filter(entry => entry.folder === folderName);
  };

  const getFolderFileCount = (folderName) => {
    const folderEntries = getFolderEntries(folderName);
    return folderEntries.reduce((sum, entry) => sum + entry.files.length, 0);
  };

  const getFolderEntryCount = (folderName) => {
    return getFolderEntries(folderName).length;
  };

  const handleFolderClick = (folderName) => {
    setSelectedFolder(folderName);
    setSearchTerm('');
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setSearchTerm('');
  };

  const getFolderIcon = (folderName) => {
    // You can add custom icons for specific folders
    const folderIcons = {
      'Documentation': <FileText size={24} className="text-blue-500" />,
      'Images': <Image size={24} className="text-green-500" />,
      'Videos': <FileVideo size={24} className="text-purple-500" />,
      'Code': <FileCode size={24} className="text-orange-500" />,
    };
    return folderIcons[folderName] || <Folder size={24} className="text-yellow-500" />;
  };

  // ============================================
  // FILTER & SEARCH
  // ============================================

  const filteredEntries = entries.filter(entry => {
    if (selectedFolder && entry.folder !== selectedFolder) return false;
    const matchesSearch = entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          entry.folder.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="page bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  const totalFiles = entries.reduce((sum, entry) => sum + entry.files.length, 0);

  return (
    <div className="page bg-slate-50">
      
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <FolderOpen size={24} className="text-white" />
              </div>
              <div>
                <h1 className="page-title">Knowledge Base</h1>
                <p className="text-sm text-slate-500 mt-1">Central repository for team documentation and resources</p>
              </div>
            </div>
          </div>
          
          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-md bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              Add Knowledge
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Folder size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Folders</p>
              <p className="text-2xl font-bold text-slate-800">{folders.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileText size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Entries</p>
              <p className="text-2xl font-bold text-slate-800">{entries.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <File size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Files</p>
              <p className="text-2xl font-bold text-slate-800">{totalFiles}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={selectedFolder ? `Search in "${selectedFolder}"...` : "Search by title or folder..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          {selectedFolder ? (
            <button
              onClick={handleBackToFolders}
              className="btn btn-md bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <ArrowLeft size={16} />
              Back to Folders
            </button>
          ) : null}
        </div>
      </div>

      {/* ============================================
          FOLDER VIEW (When no folder is selected)
          ============================================ */}
      {!selectedFolder ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {folders.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FolderOpen size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No folders found</p>
              <p className="text-xs text-slate-400 mt-1">
                {isAdmin ? 'Click "Add Knowledge" to create your first folder' : 'Check back later for new resources'}
              </p>
            </div>
          ) : (
            folders.map((folder) => {
              const entryCount = getFolderEntryCount(folder);
              const fileCount = getFolderFileCount(folder);
              
              return (
                <div
                  key={folder}
                  onClick={() => handleFolderClick(folder)}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                        {getFolderIcon(folder)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="section-title break-words sm:truncate">{folder}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <FileText size={12} />
                            {entryCount} entry{entryCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <File size={12} />
                            {fileCount} file{fileCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                   
                    
                    <div className="mt-4 text-xs text-blue-600 font-medium flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      Click to browse <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        // ============================================
        // FOLDER CONTENTS VIEW (When a folder is selected)
        // ============================================
        <>
          {/* Folder Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <Folder size={28} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="section-title">{selectedFolder}</h2>
                  <p className="text-slate-500 text-sm">
                    {getFolderEntryCount(selectedFolder)} entries · {getFolderFileCount(selectedFolder)} files
                  </p>
                </div>
              </div>
              <button
                onClick={handleBackToFolders}
                className="btn btn-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Back to Folders
              </button>
            </div>
          </div>

          {/* Folder Contents */}
          {sortedEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FolderOpen size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No entries in this folder</p>
              <p className="text-xs text-slate-400 mt-1">This folder is empty</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedEntries.map((entry) => (
                <div key={entry._id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="section-title break-words sm:truncate">{entry.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge rounded-full text-blue-600 bg-blue-50">
                            {entry.files.length} file{entry.files.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(entry._id)}
                          className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Card Body - Files */}
                  <div className="p-4 space-y-2">
                    {entry.files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-all group"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          {getFileIcon(file)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 break-words sm:truncate">{file.originalName}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(entry._id, index, file.originalName)}
                          className="btn-icon text-slate-400 hover:text-blue-600 hover:bg-blue-50 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Card Footer */}
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {entry.uploadedBy?.name || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // List View
            <div className="table-scroll table-sticky-first overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                  <tr>
                    <th className="th">Title</th>
                    <th className="th">Files</th>
                    <th className="th">Uploaded By</th>
                    <th className="th">Date</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => (
                    <tr key={entry._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-blue-500" />
                          <span className="text-sm font-semibold text-slate-800">{entry.title}</span>
                        </div>
                      </td>
                      <td className="td">
                        <span className="text-sm font-bold text-slate-600">{entry.files.length}</span>
                      </td>
                      <td className="td">
                        <span className="text-sm text-slate-600">{entry.uploadedBy?.name || 'Unknown'}</span>
                      </td>
                      <td className="td">
                        <span className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-2">
                          {entry.files.length === 1 ? (
                            <button
                              onClick={() => handleDownload(entry._id, 0, entry.files[0].originalName)}
                              className="btn btn-sm bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                            >
                              <Download size={12} />
                              Download
                            </button>
                          ) : (
                            <div className="flex gap-1">
                              {entry.files.map((file, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleDownload(entry._id, index, file.originalName)}
                                  className="btn-icon bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white"
                                  title={`Download ${file.originalName}`}
                                >
                                  <Download size={12} />
                                </button>
                              ))}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(entry._id)}
                              className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============================================
          UPLOAD MODAL
          ============================================ */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="section-title">Add Knowledge Entry</h2>
                <p className="text-xs text-slate-500 mt-1">Upload documents, images, or any resource</p>
              </div>
              <button
                onClick={resetUploadForm}
                className="btn-icon bg-slate-100 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="modal-body space-y-5">
              {/* Title */}
              <div>
                <label className="label block mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter a descriptive title..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="input bg-slate-50"
                />
              </div>

              {/* Folder Selection */}
              <div>
                <label className="label block mb-1.5">
                  Folder <span className="text-red-500">*</span>
                </label>
                
                {!showNewFolderInput ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedFolderForUpload}
                      onChange={(e) => setSelectedFolderForUpload(e.target.value)}
                      className="input flex-1 min-w-0 bg-slate-50 cursor-pointer"
                    >
                      <option value="">Select or create a folder...</option>
                      {folders.map(folder => (
                        <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewFolderInput(true)}
                      className="btn btn-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      <FolderPlus size={14} />
                      New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="input flex-1 min-w-0 bg-blue-50 border-blue-200"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewFolderInput(false)}
                      className="btn btn-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div>
                <label className="label block mb-1.5">
                  Files <span className="text-red-500">*</span>
                  <span className="font-normal text-slate-400 ml-2">(Max 50MB per file)</span>
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-50/80' : 'border-slate-300 bg-white hover:border-blue-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={32} className={isDragging ? 'text-blue-600' : 'text-slate-400'} />
                    <p className="text-sm font-medium text-slate-600">
                      {isDragging ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Supports all file types up to 50MB
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="btn btn-md mt-2 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Browse Files
                    </button>
                  </div>
                </div>

                {/* File Previews */}
                {uploadPreviews.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {uploadPreviews.map((preview, idx) => (
                      <div key={preview.id || idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-500">
                          {getFileIcon(preview)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{preview.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(preview.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={uploading}
                className="btn btn-md w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload Knowledge
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;