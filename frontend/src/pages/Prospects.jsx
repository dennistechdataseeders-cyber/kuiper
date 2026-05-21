import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Search, Loader2, Plus, X, 
  PackageSearch, RefreshCcw, Database, Layers, 
  ChevronLeft, ChevronRight, Building2, Filter, 
  Mail, Send, ChevronDown, ChevronUp, Calendar, 
  CheckCircle2, Clock, Trash2, AlertCircle
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
    } catch (err) { toast.error("Error loading prospects"); }
  };

  const fetchBucketCount = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/prospects/bucket-count`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBucketCount(res.data.count);
    } catch (err) { console.error("Bucket count fetch error"); }
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
      
      toast.success("Prospect moved to No Response");
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
      } catch (err) { toast.error("Import failed"); }
      finally { setImporting(false); e.target.value = null; }
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
    } catch (err) { toast.error(err.response?.data?.error || "Error adding prospect"); }
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
    if (statusFilter === "Assigned") return matchesSearch && p.salesRepId && !p.organizationId;
    if (statusFilter === "Approached") return matchesSearch && p.status === "Approached";
    if (statusFilter === "Org Created") return matchesSearch && p.organizationId && !p.leadId;
    if (statusFilter === "Lead Generated") return matchesSearch && p.leadId;
    return matchesSearch;
  });

  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const isContactInfoProvided = !!(newProspect.pocEmail || newProspect.pocContact || newProspect.pocLinkedin);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  return (
    <div
        className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
             {isSM ? "Master Inventory" : "My Workspace"}
          </h1>
          <p className="text-slate-500 font-medium">
           <p className="text-slate-500 font-medium mt-1">Track and manage your prospect outreach steps.</p>
          </p>
        </div>

        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
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
              <input type="file" id="bulk-up" className="hidden" onChange={handleFileUpload} />
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

      {/* Search & Filter */}
      <div className=" flex flex-col md:flex-row justify-between items-center mt-6 px-4 gap-4">
        <p className="text-sm font-bold text-slate-500">
          Showing <span className="text-slate-900">{currentItems.length}</span> of <span className="text-slate-900">{filtered.length}</span> prospects
        </p>
        
        <div className="flex items-center gap-2 py-5">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-3 bg-white rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm">
            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1;
              // Only show first, last, and pages around current to avoid clutter
              if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${
                      currentPage === pageNum 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                        : 'text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return <span key={pageNum} className="px-1 text-slate-300">...</span>;
              }
              return null;
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
              <option value="All">All Status</option>
              <option value="Assigned">Assigned</option>
              <option value="Approached">Approached</option>
              <option value="Org Created">Created Org</option>
              <option value="Lead Generated">Lead Generated</option>
            </select>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-md rounded-[2rem] shadow-xl border border-white overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b">Company Details</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b">Contact</th>
                {isSM && <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b">Assignee</th>}
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b">Lead ID</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b text-center">Status</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((item) => {
                let displayStatus = item.status;
                let statusStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                
                if (item.leadId) {
                    displayStatus = "Lead Generated";
                    statusStyle = "bg-blue-50 text-blue-600 border-blue-100";
                } else if (item.organizationId) {
                    displayStatus = "Org Created";
                    statusStyle = "bg-violet-50 text-violet-600 border-violet-100";
                } else if (item.status === 'Approached') {
                    statusStyle = "bg-orange-50 text-orange-600 border-orange-100";
                }

                return (
                <React.Fragment key={item._id}>
                  <tr className={`group transition-all ${expandedRow === item._id ? 'bg-blue-50/80' : 'hover:bg-blue-50/30'}`}>
                    <td className="px-8 py-6 cursor-pointer" onClick={() => toggleRow(item._id)}>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          {expandedRow === item._id ? <ChevronUp size={16} className="text-blue-600"/> : <ChevronDown size={16} className="text-slate-400"/>}
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
                      </div>
                    </td>

                    {isSM && (
                      <td className="px-8 py-6">
                         <span className="text-xs font-bold text-slate-700">{item.salesRepId?.name || 'Unassigned'}</span>
                      </td>
                    )}

                    <td className="px-8 py-6">
                      {item.leadId ? (
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                          {formatId(item.leadId.leadNumber)}
                        </span>
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
                        {!isSM && !item.leadId && (
                          <button 
                            onClick={() => { setSelectedProspect(item); setIsApproachModalOpen(true); }}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all"
                          >
                            {item.status === 'Approached' ? 'Follow Up' : 'Approach'}
                          </button>
                        )}

                        {!isSM && (
                          item.organizationId ? (
                            !item.leadId && (
                                <button 
                                onClick={() => navigate('/sales/lead_generation', { state: { prospect: item } })}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                                >
                                Generate Lead
                                </button>
                            )
                          ) : (
                            !item.leadId && (
                              <button 
                                onClick={() => navigate('/sales/add_org', { state: { convertedLead: item } })}
                                className="px-4 py-2 bg-white border-2 border-slate-900 text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all flex items-center gap-1"
                              >
                                <RefreshCcw size={12}/> Convert
                              </button>

                            )
                          )
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedRow === item._id && (
                    <tr>
                      <td colSpan={isSM ? "6" : "5"} className="px-12 py-8 bg-slate-50/50 border-b border-slate-100">
                        <div className="max-w-5xl">
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Layers size={14} /> Approach History & Pipeline
                            </h4>
                            {/* CLOSE PROSPECT BUTTON */}
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
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )})}
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
                <p className="text-slate-500 text-sm mt-1 font-medium">This will move {selectedProspect?.companyName} to the 'No Response' archive.</p>
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
                  <input type="email" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="email@company.com" value={newProspect.pocEmail} onChange={(e) => setNewProspect({...newProspect, pocEmail: e.target.value})} />
              </div>
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