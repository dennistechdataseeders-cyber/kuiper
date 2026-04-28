import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Search, Loader2, Plus, X, 
  PackageSearch, RefreshCcw, Database, Layers, 
  ChevronLeft, ChevronRight, User, Building2, Filter, 
  UserCheck, Briefcase, Mail, Phone, ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

const Prospects = () => {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState([]);
  const [bucketCount, setBucketCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fetchingBucket, setFetchingBucket] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); 
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const userRole = localStorage.getItem('role');
  const isSM = userRole === 'Sales Manager' || userRole === 'Admin';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProspect, setNewProspect] = useState({ 
    companyName: '', 
    pocName: '', 
    pocEmail: '', 
    industry: '',
    pocContact: '',
    pocLinkedin: '',
    sector:''
  });

  useEffect(() => { fetchData(); }, []);

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
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/prospects/fetch-bucket`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      const errorMessage = err.response?.data?.details || err.response?.data?.message || "Server error";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setFetchingBucket(false);
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

        // --- NEW FILTERING LOGIC ---
        const validData = rawData.filter(row => {
            // We check for common variants of keys (e.g., lowercase or spaces) 
            // depending on your Excel headers
            const email = row.pocEmail || row.email || row.Email;
            const contact = row.pocContact || row.phone || row.Contact;
            const linkedin = row.pocLinkedin || row.linkedin || row.LinkedIn;

            return !!(email || contact || linkedin);
        });

        const skippedCount = rawData.length - validData.length;
        if (skippedCount > 0) {
            toast.error(`Skipped ${skippedCount} records missing contact info.`, { duration: 4000 });
        }

        if (validData.length === 0) {
            setImporting(false);
            return toast.error("No valid records found in file.");
        }
        // ----------------------------

        const token = localStorage.getItem('token');
        const CHUNK_SIZE = 1000;
        let total = 0;

        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const res = await axios.post(`${API_BASE_URL}/api/prospects/bulk-import`, chunk, {
            headers: { Authorization: `Bearer ${token}` }
            });
            total += res.data.count;
            toast.loading(`Importing: ${total} / ${validData.length}`, { id: 'up-status' });
        }

        toast.success(`Import Complete! ${total} records added.`, { id: 'up-status' });
        fetchData();
        } catch (err) { 
        toast.error("Import encountered an error", { id: 'up-status' }); 
        } finally { 
        setImporting(false); 
        e.target.value = null; 
        }
    };
    reader.readAsBinaryString(file);
    };

 const handleSingleSubmit = async (e) => {
    e.preventDefault();

    // Validation: Check if at least one contact method is present
    const { pocEmail, pocContact, pocLinkedin } = newProspect;
    if (!pocEmail && !pocContact && !pocLinkedin) {
      return toast.error("Please provide at least one contact method (Email, Phone, or LinkedIn)");
    }

    try {
      await axios.post(`${API_BASE_URL}/api/prospects`, newProspect, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success("Added to Global Inventory");
      setIsModalOpen(false);
      // Reset form
      setNewProspect({ 
        companyName: '', pocName: '', pocEmail: '', 
        industry: '', pocContact: '', pocLinkedin: '' 
      });
      fetchData();
    } catch (err) { 
        const msg = err.response?.data?.error || "Error adding prospect";
        toast.error(msg); 
    }
  };
  const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (id) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
        newExpandedRows.delete(id);
    } else {
        newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
    };
  const filtered = prospects.filter(p => {
    const matchesSearch = 
      p.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.pocName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "Available") return matchesSearch && !p.salesRepId;
    if (statusFilter === "Assigned") return matchesSearch && p.salesRepId && !p.organizationId;
    if (statusFilter === "Org Created") return matchesSearch && p.organizationId && !p.leadId;
    if (statusFilter === "Lead Generated") return matchesSearch && p.leadId;
    return matchesSearch;
  });
  
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const isContactInfoProvided = !!(newProspect.pocEmail || newProspect.pocContact || newProspect.pocLinkedin);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  return (
    <div className="lg:ml-64 p-8 min-h-screen bg-blue-100">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {isSM ? "Master Inventory" : "My Workspace"}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            {isSM ? "Manage and monitor global prospect flow." : "Claim and convert leads to organizations."}
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
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

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search company or contact..." 
            className="w-full pl-16 pr-8 py-5 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none font-medium text-slate-800 focus:border-blue-500 transition-all" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        <div className="relative min-w-[220px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select 
              className="w-full pl-12 pr-8 py-5 bg-white rounded-2xl shadow-sm border border-slate-100 outline-none font-bold text-slate-700 appearance-none cursor-pointer focus:border-blue-500 transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Available">Available (In Bucket)</option>
              <option value="Assigned">Assigned</option>
              <option value="Org Created">Created Org</option>
              <option value="Lead Generated">Lead Generated</option>
            </select>
        </div>
      </div>

      {/* TABLE SECTION */}
     {/* REFINED TABLE SECTION */}
<div className="bg-white/70 backdrop-blur-md rounded-[2rem] shadow-xl shadow-blue-900/5 border border-white overflow-hidden mb-6">
  <div className="overflow-x-auto">
    <table className="w-full text-left border-separate border-spacing-0">
      <thead>
        <tr className="bg-slate-50/80">
          <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100">Company Details</th>
          <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100">Contact Info</th>
          {isSM && <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100">Assignee</th>}
          <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100 text-center">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {loading ? (
          <tr><td colSpan={isSM ? "5" : "4"} className="p-24 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40}/></td></tr>
        ) : currentItems.length === 0 ? (
          <tr><td colSpan={isSM ? "5" : "4"} className="p-24 text-center font-bold text-slate-400">No prospects available in this view.</td></tr>
        ) : currentItems.map((item) => {
            const isExpanded = expandedRows.has(item._id);
          // Status Logic
          let statusLabel = "Available";
          let statusStyle = "bg-emerald-100 text-emerald-700 border-emerald-200";
          if (item.leadId) {
            statusLabel = "Lead Gen";
            statusStyle = "bg-blue-100 text-blue-700 border-blue-200";
          } else if (item.organizationId) {
            statusLabel = "Org Created";
            statusStyle = "bg-violet-100 text-violet-700 border-violet-200";
          } else if (item.salesRepId) {
            statusLabel = "Assigned";
            statusStyle = "bg-amber-100 text-amber-700 border-amber-200";
          }

          return (
            <tr key={item._id} className="group hover:bg-blue-50/50 transition-all duration-200">
              {/* Company Column */}
              <td className="px-8 py-6 relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-200 rounded-r-full" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:from-blue-500 group-hover:to-blue-600 group-hover:text-white group-hover:border-blue-400 transition-all duration-300 shadow-sm">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-base mb-0.5">{item.companyName}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                        {item.sector || item.industry || 'General'}
                      </span>
                    </div>
                  </div>
                </div>
              </td>

            {/* Contact Column */}
<td className="px-8 py-6">
  <div className="flex flex-col gap-2">
    {/* POC Name - Primary focus */}
    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
      <User size={14} className="text-blue-500" />
      {item.pocName || 'Unknown POC'}
    </div>

    {/* Contact Details - Structured list */}
    <div className="space-y-1.5">
      {/* Email Row */}
      {item.pocEmail ? (
        <a 
          href={`mailto:${item.pocEmail}`} 
          className="flex items-center gap-2 text-[12px] text-slate-500 hover:text-blue-600 transition-colors group/link"
        >
          <div className="p-1 bg-slate-100 rounded group-hover/link:bg-blue-100 transition-colors">
            <Mail size={12} className="text-slate-400 group-hover/link:text-blue-600" />
          </div>
          <span className="truncate max-w-[180px]">{item.pocEmail}</span>
        </a>
      ) : (
        <span className="text-[11px] text-slate-300 italic flex items-center gap-2 ml-1">
          <Mail size={10} /> No Email
        </span>
      )}

      {/* NEW: Phone/Contact Row */}
      {item.pocPhone ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <div className="p-1 bg-slate-100 rounded">
            <Phone size={12} className="text-slate-400" />
          </div>
          <span>{item.pocPhone}</span>
        </div>
      ) : (
        <span className="text-[11px] text-slate-300 italic flex items-center gap-2 ml-1">
          <Phone size={10} /> No Phone
        </span>
      )}
      
      {/* NEW: LinkedIn Row */}
      {item.linkedin ? (
        <a 
          href={item.linkedin} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 text-[12px] text-slate-500 hover:text-blue-700 transition-colors group/link"
        >
          <div className="p-1 bg-slate-100 rounded group-hover/link:bg-blue-100">
            <ExternalLink size={12} className="text-slate-400 group-hover/link:text-blue-700" />
          </div>
          <span className="font-medium underline decoration-slate-200 underline-offset-2">{item.linkedin}</span>
        </a>
      ) : (
        <span className="text-[11px] text-slate-300 italic flex items-center gap-2 ml-1">
          <ExternalLink size={10} /> No LinkedIn
        </span>
      )}
    </div>
  </div>
</td>

              {/* Assignee Column (SM only) */}
              {isSM && (
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${item.salesRepId ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-dashed border-slate-300'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.salesRepId ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                      <User size={12} />
                    </div>
                    <span className={`text-xs font-bold ${item.salesRepId ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                      {item.salesRepId?.name || 'Waiting...'}
                    </span>
                  </div>
                </td>
              )}

              {/* Status Column */}
              <td className="px-8 py-6 text-center">
                <span className={`inline-block min-w-[100px] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 shadow-sm ${statusStyle}`}>
                  {statusLabel}
                </span>
              </td>

              {/* Action Column */}
         {/* Action Column */}
