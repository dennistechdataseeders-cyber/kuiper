// frontend/src/pages/PmFeasibilityDashboard.jsx - PM with Full Comment System

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  Mail,
  Phone,
  Hash,
  RefreshCw,
  Ban,
  X,
  Globe,
  Users,
  Target,
  Eye,
  Download,
  Info,
  File,
  Paperclip,
  MessageSquare,
  Send,
  Plus,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const PmFeasibilityDashboard = () => {
  const [feasibilityTasks, setFeasibilityTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [debugInfo, setDebugInfo] = useState(null);
  const [expandedComments, setExpandedComments] = useState(null);

  // Feasibility Details Modal State
  const [showFeasibilityDetailsModal, setShowFeasibilityDetailsModal] = useState(false);
  const [selectedFeasibilityDetails, setSelectedFeasibilityDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Add Comment Modal State
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentHistory, setCommentHistory] = useState([]);

  const itemsPerPage = 10;
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');

  useEffect(() => {
    console.log('🔍 Current User ID:', currentUserId);
    console.log('🔍 Current User Role:', currentUserRole);
    fetchFeasibilityTasks();
  }, []);

  const fetchFeasibilityTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/lead-generation`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = Array.isArray(res.data) ? res.data : [];
      
      console.log('📊 Total leads fetched:', data.length);
      console.log('👤 Current PM ID:', currentUserId);
      
      const allFeasibilityLeads = data.filter(lead => 
        lead.status === 'Feasibility' || lead.status === 'Feasibility Completed'
      );
      console.log('📊 All Feasibility leads:', allFeasibilityLeads.length);
      
      const filtered = data.filter(lead => {
        const isFeasibility = lead.status === 'Feasibility' || lead.status === 'Feasibility Completed';
        if (!isFeasibility) return false;
        
        let isAssignedToPM = false;
        const pmId = lead.projectManagerId;
        
        if (pmId) {
          const pmIdStr = typeof pmId === 'object' ? (pmId._id || pmId).toString() : pmId.toString();
          const userIdStr = currentUserId.toString();
          isAssignedToPM = pmIdStr === userIdStr;
        }
        
        return isAssignedToPM;
      });

      console.log('📊 Filtered feasibility tasks:', filtered.length);
      setFeasibilityTasks(filtered);
      
      setDebugInfo({
        totalLeads: data.length,
        feasibilityLeads: allFeasibilityLeads.length,
        assignedToMe: filtered.length,
        currentUserId: currentUserId,
        sampleLead: allFeasibilityLeads[0] || null
      });
      
    } catch (err) {
      console.error("Error fetching feasibility tasks:", err);
      toast.error("Failed to load feasibility tasks");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Fetch Feasibility Details
  // ============================================
  const fetchFeasibilityDetails = async (leadId) => {
    setLoadingDetails(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/lead-generation/feasibility/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setSelectedFeasibilityDetails(res.data.data);
        setShowFeasibilityDetailsModal(true);
      } else {
        toast.error(res.data.error || 'Failed to fetch feasibility details');
      }
    } catch (err) {
      console.error("Error fetching feasibility details:", err);
      toast.error(err.response?.data?.error || 'Failed to fetch feasibility details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // ============================================
  // OPEN ADD COMMENT MODAL - WITH HISTORY
  // ============================================
  const openCommentModal = (lead) => {
    setSelectedFeasibilityDetails(lead);
    setCommentText('');
    // Extract existing comments for history
    const existingComments = extractAllComments(lead.lastInteractionDesc || '');
    setCommentHistory(existingComments);
    setShowCommentModal(true);
  };

  // ============================================
  // HANDLE ADD COMMENT SUBMIT - Stay in modal
  // ============================================
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!commentText.trim()) {
      toast.error("Please enter your comment/findings");
      return;
    }

    setIsSubmittingComment(true);

    try {
      const token = localStorage.getItem('token');
      const leadId = selectedFeasibilityDetails._id;
      
      // Get existing lastInteractionDesc to append
      const currentLead = await axios.get(`${API_BASE_URL}/api/lead-generation/feasibility/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const existingDesc = currentLead.data.data?.lastInteractionDesc || '';
      
      // Format the new comment with timestamp
      const timestamp = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const newComment = `\n\n**[PM Comment - ${timestamp}]**\n${commentText.trim()}`;
      const updatedDesc = existingDesc + newComment;
      
      const payload = {
        lastInteractionDesc: updatedDesc
      };
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${leadId}/comment`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('✅ Comment added successfully!');
      
      // Add the new comment to history
      const newCommentObj = {
        type: 'PM',
        timestamp: timestamp,
        text: commentText.trim()
      };
      setCommentHistory([...commentHistory, newCommentObj]);
      
      // Clear the input but keep modal open
      setCommentText('');
      
      // Refresh the tasks data in background
      fetchFeasibilityTasks();
      
    } catch (err) {
      console.error("Add Comment Error:", err);
      toast.error(err.response?.data?.error || "Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ============================================
  // CLOSE COMMENT MODAL
  // ============================================
  const closeCommentModal = () => {
    setShowCommentModal(false);
    setCommentText('');
    setCommentHistory([]);
  };

  // ============================================
  // Toggle comment expansion
  // ============================================
  const toggleComments = (leadId) => {
    setExpandedComments(expandedComments === leadId ? null : leadId);
  };

  // ============================================
  // DOWNLOAD ATTACHMENT
  // ============================================
  const handleDownloadAttachment = async (attachmentUrl, filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(attachmentUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Feasibility': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Feasibility Completed': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Extract ALL comments (PM and Sales) from lastInteractionDesc
  const extractAllComments = (desc) => {
    if (!desc) return [];
    const comments = [];
    const lines = desc.split('\n');
    let currentComment = null;
    
    for (const line of lines) {
      if (line.includes('**[PM Comment -') || line.includes('**[Sales Comment -')) {
        if (currentComment) {
          comments.push(currentComment);
        }
        const match = line.match(/\[(PM|Sales) Comment - (.+?)\]/);
        const type = match ? match[1] : 'Unknown';
        const timestamp = match ? match[2] : 'Unknown time';
        currentComment = {
          type: type,
          timestamp: timestamp,
          text: ''
        };
      } else if (currentComment && line.trim()) {
        currentComment.text += (currentComment.text ? '\n' : '') + line.trim();
      }
    }
    
    if (currentComment) {
      comments.push(currentComment);
    }
    
    return comments;
  };

  const filteredTasks = feasibilityTasks.filter(task => {
    const matchesSearch = 
      task.pocName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.organizationId?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.feasibilityId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const currentTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="page bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading feasibility tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page bg-slate-50">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <h1 className="page-title">
                  My Feasibility Tasks
                </h1>
                <p className="text-slate-500 mt-1">Manage feasibility requests assigned to you</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span>User ID: {currentUserId?.substring(0, 10)}...</span>
                  <span>|</span>
                  <span>Role: {currentUserRole}</span>
                  <span>|</span>
                  <span>Tasks: {feasibilityTasks.length}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={fetchFeasibilityTasks}
            className="btn btn-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-xs font-semibold uppercase opacity-80 tracking-wide">Total Tasks</p>
          <p className="text-2xl font-bold">{feasibilityTasks.length}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <p className="text-xs font-semibold uppercase opacity-80 tracking-wide">Pending</p>
          <p className="text-2xl font-bold">
            {feasibilityTasks.filter(t => t.status === 'Feasibility').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-xs font-semibold uppercase opacity-80 tracking-wide">Completed</p>
          <p className="text-2xl font-bold">
            {feasibilityTasks.filter(t => t.status === 'Feasibility Completed').length}
          </p>
        </div>
      </div>

      {/* Debug Info */}
      {feasibilityTasks.length === 0 && debugInfo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 sm:mb-6">
          <h4 className="text-sm font-semibold text-amber-700 mb-2">Debug Information:</h4>
          <div className="text-xs text-amber-600 space-y-1">
            <p>Total Leads in DB: {debugInfo.totalLeads}</p>
            <p>Feasibility Leads: {debugInfo.feasibilityLeads}</p>
            <p>Assigned to You: {debugInfo.assignedToMe}</p>
            <p>Your User ID: {debugInfo.currentUserId}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by POC, organization, or Feasibility ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="relative min-w-[180px]">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="all">All Status</option>
              <option value="Feasibility">Pending</option>
              <option value="Feasibility Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Table - With Expandable Comments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {currentTasks.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No feasibility tasks found</p>
            <p className="text-xs text-slate-400 mt-1">Tasks will appear here when assigned to you</p>
            <button
              onClick={fetchFeasibilityTasks}
              className="btn btn-md mt-4 bg-blue-600 text-white hover:bg-blue-700"
            >
              Refresh Tasks
            </button>
          </div>
        ) : (
          <div className="table-scroll table-sticky-first overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <tr>
                  <th className="th">Feasibility ID</th>
                  <th className="th">POC / Organization</th>
                  <th className="th">Task Details</th>
                  <th className="th">Date</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentTasks.map((task) => {
                  const comments = extractAllComments(task.lastInteractionDesc);
                  const hasExistingComments = comments.length > 0;
                  const isExpanded = expandedComments === task._id;
                  
                  return (
                    <React.Fragment key={task._id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                        <td className="td">
                          <span className="badge text-blue-600 bg-blue-50">
                            {task.feasibilityId || 'N/A'}
                          </span>
                        </td>
                        <td className="td">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{task.pocName}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Building2 size={12} />
                              {task.organizationId?.companyName || 'No Organization'}
                            </p>
                            {task.pocEmail && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Mail size={12} className="shrink-0" />
                                <span className="break-all min-w-[140px]">{task.pocEmail}</span>
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="td">
                          <div>
                            <p className="text-xs text-slate-600 max-w-[200px] truncate">
                              {task.taskDetails || task.lastInteractionDesc || 'No details provided'}
                            </p>
                            {hasExistingComments && (
                              <button
                                onClick={() => toggleComments(task._id)}
                                className="mt-1 flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                <MessageSquare size={12} />
                                <span className="text-xs font-semibold">
                                  {comments.length} comment(s)
                                </span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="td">
                          <div className="text-xs text-slate-500">
                            <p>Created: {formatDate(task.createdAt)}</p>
                            {task.feasibilityDate && (
                              <p className="text-blue-600 font-medium">Due: {formatDate(task.feasibilityDate)}</p>
                            )}
                          </div>
                        </td>
                        <td className="td">
                          <span className={`badge ${getStatusColor(task.status)}`}>
                            {task.status === 'Feasibility' ? 'Pending' : 'Completed'}
                          </span>
                        </td>
                        <td className="td text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => fetchFeasibilityDetails(task._id)}
                              className="btn btn-sm bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              <Eye size={12} />
                              View Details
                            </button>
                            {task.status === 'Feasibility' && (
                              <button
                                onClick={() => openCommentModal(task)}
                                className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <Plus size={12} />
                                Comment
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Comments Row */}
                      {isExpanded && hasExistingComments && (
                        <tr className="bg-emerald-50/30">
                          <td colSpan={6} className="td">
                            <div className="card border-emerald-200">
                              <div className="flex items-center gap-2 mb-3">
                                <MessageSquare size={16} className="text-emerald-600" />
                                <h4 className="text-sm font-semibold text-emerald-700">
                                  Comments ({comments.length})
                                </h4>
                              </div>
                              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                {comments.map((comment, idx) => (
                                  <div key={idx} className={`p-3 rounded-lg border ${
                                    comment.type === 'PM' 
                                      ? 'bg-blue-50 border-blue-100' 
                                      : 'bg-emerald-50 border-emerald-100'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`badge rounded-full ${
                                        comment.type === 'PM' 
                                          ? 'bg-blue-600 text-white' 
                                          : 'bg-emerald-600 text-white'
                                      }`}>
                                        {comment.type}
                                      </span>
                                      <p className="text-xs font-semibold text-slate-500">
                                        📝 {comment.timestamp}
                                      </p>
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                      {comment.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================
          FEASIBILITY DETAILS MODAL
          ============================================ */}
      {showFeasibilityDetailsModal && selectedFeasibilityDetails && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Feasibility Details
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedFeasibilityDetails.feasibilityId} • {selectedFeasibilityDetails.pocName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowFeasibilityDetailsModal(false);
                  setSelectedFeasibilityDetails(null);
                }}
                className="btn-icon hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="stack">
             

                {/* Feasibility Details Section */}
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                  <h3 className="label text-indigo-600 uppercase mb-3 flex items-center gap-2">
                    <Target size={14} />
                    Feasibility Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Feasibility ID</p>
                      <p className="text-sm font-bold text-indigo-700 font-mono">{selectedFeasibilityDetails.feasibilityId}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Status</p>
                      <span className={`badge ${getStatusColor(selectedFeasibilityDetails.status)}`}>
                        {selectedFeasibilityDetails.status === 'Feasibility' ? 'Pending' : 'Completed'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Feasibility Date</p>
                      <p className="text-sm font-semibold text-slate-800">{formatDate(selectedFeasibilityDetails.feasibilityDate)}</p>
                    </div>
                    {selectedFeasibilityDetails.feasibilityCompletedAt && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400">Completed At</p>
                        <p className="text-sm font-semibold text-emerald-600">{formatDateTime(selectedFeasibilityDetails.feasibilityCompletedAt)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Details Section */}
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h3 className="label text-amber-600 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    Task Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Task Description</p>
                      <div className="mt-1 p-3 bg-white rounded-lg border border-amber-100">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {selectedFeasibilityDetails.taskDetails || 'No task details provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments Section - Shows ALL comments with labels */}
                {extractAllComments(selectedFeasibilityDetails.lastInteractionDesc).length > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <h3 className="label text-emerald-700 uppercase mb-3 flex items-center gap-2">
                      <MessageSquare size={14} className="text-emerald-600" />
                      Comments ({extractAllComments(selectedFeasibilityDetails.lastInteractionDesc).length})
                    </h3>
                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                      {extractAllComments(selectedFeasibilityDetails.lastInteractionDesc).map((comment, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${
                          comment.type === 'PM' 
                            ? 'bg-blue-50 border-blue-100' 
                            : 'bg-emerald-50 border-emerald-100'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`badge rounded-full ${
                              comment.type === 'PM' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-emerald-600 text-white'
                            }`}>
                              {comment.type}
                            </span>
                            <p className="text-xs font-semibold text-slate-500">
                              📝 {comment.timestamp}
                            </p>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {comment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last Interaction (if no comments, show this) */}
                {extractAllComments(selectedFeasibilityDetails.lastInteractionDesc).length === 0 && selectedFeasibilityDetails.lastInteractionDesc && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="label uppercase mb-3 flex items-center gap-2">
                      <FileText size={14} />
                      Last Interaction
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedFeasibilityDetails.lastInteractionDesc}
                    </p>
                  </div>
                )}

                {/* Attachment Section */}
                {selectedFeasibilityDetails.attachmentPath && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="label uppercase mb-3 flex items-center gap-2">
                      <Paperclip size={14} />
                      Attachment
                    </h3>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <File size={16} className="text-blue-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {selectedFeasibilityDetails.attachmentFilename || 'Attachment'}
                          </p>
                          <p className="text-xs text-slate-400">
                            Uploaded on {formatDate(selectedFeasibilityDetails.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadAttachment(
                          selectedFeasibilityDetails.attachmentPath,
                          selectedFeasibilityDetails.attachmentFilename || 'attachment'
                        )}
                        className="btn btn-md bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-400">
                    <span>Created: {formatDateTime(selectedFeasibilityDetails.createdAt)}</span>
                    <span>Last Updated: {formatDateTime(selectedFeasibilityDetails.updatedAt)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowFeasibilityDetailsModal(false);
                      setSelectedFeasibilityDetails(null);
                    }}
                    className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    Close
                  </button>
                  {selectedFeasibilityDetails.status === 'Feasibility' && (
                    <button
                      onClick={() => {
                        setShowFeasibilityDetailsModal(false);
                        openCommentModal(selectedFeasibilityDetails);
                      }}
                      className="btn btn-md flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Plus size={14} />
                      Comment
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          ADD COMMENT MODAL - WITH FULL HISTORY
          ============================================ */}
      {showCommentModal && selectedFeasibilityDetails && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg">
            <div className="modal-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <MessageSquare size={20} className="text-emerald-600" />
                  Add Comment
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedFeasibilityDetails.feasibilityId} • {selectedFeasibilityDetails.pocName}
                </p>
              </div>
              <button
                onClick={closeCommentModal}
                className="btn-icon hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Comment History Section */}
            <div className="modal-body">
            {commentHistory.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <History size={14} className="text-emerald-600" />
                  <h3 className="label text-emerald-700 uppercase">
                    Previous Comments ({commentHistory.length})
                  </h3>
                </div>
                <div className="max-h-[150px] overflow-y-auto space-y-2 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  {commentHistory.map((comment, idx) => (
                    <div key={idx} className={`p-2 rounded-lg border ${
                      comment.type === 'PM' 
                        ? 'bg-blue-50 border-blue-100' 
                        : 'bg-emerald-50 border-emerald-100'
                    }`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`badge rounded-full ${
                          comment.type === 'PM' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {comment.type}
                        </span>
                        <p className="text-xs font-semibold text-slate-500">
                          {comment.timestamp}
                        </p>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">
                        {comment.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCommentSubmit} className="space-y-5">
              <div>
                <label className="label block mb-1.5">
                  New Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter your feasibility findings, technical assessment, recommendations, or any observations..."
                  className="input bg-slate-50 resize-none"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                  This comment will be visible to the Sales team
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeCommentModal}
                  className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className={`btn btn-md flex-[2] text-white ${
                    isSubmittingComment || !commentText.trim()
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                  }`}
                >
                  {isSubmittingComment ? (
                    <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                  ) : (
                    <><Send size={16} /> Add Comment</>
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PmFeasibilityDashboard;