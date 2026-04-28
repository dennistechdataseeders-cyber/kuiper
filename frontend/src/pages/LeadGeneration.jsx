import { useLocation } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, X, Target, Phone, Mail, Clock, ChevronDown, 
  Globe, Filter, ChevronLeft, ChevronRight, UserPlus, Search, AlertCircle
} from 'lucide-react';

// Helper for formatting Lead IDs
const formatId = (num, prefix = "LEAD") => {
  if (!num) return `${prefix}---`;
  return `${prefix}${String(num).padStart(4, '0')}`;
};

// --- SUB-COMPONENT: INDIVIDUAL LEAD CARD ---
const LeadCard = ({ lead }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusStyles = (status) => {
    switch (status) {
      case 'Feasibility': return 'bg-white text-purple-600 border-purple-500/20';
      case 'Follow-up Scheduled': return 'bg-orange-100 text-orange-600 border-orange-500/20';
      case 'Closed': return 'bg-emerald-100 text-emerald-600 border-emerald-500/20';
      default: return 'bg-blue-100 text-blue-600 border-blue-500/20';
    }
  };

  return (
    <div className={`group bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-xl shadow-blue-50 ring-1 ring-blue-50' : 'border-slate-100 shadow-sm hover:border-blue-200'}`}>
      <div onClick={() => setIsExpanded(!isExpanded)} className="p-5 flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-5">
          <div className={`p-4 rounded-2xl transition-all duration-300 ${isExpanded ? 'scale-110 shadow-lg' : ''} ${getStatusStyles(lead.status).split(' ')[0]}`}>
             <Target size={22} className={getStatusStyles(lead.status).split(' ')[1]} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{formatId(lead.leadNumber)}</span>
              <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{lead.pocName}</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${getStatusStyles(lead.status)}`}>{lead.status || 'New'}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-blue-600 text-white`}>{lead.leadType}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400"/> {lead.pocEmail}</span>
              <span className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400"/> {lead.pocPhone}</span>
              
              {lead.status === 'Follow-up Scheduled' && lead.followUpDate && (
                <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                  <Clock size={12} /> {new Date(lead.followUpDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 justify-end mb-1">Created On</p>
            <p className="text-xs font-bold text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</p>
          </div>
          <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-blue-50 text-blue-600' : 'text-slate-300'}`}>
            <ChevronDown size={20} />
          </div>
        </div>
      </div>

      <div className={`transition-all duration-500 ease-in-out bg-slate-50/50 border-t border-slate-50 overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pipeline Status</h4>
            <div className="space-y-3">
              {[
                { label: 'Lead Generated', done: true, color: 'bg-blue-500' },
                { label: 'Follow-up Scheduled', done: lead.status !== 'New' && lead.status, color: 'bg-orange-500' },
                { label: 'Feasibility', done: lead.status === 'Feasibility' || lead.status === 'Closed', color: 'bg-purple-500' },
                { label: 'Closed Deal', done: lead.status === 'Closed', color: 'bg-emerald-500' }
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${step.done ? step.color : 'bg-slate-200'}`} />
                  <span className={`text-xs font-bold ${step.done ? 'text-slate-700' : 'text-slate-300'}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Important Dates</h4>
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Feasibility Date</span>
                    <p className="text-xs font-black text-purple-600">
                      {lead.feasibilityDate ? new Date(lead.feasibilityDate).toLocaleDateString() : 'Not Set'}
                    </p>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Follow-up Date</span>
                    <p className="text-xs font-black text-orange-600">
                      {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : 'Not Set'}
                    </p>
                 </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Organization Ref</h4>
               <p className="text-xs font-bold text-slate-600 truncate">{lead.organizationId?.companyName || 'N/A'}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Lead Classification</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                 <Globe size={14} className="text-slate-400" />
                 <p className="text-xs font-bold text-slate-600">{lead.leadType}</p>
              </div>
              {lead.referredBy && (
                <div className="flex items-center gap-2">
                   <UserPlus size={14} className="text-blue-500" />
                   <p className="text-xs font-bold text-blue-600">Ref: {lead.referredBy}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const LeadGeneration = () => {
  const location = useLocation(); 
  const [orgs, setOrgs] = useState([]);
  const [generatedLeads, setGeneratedLeads] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const statuses = ['All', 'Feasibility', 'Follow-up Scheduled', 'Closed'];

  // Identify if this prospect was already converted
  const prospectData = location.state?.prospect;
  const isAlreadyConverted = !!prospectData?.leadId;

  const [formData, setFormData] = useState({
    leadType: 'Inbound',
    organizationId: '',
    pocName: '',
    pocPhone: '',
    pocEmail: '',
    referredBy: ''
  });

  const API_BASE_URL = "http://192.168.1.5:5000";

  const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    const [orgRes, leadRes] = await Promise.all([
      // HIT THE ORGS ENDPOINT, NOT LEADS
      axios.get(`${API_BASE_URL}/api/orgs`, { headers }), 
      axios.get(`${API_BASE_URL}/api/lead-generation`, { headers })
    ]);

    // Extracting Organization Data
    const rawOrgs = orgRes.data?.organizations || orgRes.data?.data || orgRes.data || [];
    setOrgs(Array.isArray(rawOrgs) ? rawOrgs : []);

    // Extracting Lead Data
    const rawLeads = leadRes.data?.leads || leadRes.data?.data || leadRes.data || [];
    setGeneratedLeads(Array.isArray(rawLeads) ? rawLeads : []);

  } catch (err) {
    console.error("Error fetching data", err);
  } finally {
    setLoading(false);
  }
}, [API_BASE_URL]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  // Pre-fill effect
  useEffect(() => {
    if (prospectData) {
      setIsModalOpen(true);
      // Ensure we extract just the ID if organizationId is an object
      const orgId = prospectData.organizationId?._id || prospectData.organizationId || '';
      
      setFormData(prev => ({
        ...prev,
        organizationId: orgId,
        pocName: prospectData.pocName || '',
        pocPhone: prospectData.pocPhone || '',
        pocEmail: prospectData.pocEmail || ''
      }));
    }
  }, [prospectData]);

  const filteredLeads = generatedLeads.filter(lead => {
    const matchesStatus = filterStatus === 'All' 
      ? true 
      : (filterStatus === 'New' ? !lead.status : lead.status === filterStatus);

    const formattedId = formatId(lead.leadNumber).toLowerCase();
    const pocName = lead.pocName?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();

    return matchesStatus && (pocName.includes(search) || formattedId.includes(search));
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [filterStatus, searchTerm]);

  const handleOrgChange = (orgId) => {
    const selectedOrg = orgs.find(o => o._id === orgId);
    if (selectedOrg) {
      setFormData(prev => ({ 
        ...prev, 
        organizationId: orgId, 
        pocName: selectedOrg.pocName || '', 
        pocPhone: selectedOrg.pocPhone || '', 
        pocEmail: selectedOrg.pocEmail || '' 
      }));
    } else {
      setFormData(prev => ({ ...prev, organizationId: '', pocName: '', pocPhone: '', pocEmail: '' }));
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isAlreadyConverted) {
      alert("This prospect already has a lead generated.");
      return;
    }

    if (!formData.organizationId) {
      alert("Please select an Organization first.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const prospectId = prospectData?._id || window.history.state?.usr?.prospect?._id;
      
      const finalData = { 
        ...formData,
        prospectId: prospectId || null 
      };

      await axios.post(`${API_BASE_URL}/api/lead-generation`, finalData, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      });

      alert("Lead Generated Successfully!");
      setIsModalOpen(false);
      setFormData({ 
        leadType: 'Inbound', 
        organizationId: '', 
        pocName: '', 
        pocPhone: '', 
        pocEmail: '', 
        referredBy: '' 
      });

      fetchData();

    } catch (err) {
      const errorMessage = err.response?.data?.error || "Submission failed";
      alert(`Failed to create lead: ${errorMessage}`);
    }
  };

  return (
    <div className="p-8 lg:ml-64 min-h-screen bg-blue-100">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lead Generation</h1>
          <p className="text-slate-500 font-medium">Manage your active opportunities</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95">
          <Plus size={20} strokeWidth={3} /> New Lead
        </button>
      </div>

      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-96">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search name or Lead ID..."
            className="w-full pl-12 pr-10 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-1">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-slate-400 shrink-0">
            <Filter size={14} />
          </div>
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filterStatus === status 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-400 font-bold">Loading leads...</p>
          </div>
        ) : currentLeads.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 border border-slate-100 text-center shadow-sm">
            <Target size={40} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-xl font-black text-slate-800 mb-2">No leads found</h3>
            <p className="text-slate-400 font-medium">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {currentLeads.map((lead) => (
                <LeadCard key={lead._id} lead={lead} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm mt-10">
                <div className="text-xs font-bold text-slate-400 ml-4">
                  Showing <span className="text-slate-900">{indexOfFirstItem + 1}</span> to <span className="text-slate-900">{Math.min(indexOfLastItem, filteredLeads.length)}</span> of <span className="text-slate-900">{filteredLeads.length}</span> Leads
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-3 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                          currentPage === i + 1 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'bg-white text-slate-400 hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-3 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 relative animate-in fade-in zoom-in duration-300 max-h-[95vh] overflow-y-auto border border-slate-100">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full">
              <X size={24} />
            </button>
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-800 mb-1">Create New Lead</h2>
              <p className="text-slate-400 text-sm font-medium">Verify organization details before generating.</p>
            </div>

            {isAlreadyConverted && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700">
                <AlertCircle size={20} />
                <p className="text-xs font-bold uppercase tracking-tight">
                  Lead already generated for this prospect.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Lead Source</label>
                  <select 
                    disabled={isAlreadyConverted}
                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold ${isAlreadyConverted ? 'bg-slate-100 border-transparent text-slate-400' : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white text-slate-700'}`}
                    value={formData.leadType}
                    onChange={(e) => setFormData({...formData, leadType: e.target.value})}
                  >
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                    <option value="Email Marketing">Email Marketing</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Reference">Reference</option>
                    <option value="Cold Call">Cold Call</option>
                  </select>
                </div>

                {formData.leadType === 'Reference' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-2">Ref By:</label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                      <input 
                        required
                        disabled={isAlreadyConverted}
                        placeholder="Who referred this lead?" 
                        className="w-full p-4 pl-12 bg-blue-50/50 rounded-2xl border-2 border-blue-100 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                        value={formData.referredBy}
                        onChange={(e) => setFormData({...formData, referredBy: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Select Org</label>
               <select 
                    required
                    disabled={isAlreadyConverted}
                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold ${isAlreadyConverted ? 'bg-slate-100 border-transparent text-slate-400' : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white text-slate-700'}`}
                    value={formData.organizationId}
                    onChange={(e) => handleOrgChange(e.target.value)}
                  >
                    <option value="">Choose...</option>
                    {orgs && orgs.length > 0 ? (
                      orgs.map(org => (
                        <option key={org._id} value={org._id}>
                          {/* Use Optional Chaining and fallback for company name */}
                          {org.name || org.companyName || org.organizationId?.companyName || "Unknown Organization"}
                        </option>
                      ))
                    ) : (
                      <option disabled value="">No organizations available</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center">Contact Information Preview</h4>
                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                       <Target size={16} className="text-blue-500" />
                       <p className="text-xs font-bold text-slate-700">{formData.pocName || 'POC Name'}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                       <Phone size={16} className="text-emerald-500" />
                       <p className="text-xs font-bold text-slate-700">{formData.pocPhone || 'POC Phone'}</p>
                    </div>
                </div>
              </div>

              <button 
                disabled={isAlreadyConverted}
                className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                  isAlreadyConverted 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                }`}
              >
                {isAlreadyConverted ? "Lead Already Generated" : "Generate Lead Now"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadGeneration;