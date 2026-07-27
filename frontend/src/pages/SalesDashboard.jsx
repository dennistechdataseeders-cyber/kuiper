import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useSidebar } from '../context/SidebarContext';
import { 
  Target, User, Mail, Phone, Clock, TrendingUp, Briefcase, 
  Calendar as CalendarIcon, CheckCircle, X, ChevronRight, PhoneCall, MessageSquare, 
  ExternalLink, Upload, FileText, Loader2, ChevronLeft, ChevronDown, ChevronUp, AlertCircle,
  Send, CalendarDays, Copy, Check, AlertTriangle, Building2, Search as SearchIcon, Plus,
  ArrowRight, Ban, Users, Search
} from 'lucide-react';
import API_BASE_URL from '../config';
import tips from '../data/salesTips';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CreatableSelect from 'react-select/creatable'; 

const LeadCard = ({ lead, getStatusStyle, setSelectedLead, setShowActionModal, type }) => {
  const [isExpanded, setIsExpanded] = useState(false);  
  const [copiedField, setCopiedField] = useState('');
  
  const formatId = (num, prefix = "LEAD") => {
    if (!num) return `${prefix}---`;
    return `${prefix}${String(num).padStart(4, '0')}`;
  };
  
  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const getCardBgColor = () => {
    const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
    if (isOverdue) return 'bg-red-100 border-red-300';
    if (type === 'followup') return 'bg-orange-100 border-orange-200';
    if (type === 'feasibility') return 'bg-purple-100 border-purple-200';
    return 'bg-blue-200 border-blue-100';
  };

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative flex flex-col p-3 pt-8 rounded-[2rem] ${getCardBgColor()} text-slate-800 shadow-sm border transition-all duration-300 hover:shadow-md cursor-pointer`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="absolute top-1.5 left-5">
          <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">
            {formatId(lead.leadNumber)}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/80 text-blue-600 rounded-2xl shrink-0 cursor-pointer hover:bg-white transition-colors">
            <User size={24} />
          </div>
          
          <div className="cursor-pointer">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-lg text-slate-900">{lead.pocName}</h4>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${getStatusStyle(lead.status)}`}>
                {lead.status || 'New'}
              </span>
            </div>
            
            <div className="flex items-center gap-1 mt-1">
              <Building2 size={12} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-700">
                {lead.organizationId?.companyName || 'No Organization'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[6px] font-black uppercase tracking-widest px-1 py-0.5 rounded-md border italic ${
                lead.leadType?.toLowerCase() === 'inbound' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                {lead.leadType}
              </span>
              
              {lead.followUpDate && (
                <span className="text-[8px] font-black bg-white/60 px-1.5 py-0.5 rounded-full text-slate-600">
                  📅 {new Date(lead.followUpDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto lg:ml-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLead(lead);
              setShowActionModal(true);
            }}
            className="bg-gradient-to-r from-blue-800 to-blue-600 text-white hover:from-blue-600 hover:to-blue-800 px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-blue-100 active:scale-95"
          >
            Take Action
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-6 pt-6 border-t border-slate-200' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2">
            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Contact Details</p>
              
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white/60 rounded-lg text-slate-900">
                    <Mail size={14}/>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 truncate">{lead.pocEmail || 'No email'}</span>
                </div>
                {lead.pocEmail && (
                  <button onClick={() => handleCopy(lead.pocEmail, 'email')} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors shrink-0">
                    {copiedField === 'email' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-slate-500" />}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3 group">
                <div className="p-2 bg-white/60 rounded-lg text-slate-900">
                  <Phone size={14}/>
                </div>
                <span className="text-xs font-semibold text-slate-900">{lead.pocPhone || 'No phone'}</span>
                {lead.pocPhone && (
                  <button onClick={() => handleCopy(lead.pocPhone, 'phone')} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors shrink-0">
                    {copiedField === 'phone' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-slate-500" />}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Network & Info</p>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/60 rounded-lg text-slate-900">
                  <ExternalLink size={14}/>
                </div>
                <span className="text-xs font-medium text-slate-900 underline underline-offset-4 decoration-blue-100 truncate">
                  {lead.organizationId?.linkedin || 'No LinkedIn'}
                </span>
                {lead.organizationId?.linkedin && (
                  <button onClick={() => handleCopy(lead.organizationId.linkedin, 'linkedin')} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors shrink-0">
                    {copiedField === 'linkedin' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-slate-500" />}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/60 rounded-lg text-slate-900">
                  <Clock size={14}/>
                </div>
                <span className="text-[10px] font-bold text-slate-900 uppercase">Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
              
              {lead.feasibilityId && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg text-purple-600">
                    <FileText size={14}/>
                  </div>
                  <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Feasibility ID: {lead.feasibilityId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesDashboard = () => {
  const [randomTip, setRandomTip] = useState("");
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [generatedLeads, setGeneratedLeads] = useState([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showFeasibilityModal, setShowFeasibilityModal] = useState(false);
  const [actionStep, setActionStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [approachesToday, setApproachesToday] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [overviewRange, setOverviewRange] = useState(7);
  const [allData, setAllData] = useState([]);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [allScheduledItems, setAllScheduledItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledCurrentPage, setScheduledCurrentPage] = useState(1);
  const scheduledItemsPerPage = 5;

  // Search states for each bucket
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [followUpSearchTerm, setFollowUpSearchTerm] = useState('');
  const [approachSearchTerm, setApproachSearchTerm] = useState('');

  // Table search states
  const [followUpTableSearch, setFollowUpTableSearch] = useState('');
  const [approachTableSearch, setApproachTableSearch] = useState('');

  // Organization selection state for project modal
  const [organizations, setOrganizations] = useState([]);
  const [searchOrgTerm, setSearchOrgTerm] = useState('');
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    companyName: '',
    website: '',
    address: ''
  });

  // Helper function to check if PM is selected
  const isPMSelected = () => {
    return projectForm.projectManager && projectForm.projectManager !== '';
  };

  // Close Lead Modal State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingData, setClosingData] = useState({ reason: 'won', description: '' });
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [followUpData, setFollowUpData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'call',
    description: ''
  });
  
  const overviewCount = allData.filter(l => {
    const leadDate = new Date(l.createdAt);
    const daysAgo = new Date(new Date().getTime() - overviewRange * 24 * 60 * 60 * 1000);
    return leadDate >= daysAgo;
  }).length;

  const [feasibilityData, setFeasibilityData] = useState({
    feasibilityId: '',
    taskDetails: '',
    attachment: null,
    feasibilityDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '' ,
    attachmentName: '' 
  });

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
  
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Follow-up Scheduled': return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
      case 'Feasibility': return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
      case 'Closed': return 'bg-rose-500/20 text-rose-700 border-rose-500/30';
      case 'Converted': return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30';
      default: return 'bg-green-500 text-white border-1';
    }
  };

  const isOverdue = (scheduledDate) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dueDate = new Date(scheduledDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < todayStart;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [res, prospect_res] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/lead-generation`, { headers }),
        axios.get(`${API_BASE_URL}/api/prospects`, { headers })
      ]);

      const data = Array.isArray(res.data) ? res.data : [];
      const prospect_data = Array.isArray(prospect_res.data) ? prospect_res.data : [];

      setAllData(data);

      const todayStr = new Date().toLocaleDateString('en-CA');
      
      setGeneratedLeads(data.filter(l => 
        new Date(l.createdAt).toLocaleDateString('en-CA') === todayStr && 
        (!l.status || l.status === 'New')
      ));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allPendingFollowUps = data.filter(l => {
        if (!l.followUpDate || l.status !== 'Follow-up Scheduled' || l.completedAt) {
          return false;
        }
        
        const followUpDate = new Date(l.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        
        return followUpDate <= today;
      });
      
      setFollowUps(allPendingFollowUps);

      const filteredApproaches = prospect_data.filter(item => {
        const dateValue = item.nextFollowUpDate?.$date || item.nextFollowUpDate;
        if (dateValue) {
          const followUpDate = new Date(dateValue);
          const todayDate = new Date();
          followUpDate.setHours(0, 0, 0, 0);
          todayDate.setHours(0, 0, 0, 0);
          return followUpDate <= todayDate && item.status === 'Approached';
        }
        return false;
      });

      setApproachesToday(filteredApproaches);

      const scheduledFollowUps = data
        .filter(l => l.followUpDate && l.status === 'Follow-up Scheduled' && !l.completedAt)
        .map(l => ({
          id: l._id,
          title: l.pocName,
          orgName: l.organizationId?.companyName || 'No Org',
          type: 'followup',
          date: new Date(l.followUpDate),
          originalLead: l,
          isOverdue: isOverdue(l.followUpDate)
        }));
      
      const scheduledFeasibility = data
        .filter(l => l.followUpDate && l.status === 'Feasibility' && !l.completedAt)
        .map(l => ({
          id: l._id,
          title: l.pocName,
          orgName: l.organizationId?.companyName || 'No Org',
          type: 'feasibility',
          date: new Date(l.followUpDate),
          originalLead: l,
          isOverdue: isOverdue(l.followUpDate)
        }));
      
      setAllScheduledItems([...scheduledFollowUps, ...scheduledFeasibility]);
      
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizations(res.data);
    } catch (err) {
      console.error("Error fetching organizations:", err);
      setOrganizations([]);
    }
  };

  const createNewOrganization = async () => {
    if (!newOrgData.companyName.trim()) {
      toast.error("Organization name is required");
      return null;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/orgs`, {
        companyName: newOrgData.companyName,
        website: newOrgData.website,
        address: newOrgData.address,
        pointsOfContact: []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Organization "${newOrgData.companyName}" created successfully`);
      await fetchOrganizations();
      return response.data;
    } catch (err) {
      console.error("Error creating organization:", err);
      toast.error(err.response?.data?.error || "Failed to create organization");
      return null;
    }
  };

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  const [projectForm, setProjectForm] = useState({
    name: '',
    organizationId: '',
    projectManager: '',
    description: '',
    country: '',
    industry: '',
  });
  
  const [feasibilityPM, setFeasibilityPM] = useState('');
  const [projectManagersList, setProjectManagersList] = useState([]);
  const [loadingPMs, setLoadingPMs] = useState(false);
  
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
      console.log('✅ Project Managers fetched:', pms.length);
    } catch (err) {
      console.error("Error fetching PMs:", err);
      toast.error("Failed to load Project Managers");
    } finally {
      setLoadingPMs(false);
    }
  };
  
  // Auto-select the first Project Manager when they load
  useEffect(() => {
    if (projectManagers.length > 0 && !projectForm.projectManager) {
      setProjectForm(prev => ({
        ...prev,
        projectManager: projectManagers[0]._id
      }));
      console.log('✅ Auto-selected Project Manager:', projectManagers[0].name);
    }
  }, [projectManagers]);

  useEffect(() => {
    const fetchPMs = async () => {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProjectManagers(res.data.filter(u => u.role === 'Project Manager'));
    };
    fetchPMs();
    fetchData();
    fetchOrganizations();
    fetchProjectManagers();
    
    const randomIndex = Math.floor(Math.random() * tips.length);
    setRandomTip(tips[randomIndex]);
  }, []);
  
  const filteredOrganizations = organizations.filter(org =>
    org.companyName?.toLowerCase().includes(searchOrgTerm.toLowerCase())
  );

  const handleFollowUpSubmit = async () => {
    // ✅ Add validation for Follow-up
    if (!selectedLead) {
      toast.error("No lead selected");
      return;
    }
    
    if (!followUpData.date) {
      toast.error("Please select a follow-up date");
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, { 
        status: 'Follow-up Scheduled',
        followUpDate: followUpData.date,
        followUpType: followUpData.type,
        lastInteractionDesc: followUpData.description,
        completedAt: null
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Follow-up scheduled successfully!');
      fetchData(); 
      closeModal();
    } catch (err) { 
      toast.error(err.response?.data?.error || "Follow-up update failed");
    }
  };
  
  const handleCompleteTask = async (lead) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${lead._id}/action`, { 
        completedAt: new Date().toISOString(),
        status: lead.status === 'Follow-up Scheduled' ? 'Follow-up Completed' : 'Feasibility Completed'
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Task marked as completed!");
      fetchData();
    } catch (err) {
      toast.error("Failed to complete task");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 5;
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  
  // Filter leads by search term
  const filteredLeads = generatedLeads.filter(lead =>
    lead.pocName?.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    lead.organizationId?.companyName?.toLowerCase().includes(leadSearchTerm.toLowerCase())
  );
  
  const currentLeads = filteredLeads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  
  // Filter follow-ups by table search term (name, email, org)
  const filteredFollowUps = followUps.filter(lead => {
    const search = followUpTableSearch.toLowerCase();
    return lead.pocName?.toLowerCase().includes(search) ||
           lead.pocEmail?.toLowerCase().includes(search) ||
           lead.organizationId?.companyName?.toLowerCase().includes(search) ||
           lead.lastInteractionDesc?.toLowerCase().includes(search);
  });
  
  // Filter approaches by table search term (name, company)
  const filteredApproaches = approachesToday.filter(lead => {
    const search = approachTableSearch.toLowerCase();
    return lead.pocName?.toLowerCase().includes(search) ||
           lead.companyName?.toLowerCase().includes(search) ||
           lead.pocEmail?.toLowerCase().includes(search);
  });
  
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
  
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  const handleFeasibilitySubmit = async (e) => {
    e.preventDefault();
    
    // ✅ Add PM validation for Feasibility
    if (!feasibilityPM) {
      toast.error("⚠️ Please select a Project Manager for this feasibility request");
      return;
    }
    
    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      const safeFeasibilityDate = new Date(`${feasibilityData.feasibilityDate}T12:00:00`).toISOString();
      const safeFollowUpDate = feasibilityData.nextFollowUpDate 
        ? new Date(`${feasibilityData.nextFollowUpDate}T12:00:00`).toISOString() 
        : null;

      formData.append('status', 'Feasibility');
      formData.append('feasibilityId', feasibilityData.feasibilityId);
      formData.append('feasibilityDate', safeFeasibilityDate);
      formData.append('taskDetails', feasibilityData.taskDetails);
      
      if (feasibilityPM) {
        formData.append('projectManagerId', feasibilityPM);
      }
      
      if (safeFollowUpDate) {
        formData.append('followUpDate', safeFollowUpDate);
      }

      // Handle file attachment - supports all file types
      if (feasibilityData.attachment) {
        formData.append('file', feasibilityData.attachment);
      }

      const response = await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'multipart/form-data' 
        }
      });
      
      setIsUploading(false);
      setShowSuccess(true);
      setFeasibilityPM('');
      
      setTimeout(() => { 
        setShowSuccess(false); 
        fetchData(); 
        closeModal(); 
      }, 2500);

    } catch (err) {
      console.error("Submission Error:", err);
      toast.error(err.response?.data?.error || "Feasibility submission failed");
      setIsUploading(false);
    }
  };
  
  // ============================================
  // CLOSE LEAD HANDLERS
  // ============================================
  
  const openCloseLeadModal = () => {
    setClosingData({ reason: 'won', description: '' });
    setShowProductionForm(false);
    setShowCloseModal(true);
    setShowActionModal(false);
    
    // Auto-select the first PM if available
    const defaultPM = projectManagers.length > 0 ? projectManagers[0]._id : '';
    
    setProjectForm({
      name: selectedLead?.organizationId?.companyName || selectedLead?.pocName || '',
      organizationId: selectedLead?.organizationId?._id || selectedLead?.organizationId || '',
      projectManager: defaultPM,
      description: `Project from lead: ${selectedLead?.pocName}`,
      country: 'United States',
      industry: 'ECOM',
    });
  };

  const handleProductionSubmit = async (e) => {
    e.preventDefault();

    // Check if PM is selected
    if (!projectForm.projectManager) {
      toast.error("⚠️ Please select a Project Manager");
      return;
    }

    setIsClosing(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        status: 'Production Ready',
        lastInteractionDesc: closingData.description || 'Lead marked as Production Ready',
        projectManagerId: projectForm.projectManager,
        industry: projectForm.industry,
        country: projectForm.country,
        projectBriefName: projectForm.name,
        organizationId: selectedLead?.organizationId?._id || selectedLead?.organizationId,
      };
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('✅ Project created and assigned to Project Manager!');
      
      setShowCloseModal(false);
      setShowProductionForm(false);
      setSelectedLead(null);
      setClosingData({ reason: 'won', description: '' });
      
      fetchData();
      
    } catch (err) {
      console.error("Production Ready Error:", err);
      toast.error(err.response?.data?.error || "Failed to mark as Production Ready");
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseLead = async () => {
    if (!closingData.reason) {
      toast.error("Please select an outcome (Won or Lost)");
      return;
    }

    if (closingData.reason === 'won') {
      setShowProductionForm(true);
      return;
    }

    if (closingData.reason === 'lost' && !closingData.description.trim()) {
      toast.error("Please provide a reason for losing the lead");
      return;
    }

    setIsClosing(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        status: 'Closed',
        lastInteractionDesc: closingData.description || 'No description provided',
      };
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Lead marked as Closed');
      
      setShowCloseModal(false);
      setSelectedLead(null);
      setClosingData({ reason: 'won', description: '' });
      
      fetchData();
      
    } catch (err) {
      console.error("Close Lead Error:", err);
      toast.error(err.response?.data?.error || "Failed to close lead");
    } finally {
      setIsClosing(false);
    }
  };

  const closeModal = () => {
    if (isUploading) return;
    setShowActionModal(false);
    setShowFeasibilityModal(false);
    setShowCloseModal(false);
    setShowProductionForm(false);
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
      nextFollowUpDate: ''
    });
    setFeasibilityPM('');
    setClosingData({ reason: 'won', description: '' });
  };
  
  const [followUpPage, setFollowUpPage] = useState(1);
  const [approachPage, setApproachPage] = useState(1);
  const itemsPerPage = 5;
  
  const lastFollowUpIndex = followUpPage * itemsPerPage;
  const firstFollowUpIndex = lastFollowUpIndex - itemsPerPage;
  const currentFollowUps = filteredFollowUps.slice(firstFollowUpIndex, lastFollowUpIndex);
  const totalFollowUpPages = Math.ceil(filteredFollowUps.length / itemsPerPage);
  
  const lastApproachIndex = approachPage * itemsPerPage;
  const firstApproachIndex = lastApproachIndex - itemsPerPage;
  const currentApproaches = filteredApproaches.slice(firstApproachIndex, lastApproachIndex);
  const totalApproachPages = Math.ceil(filteredApproaches.length / itemsPerPage);
  
  const [isApproachModalOpen, setIsApproachModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [approachData, setApproachData] = useState({ method: 'Email', summary: '' });
  const [submittingApproach, setSubmittingApproach] = useState(false);
  
  const handleApproachSubmit = async (e) => {
    e.preventDefault();
    if (!approachData.summary) return toast.error("Please provide a summary");
    
    setSubmittingApproach(true);
    try {
      const stepToUpdate = (selectedProspect.status !== 'Approached') 
        ? 0 
        : (selectedProspect.currentFollowUpStep || 0);
  
      const payload = {
        method: approachData.method,
        summary: approachData.summary,
        step: stepToUpdate 
      };
  
      await axios.put(`${API_BASE_URL}/api/prospects/approach/${selectedProspect._id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
  
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
  
  const handleStatusUpdate = async (leadId, status, extraData = {}) => {
    if (status === 'Production Ready') {
      // Auto-select the first PM if available
      const defaultPM = projectManagers.length > 0 ? projectManagers[0]._id : '';
      
      setProjectForm({
        name: selectedLead.companyName || '',
        organizationId: selectedLead.organizationId?._id || selectedLead.organizationId || '',
        projectManager: defaultPM,
        description: `Lead converted from Sales Dashboard. POC: ${selectedLead.pocName}`,
        country: selectedLead.country || '',
        industry: selectedLead.industry || '',
      });
      setShowProjectModal(true);
      setShowActionModal(false);
      return;
    }
  };
  
  const handleProjectSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!projectForm.projectManager) {
      toast.error("⚠️ Please select a Project Manager before launching the project");
      return;
    }
    if (isSubmittingProject) return;
    
    let finalOrgId = projectForm.organizationId;
    
    if (showNewOrgForm && newOrgData.companyName.trim()) {
      const newOrg = await createNewOrganization();
      if (newOrg) {
        finalOrgId = newOrg._id;
      } else {
        return;
      }
    }
    
    if (!finalOrgId) {
      toast.error("Please select or create an organization");
      return;
    }
    
    try {
      setIsSubmittingProject(true);
      const token = localStorage.getItem('token');
      
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLead._id}/action`, 
        { 
          status: 'Production Ready',
          projectManagerId: projectForm.projectManager,
          industry: projectForm.industry,
          country: projectForm.country,
          projectBriefName: projectForm.name,
          organizations: [finalOrgId]
        }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Project launched successfully!");
      
      setShowProjectModal(false);
      setShowActionModal(false);
      setShowNewOrgForm(false);
      setNewOrgData({ companyName: '', website: '', address: '' });
      setSearchOrgTerm('');
      
      await fetchData();
      
      const userRole = localStorage.getItem('role');
      if (userRole === 'Admin') {
        navigate('/admin/projects');
      } else if (userRole === 'Project Manager') {
        navigate('/admin/projects');
      } else {
        toast.success("Project created! Project Manager can now access it.");
      }
      
    } catch (err) {
      console.error("Project launch error:", err);
      toast.error(err.response?.data?.error || "Failed to launch project");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const getItemsForDate = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return allScheduledItems.filter(item => 
      item.date.toLocaleDateString('en-CA') === dateStr
    );
  };

  const paginatedScheduledItems = allScheduledItems.slice(
    (scheduledCurrentPage - 1) * scheduledItemsPerPage,
    scheduledCurrentPage * scheduledItemsPerPage
  );
  const totalScheduledPages = Math.ceil(allScheduledItems.length / scheduledItemsPerPage);

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const items = getItemsForDate(date);
      if (items.length === 0) return null;
      return (
        <div className="flex justify-center gap-0.5 mt-1">
          {items.some(i => i.type === 'followup') && (
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
          )}
          {items.some(i => i.type === 'feasibility') && (
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
          )}
        </div>
      );
    }
    return null;
  };

  // Approach Status Style
  const getApproachStatusStyle = (status) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Missed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>      
      <div className="max-w-[1600px] mx-auto">
        
        {/* TOP ROW - THREE BUCKETS IN ONE LINE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* TODAY'S LEADS */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg border border-blue-400/30 p-3 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Target size={12} className="text-white" />
                </div>
                <span className="text-[8px] font-black text-white/80 uppercase tracking-wider">Today's Leads</span>
              </div>
              <span className="text-lg font-black text-white">{filteredLeads.length}</span>
            </div>
          </div>

          {/* FOLLOW-UPS */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg border border-orange-400/30 p-3 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Clock size={12} className="text-white" />
                </div>
                <span className="text-[8px] font-black text-white/80 uppercase tracking-wider">Follow-ups</span>
              </div>
              <span className="text-lg font-black text-white">{filteredFollowUps.length}</span>
            </div>
          </div>

          {/* APPROACHES */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg border border-purple-400/30 p-3 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Users size={12} className="text-white" />
                </div>
                <span className="text-[8px] font-black text-white/80 uppercase tracking-wider">Approaches</span>
              </div>
              <span className="text-lg font-black text-white">{filteredApproaches.length}</span>
            </div>
          </div>

          {/* OVERVIEW */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl shadow-lg border border-cyan-400/30 p-3 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <h3 className="text-[10px] font-black text-white/80">Overview</h3>
                <p className="text-[7px] text-white/60 font-bold uppercase tracking-tight">Lead Volume</p>
              </div>
              <div className="flex bg-white/20 p-0.5 rounded-lg">
                <button 
                  onClick={() => setOverviewRange(7)} 
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-black transition-all ${
                    overviewRange === 7 
                      ? 'bg-white text-cyan-700 shadow-sm' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  7D
                </button>
                <button 
                  onClick={() => setOverviewRange(30)} 
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-black transition-all ${
                    overviewRange === 30 
                      ? 'bg-white text-cyan-700 shadow-sm' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  30D
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <h4 className="text-xl font-black text-white">{overviewCount}</h4>
              <span className="text-[10px] font-bold text-white/80">leads</span>
              <span className="text-[8px] font-black text-white/70 bg-white/20 px-1.5 py-0.5 rounded-full">
                Last {overviewRange}d
              </span>
            </div>
          </div>
        </div>

        {/* PRO TIP - SECOND ROW (Full width) */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl p-3 border border-amber-300/50 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white/30 text-white rounded-lg shadow-md flex-shrink-0">
                <AlertCircle size={14} />
              </div>
              <div>
                <h3 className="text-[9px] font-black text-white/90 uppercase tracking-tight">Pro Tip</h3>
                <p className="text-amber-50 text-[10px] leading-relaxed font-bold italic line-clamp-1">
                  {randomTip || "Loading your daily wisdom..."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PIPELINE SECTION */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Target size={20} className="text-blue-600"/> Today's Generated Pipeline
            </h2>
            {totalPages > 1 && (
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
            ) : currentLeads.length === 0 ? (
              <p className="text-slate-400 text-sm italic text-center py-10">No leads generated today yet.</p>
            ) : (
              <>
                {currentLeads.map((lead) => (
                  <LeadCard 
                    key={lead._id} 
                    lead={lead} 
                    getStatusStyle={getStatusStyle}
                    setSelectedLead={setSelectedLead} 
                    setShowActionModal={setShowActionModal}
                    type="pipeline"
                  />
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-50">
                    <button onClick={() => paginate(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      <ChevronDown className="rotate-90" size={18} />
                    </button>
                    <div className="flex gap-1">
                      {[...Array(totalPages)].map((_, i) => (
                        <button key={i + 1} onClick={() => paginate(i + 1)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => paginate(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      <ChevronDown className="-rotate-90" size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>  
        </div>

        {/* FOLLOW-UPS TABLE */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <Clock size={16} className="text-orange-600" />
              </div>
              <h2 className="text-sm font-black text-slate-800">Follow-up Due Today</h2>
              <span className="text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                {filteredFollowUps.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, org..."
                  value={followUpTableSearch}
                  onChange={(e) => setFollowUpTableSearch(e.target.value)}
                  className="w-40 pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors bg-slate-50"
                />
              </div>
              <button 
                onClick={() => setShowScheduledModal(true)} 
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[8px] font-black transition-all"
              >
                <CalendarDays size={12} />
                Calendar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Lead</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Organization</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Method</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Scheduled</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Description</th>
                  <th className="text-right px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentFollowUps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400 text-xs">
                      No pending follow-ups for today 🎉
                    </td>
                  </tr>
                ) : (
                  currentFollowUps.map((lead) => {
                    const isOverdueTask = isOverdue(lead.followUpDate);
                    return (
                      <tr key={lead._id} className={`hover:bg-slate-50/60 transition-all ${isOverdueTask ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[8px] font-bold">
                              {lead.pocName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{lead.pocName}</p>
                              {lead.pocEmail && (
                                <span className="text-[7px] text-slate-400 flex items-center gap-0.5">
                                  <Mail size={7} />
                                  {lead.pocEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-medium text-slate-600">
                            {lead.organizationId?.companyName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-slate-100 text-slate-600">
                            {lead.followUpType === 'email' ? '📧' : 
                             lead.followUpType === 'call' ? '📞' :
                             lead.followUpType === 'message' ? '💬' :
                             lead.followUpType === 'meeting' ? '🤝' : '📝'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-medium ${isOverdueTask ? 'text-red-600' : 'text-slate-600'}`}>
                            {new Date(lead.followUpDate).toLocaleDateString()}
                            {isOverdueTask && (
                              <span className="ml-1 text-[7px] font-black text-red-600 bg-red-100 px-1 py-0.5 rounded-full">Overdue</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[7px] font-black bg-amber-100 text-amber-700">
                            Pending
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9px] text-slate-500 truncate max-w-[150px] block">
                            {lead.lastInteractionDesc || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button 
                            onClick={() => { setSelectedLead(lead); setShowActionModal(true); }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[8px] font-black transition-all"
                          >
                            Take Action
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalFollowUpPages > 1 && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-400">
                Page {followUpPage} of {totalFollowUpPages}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setFollowUpPage(p => Math.max(1, p - 1))} 
                  disabled={followUpPage === 1}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft size={12} />
                </button>
                <button 
                  onClick={() => setFollowUpPage(p => Math.min(totalFollowUpPages, p + 1))} 
                  disabled={followUpPage === totalFollowUpPages}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* APPROACHES TABLE */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Users size={16} className="text-purple-600" />
              </div>
              <h2 className="text-sm font-black text-slate-800">Today's Approaches</h2>
              <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                {filteredApproaches.length}
              </span>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, company..."
                value={approachTableSearch}
                onChange={(e) => setApproachTableSearch(e.target.value)}
                className="w-40 pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors bg-slate-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Prospect</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Company</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Method</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Step</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Description</th>
                  <th className="text-right px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentApproaches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400 text-xs">
                      No approaches scheduled for today 🎯
                    </td>
                  </tr>
                ) : (
                  currentApproaches.map((lead) => {
                    const latestApproach = lead.approaches?.[lead.approaches?.length - 1] || {};
                    const isOverdue = latestApproach.scheduledDate && new Date(latestApproach.scheduledDate) < new Date();
                    
                    return (
                      <tr key={lead._id} className={`hover:bg-slate-50/60 transition-all cursor-pointer ${isOverdue ? 'bg-red-50/30' : ''}`} onClick={() => navigate('/prospects', { state: { openApproachFor: lead } })}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[8px] font-bold">
                              {lead.pocName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{lead.pocName}</p>
                              {lead.pocEmail && (
                                <span className="text-[7px] text-slate-400 flex items-center gap-0.5">
                                  <Mail size={7} />
                                  {lead.pocEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-medium text-slate-600">
                            {lead.companyName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-slate-100 text-slate-600">
                            {latestApproach.method || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-medium text-slate-600">
                            Step {lead.currentFollowUpStep || 0} of 5
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[7px] font-black ${getApproachStatusStyle(latestApproach.status || 'Pending')}`}>
                            {latestApproach.status || 'Pending'}
                          </span>
                          {isOverdue && (
                            <span className="ml-1 text-[7px] font-black text-red-600 bg-red-100 px-1 py-0.5 rounded-full">Overdue</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9px] text-slate-500 truncate max-w-[150px] block">
                            {latestApproach.summary || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate('/prospects', { state: { openApproachFor: lead } }); }}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[8px] font-black transition-all"
                          >
                            Approach Now
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalApproachPages > 1 && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-400">
                Page {approachPage} of {totalApproachPages}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setApproachPage(p => Math.max(1, p - 1))} 
                  disabled={approachPage === 1}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft size={12} />
                </button>
                <button 
                  onClick={() => setApproachPage(p => Math.min(totalApproachPages, p + 1))} 
                  disabled={approachPage === totalApproachPages}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACTION MODAL */}
      {showActionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative">
            <button onClick={closeModal} className="absolute top-6 right-6 md:top-10 md:right-10 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
            {actionStep === 1 && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-3xl font-black text-slate-900 mb-2">Take Action</h2>
                <p className="text-slate-400 font-medium mb-8 italic">Target: <span className="text-indigo-600 font-bold">{selectedLead?.pocName}</span></p>
                <div className="space-y-3">
                  <button onClick={() => setActionStep(2)} className="w-full flex items-center justify-between p-5 rounded-3xl bg-slate-50 hover:bg-amber-50 group border border-slate-100 transition-all">
                    <div className="flex items-center gap-4 text-slate-700 font-black group-hover:text-amber-600"><CalendarIcon size={20} className="text-amber-500" /> Set Next Follow-Up</div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                  <button onClick={openFeasibilityModal} className="w-full flex items-center justify-between p-5 rounded-3xl bg-slate-50 hover:bg-purple-50 group border border-slate-100 transition-all">
                    <div className="flex items-center gap-4 text-slate-700 font-black group-hover:text-purple-600"><TrendingUp size={20} className="text-purple-500" /> Send to Feasibility</div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                  <button onClick={openCloseLeadModal} className="w-full flex items-center justify-between p-5 rounded-3xl bg-rose-50 hover:bg-rose-100 group border border-rose-100 transition-all">
                    <div className="flex items-center gap-4 text-rose-600 font-black"><Ban size={20} /> Close Lead</div>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {actionStep === 2 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-6">Follow-up Details</h2>
                <div className="space-y-4">
                  <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Date</label><input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-500/20" value={followUpData.date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFollowUpData({...followUpData, date: e.target.value})} /></div>
                  <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Method</label><select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={followUpData.type} onChange={(e) => setFollowUpData({...followUpData, type: e.target.value})}><option value="call">📞 Phone Call</option><option value="email">📧 Email</option><option value="message">💬 Message</option> <option value="meeting">🤝 Meeting</option> </select></div>
                  <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Notes</label><textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-24 resize-none font-medium outline-none focus:ring-2 focus:ring-amber-500/20" value={followUpData.description} onChange={(e) => setFollowUpData({...followUpData, description: e.target.value})} /></div>
                  <div className="flex gap-3 pt-4"><button onClick={() => setActionStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button><button onClick={handleFollowUpSubmit} className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-200">Save Schedule</button></div>
                </div>
              </div>
            )}
            {actionStep === 4 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Assign Project</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Select a Project Manager to proceed</p>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assign Project Manager *</label>
                  <select 
                    required 
                    className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-slate-700 appearance-none cursor-pointer focus:border-blue-400 transition-all" 
                    value={projectForm.projectManager} 
                    onChange={(e) => setProjectForm({...projectForm, projectManager: e.target.value})}
                  >
                    <option value="">— Select a Manager —</option>
                    {projectManagers.map(pm => (
                      <option key={pm._id} value={pm._id}>{pm.name}</option>
                    ))}
                  </select>
                  
                  {/* Show warning if no PM selected */}
                  {!projectForm.projectManager && (
                    <p className="text-[8px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      Please select a Project Manager to continue
                    </p>
                  )}
                  
                  {/* Show success if PM selected */}
                  {projectForm.projectManager && (
                    <p className="text-[8px] text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={10} />
                      PM selected: {projectManagers.find(p => p._id === projectForm.projectManager)?.name}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setActionStep(1)} 
                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => {
                      // Validate before showing Project Modal
                      if (!projectForm.projectManager) {
                        toast.error("⚠️ Please select a Project Manager first");
                        return;
                      }
                      setShowProjectModal(true);
                    }} 
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                  >
                    Launch Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLOSE LEAD MODAL WITH PRODUCTION FORM */}
      {showCloseModal && selectedLead && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
            <button 
              onClick={() => {
                setShowCloseModal(false);
                setShowProductionForm(false);
                setSelectedLead(null);
                setClosingData({ reason: 'won', description: '' });
              }} 
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <X size={24}/>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
                <Ban size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                {showProductionForm ? 'Production Ready Setup' : 'Close Lead'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                For: <span className="font-bold text-slate-800">{selectedLead?.pocName}</span>
              </p>
            </div>

            {!showProductionForm ? (
              <form onSubmit={(e) => { e.preventDefault(); handleCloseLead(); }} className="space-y-5">
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
                      setSelectedLead(null);
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
                    <ArrowRight size={16} />
                    {closingData.reason === 'won' ? 'Continue to Setup' : 'Confirm Loss'}
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
                  <p className="text-[9px] text-emerald-600 mt-1">Assign a Project Manager to launch this project</p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({...projectForm, name: e.target.value})}
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
                      value={INDUSTRY_OPTIONS.find(opt => opt.value === projectForm.industry) || { label: projectForm.industry, value: projectForm.industry }} 
                      onChange={(v) => setProjectForm({ ...projectForm, industry: v?.value || '' })} 
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
                      value={POPULAR_COUNTRIES.find(opt => opt.label === projectForm.country) || { label: projectForm.country, value: projectForm.country }} 
                      onChange={(v) => setProjectForm({ ...projectForm, country: v?.label || '' })} 
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
                    value={projectForm.projectManager}
                    onChange={(e) => setProjectForm({...projectForm, projectManager: e.target.value})}
                  >
                    <option value="">Select Project Manager...</option>
                    {projectManagers.map(pm => (
                      <option key={pm._id} value={pm._id}>{pm.name}</option>
                    ))}
                  </select>
                  
                  {/* Show warning if no PM selected */}
                  {!projectForm.projectManager && (
                    <p className="text-[10px] text-red-500 text-center flex items-center justify-center gap-1 mt-2">
                      <AlertCircle size={14} />
                      Please select a Project Manager to launch this project
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-medium text-sm resize-none"
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({...projectForm, description: e.target.value})}
                    placeholder="Brief project description..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isClosing || !projectForm.projectManager}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isClosing || !projectForm.projectManager
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

      {/* FEASIBILITY MODAL */}
      {showFeasibilityModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in duration-300 overflow-hidden">
            {showSuccess && (<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in fade-in"><div className="p-6 bg-green-100 text-green-600 rounded-full mb-6"><CheckCircle size={60} /></div><h2 className="text-2xl font-black text-slate-900 uppercase">Feasibility Sent</h2></div>)}
            <button onClick={closeModal} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><X size={24}/></button>
            
            <div className="mb-6">
              <h2 className="text-3xl font-black text-slate-900">Feasibility Request</h2>
              <p className="text-slate-400 font-medium italic">Client: <span className="text-purple-600 font-bold">{selectedLead?.pocName}</span></p>
            </div>
            
            <form onSubmit={handleFeasibilitySubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Feasibility ID</label>
                  <input type="text" readOnly className="w-full p-4 bg-purple-50 border border-purple-100 rounded-2xl font-black text-purple-700 outline-none" value={feasibilityData.feasibilityId} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Feasibility Date</label>
                  <input type="date" readOnly className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed" value={feasibilityData.feasibilityDate} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Next Follow-up Date</label>
                  <input type="date" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-purple-400 transition-colors" value={feasibilityData.nextFollowUpDate || ''} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFeasibilityData({...feasibilityData, nextFollowUpDate: e.target.value})} />
                  <p className="text-[8px] text-slate-400 mt-1 italic">* Task will reappear on this date</p>
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block flex items-center gap-2">
                    <Briefcase size={14} className="text-purple-600" />
                    Assign Project Manager <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-purple-400 transition-colors cursor-pointer"
                    value={feasibilityPM}
                    onChange={(e) => setFeasibilityPM(e.target.value)}
                  >
                    <option value="">— Select Project Manager —</option>
                    {projectManagersList.length === 0 ? (
                      <option value="" disabled>No PMs available</option>
                    ) : (
                      projectManagersList.map(pm => (
                        <option key={pm._id} value={pm._id}>{pm.name}</option>
                      ))
                    )}
                  </select>
                  
                  {/* ✅ Show warning if no PM selected */}
                  {!feasibilityPM && (
                    <p className="text-[9px] text-red-500 mt-1.5 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      Please select a Project Manager to submit this feasibility request
                    </p>
                  )}
                  
                  {/* ✅ Show success if PM selected */}
                  {feasibilityPM && (
                    <p className="text-[9px] text-emerald-600 mt-1.5 flex items-center gap-1.5">
                      <CheckCircle size={12} />
                      PM selected: {projectManagersList.find(pm => pm._id === feasibilityPM)?.name}
                    </p>
                  )}
                  
                  <p className="text-[8px] text-slate-400 mt-1">The feasibility task will be assigned to this PM</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Task Details</label>
                <textarea required placeholder="Requirement details..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none h-20 md:h-24 resize-none focus:border-purple-400 transition-colors" value={feasibilityData.taskDetails} onChange={(e) => setFeasibilityData({...feasibilityData, taskDetails: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                  Attachment (PDF, Word, Excel, Images, JSON, ZIP, etc.)
                </label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.txt,.csv,.tsv,.json,.xml,.yaml,.yml,.zip,.rar,.7z,.tar,.gz,.ppt,.pptx,.odp,.mp4,.avi,.mkv,.mov,.mp3,.wav,.aac,.flac,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.sh,.bash,.bat,.ps1,.cmd" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        // Validate file size (50MB max)
                        if (file.size > 50 * 1024 * 1024) {
                          toast.error('File size must be less than 50MB');
                          e.target.value = '';
                          return;
                        }
                        setFeasibilityData({
                          ...feasibilityData, 
                          attachment: file,
                          attachmentName: file.name
                        });
                      }
                    }} 
                  />
                  <div className={`w-full p-4 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    feasibilityData.attachment 
                      ? 'border-emerald-400 bg-emerald-50' 
                      : 'border-slate-200 hover:border-purple-400 bg-slate-50'
                  }`}>
                    <Upload size={24} className={feasibilityData.attachment ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className="text-xs font-bold text-slate-500 truncate w-full px-4 text-center">
                      {feasibilityData.attachment 
                        ? feasibilityData.attachmentName || feasibilityData.attachment.name 
                        : "Click to upload files (Max 50MB)"}
                    </span>
                    {feasibilityData.attachment && (
                      <span className="text-[8px] text-emerald-600">
                        {(feasibilityData.attachment.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                    <span className="text-[7px] text-slate-400">
                      Supported: PDF, Word, Excel, Images, JSON, ZIP, Code files, and more
                    </span>
                  </div>
                </div>
                {feasibilityData.attachment && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeasibilityData({...feasibilityData, attachment: null, attachmentName: ''});
                      // Reset the file input
                      const fileInput = document.querySelector('input[type="file"]');
                      if (fileInput) fileInput.value = '';
                    }}
                    className="mt-1 text-[8px] font-bold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove file
                  </button>
                )}
              </div>
              
              {/* Feasibility Modal - Submit Button */}
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowFeasibilityModal(false); setShowActionModal(true); }} 
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading || !feasibilityPM}
                  className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    isUploading || !feasibilityPM
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                  }`}
                >
                  {isUploading ? (
                    <><Loader2 size={18} className="animate-spin" /> Uploading...</>
                  ) : !feasibilityPM ? (
                    <>⚠️ Select PM First</>
                  ) : (
                    "Submit Feasibility"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT LAUNCH MODAL WITH ORGANIZATION SELECTION */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[200] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">Launch New Hub</h2>
              <button 
                onClick={() => {
                  setShowProjectModal(false);
                  setShowNewOrgForm(false);
                  setNewOrgData({ companyName: '', website: '', address: '' });
                  setSearchOrgTerm('');
                }} 
                className="text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X size={28} />
              </button>
            </div>
            
            <form onSubmit={handleProjectSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Brief Title *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-slate-700 focus:border-blue-400 transition-all" 
                  value={projectForm.name} 
                  onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} 
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <Building2 size={12} />
                  Client Organization *
                </label>
                
                {!showNewOrgForm ? (
                  <>
                    <div className="relative">
                      <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search or select organization..."
                        value={searchOrgTerm}
                        onChange={(e) => {
                          setSearchOrgTerm(e.target.value);
                          setIsOrgDropdownOpen(true);
                        }}
                        onFocus={() => setIsOrgDropdownOpen(true)}
                        className="w-full h-12 rounded-xl border border-slate-200 pl-9 pr-8 font-medium text-sm outline-none focus:border-blue-500 bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {isOrgDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {isOrgDropdownOpen && (
                      <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto z-50">
                        {filteredOrganizations.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs">No organizations found</div>
                        ) : (
                          filteredOrganizations.map(org => (
                            <div
                              key={org._id}
                              onClick={() => {
                                setProjectForm({...projectForm, organizationId: org._id});
                                setSearchOrgTerm(org.companyName);
                                setIsOrgDropdownOpen(false);
                              }}
                              className="flex items-center justify-between p-3 cursor-pointer transition-all hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-800">{org.companyName}</p>
                                <p className="text-[9px] text-slate-400">{org.website || 'No website'}</p>
                              </div>
                              {projectForm.organizationId === org._id && (
                                <CheckCircle size={14} className="text-blue-600" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewOrgForm(true);
                        setIsOrgDropdownOpen(false);
                      }}
                      className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-[10px] font-black uppercase tracking-wider hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      Create New Organization
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-blue-600 ml-1">New Organization Details</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewOrgForm(false);
                          setNewOrgData({ companyName: '', website: '', address: '' });
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Organization Name *"
                      required
                      className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none font-bold text-sm"
                      value={newOrgData.companyName}
                      onChange={(e) => setNewOrgData({...newOrgData, companyName: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Website (optional)"
                      className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm"
                      value={newOrgData.website}
                      onChange={(e) => setNewOrgData({...newOrgData, website: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Address (optional)"
                      className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm"
                      value={newOrgData.address}
                      onChange={(e) => setNewOrgData({...newOrgData, address: e.target.value})}
                    />
                  </div>
                )}
                
                {projectForm.organizationId && !showNewOrgForm && (
                  <p className="text-[8px] text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={10} />
                    Organization selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Industry</label>
                  <CreatableSelect 
                    isClearable 
                    options={INDUSTRY_OPTIONS} 
                    value={INDUSTRY_OPTIONS.find(opt => opt.value === projectForm.industry) || (projectForm.industry ? { label: projectForm.industry, value: projectForm.industry } : null)} 
                    onChange={(newValue) => setProjectForm({ ...projectForm, industry: newValue ? newValue.value : '' })} 
                    styles={customSelectStyles} 
                    placeholder="Type or select..." 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Country</label>
                  <CreatableSelect 
                    isClearable 
                    options={POPULAR_COUNTRIES} 
                    value={POPULAR_COUNTRIES.find(opt => opt.value === projectForm.country) || (projectForm.country ? { label: projectForm.country, value: projectForm.country } : null)} 
                    onChange={(newValue) => setProjectForm({ ...projectForm, country: newValue ? newValue.value : '' })} 
                    styles={customSelectStyles} 
                    placeholder="Select country..." 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assign Project Manager *</label>
                <select 
                  required 
                  className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-slate-700 appearance-none cursor-pointer focus:border-blue-400 transition-all" 
                  value={projectForm.projectManager} 
                  onChange={(e) => setProjectForm({...projectForm, projectManager: e.target.value})}
                >
                  <option value="">Select a Manager...</option>
                  {projectManagers.map(pm => (
                    <option key={pm._id} value={pm._id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingProject || (!projectForm.organizationId && !showNewOrgForm)} 
                className={`w-full py-5 text-white font-black rounded-2xl uppercase tracking-widest shadow-lg transition-all ${
                  isSubmittingProject || (!projectForm.organizationId && !showNewOrgForm) 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-[#111C44] hover:bg-[#1a2b63] active:scale-95'
                }`}
              >
                {isSubmittingProject ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Creating Project...</span>
                  </div>
                ) : (
                  "Confirm & Create Project"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* APPROACH MODAL */}
      {isApproachModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative border border-slate-100">
            <button onClick={() => setIsApproachModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            <div className="mb-8"><h2 className="text-2xl font-black text-slate-800">Approach Prospect</h2><p className="text-slate-400 text-sm font-medium mt-1">Record the interaction for {selectedProspect?.companyName}.</p></div>
            <form onSubmit={handleApproachSubmit} className="space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Approach Method</label><div className="grid grid-cols-2 gap-3">{['Email', 'WhatsApp', 'Message', 'LinkedIn','Meeting'].map((method) => (<button key={method} type="button" onClick={() => setApproachData({...approachData, method})} className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all ${approachData.method === method ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>{method}</button>))}</div></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Summary of Discussion</label><textarea required rows="4" className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all resize-none" placeholder="What was discussed?" value={approachData.summary} onChange={(e) => setApproachData({...approachData, summary: e.target.value})} /></div>
              <button type="submit" disabled={submittingApproach} className="w-full p-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 hover:bg-blue-600 disabled:bg-slate-300 flex items-center justify-center gap-2">{submittingApproach ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>}Confirm Approach</button>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULED CALENDAR MODAL */}
      {showScheduledModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl p-6 md:p-8 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowScheduledModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors z-10"><X size={24} /></button>
            <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2"><CalendarDays size={24} className="text-purple-600" /> Scheduled Follow-ups & Feasibility</h2>
            <p className="text-slate-400 text-sm mb-6">View all upcoming scheduled tasks</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Calendar View</h3>
                <Calendar onChange={setSelectedDate} value={selectedDate} tileContent={tileContent} className="rounded-2xl border-0 shadow-sm w-full" nextLabel={<ChevronRight size={18} />} prevLabel={<ChevronLeft size={18} />} />
                <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-slate-500">Follow-up</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="text-slate-500">Feasibility</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Tasks for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                  {getItemsForDate(selectedDate).length === 0 ? (
                    <p className="text-slate-400 text-sm italic text-center py-8">No scheduled tasks for this date.</p>
                  ) : (
                    getItemsForDate(selectedDate).map((item) => (
                      <div key={item.id} className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer hover:shadow-md ${item.isOverdue ? 'bg-red-50 border-red-200' : item.type === 'followup' ? 'bg-orange-50 border-orange-100 hover:border-orange-200' : 'bg-purple-50 border-purple-100 hover:border-purple-200'}`} onClick={() => { setShowScheduledModal(false); setSelectedLead(item.originalLead); setShowActionModal(true); }}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${item.isOverdue ? 'bg-red-200 text-red-700' : item.type === 'followup' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                            {item.type === 'followup' ? <PhoneCall size={12} /> : <FileText size={12} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-800 text-xs">{item.title}</h4>
                              <span className="text-[8px] font-bold text-slate-500">{item.orgName}</span>
                              {item.isOverdue && (
                                <span className="text-[7px] font-black bg-red-500 text-white px-1 py-0.5 rounded-full uppercase tracking-wider">Overdue</span>
                              )}
                            </div>
                            <p className="text-[8px] text-slate-500">{item.type === 'followup' ? 'Follow-up' : 'Feasibility'} • {item.date.toLocaleDateString()}</p>
                            {item.originalLead.lastInteractionDesc && (
                              <p className="text-[7px] text-slate-400 italic mt-0.5 truncate max-w-[150px]">"{item.originalLead.lastInteractionDesc.substring(0, 50)}"</p>
                            )}
                          </div>
                        </div>
                        <button className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"><ExternalLink size={10} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span>All Scheduled Tasks ({allScheduledItems.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                {paginatedScheduledItems.map((item) => (
                  <div key={item.id} className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer hover:shadow-sm ${item.isOverdue ? 'bg-red-50 border-red-200' : item.type === 'followup' ? 'bg-orange-50 border-orange-100' : 'bg-purple-50 border-purple-100'}`} onClick={() => { setShowScheduledModal(false); setSelectedLead(item.originalLead); setShowActionModal(true); }}>
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md ${item.isOverdue ? 'bg-red-200 text-red-700' : item.type === 'followup' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                        {item.type === 'followup' ? <PhoneCall size={10} /> : <FileText size={10} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-[10px]">{item.title}</p>
                        <p className="text-[7px] text-slate-500">{item.orgName} • {item.date.toLocaleDateString()}</p>
                      </div>
                    </div>
                    <ExternalLink size={10} className="text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
              
              {totalScheduledPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button onClick={() => setScheduledCurrentPage(p => Math.max(1, p - 1))} disabled={scheduledCurrentPage === 1} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"><ChevronLeft size={14} /></button>
                  <span className="text-[9px] font-black text-slate-500">Page {scheduledCurrentPage} of {totalScheduledPages}</span>
                  <button onClick={() => setScheduledCurrentPage(p => Math.min(totalScheduledPages, p + 1))} disabled={scheduledCurrentPage === totalScheduledPages} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>  
  );
};

export default SalesDashboard;