<td className="px-8 py-6 text-right">
  {isSM ? (
    <div className="w-10" /> // Admin/SM just monitors
  ) : (
    <div className="flex justify-end">
      {item.leadId ? (
        /* STAGE 3: Lead already exists */
        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
          <UserCheck size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Lead Gen Done</span>
        </div>
      ) : item.organizationId ? (
        /* STAGE 2: Org exists, need to generate Lead */
        <button 
          onClick={() => navigate('/sales/lead_generation', { 
            state: { prospect: item } 
          })}
          className="group/btn flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-95"
        >
          Generate Lead
          <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
      ) : (
        /* STAGE 1: Raw Prospect, need to convert to Org first */
        <button 
          onClick={() => navigate('/sales/add_org', { 
            state: { convertedLead: item } 
          })}
          className="group/btn flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200 active:scale-95"
        >
          Convert to Org
          <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  )}
</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</div>

      {/* PAGINATION SECTION */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      
   {/* ADD SINGLE PROSPECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 relative border border-slate-100">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
              <X size={24} />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-800">Add New Prospect</h2>
              <p className="text-slate-400 text-sm font-medium">Please provide at least one contact method below.</p>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Company</label>
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="Company Name"
                        value={newProspect.companyName}
                        onChange={(e) => setNewProspect({...newProspect, companyName: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">POC Name</label>
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="Point of Contact"
                        value={newProspect.pocName}
                        onChange={(e) => setNewProspect({...newProspect, pocName: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Sector</label>
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="IT,QuickCommerce..."
                        value={newProspect.sector}
                        onChange={(e) => setNewProspect({...newProspect, sector: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="email" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="email@company.com"
                        value={newProspect.pocEmail}
                        onChange={(e) => setNewProspect({...newProspect, pocEmail: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Contact Number</label>
                <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="+1 234 567 890"
                        value={newProspect.pocContact}
                        onChange={(e) => setNewProspect({...newProspect, pocContact: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">LinkedIn Profile URL</label>
                <div className="relative">
                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="url" className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        placeholder="https://linkedin.com/in/username"
                        value={newProspect.pocLinkedin}
                        onChange={(e) => setNewProspect({...newProspect, pocLinkedin: e.target.value})} />
                </div>
              </div>

             <button 
                type="submit" 
                disabled={!isContactInfoProvided}
                className={`w-full mt-4 p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 
                    ${isContactInfoProvided 
                    ? 'bg-slate-900 text-white hover:bg-blue-600' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
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