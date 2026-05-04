import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { 
  Plus, X, Globe, Phone, User, 
  Mail, Pencil, Trash2, MapPin, ChevronDown, 
  CheckCircle, Building2, ChevronLeft, ChevronRight
} from 'lucide-react';
import API_BASE_URL from '../config';

// --- SUB-COMPONENT: EXPANDABLE ORG CARD ---
const OrganizationCard = ({ org, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`group relative transition-all duration-500 rounded-[2.5rem] border-2 h-fit ${
      isExpanded 
      ? 'bg-white shadow-2xl shadow-blue-100 border-blue-50' 
      : 'bg-blue-600 border-blue-500 shadow-lg hover:shadow-blue-200 hover:-translate-y-1'
    }`}>
      
      {/* ACTION ZONE */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(org); }} 
          className={`p-2.5 rounded-xl border transition-all duration-300 ${
            isExpanded 
            ? 'bg-slate-50 border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50' 
            : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20'
          }`}
        >
          <Pencil size={15} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(org._id); }} 
          className={`p-2.5 rounded-xl border transition-all duration-300 ${
            isExpanded 
            ? 'bg-slate-50 border-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50' 
            : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-red-500'
          }`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div onClick={() => setIsExpanded(!isExpanded)} className="p-7 cursor-pointer select-none">
        <div className="flex items-start gap-5">
          <div className={`p-4 rounded-[1.5rem] transition-all duration-500 shrink-0 ${
            isExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-blue-600 ring-1 ring-white/20'
          }`}>
            <Building2 size={24} />
          </div>
          
          <div className="flex-1 pr-20">
            <h3 className={`text-lg font-black leading-tight transition-colors duration-500 truncate ${
              isExpanded ? 'text-slate-900' : 'text-white'
            }`}>
              {org.companyName}
            </h3>
            
            <div className="flex flex-wrap gap-2 mt-3">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border transition-colors ${
                isExpanded ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white/10 border-white/10 text-blue-100'
              }`}>
                <Mail size={10} /> {org.pocEmail?.split('@')[0] || 'N/A'}
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border transition-colors ${
                isExpanded ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white/10 border-white/10 text-blue-100'
              }`}>
                <Phone size={10} /> {org.pocPhone || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* EXPANDED SECTION */}
        <div className={`grid transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-8' : 'grid-rows-[0fr] opacity-0'
        }`}>
          <div className="overflow-hidden space-y-5">
            <div className="bg-[#f8fafc] rounded-3xl p-5 border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Point of Contact</p>
                  <p className="text-sm font-black text-slate-800">{org.pocName}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-50 group/item">
                  <div className="flex items-center gap-3">
                    <Mail size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-slate-600">{org.pocEmail || 'No Email'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-50 group/item">
                  <div className="flex items-center gap-3">
                    <Phone size={14} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">{org.pocPhone || 'No Phone'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-2 space-y-3 pb-2">
              <div className="flex items-center gap-3 text-slate-400">
                <Globe size={14} />
                <span className="text-[11px] font-bold truncate">{org.website || 'No Website'}</span>
              </div>
              {org.linkedin && (
                <div className="flex items-center gap-3 text-slate-400">
                   <CheckCircle size={14} className="text-blue-400" />
                   <a href={org.linkedin} target="_blank" rel="noreferrer" className="text-[11px] font-bold hover:underline text-blue-500">{org.linkedin}</a>
                </div>
              )}
              {org.address && (
                <div className="flex items-start gap-3 text-slate-400">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] font-bold leading-relaxed">{org.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isExpanded && (
          <div className="mt-4 flex justify-center">
              <ChevronDown size={16} className="text-white/30 group-hover:text-white/60 transition-colors animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const Organizations = () => {
  const location = useLocation();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Added prospectId to state
  const [formData, setFormData] = useState({
    companyName: '', website: '', pocName: '', 
    pocEmail: '', pocPhone: '', linkedin: '', address: '',
    prospectId: null 
  });

  // EFFECT: Handle "Convert to Lead" redirection from Prospects page
  useEffect(() => {
    if (location.state?.convertedLead) {
      const data = location.state.convertedLead;
      setFormData({
        companyName: data.companyName || '',
        website: data.website || '',
        pocName: data.pocName || '',
        pocEmail: data.pocEmail || '',
        pocPhone: data.pocPhone || '',
        linkedin: data.linkedin || '',
        address: '',
        prospectId: data._id // Storing the link to the prospect
      });
      setIsModalOpen(true);
      // Clear navigation state to prevent re-opening modal on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // FIX: Use full URL or ensure base proxy is correct
      // const API_BASE_URL = "http://192.168.1.5:5000"; 
      
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const data = Array.isArray(res.data) ? res.data : (res.data.leads || []);
      setOrgs(data);
    } catch (err) {
      console.error("Error fetching", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchOrgs(); }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrgs = orgs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(orgs.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditModal = (org) => {
    setEditingId(org._id);
    setFormData({ 
      companyName: org.companyName || '', 
      website: org.website || '', 
      pocName: org.pocName || '', 
      pocEmail: org.pocEmail || '', 
      pocPhone: org.pocPhone || '', 
      linkedin: org.linkedin || '', 
      address: org.address || '',
      prospectId: null // Edit mode doesn't need to link to prospect
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ 
      companyName: '', website: '', pocName: '', 
      pocEmail: '', pocPhone: '', linkedin: '', address: '',
      prospectId: null 
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this organization?")) return;
    try { 
      const token = localStorage.getItem('token');
      await axios.delete(`/api/orgs/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchOrgs();
    } catch (err) { console.error(err); }
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  // const API_BASE_URL = "http://192.168.1.5:5000";

  const hasLinkedIn = formData.linkedin?.trim().length > 0;
  const hasEmail = formData.pocEmail?.trim().length > 0;
  const hasPhone = formData.pocPhone?.trim().length > 0;

  if (!hasLinkedIn && !hasEmail && !hasPhone) {
    alert("Incomplete Contact Info: Provide LinkedIn, Email, or Phone.");
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    // FIX: The LeadGen model REQUIRES leadType. 
    // We add a default value here so the server doesn't return a 400 error.
    const payload = {
      ...formData,
      leadType: 'Inbound' // Defaulting to Inbound to satisfy the Mongoose enum
    };
    
    if (editingId) {
      await axios.put(`${API_BASE_URL}/api/orgs/${editingId}`, payload, config);
    } else {
      await axios.post(`${API_BASE_URL}/api/orgs`, payload, config);
    }
    
    fetchOrgs();
    closeModal();
  } catch (err) {
    console.error("Submission Error:", err.response?.data);
    // This alert will now show you the SPECIFIC validation error from Mongoose
    const msg = err.response?.data?.error || "Error saving organization.";
    alert(msg);
  }
};

  return (
    <div className="p-8 lg:ml-64 min-h-screen bg-blue-100">
      
      {/* HEADER SECTION */}
      <div className="max-w-6xl mx-auto mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Organizations</h1>
          <p className="text-slate-500 font-bold flex items-center gap-2">
            <CheckCircle size={16} className="text-blue-500" /> 
            {orgs.length} Registered Entities
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-blue-200 transition-all active:scale-95">
          <Plus size={18} strokeWidth={3} /> New Entry
        </button>
      </div>

      {/* LIST SECTION */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
              {currentOrgs.map(org => (
                <OrganizationCard key={org._id} org={org} onEdit={openEditModal} onDelete={handleDelete} />
              ))}
            </div>

            {/* PAGINATION UI */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-3">
                <button 
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-50 transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-2">
                  {[...Array(totalPages)].map((_, idx) => (
                    <button
                      key={idx + 1}
                      onClick={() => paginate(idx + 1)}
                      className={`w-12 h-12 rounded-xl font-black text-sm transition-all ${
                        currentPage === idx + 1 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-50 transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 relative animate-in fade-in zoom-in duration-300 max-h-[95vh] overflow-y-auto border border-slate-100">
            <button onClick={closeModal} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
              <X size={24} />
            </button>
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-800 mb-1">{editingId ? 'Modify Record' : 'Add Organization'}</h2>
              <p className="text-slate-400 text-sm font-medium">Capture essential business and contact info.</p>
              {formData.prospectId && (
                 <div className="mt-2 py-1 px-3 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full inline-block">
                   Linking to Prospect
                 </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 ml-1">Company Details</p>
                <input 
                  required 
                  placeholder="Company Name" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={formData.companyName} 
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                />

                <div className="grid grid-cols-2 gap-4">
                  <input 
                    placeholder="Website URL (Optional)" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                    value={formData.website} 
                    onChange={(e) => setFormData({...formData, website: e.target.value})} 
                  />
                  <input 
                    placeholder="LinkedIn URL" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                    value={formData.linkedin} 
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})} 
                  />
                </div>

                <input 
                  placeholder="Physical Office Address (Optional)" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                  value={formData.address} 
                  onChange={(e) => setFormData({...formData, address: e.target.value})} 
                />
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 ml-1">Contact Person</p>
                <input 
                  required 
                  placeholder="POC Full Name" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                  value={formData.pocName} 
                  onChange={(e) => setFormData({...formData, pocName: e.target.value})} 
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                    value={formData.pocEmail} 
                    onChange={(e) => setFormData({...formData, pocEmail: e.target.value})} 
                  />
                  <input 
                    placeholder="Phone Number" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                    value={formData.pocPhone} 
                    onChange={(e) => setFormData({...formData, pocPhone: e.target.value})} 
                  />
                </div>
              </div>

              <button className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all mt-6 shadow-xl shadow-slate-200 active:scale-95">
                {editingId ? 'Update Organization' : 'Save Organization'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organizations;