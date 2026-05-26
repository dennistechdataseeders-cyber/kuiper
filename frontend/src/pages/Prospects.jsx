import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Search, Loader2, Plus, X, 
  PackageSearch, RefreshCcw, Database, Layers, 
  ChevronLeft, ChevronRight, Building2, Filter, 
  Mail, Send, ChevronDown, ChevronUp, Calendar, 
  CheckCircle2, Clock, Trash2, AlertCircle, ExternalLink,Target,
  ArrowRight, Users, UserPlus, Phone as PhoneIcon
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

const Prospects = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed } = useSidebar();
  
  // Core State
  const [prospects, setProspects] = useState([]);
  const [bucketCount, setBucketCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fetchingBucket, setFetchingBucket] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); 
  const [expandedRow, setExpandedRow] = useState(null); 

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Converting states
  const [convertingOrg, setConvertingOrg] = useState({});
  const [convertingLead, setConvertingLead] = useState({});

  // Lead Conversion Modal States
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedProspectForLead, setSelectedProspectForLead] = useState(null);
  const [availablePOCs, setAvailablePOCs] = useState([]);
  const [selectedPOC, setSelectedPOC] = useState(null);
  const [leadType, setLeadType] = useState('Inbound');
  const [referredBy, setReferredBy] = useState('');
  const [submittingLead, setSubmittingLead] = useState(false);

  // Approach Modal State
  const [isApproachModalOpen, setIsApproachModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [approachData, setApproachData] = useState({ method: 'Email', summary: '' });
  const [submittingApproach, setSubmittingApproach] = useState(false);

  // Close Prospect Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  // General Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProspect, setNewProspect] = useState({ 
    companyName: '', pocName: '', pocEmail: '', 
    industry: '', pocContact: '', pocLinkedin: '', sector:''
  });

  // Role Logic
  const userRole = localStorage.getItem('role');
  const isSM = userRole === 'Sales Manager' || userRole === 'Admin';

  const formatId = (num, prefix = "LEAD") => {
    if (!num) return `${prefix}---`;
    return `${prefix}${String(num).padStart(4, '0')}`;
  };

  useEffect(() => {
    fetchData();
    if (location.state?.openApproachFor) {
      setSelectedProspect(location.state.openApproachFor);
      setIsApproachModalOpen(true); 
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchData = async () => {
    setLoading(true);
    const tasks = [fetchProspects()];
    if (!isSM) tasks.push(fetchBucketCount());
    await Promise.all(tasks);
    setLoading(false);
  };

  const fetchProspects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/prospects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProspects(res.data);
    } catch (err) { 
      toast.error("Error loading prospects"); 
    }
  };

  const fetchBucketCount = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/prospects/bucket-count`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBucketCount(res.data.count);
    } catch (err) { 
      console.error("Bucket count fetch error"); 
    }
  };

  const handleFetchBucket = async () => {
    setFetchingBucket(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/prospects/fetch-bucket`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Server error");
    } finally {
      setFetchingBucket(false);
    }
  };

  const handleApproachSubmit = async (e) => {
    e.preventDefault();
    if (!approachData.summary) return toast.error("Please provide a summary");
    setSubmittingApproach(true);
    try {
      const stepToUpdate = (selectedProspect.status !== 'Approached') ? 0 : (selectedProspect.currentFollowUpStep || 0);
      await axios.put(`${API_BASE_URL}/api/prospects/approach/${selectedProspect._id}`, {
        ...approachData,
        step: stepToUpdate 
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }});
      
      toast.success("Action recorded!");
      setIsApproachModalOpen(false);
      setApproachData({ method: 'Email', summary: '' });
      fetchData();
    } catch (err) { 
      toast.error("Failed to update approach"); 
    } finally {
      setSubmittingApproach(false);
    }
  };

  const handleCloseSubmit = async (e) => {
    e.preventDefault();
    if (!closeReason) return toast.error("Please provide a reason for closing.");
    setIsClosing(true);
    try {
      await axios.post(`${API_BASE_URL}/api/prospects/close/${selectedProspect._id}`, {
        reason: closeReason
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }});
      
      toast.success("Prospect closed successfully");
      setIsCloseModalOpen(false);
      setCloseReason("");
      setExpandedRow(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to close prospect");
    } finally {
      setIsClosing(false);
    }
  };

  const handleConvertToOrg = async (item) => {
    setConvertingOrg(prev => ({ ...prev, [item._id]: true }));
    try {
      const token = localStorage.getItem('token');
      
      // First check if organization already exists
      const checkResponse = await axios.post(`${API_BASE_URL}/api/orgs/check-duplicate`, {
        companyName: item.companyName,
        prospectId: item._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (checkResponse.data.exists) {
        toast.error(`Organization "${item.companyName}" already exists!`);
        setConvertingOrg(prev => ({ ...prev, [item._id]: false }));
        return;
      }
      
      const payload = {
        companyName: item.companyName,
        pocName: item.pocName,
        pocEmail: item.pocEmail,
        pocPhone: item.pocContact,
        linkedin: item.pocLinkedin,
        website: '',
        address: '',
        prospectId: item._id
      };
      
      const response = await axios.post(`${API_BASE_URL}/api/orgs`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the prospect with organizationId
      await axios.put(`${API_BASE_URL}/api/prospects/${item._id}`, {
        organizationId: response.data._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Organization created for ${item.companyName}`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create organization");
    } finally {
      setConvertingOrg(prev => ({ ...prev, [item._id]: false }));
    }
  };

  // Open Lead Conversion Modal with POCs
  const openLeadModal = async (item) => {
    setSelectedProspectForLead(item);
    setLeadType('Inbound');
    setReferredBy('');
    setSelectedPOC(null);
    
    // Extract POCs from the prospect
    const pocs = [];
    
    // Add main POC
    if (item.pocName) {
      pocs.push({
        id: 'main',
        name: item.pocName,
        email: item.pocEmail || '',
        phone: item.pocContact || '',
        linkedin: item.pocLinkedin || '',
        isPrimary: true,
        department: 'Primary Contact'
      });
    }
    
    // If there's an organization with multiple POCs, fetch them
    if (item.organizationId && typeof item.organizationId === 'object') {
      const org = item.organizationId;
      if (org.pointsOfContact && org.pointsOfContact.length > 0) {
        org.pointsOfContact.forEach((poc, idx) => {
          // Avoid duplicates
          if (!pocs.some(p => p.name === poc.pocName)) {
            pocs.push({
              id: poc._id || `poc_${idx}`,
              name: poc.pocName,
              email: poc.pocEmail || '',
              phone: poc.pocPhone || '',
              linkedin: poc.linkedin || '',
              isPrimary: poc.isPrimary || false,
              department: poc.department || 'Other'
            });
          }
        });
      }
    }
    
    setAvailablePOCs(pocs);
    
    // Auto-select first POC
    if (pocs.length > 0) {
      setSelectedPOC(pocs[0]);
    }
    
    setIsLeadModalOpen(true);
  };

  // Handle Lead Conversion from Modal
  const handleLeadConversionSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPOC) {
      toast.error("Please select a Point of Contact");
      return;
    }
    
    if (leadType === 'Reference' && !referredBy) {
      toast.error("Please provide referral information");
      return;
    }
    
    setSubmittingLead(true);
    
    try {
      const token = localStorage.getItem('token');
      const orgId = selectedProspectForLead.organizationId?._id || selectedProspectForLead.organizationId;
      
      if (!orgId) {
        toast.error("Organization not found. Please create organization first.");
        return;
      }
      
      const leadPayload = {
        organizationId: orgId,
        leadType: leadType,
        referredBy: leadType === 'Reference' ? referredBy : '',
        prospectId: selectedProspectForLead._id,
        pocName: selectedPOC.name,
        pocEmail: selectedPOC.email || '',
        pocPhone: selectedPOC.phone || '',
        linkedin: selectedPOC.linkedin || ''
      };
      
      const leadResponse = await axios.post(`${API_BASE_URL}/api/lead-generation`, leadPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update prospect with leadId
      await axios.put(`${API_BASE_URL}/api/prospects/${selectedProspectForLead._id}`, {
        leadId: leadResponse.data._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Lead generated for ${selectedProspectForLead.companyName}`);
      setIsLeadModalOpen(false);
      setSelectedProspectForLead(null);
      setSelectedPOC(null);
      setAvailablePOCs([]);
      fetchData();
    } catch (err) {
      console.error("Lead conversion error:", err);
      toast.error(err.response?.data?.error || "Failed to generate lead");
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const validData = rawData.filter(row => row.pocEmail || row.pocContact || row.pocLinkedin);
        
        if (validData.length === 0) return toast.error("No valid records found.");

        await axios.post(`${API_BASE_URL}/api/prospects/bulk-import`, validData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success("Import Complete!");
        fetchData();
      } catch (err) { 
        toast.error("Import failed"); 
      } finally { 
        setImporting(false); 
        e.target.value = null; 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/api/prospects`, newProspect, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success("Added successfully");
      setIsModalOpen(false);
      setNewProspect({ companyName: '', pocName: '', pocEmail: '', industry: '', pocContact: '', pocLinkedin: '' });
      fetchData();
    } catch (err) { 
      toast.error(err.response?.data?.error || "Error adding prospect"); 
    }
  };

  const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);

  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput.$date || dateInput); 
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filtered = prospects.filter(p => {
    const matchesSearch = p.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.pocName?.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === "Assigned") return matchesSearch && p.salesRepId && !p.organizationId && !p.closed;
    if (statusFilter === "Approached") return matchesSearch && p.status === "Approached" && !p.closed;
    if (statusFilter === "Org Created") return matchesSearch && p.organizationId && !p.leadId && !p.closed;
    if (statusFilter === "Lead Generated") return matchesSearch && p.leadId && !p.closed;
    if (statusFilter === "Closed") return matchesSearch && p.closed === true;
    return matchesSearch && !p.closed;
  });

  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const isContactInfoProvided = !!(newProspect.pocEmail || newProspect.pocContact || newProspect.pocLinkedin);

  useEffect(() => { 
    setCurrentPage(1); 
  }, [searchTerm, statusFilter]);

  // Helper to get organization and lead details
  const getOrgDetails = (prospect) => {
    if (prospect.organizationId && typeof prospect.organizationId === 'object') {
      return prospect.organizationId;
    }
    return null;
  };

  const getLeadDetails = (prospect) => {
    if (prospect.leadId && typeof prospect.leadId === 'object') {
      return prospect.leadId;
    }
    return null;
  };

  // Check if approach button should be shown
  const shouldShowApproachButton = (item) => {
    return !item.closed && !item.leadId && !item.organizationId;
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="text-slate-600 font-medium">Loading prospects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-6  ${
      isCollapsed ? 'ml-20' : 'ml-64'
    }`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {isSM ? "Master Inventory" : "My Workspace"}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Track and manage your prospect outreach steps.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          {!isSM && (
            <div className="bg-white px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-4 shadow-sm">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Database size={20} /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Global Bucket</p>
                <p className="text-xl font-black text-slate-800">{bucketCount}</p>
              </div>
            </div>  
          )}

          {isSM && (
            <>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-4 bg-white text-slate-900 border-2 border-slate-900 rounded-2xl font-bold hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                <Plus size={20}/> Add Single
              </button>
              <input type="file" id="bulk-up" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
              <label htmlFor="bulk-up" className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                {importing ? <Loader2 className="animate-spin" size={20}/> : <FileSpreadsheet size={20}/>} Bulk Import 
              </label>
            </>
          )}

          {!isSM && (
            <button 
              onClick={handleFetchBucket} 
              disabled={fetchingBucket || bucketCount === 0}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:bg-slate-300 transition-all"
            >
              {fetchingBucket ? <RefreshCcw className="animate-spin" size={18}/> : <PackageSearch size={18}/>} Fetch 10 Prospects
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 px-4 gap-4">
        <p className="text-sm font-bold text-slate-500">
          Showing <span className="text-slate-900">{currentItems.length}</span> of <span className="text-slate-900">{filtered.length}</span> prospects
        </p>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-3 bg-white rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm">
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
                if (i === 6) pageNum = totalPages;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
                if (i === 0) pageNum = 1;
                if (i === 6) pageNum = totalPages;
              }
              
              if (pageNum === 1 && i > 0 && currentPage > 4 && totalPages > 7) {
                return <span key="ellipsis1" className="px-2 text-slate-400">...</span>;
              }
              
              if (pageNum === totalPages && i < 6 && currentPage < totalPages - 3 && totalPages > 7) {
                return <span key="ellipsis2" className="px-2 text-slate-400">...</span>;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-3 bg-white rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center px-6">
          <Search className="text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search company or contact..." 
            className="w-full py-5 px-4 outline-none font-medium text-slate-800" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        <div className="relative min-w-[220px]">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            className="w-full pl-12 pr-8 py-5 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none font-bold text-slate-700 appearance-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Active</option>
            <option value="Assigned">Assigned</option>
            <option value="Approached">Approached</option>
            <option value="Org Created">Created Org</option>
            <option value="Lead Generated">Lead Generated</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-md rounded-[2rem] shadow-xl border border-white overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Company Details</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Contact</th>
                {isSM && <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Assignee</th>}
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Lead ID / Org</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={isSM ? "6" : "5"} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <PackageSearch size={48} className="text-slate-300" />
                      <p className="text-slate-500 font-medium">No prospects found</p>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm("")}
                          className="text-blue-600 text-sm font-bold"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  let displayStatus = item.status;
                  let statusStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                  const orgDetails = getOrgDetails(item);
                  const leadDetails = getLeadDetails(item);
                  const hasOrg = !!item.organizationId;
                  const hasLead = !!item.leadId;
                  
                  if (item.closed) {
                    displayStatus = "Closed";
                    statusStyle = "bg-red-50 text-red-600 border-red-100";
                  } else if (hasLead) {
                    displayStatus = "Lead Generated";
                    statusStyle = "bg-blue-50 text-blue-600 border-blue-100";
                  } else if (hasOrg) {
                    displayStatus = "Org Created";
                    statusStyle = "bg-violet-50 text-violet-600 border-violet-100";
                  } else if (item.status === 'Approached') {
                    statusStyle = "bg-orange-50 text-orange-600 border-orange-100";
                  }

                  return (
                    <React.Fragment key={item._id}>
                      <tr className={`group transition-all ${expandedRow === item._id ? 'bg-blue-50/80' : 'hover:bg-blue-50/30'} ${item.closed ? 'opacity-60' : ''}`}>
                        <td className="px-8 py-6 cursor-pointer" onClick={() => !item.closed && toggleRow(item._id)}>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                              {!item.closed && (expandedRow === item._id ? <ChevronUp size={16} className="text-blue-600"/> : <ChevronDown size={16} className="text-slate-400"/>)}
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                              <Building2 size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{item.companyName}</p>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.industry || 'General'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{item.pocName}</span>
                            <span className="text-xs text-slate-400">{item.pocEmail}</span>
                            {item.pocContact && <span className="text-xs text-slate-400">{item.pocContact}</span>}
                          </div>
                        </td>

                        {isSM && (
                          <td className="px-8 py-6">
                            <span className="text-xs font-bold text-slate-700">{item.salesRepId?.name || 'Unassigned'}</span>
                          </td>
                        )}

                        <td className="px-8 py-6">
                          {hasLead ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md border border-blue-100 inline-block w-fit">
                                {formatId(leadDetails?.leadNumber)}
                              </span>
                            </div>
                          ) : hasOrg ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest bg-violet-50 px-2 py-1 rounded-md border border-violet-100 inline-block w-fit">
                                {orgDetails?.companyName?.substring(0, 20) || 'Org Created'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Not Linked</span>
                          )}
                        </td>

                        <td className="px-8 py-6 text-center">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 ${statusStyle}`}>
                            {displayStatus}
                          </span>
                        </td>

                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                            {!item.closed && (
                              <>
                                {/* Approach button - only show if no org and no lead */}
                                {shouldShowApproachButton(item) && (
                                  <button 
                                    onClick={() => { setSelectedProspect(item); setIsApproachModalOpen(true); }}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all"
                                  >
                                    {item.status === 'Approached' ? 'Follow Up' : 'Approach'}
                                  </button>
                                )}

                                {/* Convert to Org button - only if no org and no lead */}
                                {!hasOrg && !hasLead && (
                                  <button 
                                    onClick={() => handleConvertToOrg(item)}
                                    disabled={convertingOrg[item._id]}
                                    className="px-4 py-2 bg-white border-2 border-slate-900 text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all flex items-center gap-1"
                                  >
                                    {convertingOrg[item._id] ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <RefreshCcw size={12} />
                                    )}
                                    Convert
                                  </button>
                                )}

                                {/* Convert to Lead button - only if has org but no lead */}
                                {hasOrg && !hasLead && (
                                  <button 
                                    onClick={() => openLeadModal(item)}
                                    disabled={convertingLead[item._id]}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-lg shadow-emerald-100"
                                  >
                                    {convertingLead[item._id] ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <ArrowRight size={12} />
                                    )}
                                    Convert to Lead
                                  </button>
                                )}

                                {/* View Lead button */}
                                {hasLead && (
                                  <button 
                                    onClick={() => navigate('/sales/lead_generation')}
                                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase hover:bg-blue-200 transition-all flex items-center gap-1"
                                  >
                                    <ExternalLink size={12}/> View Lead
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedRow === item._id && !item.closed && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={isSM ? "6" : "5"} className="px-12 py-8">
                            <div className="max-w-5xl">
                              <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Layers size={14} /> Approach History & Pipeline
                                </h4>
                                {!isSM && !item.leadId && (
                                  <button 
                                    onClick={() => { setSelectedProspect(item); setIsCloseModalOpen(true); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase border-2 border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                                  >
                                    <Trash2 size={12}/> Close Prospect
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {item.approaches?.map((appr, idx) => (
                                  <div key={idx} className={`p-4 rounded-2xl border-2 transition-all ${appr.status === 'Completed' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                      <div className={`p-2 rounded-lg ${appr.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {appr.status === 'Completed' ? <CheckCircle2 size={16}/> : <Clock size={16}/>}
                                      </div>
                                      <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase text-slate-500">Step {appr.step}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled For</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                      <Calendar size={12} className="text-blue-500"/> {formatDate(appr.scheduledDate)}
                                    </p>
                                    {appr.status === 'Completed' && (
                                      <div className="mt-2 pt-2 border-t border-slate-100">
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{appr.method}</span>
                                        <p className="text-xs italic text-slate-600 mt-2 line-clamp-2">"{appr.summary}"</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {(!item.approaches || item.approaches.length === 0) && (
                                  <p className="text-sm text-slate-400 text-center col-span-3 py-8">No approach history yet.</p>
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

      {/* MODAL: CLOSE PROSPECT */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 relative">
            <button onClick={() => setIsCloseModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"><X size={24} /></button>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4 border-2 border-red-100">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Close Prospect?</h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">This will move {selectedProspect?.companyName} to the 'Closed' archive.</p>
            </div>
            
            <form onSubmit={handleCloseSubmit} className="space-y-6">
              <textarea 
                required 
                rows="4" 
                className="w-full p-5 bg-slate-50 rounded-2xl outline-none text-slate-700 font-medium border-2 border-transparent focus:border-red-100 transition-all" 
                placeholder="Why are you closing this prospect? (e.g., Not interested, Wrong number, No response after 5 steps)" 
                value={closeReason} 
                onChange={(e) => setCloseReason(e.target.value)} 
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsCloseModalOpen(false)} className="flex-1 p-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={isClosing} className="flex-2 px-10 p-5 bg-red-600 text-white rounded-2xl font-black uppercase hover:bg-red-700 flex items-center justify-center gap-3 shadow-lg shadow-red-100 transition-all">
                  {isClosing ? <Loader2 className="animate-spin"/> : "Close Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APPROACH */}
      {isApproachModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative">
            <button onClick={() => setIsApproachModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"><X size={24} /></button>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Record Approach</h2>
            <p className="text-slate-500 text-sm mb-4">For: <span className="font-bold text-slate-800">{selectedProspect?.companyName}</span></p>
            <form onSubmit={handleApproachSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-3">
                {['Email', 'WhatsApp', 'Message', 'LinkedIn'].map((m) => (
                  <button key={m} type="button" onClick={() => setApproachData({...approachData, method: m})}
                    className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all ${approachData.method === m ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}
                  > {m} </button>
                ))}
              </div>
              <textarea required rows="4" className="w-full p-5 bg-slate-50 rounded-2xl outline-none text-slate-700 font-medium" 
                placeholder="What was the outcome?" value={approachData.summary} onChange={(e) => setApproachData({...approachData, summary: e.target.value})} />
              <button type="submit" disabled={submittingApproach} className="w-full p-5 bg-slate-900 text-white rounded-2xl font-black uppercase hover:bg-blue-600 flex items-center justify-center gap-3">
                {submittingApproach ? <Loader2 className="animate-spin"/> : <Send size={20}/>} Confirm Outreach
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVERT TO LEAD WITH POC SELECTION */}
      {isLeadModalOpen && selectedProspectForLead && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsLeadModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"><X size={24} /></button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100">
                <Target size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Generate Lead</h2>
              <p className="text-slate-500 text-sm mt-1">
                For: <span className="font-bold text-slate-800">{selectedProspectForLead.companyName}</span>
              </p>
            </div>

            <form onSubmit={handleLeadConversionSubmit} className="space-y-5">
              {/* Lead Type Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                  Lead Source
                </label>
                <select
                  required
                  className="w-full p-4 mt-1 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                >
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                  <option value="Email Marketing">Email Marketing</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Reference">Reference</option>
                  <option value="Cold Call">Cold Call</option>
                </select>
              </div>

              {/* Referred By - Only for Reference type */}
              {leadType === 'Reference' && (
                <div className="animate-in fade-in duration-300">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-2">
                    Referred By *
                  </label>
                  <div className="relative mt-1">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                    <input
                      required
                      type="text"
                      placeholder="Who referred this lead?"
                      className="w-full p-4 pl-12 bg-blue-50/50 rounded-2xl border-2 border-blue-100 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* POC Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 flex items-center gap-2">
                  <Users size={12} /> Select Point of Contact *
                </label>
                <select
                  required
                  className="w-full p-4 mt-1 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={selectedPOC?.id || ''}
                  onChange={(e) => {
                    const poc = availablePOCs.find(p => p.id === e.target.value);
                    setSelectedPOC(poc);
                  }}
                >
                  <option value="">Select a Point of Contact...</option>
                  {availablePOCs.map((poc) => (
                    <option key={poc.id} value={poc.id}>
                      {poc.name} {poc.isPrimary && "(Primary)"} - {poc.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected POC Details Preview */}
              {selectedPOC && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in duration-300">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Selected Contact Details</p>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">{selectedPOC.name}</p>
                    {selectedPOC.email && (
                      <p className="text-xs text-slate-600 flex items-center gap-2">
                        <Mail size={12} className="text-slate-400" />
                        {selectedPOC.email}
                      </p>
                    )}
                    {selectedPOC.phone && (
                      <p className="text-xs text-slate-600 flex items-center gap-2">
                        <PhoneIcon size={12} className="text-slate-400" />
                        {selectedPOC.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingLead || !selectedPOC}
                className="w-full p-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingLead ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowRight size={20} />
                )}
                Generate Lead Now
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SINGLE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"><X size={24} /></button>
            <h2 className="text-2xl font-black text-slate-800 mb-6">Add New Prospect</h2>
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Company Name" value={newProspect.companyName} onChange={(e) => setNewProspect({...newProspect, companyName: e.target.value})} />
              <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Point of Contact" value={newProspect.pocName} onChange={(e) => setNewProspect({...newProspect, pocName: e.target.value})} />
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Email Address" value={newProspect.pocEmail} onChange={(e) => setNewProspect({...newProspect, pocEmail: e.target.value})} />
              </div>
              <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Contact Number (Optional)" value={newProspect.pocContact} onChange={(e) => setNewProspect({...newProspect, pocContact: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="LinkedIn Profile (Optional)" value={newProspect.pocLinkedin} onChange={(e) => setNewProspect({...newProspect, pocLinkedin: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Industry (Optional)" value={newProspect.industry} onChange={(e) => setNewProspect({...newProspect, industry: e.target.value})} />
              <button type="submit" disabled={!isContactInfoProvided} className={`w-full p-5 rounded-2xl font-black uppercase shadow-xl ${isContactInfoProvided ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                Save Prospect
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prospects;