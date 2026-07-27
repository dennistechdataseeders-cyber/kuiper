// frontend/src/pages/FeasibilityDashboard.jsx - With Create Feasibility Form (Simplified)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  FolderKanban,
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
  ArrowRight,
  X,
  Globe,
  Users,
  Target,
  Send,
  Upload,
  MessageSquare,
  Eye,
  History,
  Download,
  File,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Country and Industry Options
const POPULAR_COUNTRIES = [
  { label: "Afghanistan", value: "AF" }, { label: "Albania", value: "AL" }, { label: "Algeria", value: "DZ" },
  { label: "Australia", value: "AU" }, { label: "Brazil", value: "BR" }, { label: "Canada", value: "CA" },
  { label: "China", value: "CN" }, { label: "France", value: "FR" }, { label: "Germany", value: "DE" },
  { label: "India", value: "IN" }, { label: "Indonesia", value: "ID" }, { label: "Italy", value: "IT" },
  { label: "Japan", value: "JP" }, { label: "Mexico", value: "MX" }, { label: "Netherlands", value: "NL" },
  { label: "Nigeria", value: "NG" }, { label: "Pakistan", value: "PK" }, { label: "Russia", value: "RU" },
  { label: "Saudi Arabia", value: "SA" }, { label: "Singapore", value: "SG" }, { label: "South Africa", value: "ZA" },
  { label: "South Korea", value: "KR" }, { label: "Spain", value: "ES" }, { label: "Turkey", value: "TR" },
  { label: "United Arab Emirates", value: "AE" }, { label: "United Kingdom", value: "GB" },
  { label: "United States", value: "US" }, { label: "Vietnam", value: "VN" }
];

const INDUSTRY_OPTIONS = [
  { label: "ECOM", value: "ECOM" },
  { label: "FOOD", value: "FOOD" },
  { label: "HTL", value: "HTL" },
  { label: "TRVL", value: "TRVL" },
  { label: "FNC", value: "FNC" },
  { label: "SCLM", value: "SCLM" },
  { label: "JOB", value: "JOB" },
  { label: "AUTO", value: "AUTO" }
];

const customSelectStyles = {
  control: (base) => ({
    ...base,
    padding: '8px',
    borderRadius: '1rem',
    border: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
    fontWeight: 'bold',
    boxShadow: 'none',
    '&:hover': { border: '1px solid #e2e8f0' }
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#eff6ff' : 'white',
    color: state.isFocused ? '#2563eb' : '#1e293b',
    fontWeight: 'bold'
  })
};

