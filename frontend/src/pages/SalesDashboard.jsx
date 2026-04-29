import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Target, User, Mail, Phone, Clock, TrendingUp, Briefcase, 
  Calendar, CheckCircle, X, ChevronRight, PhoneCall, MessageSquare, 
  ExternalLink, Upload, FileText, Loader2,ChevronLeft, ChevronDown, ChevronUp, AlertCircle 
} from 'lucide-react';
import API_BASE_URL from '../config';
import tips from '../data/salesTips';
import toast from 'react-hot-toast';
// Sub-component to handle individual card expansion state
const LeadCard = ({ lead, getStatusStyle, setSelectedLead, setShowActionModal }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatId = (num, prefix = "LEAD") => {
    if (!num) return `${prefix}---`;
    return `${prefix}${String(num).padStart(4, '0')}`;
  };

  return (
    <div className="relative flex flex-col  p-3 pt-8 rounded-[2rem] bg-blue-200 text-slate-800 shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="absolute top-1.5 left-5">
          <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">
            {formatId(lead.leadNumber)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div 
            className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <User size={24} />
          </div>

          <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-lg text-slate-900">{lead.pocName}</h4>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${getStatusStyle(lead.status)}`}>
                {lead.status || 'New'}
              </span>
            </div>
            <span className={`text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded-md border italic ${
              lead.leadType?.toLowerCase() === 'inbound' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                : 'bg-rose-50 text-rose-700 border-rose-100'
            }`}>
              {lead.leadType}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto lg:ml-0 border-black">
          <button 
            onClick={() => { setSelectedLead(lead); setShowActionModal(true); }}
            className="bg-gradient-to-r from-blue-800 to-blue-600 text-white hover:from-blue-600 hover:to-blue-800 px-6 py-2.5 rounded-xl text-xs font-black transition-all  shadow-blue-100 active:scale-95"
          >
            Take Action
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-100 text-slate-900' : 'text-slate-900 hover:text-slate-600'}`}
          >
            {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-6 pt-6 border-t border-slate-50' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2">
            <div className="space-y-3">
               <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Contact Details</p>
               <div className="flex items-center gap-3 group">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-900 group-hover:text-blue-500 transition-colors">
                  <Mail size={14}/>
                </div>
                <span className="text-xs font-semibold text-slate-900 truncate">{lead.pocEmail}</span>
              </div>
              <div className="flex items-center gap-3 group">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-900 group-hover:text-blue-500 transition-colors">
                  <Phone size={14}/>
                </div>
                <span className="text-xs font-semibold text-slate-900">{lead.pocPhone}</span>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Network</p>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-900">
                  <ExternalLink size={14}/>
                </div>
                <span className="text-xs font-medium text-slate-900 underline underline-offset-4 decoration-blue-100 truncate">
                  {/* Use ?. here and check if organizationId exists */}
                  {lead.organizationId?.linkedin || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-900">
                  <Clock size={14}/>
                </div>
                <span className="text-[10px] font-bold text-slate-900 uppercase">
                  Created: {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesDashboard = () => {
  const [randomTip, setRandomTip] = useState("");
 
  const [generatedLeads, setGeneratedLeads] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [feasibilityTasks, setFeasibilityTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showFeasibilityModal, setShowFeasibilityModal] = useState(false);
  const [actionStep, setActionStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [overviewRange, setOverviewRange] = useState(7); // default to 7 days
    // Calculate date ranges
  const [allData, setAllData] = useState([]); // Add this
  // 1. Get current timestamps
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 2. Filter from the RAW data (allData), not the "Today" lists
  // We use optional chaining (?.) and default to an empty array ([]) to avoid errors
  const lastWeekCount = (allData || []).filter(lead => {
    const createdAt = new Date(lead.createdAt);
    return createdAt >= oneWeekAgo && createdAt <= now;
  }).length;

  const lastMonthCount = (allData || []).filter(lead => {
    const createdAt = new Date(lead.createdAt);
    return createdAt >= oneMonthAgo && createdAt <= now;
  }).length;
  const [followUpData, setFollowUpData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'call',
    description: ''
  });
  // Calculate the specific count based on the selected range
  const overviewCount = allData.filter(l => {
    const leadDate = new Date(l.createdAt);
    const daysAgo = new Date(new Date().getTime() - overviewRange * 24 * 60 * 60 * 1000);
    return leadDate >= daysAgo;
  }).length;

  // Optional: Calculate a simple percentage for the UI display
  const [feasibilityData, setFeasibilityData] = useState({
    feasibilityId: '',
    taskDetails: '',
    attachment: null,
    feasibilityDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '' 
  });

  const [closingData, setClosingData] = useState({ reason: 'won', description: '' });

  const generateFeasibilityId = (leadNumber) => `FSL${String(leadNumber || 0).padStart(4, '0')}`;

  const openFeasibilityModal = () => {
    setFeasibilityData({
      ...feasibilityData,
      feasibilityId: generateFeasibilityId(selectedLead?.leadNumber),
      taskDetails: '',
      feasibilityDate: new Date().toISOString().split('T')[0]
    });
    setShowActionModal(false);
    setShowFeasibilityModal(true);
  };
  const [projectManagers, setProjectManagers] = useState([]);
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Follow-up Scheduled': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Feasibility': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Closed': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'Converted': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-green-500 text-White border-1';
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/lead-generation', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = Array.isArray(res.data) ? res.data : [];
      setAllData(data); 

      // Use local comparison to handle timezone offsets correctly
      const todayStr = new Date().toLocaleDateString('en-CA'); 

      // Filter for New Leads created today
      setGeneratedLeads(data.filter(l => 
        new Date(l.createdAt).toLocaleDateString('en-CA') === todayStr && 
        (!l.status || l.status === 'New')
      ));

      // Filter for Follow-up Scheduled today
      setFollowUps(data.filter(l => 
        l.followUpDate && 
        new Date(l.followUpDate).toLocaleDateString('en-CA') === todayStr && 
        l.status === 'Follow-up Scheduled'
      ));

      // --- THE FIX ---
      // Filter Feasibility tasks based on the followUpDate (The reappearance date)
      setFeasibilityTasks(data.filter(l => 
        l.followUpDate && 
        new Date(l.followUpDate).toLocaleDateString('en-CA') === todayStr && 
        l.status === 'Feasibility'
      ));
      
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPMs = async () => {
        const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        // Filter users who have the PM role
        setProjectManagers(res.data.filter(u => u.role === 'Project Manager'));
    };
    fetchPMs();
    fetchData();
    
    const randomIndex = Math.floor(Math.random() * tips.length);
    setRandomTip(tips[randomIndex]);
  }, [])
  // Inside SalesDashboard.jsx
const [selectedPM, setSelectedPM] = useState('');

// Add this to your useEffect or a separate fetch function
useEffect(() => {
    const fetchPMs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            // Filter the results to only include users with the role "Project Manager"
            const onlyPMs = res.data.filter(user => user.role === 'Project Manager');
            
            setProjectManagers(onlyPMs);
        } catch (err) {
            console.error("Error fetching PMs", err);
        }
    };
    fetchPMs();
}, []); // Ensure the dependency array is here
  const handleFollowUpSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/lead-generation/${selectedLead._id}/action`, { 
        status: 'Follow-up Scheduled',
        followUpDate: followUpData.date,
        followUpType: followUpData.type,
        lastInteractionDesc: followUpData.description 
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData(); closeModal();
    } catch (err) { alert("Follow-up update failed"); }
  };
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5; // Change this number to show more/less per page

  // Calculate indexes for slicing
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = generatedLeads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(generatedLeads.length / leadsPerPage);

  // Helper to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
      const handleFeasibilitySubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        try {
          const token = localStorage.getItem('token');
          const formData = new FormData();

          // 1. Logic for Feasibility Date (Selected by User)
          // We append T12:00:00 to prevent IST/UTC timezone rollback
          const safeFeasibilityDate = new Date(`${feasibilityData.feasibilityDate}T12:00:00`).toISOString();
          
          // 2. Logic for Next Follow-up Date (Selected by User)
          // This is the date the user picked in the "Next Follow-up Date" field
          const safeFollowUpDate = feasibilityData.nextFollowUpDate 
            ? new Date(`${feasibilityData.nextFollowUpDate}T12:00:00`).toISOString() 
            : null;

          formData.append('status', 'Feasibility');
          formData.append('feasibilityId', feasibilityData.feasibilityId);
          formData.append('feasibilityDate', safeFeasibilityDate);
          formData.append('taskDetails', feasibilityData.taskDetails);
          
          // Send the followUpDate to match your Mongoose Schema field name
          if (safeFollowUpDate) {
            formData.append('followUpDate', safeFollowUpDate);
          }

          if (feasibilityData.attachment) {
            formData.append('file', feasibilityData.attachment);
          }

          await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, formData, {
            headers: { 
              Authorization: `Bearer ${token}`, 
              'Content-Type': 'multipart/form-data' 
            }
          });
          
          setIsUploading(false);
          setShowSuccess(true);
          
          setTimeout(() => { 
            setShowSuccess(false); 
            fetchData(); 
            closeModal(); 
          }, 2500);

        } catch (err) {
          setIsUploading(true); // Reset button state
          console.error("Submission Error:", err);
          alert(err.response?.data?.error || "Feasibility submission failed");
        } finally {
          setIsUploading(false);
        }
      };

 const handleCloseLead = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Ensure we are sending a payload that the backend expects
      const payload = {
        status: closingData.reason === 'won' ? 'Converted' : 'Closed',
        lastInteractionDesc: closingData.description || 'No description provided',
        // Adding a null PM ID might prevent backend "undefined" errors if it's 
        // shared logic with the Production Ready flow
        projectManagerId: null 
      };

      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, 
        payload, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Lead marked as ${payload.status}`);
      fetchData(); 
      closeModal();
    } catch (err) { 
      console.error("Close Lead Error:", err.response?.data);
      alert(err.response?.data?.error || "Failed to close lead"); 
    }
  };

  const closeModal = () => {
  if (isUploading) return;
  setShowActionModal(false);
  setShowFeasibilityModal(false);
  setShowSuccess(false);
  setActionStep(1);
  setFollowUpData({ 
    date: new Date().toISOString().split('T')[0], 
    type: 'call', 
    description: '' 
  });
  setFeasibilityData({ 
    feasibilityId: '', 
    taskDetails: '', 
    attachment: null, 
    feasibilityDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '' // Ensure this is reset
  });
};
      // --- Pagination State ---
    const [followUpPage, setFollowUpPage] = useState(1);
    const [feasibilityPage, setFeasibilityPage] = useState(1);
    const itemsPerPage = 3; // Adjust as needed for your UI height

    // --- Logic for Follow-ups ---
    const lastFollowUpIndex = followUpPage * itemsPerPage;
    const firstFollowUpIndex = lastFollowUpIndex - itemsPerPage;
    const currentFollowUps = followUps.slice(firstFollowUpIndex, lastFollowUpIndex);
    const totalFollowUpPages = Math.ceil(followUps.length / itemsPerPage);

    // --- Logic for Feasibility ---
    const lastFeasibilityIndex = feasibilityPage * itemsPerPage;
    const firstFeasibilityIndex = lastFeasibilityIndex - itemsPerPage;
    const currentFeasibility = feasibilityTasks.slice(firstFeasibilityIndex, lastFeasibilityIndex);
    const totalFeasibilityPages = Math.ceil(feasibilityTasks.length / itemsPerPage);
    const handleStatusUpdate = async (leadId, status, extraData = {}) => {
      try {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_BASE_URL}/api/leads/${leadId}/action`, {
          status,
          ...extraData // This will now spread { projectManagerId: null }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success(extraData.projectManagerId ? "Project Assigned!" : "Project moved to Unassigned bucket");
        // --- CHANGE THIS LINE ---
        // If your function is named something else (e.g., fetchLeads), change it here:
        if (typeof fetchLeads === 'function') {
          fetchLeads(); 
        } else {
          // If you don't have a fetch function, just reload the page as a fallback
          window.location.reload(); 
        }

        closeModal();
      } catch (err) {
        console.error("Full Error Object:", err);
        toast.error("Operation failed, but check database.");
      }
    };
  return (
    <div className="lg:ml-64 md:ml-20 ml-0 p-4 md:p-6 lg:p-10 min-h-screen bg-blue-100 transition-all duration-300">
      <div className="max-w-[1600px] mx-auto">

        {/* SUMMARY STATS */}
        {/* SUMMARY STATS - Compact Version */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* TOTAL LEADS CARD (Slim) */}
          

          {/* NEW LEADS (Slim) */}
        <div className="bg-blue-500 p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-100 uppercase tracking-widest leading-none mb-1">Today's Leads</p>
            <h3 className="text-xl font-black text-slate-100 leading-none">{generatedLeads.length}</h3>
          </div>
        </div>

        {/* FOLLOW-UPS (Slim) */}
        <div className="bg-orange-100 p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Follow-ups</p>
            <h3 className="text-xl font-black text-orange-600 leading-none">{followUps.length}</h3>
          </div>
        </div>

        {/* FEASIBILITY (Slim) */}
        <div className="bg-purple-100 p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest leading-none mb-1">Feasibility</p>
            <h3 className="text-xl font-black text-purple-600 leading-none">{feasibilityTasks.length}</h3>
          </div>
          
        </div>
         <div className="bg-blue-900 p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
          <div className="p-3 bg-slate-100 text-slate-900 rounded-xl shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-100 uppercase tracking-widest leading-none mb-1">Total Leads</p>
            <h3 className="text-xl font-black text-slate-100 leading-none">
              {generatedLeads.length + followUps.length + feasibilityTasks.length}
            </h3>
          </div>
        </div>
      </div>
     
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 lg:gap-10">
          <div className="xl:col-span-3 space-y-10">
            {/* PIPELINE */}
            {/* PIPELINE SECTION */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Target size={20} className="text-blue-600"/> Today's Generated Pipeline
            </h2>
            {/* Page Indicator */}
            {totalPages > 1 && (
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
            ) : generatedLeads.length === 0 ? (
              <p className="text-slate-400 text-sm italic text-center py-10">No leads generated today yet.</p>
            ) : (
              <>
                {/* Render only the leads for the current page */}
                {currentLeads.map((lead) => (
                  <LeadCard 
                    key={lead._id} 
                    lead={lead} 
                    getStatusStyle={getStatusStyle}
                    setSelectedLead={setSelectedLead} 
                    setShowActionModal={setShowActionModal}
                  />
                ))}

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-50">
                    <button
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      <ChevronDown className="rotate-90" size={18} />
                    </button>

                    <div className="flex gap-1">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => paginate(i + 1)}
                          className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                            currentPage === i + 1 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                            : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                        <button
                          onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                          <ChevronDown className="-rotate-90" size={18} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>  
            </div>

            {/* SCHEDULED FOR TODAY SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* FOLLOW-UPS LIST */}
  <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Clock size={20} className="text-orange-600"/> Follow-ups Today
      </h2>
      <div className="space-y-4">
        {followUps.length === 0 ? (
          <p className="text-slate-400 text-sm italic text-center py-6">No follow-ups today.</p>
        ) : currentFollowUps.map((lead) => (
          <div key={lead._id} className="p-5 rounded-3xl border border-slate-100 bg-blue-300 flex items-center justify-between group hover:border-orange-200 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0">
                {lead.followUpType === 'email' ? <Mail size={18}/> : <PhoneCall size={18}/>}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-800 text-sm truncate">{lead.pocName}</h4>
                <p className="text-[10px] text-slate-900 font-bold uppercase">{lead.pocPhone}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedLead(lead); setShowActionModal(true); }} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-900 hover:text-orange-600 transition-colors"><ExternalLink size={16}/></button>
          </div>
        ))}
      </div>
    </div>

    {/* Follow-up Pagination Controls */}
    {totalFollowUpPages > 1 && (
      <div className="flex items-center justify-center gap-3 mt-6">
        <button 
          onClick={() => setFollowUpPage(p => Math.max(1, p - 1))}
          disabled={followUpPage === 1}
          className="p-1.5 rounded-lg bg-white/50 disabled:opacity-30 hover:bg-white text-slate-600 transition-all"
        >
          {"<"}
        </button>
        <span className="text-[10px] font-black text-slate-500 uppercase">Page {followUpPage} / {totalFollowUpPages}</span>
        <button 
          onClick={() => setFollowUpPage(p => Math.min(totalFollowUpPages, p + 1))}
          disabled={followUpPage === totalFollowUpPages}
          className="p-1.5 rounded-lg bg-white/50 disabled:opacity-30 hover:bg-white text-slate-600 transition-all"
        >
          {">"}
          </button>
      </div>
    )}
  </div>

      {/* FEASIBILITY TODAY LIST */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <FileText size={20} className="text-purple-600"/> Feasibility Today
          </h2>
          <div className="space-y-4">
            {feasibilityTasks.length === 0 ? (
              <p className="text-slate-400 text-sm italic text-center py-6">No feasibility tasks for today.</p>
            ) : currentFeasibility.map((lead) => (
              <div key={lead._id} className="p-5 rounded-3xl border border-slate-100 bg-blue-300 flex items-center justify-between group hover:border-purple-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl group-hover:bg-purple-500 group-hover:text-white transition-all shrink-0">
                    <Briefcase size={18}/>
                  </div>
                 {/* In your currentFeasibility.map section */}
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{lead.pocName}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{lead.feasibilityId}</p>
                    {/* Adding a small tag to show the scheduled status */}
                    <span className="text-[9px] text-purple-600 font-bold italic px-1 bg-purple-50 rounded">Scheduled</span>
                  </div>
                </div>
                </div>
                <button onClick={() => { setSelectedLead(lead); setShowActionModal(true); }} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-900 hover:text-purple-600 transition-colors"><ExternalLink size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Feasibility Pagination Controls */}
        {totalFeasibilityPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button 
              onClick={() => setFeasibilityPage(p => Math.max(1, p - 1))}
              disabled={feasibilityPage === 1}
              className="p-1.5 rounded-lg bg-white/50 disabled:opacity-30 hover:bg-white text-slate-600 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-black text-slate-500 uppercase">Page {feasibilityPage} / {totalFeasibilityPages}</span>
            <button 
              onClick={() => setFeasibilityPage(p => Math.min(totalFeasibilityPages, p + 1))}
              disabled={feasibilityPage === totalFeasibilityPages}
              className="p-1.5 rounded-lg bg-white/50 disabled:opacity-30 hover:bg-white text-slate-600 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
          </div>

          {/* --- SIDEBAR COLUMN --- */}
        <div className="xl:col-span-1 space-y-6 ">
          
            {/* LEADS OVERVIEW SELECTOR */}
            <div className="bg-blue-300 rounded-[2.5rem] p-5 shadow-sm border border-slate-100 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Overview</h3>
                  <p className="text-[10px] text-slate-900 font-bold uppercase tracking-tight">Lead Volume</p>
                </div>
                {/* TOGGLE FILTER */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setOverviewRange(7)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${overviewRange === 7 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    7D
                  </button>
                  <button 
                    onClick={() => setOverviewRange(30)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${overviewRange === 30 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    30D
                  </button>
                </div>
              </div>
              
              <div className="relative group p-4 bg-slate-50 rounded-[2rem] border border-slate-100 transition-all ">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Total Leads (Last {overviewRange} Days)
                  </p>
                </div>
                
                <div className="flex items-end gap-2">
                  <h4 className="text-4xl font-black text-slate-900 leading-none">
                    {overviewCount}
                  </h4>
                  <span className="text-sm font-bold text-slate-400 mb-1">leads</span>
                </div>

                {/* SUBTLE DECORATION */}
                <div className="absolute bottom-4 right-6 ">
                  <TrendingUp size={40} className="text-slate-900" />
                </div>
              </div>

            </div>

          {/* DAILY GOAL CARD */}
          <div className="bg-indigo-600 rounded-[2.5rem] p-4 text-white shadow-lg shadow-indigo-100 transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500 rounded-lg">
                <Target size={20} className="text-white"/>
              </div>
              <h3 className="text-lg font-black">Daily Goal</h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Tasks Remaining</p>
                  {/* Sum of follow-ups and feasibility tasks currently in the lists */}
                  <h4 className="text-4xl font-black">{followUps.length + feasibilityTasks.length}</h4>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <p className="text-indigo-100 text-[11px] leading-relaxed italic opacity-80">
                  You have <span className="font-bold text-white">{followUps.length} follow-ups</span> and <span className="font-bold text-white">{feasibilityTasks.length} feasibility</span> checks left for today.
                </p>
              </div>
            </div>
          </div>

          {/* PRO TIP CARD */}
          <div className="bg-orange-100 rounded-[2.5rem] p-4 border border-amber-100 shadow-sm transition-all duration-300 ease-in-out 
                hover:scale-105 hover:shadow-xl hover:border-indigo-200 cursor-pointe">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500 text-white rounded-xl shadow-md shadow-amber-200">
                <AlertCircle size={18}/>
              </div>
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Pro Tip</h3>
            </div>
            
            <div className="relative">
              {/* Large decorative quotation mark */}
              <span className="absolute -top-4 -left-2 text-4xl text-orange-500 font-serif opacity-50">“</span>
              
              <p className="text-amber-800 text-xs leading-relaxed font-bold italic relative z-10 px-2">
                {randomTip || "Loading your daily wisdom..."}
              </p>
          </div>
        </div>

        </div>
        </div>
      </div>

      {/* --- ACTION MODAL --- */}
        {showActionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative">
            {/* Close Button */}
            <button 
              onClick={closeModal} 
              className="absolute top-6 right-6 md:top-10 md:right-10 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <X size={24}/>
            </button>

            {/* STEP 1: Main Action Menu */}
            {actionStep === 1 && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-3xl font-black text-slate-900 mb-2">Take Action</h2>
                <p className="text-slate-400 font-medium mb-8 italic">
                  Target: <span className="text-indigo-600 font-bold">{selectedLead?.pocName}</span>
                </p>
                
                <div className="space-y-3">
                  {/* Set Follow-Up */}
                  <button 
                    onClick={() => setActionStep(2)} 
                    className="w-full flex items-center justify-between p-5 rounded-3xl bg-slate-50 hover:bg-amber-50 group border border-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-4 text-slate-700 font-black group-hover:text-amber-600">
                      <Calendar size={20} className="text-amber-500" /> Set Next Follow-Up
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>

                  {/* Feasibility */}
                  <button 
                    onClick={openFeasibilityModal} 
                    className="w-full flex items-center justify-between p-5 rounded-3xl bg-slate-50 hover:bg-purple-50 group border border-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-4 text-slate-700 font-black group-hover:text-purple-600">
                      <TrendingUp size={20} className="text-purple-500" /> Send to Feasibility
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>

                 

                  {/* Close Lead */}
                  <button 
                    onClick={() => setActionStep(3)} 
                    className="w-full flex items-center justify-between p-5 rounded-3xl bg-rose-50 hover:bg-rose-100 group border border-rose-100 transition-all"
                  >
                    <div className="flex items-center gap-4 text-rose-600 font-black">
                      <X size={20} /> Close Lead
                    </div>
                    <ChevronRight size={18} />
                  </button>
                   {/* Production Ready (New Flow) */}
                  <button
                    onClick={() => setActionStep(4)}
                    className="group relative w-full flex flex-col items-center gap-2 p-3 rounded-[1.5rem] bg-emerald-50 hover:bg-emerald-600 transition-all duration-500 border border-emerald-100 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-200 text-left"
                  >
                    {/* Icon container: Reduced padding and icon size */}
                    <div className="p-1.5 bg-white rounded-xl text-emerald-600 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shadow-sm">
                      <CheckCircle size={16} />
                    </div>

                    <div className="text-center">
                      {/* Main text: Reduced from text-xs to text-[10px] */}
                      <span className="block text-[10px] font-black text-emerald-900 group-hover:text-white uppercase tracking-wider">
                        Production Ready
                      </span>
                      {/* Subtext: Reduced from text-[10px] to text-[8px] */}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Follow-up Form */}
            {actionStep === 2 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-6">Follow-up Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Date</label>
                    <input 
                      type="date" 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-500/20" 
                      value={followUpData.date} 
                      onChange={(e) => setFollowUpData({...followUpData, date: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Method</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                      value={followUpData.type} 
                      onChange={(e) => setFollowUpData({...followUpData, type: e.target.value})}
                    >
                      <option value="call">📞 Phone Call</option>
                      <option value="email">📧 Email</option>
                      <option value="message">💬 Message</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Notes</label>
                    <textarea 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-24 resize-none font-medium outline-none focus:ring-2 focus:ring-amber-500/20" 
                      value={followUpData.description} 
                      onChange={(e) => setFollowUpData({...followUpData, description: e.target.value})} 
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setActionStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button>
                    <button onClick={handleFollowUpSubmit} className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-200">Save Schedule</button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Conclusion (Won/Lost) */}
            {actionStep === 3 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Conclusion</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setClosingData({...closingData, reason: 'won'})} 
                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${closingData.reason === 'won' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-transparent text-slate-400'}`}
                    >Won</button>
                    <button 
                      onClick={() => setClosingData({...closingData, reason: 'lost'})} 
                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${closingData.reason === 'lost' ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-transparent text-slate-400'}`}
                    >Lost</button>
                  </div>
                  <textarea 
                    placeholder="Final summary/reasons..." 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 resize-none font-medium outline-none" 
                    value={closingData.description} 
                    onChange={(e) => setClosingData({...closingData, description: e.target.value})} 
                  />
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setActionStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button>
                    <button 
                      onClick={handleCloseLead} 
                      className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs uppercase shadow-lg transition-all ${closingData.reason === 'won' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}
                    >Confirm Status</button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: PM Selection (Production Ready) */}          
            {actionStep === 4 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Assign Project</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">
                  Select a Project Manager or leave blank to keep Unassigned
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Available Managers</label>
                    <select 
                      value={selectedPM}
                      onChange={(e) => setSelectedPM(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                    >
                      <option value="">Stay Unassigned (Move to Bucket)</option>
                      {projectManagers.map(pm => (
                        <option key={pm._id} value={pm._id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setActionStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button>
                    <button 
                      onClick={() => handleStatusUpdate(selectedLead._id, 'Production Ready', { 
                        // Send null if selectedPM is an empty string
                        projectManagerId: selectedPM || null 
                      })} 
                      className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200"
                    >
                      {selectedPM ? "Assign & Convert" : "Move to Unassigned"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- FEASIBILITY MODAL --- */}
      {showFeasibilityModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl relative animate-in zoom-in duration-300 overflow-hidden">
            {showSuccess && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in fade-in">
                <div className="p-6 bg-green-100 text-green-600 rounded-full mb-6"><CheckCircle size={60} /></div>
                <h2 className="text-2xl font-black text-slate-900 uppercase">Feasibility Sent</h2>
              </div>
            )}
            <button onClick={closeModal} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><X size={24}/></button>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Feasibility Request</h2>
            <p className="text-slate-400 mb-8 font-medium italic underline">Client: <span className="text-purple-600 font-bold">{selectedLead?.pocName}</span></p>
            
            <form onSubmit={handleFeasibilitySubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Feasibility ID</label>
                  <input type="text" readOnly className="w-full p-4 bg-purple-50 border border-purple-100 rounded-2xl font-black text-purple-700 outline-none" value={feasibilityData.feasibilityId} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Feasibility Date</label>
                  <input 
                    type="date" 
                    readOnly 
                    className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed" 
                    value={feasibilityData.feasibilityDate} // Set this to today's date in state
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Next Follow-up Date
                  </label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-purple-400 transition-colors" 
                    value={feasibilityData.nextFollowUpDate || ''} 
                    onChange={(e) => setFeasibilityData({
                      ...feasibilityData, 
                      nextFollowUpDate: e.target.value 
                    })} 
                  />
                  <p className="text-[9px] text-slate-400 mt-2 italic">
                    * This task will reappear in your dashboard on this date.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Task Details</label>
                <textarea required placeholder="Requirement details..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none h-24 md:h-32 resize-none" value={feasibilityData.taskDetails} onChange={(e) => setFeasibilityData({...feasibilityData, taskDetails: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Attachment (PDF/Word)</label>
                <div className="relative group">
                  <input type="file" accept=".pdf,.doc,.docx" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setFeasibilityData({...feasibilityData, attachment: e.target.files[0]})} />
                  <div className="w-full p-6 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 group-hover:border-purple-400 transition-colors bg-slate-50">
                    <Upload size={24} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 truncate w-full px-4 text-center">{feasibilityData.attachment ? feasibilityData.attachment.name : "Click to upload files"}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowFeasibilityModal(false); setShowActionModal(true); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button>
                <button type="submit" disabled={isUploading} className="flex-[2] py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-200 flex items-center justify-center gap-2">
                  {isUploading ? <><Loader2 size={18} className="animate-spin" /> Uploading...</> : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesDashboard;  