const FeasibilityDashboard = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [feasibilityTasks, setFeasibilityTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [completing, setCompleting] = useState({});
  const [expandedComments, setExpandedComments] = useState(null);

  // Close Lead Modal State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedLeadForClose, setSelectedLeadForClose] = useState(null);
  const [closingData, setClosingData] = useState({ reason: 'won', description: '' });
  const [isClosing, setIsClosing] = useState(false);

  // Feasibility Details Modal State
  const [showFeasibilityDetailsModal, setShowFeasibilityDetailsModal] = useState(false);
  const [selectedFeasibilityDetails, setSelectedFeasibilityDetails] = useState(null);

  // Add Comment Modal State (Sales)
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentHistory, setCommentHistory] = useState([]);

  // Create Feasibility Modal State - Simplified
  const [showCreateFeasibilityModal, setShowCreateFeasibilityModal] = useState(false);
  const [createFeasibilityData, setCreateFeasibilityData] = useState({
    taskDetails: '',
    feasibilityDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '',
    projectManagerId: '',
    attachment: null,
    attachmentName: '',
    organizationId: null
  });
  const [isCreatingFeasibility, setIsCreatingFeasibility] = useState(false);
  const [projectManagersList, setProjectManagersList] = useState([]);
  const [loadingPMs, setLoadingPMs] = useState(false);

  // Production Ready Form State
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  const [productionForm, setProductionForm] = useState({
    name: '',
    projectManager: '',
    description: '',
    country: '',
    industry: '',
  });

  // Attachment state
  const [productionAttachment, setProductionAttachment] = useState(null);

  const itemsPerPage = 10;
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');

  // Fetch Project Managers
  const fetchProjectManagers = async () => {
    setLoadingPMs(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pms = res.data.filter(u => u.role === 'Project Manager');
      setProjectManagersList(pms);
      setProjectManagers(pms);
    } catch (err) {
      console.error("Error fetching PMs:", err);
    } finally {
      setLoadingPMs(false);
    }
  };

  useEffect(() => {
    fetchFeasibilityTasks();
    fetchProjectManagers();
  }, []);

  const fetchFeasibilityTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/lead-generation`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = Array.isArray(res.data) ? res.data : [];
      
      const filtered = data.filter(lead => {
        const isFeasibility = lead.status === 'Feasibility' || lead.status === 'Feasibility Completed';
        
        if (userRole === 'Project Manager') {
          return isFeasibility && lead.projectManagerId === currentUserId;
        }
        
        return isFeasibility;
      });

      setFeasibilityTasks(filtered);
    } catch (err) {
      console.error("Error fetching feasibility tasks:", err);
      toast.error("Failed to load feasibility tasks");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // VIEW FEASIBILITY DETAILS (Sales view)
  // ============================================
  const viewFeasibilityDetails = (lead) => {
    setSelectedFeasibilityDetails(lead);
    setShowFeasibilityDetailsModal(true);
  };

  // ============================================
  // OPEN ADD COMMENT MODAL (Sales)
  // ============================================
  const openCommentModal = (lead) => {
    setSelectedFeasibilityDetails(lead);
    setCommentText('');
    const existingComments = extractPMComments(lead.lastInteractionDesc || '');
    setCommentHistory(existingComments);
    setShowCommentModal(true);
  };

  // ============================================
  // HANDLE ADD COMMENT SUBMIT (Sales)
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
      
      const currentLead = await axios.get(`${API_BASE_URL}/api/lead-generation/feasibility/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const existingDesc = currentLead.data.data?.lastInteractionDesc || '';
      
      const timestamp = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const newComment = `\n\n**[Sales Comment - ${timestamp}]**\n${commentText.trim()}`;
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
      
      const newCommentObj = {
        type: 'Sales',
        timestamp: timestamp,
        text: commentText.trim()
      };
      setCommentHistory([...commentHistory, newCommentObj]);
      
      setCommentText('');
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
  // OPEN CREATE FEASIBILITY MODAL
  // ============================================
  const openCreateFeasibilityModal = () => {
    setCreateFeasibilityData({
      taskDetails: '',
      feasibilityDate: new Date().toISOString().split('T')[0],
      nextFollowUpDate: '',
      projectManagerId: '',
      attachment: null,
      attachmentName: ''
    });
    setShowCreateFeasibilityModal(true);
  };

  // ============================================
  // HANDLE CREATE FEASIBILITY SUBMIT
  // ============================================

const handleCreateFeasibilitySubmit = async (e) => {
  e.preventDefault();

  // Validate required fields
  if (!createFeasibilityData.projectManagerId) {
    toast.error("Please select a Project Manager");
    return;
  }
  if (!createFeasibilityData.taskDetails.trim()) {
    toast.error("Please enter task details");
    return;
  }

  setIsCreatingFeasibility(true);

  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    // Generate Feasibility ID
    const feasibilityId = `FSL${String(Date.now()).slice(-4)}`;

    const safeFeasibilityDate = new Date(`${createFeasibilityData.feasibilityDate}T12:00:00`).toISOString();
    const safeFollowUpDate = createFeasibilityData.nextFollowUpDate 
      ? new Date(`${createFeasibilityData.nextFollowUpDate}T12:00:00`).toISOString() 
      : null;

    // ============================================
    // STEP 1: Create a lead with required fields
    // ============================================
    const leadPayload = {
      pocName: `Feasibility Task - ${feasibilityId}`,
      pocEmail: '',
      pocPhone: '',
      leadType: 'Inbound',
      organizationId: null, // Set to null if your backend allows
      salesRepId: currentUserId
    };

    console.log('📦 Creating lead with payload:', leadPayload);

    const leadResponse = await axios.post(`${API_BASE_URL}/api/lead-generation`, leadPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const leadId = leadResponse.data._id;
    console.log('✅ Lead created:', leadId);

    // ============================================
    // STEP 2: Update lead with feasibility data
    // ============================================
    // Use JSON payload instead of FormData for simplicity
    const updatePayload = {
      status: 'Feasibility',
      feasibilityId: feasibilityId,
      feasibilityDate: safeFeasibilityDate,
      taskDetails: createFeasibilityData.taskDetails,
      projectManagerId: createFeasibilityData.projectManagerId,
      followUpDate: safeFollowUpDate || safeFeasibilityDate,
      lastInteractionDesc: `Feasibility request created for ${feasibilityId}`
    };

    console.log('📦 Updating lead with payload:', updatePayload);

    await axios.patch(`${API_BASE_URL}/api/lead-generation/${leadId}/action`, updatePayload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // ============================================
    // STEP 3: Handle file upload separately if needed
    // ============================================
    if (createFeasibilityData.attachment) {
      const fileFormData = new FormData();
      fileFormData.append('file', createFeasibilityData.attachment);
      
      // Upload file to the lead
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${leadId}/action`, fileFormData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
    }

    toast.success('✅ Feasibility created successfully!');
    setShowCreateFeasibilityModal(false);
    fetchFeasibilityTasks();

  } catch (err) {
    console.error("Create Feasibility Error:", err);
    console.error("Error response:", err.response?.data);
    const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to create feasibility";
    toast.error(errorMessage);
  } finally {
    setIsCreatingFeasibility(false);
  }
};

  // ============================================
  // EXTRACT COMMENTS
  // ============================================
  const extractPMComments = (desc) => {
    if (!desc) return [];
    const comments = [];
    const lines = desc.split('\n');
    let currentComment = null;
    
    for (const line of lines) {
      if (line.includes('**[PM Comment -') || line.includes('**[Sales Comment -')) {
        if (currentComment) {
          comments.push(currentComment);
        }
        const timestampMatch = line.match(/\[(PM|Sales) Comment - (.+?)\]/);
        const type = timestampMatch ? timestampMatch[1] : 'Unknown';
        const timestamp = timestampMatch ? timestampMatch[2] : 'Unknown time';
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

  const hasComments = (lead) => {
    if (!lead.lastInteractionDesc) return false;
    return lead.lastInteractionDesc.includes('**[PM Comment -') || 
           lead.lastInteractionDesc.includes('**[Sales Comment -');
  };

  const toggleComments = (leadId) => {
    setExpandedComments(expandedComments === leadId ? null : leadId);
  };

  // ============================================
  // OPEN CLOSE LEAD MODAL
  // ============================================
  const openCloseLeadModal = (lead) => {
    setSelectedLeadForClose(lead);
    setClosingData({ reason: 'won', description: '' });
    setShowCloseModal(true);
    setShowProductionForm(false);
    setProductionAttachment(null);
    setProductionForm({
      name: '',
      projectManager: '',
      description: '',
      country: '',
      industry: '',
    });
  };

  const handleProductionSubmit = async (e) => {
    e.preventDefault();

    if (!productionForm.name.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    if (!productionForm.projectManager) {
      toast.error("Please select a Project Manager");
      return;
    }
    if (!productionForm.country) {
      toast.error("Please select a country");
      return;
    }
    if (!productionForm.industry) {
      toast.error("Please select an industry");
      return;
    }

    setIsClosing(true);

    try {
      const token = localStorage.getItem('token');
      
      let attachmentUrl = null;
      let attachmentFilename = null;
      if (productionAttachment) {
        const formData = new FormData();
        formData.append('file', productionAttachment);
        
        const uploadRes = await axios.post(`${API_BASE_URL}/api/tickets/upload-file`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (uploadRes.data.success) {
          attachmentUrl = uploadRes.data.url;
          attachmentFilename = uploadRes.data.originalName;
        }
      }

      const payload = {
        status: 'Production Ready',
        projectBriefName: productionForm.name,
        projectManagerId: productionForm.projectManager,
        industry: productionForm.industry,
        country: productionForm.country,
        organizationId: selectedLeadForClose?.organizationId?._id || selectedLeadForClose?.organizationId,
        lastInteractionDesc: productionForm.description || `Project from lead: ${selectedLeadForClose.pocName}`,
        attachmentPath: attachmentUrl,
        attachmentFilename: attachmentFilename
      };
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLeadForClose._id}/action`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('✅ Project created and assigned to Project Manager!');
      
      setShowCloseModal(false);
      setShowProductionForm(false);
      setSelectedLeadForClose(null);
      setClosingData({ reason: 'won', description: '' });
      setProductionAttachment(null);
      
      fetchFeasibilityTasks();
      
    } catch (err) {
      console.error("Production Ready Error:", err);
      toast.error(err.response?.data?.error || "Failed to mark as Production Ready");
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseLeadSubmit = async (e) => {
    e.preventDefault();

    if (!closingData.reason) {
      toast.error("Please select an outcome (Won or Lost)");
      return;
    }

    if (closingData.reason === 'won') {
      setShowProductionForm(true);
      return;
    }

    if (!closingData.description.trim()) {
      toast.error("Please provide a reason for losing the lead");
      return;
    }

    setIsClosing(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        status: 'Closed',
        lastInteractionDesc: closingData.description,
      };
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLeadForClose._id}/action`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Lead marked as Closed');
      
      setShowCloseModal(false);
      setSelectedLeadForClose(null);
      setClosingData({ reason: 'won', description: '' });
      
      fetchFeasibilityTasks();
      
    } catch (err) {
      console.error("Close Lead Error:", err);
      toast.error(err.response?.data?.error || "Failed to close lead");
    } finally {
      setIsClosing(false);
    }
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
      case 'Feasibility': return 'bg-purple-100 text-purple-700 border-purple-200';
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
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading feasibility tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Feasibility Dashboard
                </h1>
                <p className="text-slate-500 mt-1">Manage feasibility requests</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreateFeasibilityModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-sm"
            >
              <Plus size={16} />
              New Feasibility
            </button>
           
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Total Tasks</p>
          <p className="text-2xl font-black">{feasibilityTasks.length}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Pending</p>
          <p className="text-2xl font-black">
            {feasibilityTasks.filter(t => t.status === 'Feasibility').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-[8px] font-black uppercase opacity-80 tracking-wider">Completed</p>
          <p className="text-2xl font-black">
            {feasibilityTasks.filter(t => t.status === 'Feasibility Completed').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by POC, organization, or Feasibility ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
            />
          </div>
          <div className="relative min-w-[180px]">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm font-medium"
            >
              <option value="all">All Status</option>
              <option value="Feasibility">Pending</option>
              <option value="Feasibility Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {currentTasks.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No feasibility tasks found</p>
            <p className="text-xs text-slate-400 mt-1">Tasks will appear here when assigned</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Feasibility ID</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">POC / Organization</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Task Details</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentTasks.map((task) => {
                  const isClosed = task.status === 'Closed' || task.status === 'Production Ready';
                  const comments = extractPMComments(task.lastInteractionDesc);
                  const hasExistingComments = comments.length > 0;
                  const isExpanded = expandedComments === task._id;
                  
                  return (
                    <React.Fragment key={task._id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            {task.feasibilityId || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{task.pocName}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Building2 size={12} />
                              {task.organizationId?.companyName || 'No Organization'}
                            </p>
                            {task.pocEmail && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Mail size={10} />
                                {task.pocEmail}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
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
                                <span className="text-[8px] font-bold">
                                  {comments.length} comment(s)
                                </span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-500">
                            <p>Created: {formatDate(task.createdAt)}</p>
                            {task.feasibilityDate && (
                              <p className="text-purple-600 font-medium">Due: {formatDate(task.feasibilityDate)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(task.status)}`}>
                            {task.status === 'Feasibility' ? 'Pending' : 'Completed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => viewFeasibilityDetails(task)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1"
                            >
                              <Eye size={12} />
                              Details
                            </button>
                            
                            {task.status === 'Feasibility' && (
                              <>
                                <button
                                  onClick={() => openCommentModal(task)}
                                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1"
                                >
                                  <Plus size={12} />
                                  Comment
                                </button>
                                <button
                                  onClick={() => openCloseLeadModal(task)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1"
                                >
                                  <Ban size={12} />
                                  Close
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Comments Row */}
                      {isExpanded && hasExistingComments && (
                        <tr className="bg-emerald-50/30">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="bg-white rounded-xl p-4 border border-emerald-200">
                              <div className="flex items-center gap-2 mb-3">
                                <MessageSquare size={16} className="text-emerald-600" />
                                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider">
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
                                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                                        comment.type === 'PM' 
                                          ? 'bg-blue-600 text-white' 
                                          : 'bg-emerald-600 text-white'
                                      }`}>
                                        {comment.type}
                                      </span>
                                      <p className="text-[8px] font-bold text-slate-500">
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
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================
          CREATE FEASIBILITY MODAL - SIMPLIFIED
          ============================================ */}
      {showCreateFeasibilityModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  New Feasibility Request
                </h2>
                <p className="text-sm text-slate-500">Create a new feasibility task and assign to PM</p>
              </div>
              <button
                onClick={() => setShowCreateFeasibilityModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFeasibilitySubmit} className="space-y-5">
              {/* Task Details */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1">
                  Task Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the feasibility requirements..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm resize-none focus:border-purple-400 transition-colors"
                  value={createFeasibilityData.taskDetails}
                  onChange={(e) => setCreateFeasibilityData({...createFeasibilityData, taskDetails: e.target.value})}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1">
                    Feasibility Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm focus:border-purple-400 transition-colors"
                    value={createFeasibilityData.feasibilityDate}
                    onChange={(e) => setCreateFeasibilityData({...createFeasibilityData, feasibilityDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm focus:border-purple-400 transition-colors"
                    value={createFeasibilityData.nextFollowUpDate}
                    onChange={(e) => setCreateFeasibilityData({...createFeasibilityData, nextFollowUpDate: e.target.value})}
                  />
                  <p className="text-[8px] text-slate-400 mt-1 italic">Task will reappear on this date</p>
                </div>
              </div>

              {/* Project Manager Assignment */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1 flex items-center gap-2">
                  <Briefcase size={14} className="text-purple-600" />
                  Assign Project Manager <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700 focus:border-purple-400 transition-colors cursor-pointer"
                  value={createFeasibilityData.projectManagerId}
                  onChange={(e) => setCreateFeasibilityData({...createFeasibilityData, projectManagerId: e.target.value})}
                >
                  <option value="">Select Project Manager...</option>
                  {loadingPMs ? (
                    <option value="" disabled>Loading PMs...</option>
                  ) : projectManagersList.length === 0 ? (
                    <option value="" disabled>No PMs available</option>
                  ) : (
                    projectManagersList.map(pm => (
                      <option key={pm._id} value={pm._id}>{pm.name}</option>
                    ))
                  )}
                </select>
                <p className="text-[8px] text-slate-400 mt-1">The feasibility task will be assigned to this PM</p>
              </div>

              {/* Attachment Upload */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1">
                  Attachment (PDF, Word, Excel, Images, ZIP, etc.)
                </label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.txt,.csv,.tsv,.json,.xml,.yaml,.yml,.zip,.rar,.7z,.tar,.gz,.ppt,.pptx,.odp,.mp4,.avi,.mkv,.mov,.mp3,.wav,.aac,.flac,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.sh,.bash,.bat,.ps1,.cmd" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 50 * 1024 * 1024) {
                          toast.error('File size must be less than 50MB');
                          e.target.value = '';
                          return;
                        }
                        setCreateFeasibilityData({
                          ...createFeasibilityData, 
                          attachment: file,
                          attachmentName: file.name
                        });
                      }
                    }} 
                  />
                  <div className={`w-full p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    createFeasibilityData.attachment 
                      ? 'border-emerald-400 bg-emerald-50' 
                      : 'border-slate-200 hover:border-purple-400 bg-slate-50'
                  }`}>
                    <Upload size={24} className={createFeasibilityData.attachment ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className="text-xs font-bold text-slate-500 truncate w-full px-4 text-center">
                      {createFeasibilityData.attachment 
                        ? createFeasibilityData.attachmentName || createFeasibilityData.attachment.name 
                        : "Click to upload files (Max 50MB)"}
                    </span>
                    {createFeasibilityData.attachment && (
                      <span className="text-[8px] text-emerald-600">
                        {(createFeasibilityData.attachment.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                    <span className="text-[7px] text-slate-400">
                      Supported: PDF, Word, Excel, Images, JSON, ZIP, Code files, and more
                    </span>
                  </div>
                </div>
                {createFeasibilityData.attachment && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateFeasibilityData({...createFeasibilityData, attachment: null, attachmentName: ''});
                      const fileInput = document.querySelector('input[type="file"]');
                      if (fileInput) fileInput.value = '';
                    }}
                    className="mt-1 text-[8px] font-bold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove file
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateFeasibilityModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFeasibility}
                  className={`flex-[2] py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    isCreatingFeasibility
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200'
                  }`}
                >
                  {isCreatingFeasibility ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating...</>
                  ) : (
                    <><Send size={16} /> Create Feasibility</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          FEASIBILITY DETAILS MODAL (Sales View)
          ============================================ */}
      {showFeasibilityDetailsModal && selectedFeasibilityDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
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
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
             

              {/* Feasibility Details Section */}
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target size={14} />
                  Feasibility Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400">Feasibility ID</p>
                    <p className="text-sm font-bold text-indigo-700 font-mono">{selectedFeasibilityDetails.feasibilityId}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400">Status</p>
                    <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(selectedFeasibilityDetails.status)}`}>
                      {selectedFeasibilityDetails.status === 'Feasibility' ? 'Pending' : 'Completed'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400">Feasibility Date</p>
                    <p className="text-sm font-semibold text-slate-800">{formatDate(selectedFeasibilityDetails.feasibilityDate)}</p>
                  </div>
                  {selectedFeasibilityDetails.feasibilityCompletedAt && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">Completed At</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatDateTime(selectedFeasibilityDetails.feasibilityCompletedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Details Section */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText size={14} />
                  Task Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400">Task Description</p>
                    <div className="mt-1 p-3 bg-white rounded-lg border border-amber-100">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedFeasibilityDetails.taskDetails || 'No task details provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              {extractPMComments(selectedFeasibilityDetails.lastInteractionDesc).length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <h3 className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MessageSquare size={14} className="text-emerald-600" />
                    Comments ({extractPMComments(selectedFeasibilityDetails.lastInteractionDesc).length})
                  </h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto">
                    {extractPMComments(selectedFeasibilityDetails.lastInteractionDesc).map((comment, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${
                        comment.type === 'PM' 
                          ? 'bg-blue-50 border-blue-100' 
                          : 'bg-emerald-50 border-emerald-100'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                            comment.type === 'PM' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-emerald-600 text-white'
                          }`}>
                            {comment.type}
                          </span>
                          <p className="text-[8px] font-bold text-slate-500">
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

              {/* Last Interaction */}
              {extractPMComments(selectedFeasibilityDetails.lastInteractionDesc).length === 0 && selectedFeasibilityDetails.lastInteractionDesc && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
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
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
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
                        <p className="text-[8px] text-slate-400">
                          Uploaded on {formatDate(selectedFeasibilityDetails.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadAttachment(
                        selectedFeasibilityDetails.attachmentPath,
                        selectedFeasibilityDetails.attachmentFilename || 'attachment'
                      )}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"
                    >
                      <Download size={12} />
                      Download
                    </button>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between text-[8px] text-slate-400">
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
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => navigate('/sales/lead_generation')}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  View in Lead Gen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          ADD COMMENT MODAL (Sales)
          ============================================ */}
      {showCommentModal && selectedFeasibilityDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <MessageSquare size={20} className="text-emerald-600" />
                  Add Comment
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedFeasibilityDetails.feasibilityId} • {selectedFeasibilityDetails.pocName}
                </p>
              </div>
              <button
                onClick={closeCommentModal}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Comment History Section */}
            {commentHistory.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <History size={14} className="text-emerald-600" />
                  <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
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
                        <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${
                          comment.type === 'PM' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {comment.type}
                        </span>
                        <p className="text-[7px] font-bold text-slate-500">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block mb-1">
                  New Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter your comments, feedback, or observations..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <p className="text-[8px] text-slate-400 mt-1">
                  This comment will be visible to the PM and other Sales team members
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeCommentModal}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className={`flex-[2] py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
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
      )}

      {/* ============================================
          CLOSE LEAD MODAL (kept for Sales to close leads)
          ============================================ */}
      {showCloseModal && selectedLeadForClose && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
            <button 
              onClick={() => {
                setShowCloseModal(false);
                setShowProductionForm(false);
                setSelectedLeadForClose(null);
                setClosingData({ reason: 'won', description: '' });
                setProductionAttachment(null);
              }} 
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <X size={24}/>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border-2 border-emerald-200">
                <FolderKanban size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                {showProductionForm ? 'Production Ready Setup' : 'Close Lead'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                For: <span className="font-bold text-slate-800">{selectedLeadForClose?.pocName}</span>
              </p>
            </div>

            {!showProductionForm ? (
              <form onSubmit={handleCloseLeadSubmit} className="space-y-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Select Outcome *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setClosingData({...closingData, reason: 'won'})} 
                      className={`py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all duration-200 flex items-center justify-center gap-2 ${
                        closingData.reason === 'won' 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md shadow-emerald-100' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <CheckCircle size={16} className={closingData.reason === 'won' ? 'text-emerald-600' : 'text-slate-400'} />
                      Won 
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => setClosingData({...closingData, reason: 'lost'})} 
                      className={`py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all duration-200 flex items-center justify-center gap-2 ${
                        closingData.reason === 'lost' 
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-md shadow-rose-100' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <X size={16} className={closingData.reason === 'lost' ? 'text-rose-600' : 'text-slate-400'} />
                      Lost
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    {closingData.reason === 'won' ? 'Success Notes' : 'Reason for Loss'} {closingData.reason === 'lost' && '*'}
                  </label>
                  <textarea 
                    placeholder={
                      closingData.reason === 'won' 
                        ? "Describe what made this lead successful..." 
                        : "Please explain why this lead was lost..."
                    }
                    required={closingData.reason === 'lost'}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-24 resize-none font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={closingData.description} 
                    onChange={(e) => setClosingData({...closingData, description: e.target.value})} 
                  />
                  {closingData.reason === 'lost' && (
                    <p className="text-[9px] text-rose-500 ml-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Please provide a reason for losing this lead
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCloseModal(false);
                      setSelectedLeadForClose(null);
                      setClosingData({ reason: 'won', description: '' });
                    }}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!closingData.reason || (closingData.reason === 'lost' && !closingData.description.trim())}
                    className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
                      closingData.reason === 'won' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' 
                        : closingData.reason === 'lost'
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                        : 'bg-slate-300 cursor-not-allowed'
                    } ${(!closingData.reason || (closingData.reason === 'lost' && !closingData.description.trim())) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isClosing ? (
                      <><Loader2 size={16} className="animate-spin" /> Processing...</>
                    ) : (
                      <>
                        <ArrowRight size={16} />
                        {closingData.reason === 'won' ? 'Continue to Setup' : 'Confirm Loss'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleProductionSubmit} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">Setup Production Project</span>
                  </div>
                  <p className="text-[9px] text-emerald-600 mt-1">Fill in the details to launch this project</p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm"
                    value={productionForm.name}
                    onChange={(e) => setProductionForm({...productionForm, name: e.target.value})}
                    placeholder="Enter project name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                      Industry *
                    </label>
                    <CreatableSelect 
                      isClearable 
                      options={INDUSTRY_OPTIONS} 
                      value={INDUSTRY_OPTIONS.find(opt => opt.value === productionForm.industry) || null} 
                      onChange={(v) => setProductionForm({ ...productionForm, industry: v?.value || '' })} 
                      styles={customSelectStyles} 
                      placeholder="Select industry..." 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                      Country *
                    </label>
                    <CreatableSelect 
                      isClearable 
                      options={POPULAR_COUNTRIES} 
                      value={POPULAR_COUNTRIES.find(opt => opt.label === productionForm.country) || null} 
                      onChange={(v) => setProductionForm({ ...productionForm, country: v?.label || '' })} 
                      styles={customSelectStyles} 
                      placeholder="Select country..." 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block flex items-center gap-2">
                    <Briefcase size={14} className="text-emerald-600" />
                    Assign Project Manager *
                  </label>
                  <select
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm text-slate-700 cursor-pointer"
                    value={productionForm.projectManager}
                    onChange={(e) => setProductionForm({...productionForm, projectManager: e.target.value})}
                  >
                    <option value="">Select Project Manager...</option>
                    {projectManagers.map(pm => (
                      <option key={pm._id} value={pm._id}>{pm.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-medium text-sm resize-none"
                    value={productionForm.description}
                    onChange={(e) => setProductionForm({...productionForm, description: e.target.value})}
                    placeholder="Brief project description..."
                  />
                </div>

                {/* Attachment Upload */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Attachment (Optional - PDF, Word, Excel, Images, ZIP)
                  </label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={(e) => setProductionAttachment(e.target.files[0])} 
                    />
                    <div className={`w-full p-3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${
                      productionAttachment ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-purple-400 bg-slate-50'
                    }`}>
                      <Upload size={20} className={productionAttachment ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-xs font-bold text-slate-500 truncate w-full px-4 text-center">
                        {productionAttachment ? productionAttachment.name : "Click to upload files (Max 20MB)"}
                      </span>
                      {productionAttachment && (
                        <span className="text-[8px] text-green-600">
                          {(productionAttachment.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isClosing || !productionForm.projectManager || !productionForm.name.trim()}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isClosing || !productionForm.projectManager || !productionForm.name.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200'
                  }`}
                >
                  {isClosing ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                  ) : (
                    <><ArrowRight size={16} /> Launch Production Project</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeasibilityDashboard;