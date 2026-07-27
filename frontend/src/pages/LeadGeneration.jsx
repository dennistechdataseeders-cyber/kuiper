import { useLocation } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import {
  Plus,
  X,
  Target,
  Phone,
  User,
  Mail,
  Clock,
  ChevronDown,
  Globe,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Search,
  AlertCircle,
  Users,
  Building2,
  CheckCircle,
  Calendar,
  Upload,
  Loader2,
  Briefcase,
  FileText,
  Send,
  Ban,
  Download,
  Eye,
  ArrowRight,
  FolderKanban
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';

import API_BASE_URL from '../config';

// Helper for formatting Lead IDs
const formatId = (num, prefix = "LEAD") => {
  if (!num) return `${prefix}---`;
  return `${prefix}${String(num).padStart(4, '0')}`;
};

// Helper for generating Feasibility ID
const generateFeasibilityId = (leadNumber) => `FSL${String(leadNumber || 0).padStart(4, '0')}`;

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

// --- SUB-COMPONENT: INDIVIDUAL LEAD CARD ---
const LeadCard = ({ lead, onQuickAction, onFeasibilityClick, onCloseLead, projectManagers = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusStyles = (status) => {
    switch (status) {
      case 'Feasibility':
        return 'bg-white text-purple-600 border-purple-500/20';
      case 'Feasibility Completed':
        return 'bg-green-100 text-green-600 border-green-500/20';
      case 'Follow-up Scheduled':
        return 'bg-orange-100 text-orange-600 border-orange-500/20';
      case 'Closed':
        return 'bg-red-100 text-red-600 border-red-500/20';
      case 'Production Ready':
        return 'bg-emerald-100 text-emerald-600 border-emerald-500/20';
      default:
        return 'bg-blue-100 text-blue-600 border-blue-500/20';
    }
  };

  const isClosed = lead.status === 'Closed' || lead.status === 'Production Ready';
  const hasFeasibilityDate = !!lead.feasibilityDate;

  // Get project ID from lead
  const getProjectId = () => {
    if (lead.projectId) {
      if (typeof lead.projectId === 'object') {
        if (lead.projectId.projectCustomId) return lead.projectId.projectCustomId;
        if (lead.projectId.name) return lead.projectId.name;
        return 'Project Created';
      }
      return lead.projectId;
    }
    
    if (lead.lastInteractionDesc) {
      const tdsMatch = lead.lastInteractionDesc.match(/(TDS\d{4}-[A-Z]{4}\s\|\s[A-Z]{2}\s\|\s[^,\n|]+)/i);
      if (tdsMatch) return tdsMatch[1].trim();
      const prjMatch = lead.lastInteractionDesc.match(/(PRJ\d{4}-[A-Z]{4}\s\|\s[A-Z]{2}\s\|\s[^,\n|]+)/i);
      if (prjMatch) return prjMatch[1].trim();
    }
    return null;
  };

  // Get the PM name from the stored projectManagerId
  const getPMName = () => {
    if (!lead.projectManagerId) return null;
    if (!projectManagers || projectManagers.length === 0) return null;
    
    let leadPmId;
    if (typeof lead.projectManagerId === 'object') {
      leadPmId = lead.projectManagerId.$oid || lead.projectManagerId._id?.toString() || lead.projectManagerId.toString();
    } else {
      leadPmId = String(lead.projectManagerId);
    }
    
    const pm = projectManagers.find(p => {
      let pId;
      if (typeof p._id === 'object') {
        pId = p._id.$oid || p._id._id?.toString() || p._id.toString();
      } else {
        pId = String(p._id);
      }
      return pId === leadPmId;
    });
    
    return pm ? pm.name : null;
  };

  // Get the reason for loss from lastInteractionDesc if it's a Closed status
  const getLossReason = () => {
    if (lead.status === 'Closed' && lead.lastInteractionDesc) {
      let reason = lead.lastInteractionDesc;
      reason = reason.replace(/Project ID:\s*[^|]+\|\s*Project:\s*[^|]+\|\s*PM:\s*[^|]+/i, '').trim();
      reason = reason.replace(/^[\s|]+/, '');
      return reason || lead.lastInteractionDesc;
    }
    return null;
  };

  const projectId = getProjectId();
  const lossReason = getLossReason();
  const pmName = getPMName();

  return (
    <div
      className={`group bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${
        isExpanded
          ? 'border-blue-200 shadow-xl shadow-blue-50 ring-1 ring-blue-50'
          : 'border-slate-100 shadow-sm hover:border-blue-200'
      } ${isClosed ? 'opacity-60' : ''}`}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-3 sm:gap-5">
          <div
            className={`p-3 sm:p-4 rounded-2xl transition-all duration-300 ${
              isExpanded ? 'scale-110 shadow-lg' : ''
            } ${getStatusStyles(lead.status).split(' ')[0]}`}
          >
            <Target
              size={18}
              className={getStatusStyles(lead.status).split(' ')[1]}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">
                {formatId(lead.leadNumber)}
              </span>

              <h3 className="font-black text-slate-800 text-base sm:text-lg group-hover:text-blue-600 transition-colors">
                {lead.pocName}
              </h3>

              <span
                className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg border ${getStatusStyles(
                  lead.status
                )}`}
              >
                {lead.status || 'New'}
              </span>

              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg bg-blue-600 text-white">
                {lead.leadType}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <Mail size={10} className="text-slate-400" />
                {lead.pocEmail}
              </span>

              {lead.status === 'Follow-up Scheduled' &&
                lead.followUpDate && (
                  <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md">
                    <Clock size={10} />
                    {new Date(
                      lead.followUpDate
                    ).toLocaleDateString()}
                  </span>
                )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 justify-end mb-0.5">
              Created On
            </p>

            <p className="text-[10px] font-bold text-slate-500">
              {new Date(lead.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div
            className={`p-1.5 rounded-full transition-transform duration-300 ${
              isExpanded
                ? 'rotate-180 bg-blue-50 text-blue-600'
                : 'text-slate-300'
            }`}
          >
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      <div
        className={`transition-all duration-500 ease-in-out bg-slate-50/50 border-t border-slate-50 overflow-hidden ${
          isExpanded
            ? 'max-h-[700px] opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT */}
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Pipeline Status
            </h4>

            <div className="space-y-2">
              {[
                {
                  label: 'Lead Generated',
                  done: true,
                  color: 'bg-blue-500'
                },
                {
                  label: 'Follow-up Scheduled',
                  done: lead.status !== 'New' && lead.status,
                  color: 'bg-orange-500'
                },
                {
                  label: 'Feasibility',
                  done:
                    lead.status === 'Feasibility' ||
                    lead.status === 'Feasibility Completed' ||
                    lead.status === 'Closed' ||
                    lead.status === 'Production Ready',
                  color: 'bg-purple-500'
                },
                {
                  label: lead.status === 'Production Ready' ? 'Production Ready' : 'Closed Deal',
                  done: lead.status === 'Closed' || lead.status === 'Production Ready',
                  color: lead.status === 'Production Ready' ? 'bg-emerald-500' : 'bg-red-500'
                }
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      step.done
                        ? step.color
                        : 'bg-slate-200'
                    }`}
                  />

                  <span
                    className={`text-[11px] font-bold ${
                      step.done
                        ? 'text-slate-700'
                        : 'text-slate-300'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* QUICK ACTION BUTTONS - HORIZONTAL */}
            {!isClosed && (
              <div className="mt-4 flex flex-row gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAction(lead._id, 'Follow-up Scheduled');
                  }}
                  disabled={hasFeasibilityDate}
                  className={`flex-1 text-[8px] font-black uppercase tracking-wider py-2 rounded-xl transition-all active:scale-95 ${
                    hasFeasibilityDate
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-100'
                  }`}
                >
                  <span className="block">Take Action</span>
                  <span className="text-[6px] font-bold opacity-80">Set Follow-up</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFeasibilityClick(lead);
                  }}
                  disabled={hasFeasibilityDate}
                  className={`flex-1 text-[8px] font-black uppercase tracking-wider py-2 rounded-xl transition-all active:scale-95 ${
                    hasFeasibilityDate
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-100'
                  }`}
                >
                  <span className="block">Feasibility</span>
                  <span className="text-[6px] font-bold opacity-80">Send Request</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseLead(lead);
                  }}
                  className="flex-1 text-[8px] font-black uppercase tracking-wider py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-100 active:scale-95 transition-all"
                >
                  <span className="block">Close Lead</span>
                  <span className="text-[6px] font-bold opacity-80">Won or Lost</span>
                </button>
              </div>
            )}

            {/* CLOSED STATUS DISPLAY */}
            {isClosed && (
              <div className="mt-4 space-y-2">
                <div className={`w-full text-center text-[9px] font-black uppercase tracking-wider py-2 rounded-xl ${
                  lead.status === 'Production Ready'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                  {lead.status === 'Production Ready' ? '✅ Production Ready' : '❌ Closed'}
                </div>
                
                {lead.status === 'Production Ready' && projectId && (
                  <div className="w-full text-center text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 py-1.5 rounded-xl px-3 break-words">
                    📁 {projectId}
                  </div>
                )}
                
                {lead.status === 'Production Ready' && pmName && (
                  <div className="w-full text-center text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200 py-1.5 rounded-xl px-3">
                    👤 PM: {pmName}
                  </div>
                )}
                
                {lead.status === 'Closed' && lossReason && (
                  <div className="w-full text-center text-[8px] font-bold text-red-700 bg-red-50 border border-red-200 py-1.5 rounded-xl px-3 break-words">
                    💬 Reason: {lossReason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CENTER */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Important Dates
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Feasibility Date
                  </span>

                  <p className="text-[11px] font-black text-purple-600">
                    {lead.feasibilityDate
                      ? new Date(
                          lead.feasibilityDate
                        ).toLocaleDateString()
                      : 'Not Set'}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Follow-up Date
                  </span>

                  <p className="text-[11px] font-black text-orange-600">
                    {lead.followUpDate
                      ? new Date(
                          lead.followUpDate
                        ).toLocaleDateString()
                      : 'Not Set'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                Organization Ref
              </h4>

              <p className="text-[11px] font-bold text-slate-600 truncate">
                {lead.organizationId?.companyName || 'N/A'}
              </p>
            </div>
          </div>

          {/* RIGHT - PROJECT INFO */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Lead Classification
            </h4>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-slate-400" />
                <p className="text-[11px] font-bold text-slate-600">
                  {lead.leadType}
                </p>
              </div>

              {lead.referredBy && (
                <div className="flex items-center gap-2">
                  <UserPlus size={12} className="text-blue-500" />
                  <p className="text-[11px] font-bold text-blue-600">
                    Ref: {lead.referredBy}
                  </p>
                </div>
              )}

              {lead.status === 'Production Ready' && projectId && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <Briefcase size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-emerald-700 break-words">
                      {projectId}
                    </p>
                  </div>
                </div>
              )}

              {lead.status === 'Production Ready' && pmName && (
                <div className="flex items-start gap-2">
                  <User size={12} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-blue-700 break-words">
                    PM: {pmName}
                  </p>
                </div>
              )}

              {lead.status === 'Closed' && lossReason && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] font-medium text-red-600 break-words">
                      {lossReason}
                    </p>
                  </div>
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
  const [selectedOrgDetails, setSelectedOrgDetails] = useState(null);
  const [availablePOCs, setAvailablePOCs] = useState([]);
  const [selectedPOCIndex, setSelectedPOCIndex] = useState(null);

  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef(null);

  const [filterStatus, setFilterStatus] = useState('Follow-up Scheduled');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedLeadForClose, setSelectedLeadForClose] = useState(null);
  const [closingData, setClosingData] = useState({ reason: 'won', description: '' });
  const [isClosing, setIsClosing] = useState(false);

  const [showProductionForm, setShowProductionForm] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  // ✅ FIX: Set ALL fields to EMPTY strings
  const [productionForm, setProductionForm] = useState({
    name: '',
    projectManager: '',
    description: '',
    country: '',
    industry: '',
  });

  // Attachment state for Production Ready form
  const [productionAttachment, setProductionAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const itemsPerPage = 10;

  const statuses = [
    'All',
    'Follow-up Scheduled',
    'Feasibility',
    'Production Ready',
    'Closed'
  ];

  const prospectData = location.state?.prospect;
  const isAlreadyConverted = !!prospectData?.leadId;

  const [formData, setFormData] = useState({
    leadType: 'Inbound',
    organizationId: '',
    pocId: '',
    pocName: '',
    pocPhone: '',
    pocEmail: '',
    pocLinkedin: '',
    referredBy: ''
  });
  
  const { isCollapsed } = useSidebar();

  const [showFeasibilityModal, setShowFeasibilityModal] = useState(false);
  const [selectedLeadForFeasibility, setSelectedLeadForFeasibility] = useState(null);
  const [feasibilityData, setFeasibilityData] = useState({
    feasibilityId: '',
    taskDetails: '',
    attachment: null,
    feasibilityDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [feasibilityPM, setFeasibilityPM] = useState('');
  const [projectManagersList, setProjectManagersList] = useState([]);
  const [loadingPMs, setLoadingPMs] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const sortedOrgs = [...orgs].sort((a, b) => {
    const nameA = (a.companyName || a.name || '').toLowerCase();
    const nameB = (b.companyName || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const filteredOrgs = sortedOrgs.filter(org => {
    const search = orgSearchTerm.toLowerCase().trim();
    if (!search) return true;
    const companyName = (org.companyName || org.name || '').toLowerCase();
    return companyName.includes(search);
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [orgRes, leadRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/orgs`, { headers }),
        axios.get(`${API_BASE_URL}/api/lead-generation`, { headers })
      ]);

      const rawOrgs = orgRes.data?.organizations || orgRes.data?.data || orgRes.data || [];
      setOrgs(Array.isArray(rawOrgs) ? rawOrgs : []);

      const rawLeads = leadRes.data?.leads || leadRes.data?.data || leadRes.data || [];
      setGeneratedLeads(Array.isArray(rawLeads) ? rawLeads : []);
    } catch (err) {
      console.error("Error fetching data", err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchProjectManagers();
  }, []);

  useEffect(() => {
    if (prospectData) {
      setIsModalOpen(true);
      const orgId = prospectData.organizationId?._id || prospectData.organizationId || '';
      setFormData((prev) => ({
        ...prev,
        organizationId: orgId,
        pocName: prospectData.pocName || '',
        pocPhone: prospectData.pocPhone || '',
        pocEmail: prospectData.pocEmail || '',
        pocLinkedin: prospectData.linkedin || ''
      }));
      if (orgId) fetchOrganizationDetails(orgId);
    }
  }, [prospectData]);

  const fetchOrganizationDetails = async (orgId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/orgs/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orgData = response.data.data || response.data;
      setSelectedOrgDetails(orgData);
      
      const pocs = [];
      if (orgData.pointsOfContact && Array.isArray(orgData.pointsOfContact) && orgData.pointsOfContact.length > 0) {
        orgData.pointsOfContact.forEach((poc, index) => {
          pocs.push({
            id: poc._id || `poc_${index}`,
            name: poc.pocName,
            email: poc.pocEmail,
            phone: poc.pocPhone,
            linkedin: poc.linkedin,
            isPrimary: poc.isPrimary || false,
            department: poc.department || 'Other'
          });
        });
      } else if (orgData.pocName) {
        pocs.push({
          id: 'main',
          name: orgData.pocName,
          email: orgData.pocEmail,
          phone: orgData.pocPhone,
          linkedin: orgData.linkedin,
          isPrimary: true,
          department: 'Primary Contact'
        });
      }
      setAvailablePOCs(pocs);
      if (pocs.length > 0 && !formData.pocName) handlePOCSelect(pocs[0]);
    } catch (err) {
      console.error("Error fetching organization details:", err);
      setAvailablePOCs([]);
      toast.error("Failed to load organization details");
    }
  };

  const handlePOCSelect = (poc) => {
    setSelectedPOCIndex(poc.id);
    setFormData(prev => ({
      ...prev,
      pocId: poc.id,
      pocName: poc.name,
      pocPhone: poc.phone || '',
      pocEmail: poc.email || '',
      pocLinkedin: poc.linkedin || ''
    }));
  };

  const handleOrgSelect = async (orgId) => {
    const selectedOrg = orgs.find((o) => o._id === orgId);
    if (selectedOrg) {
      const orgName = selectedOrg.companyName || selectedOrg.name || '';
      setOrgSearchTerm(orgName);
      setFormData((prev) => ({
        ...prev,
        organizationId: orgId,
        pocId: '',
        pocName: '',
        pocPhone: '',
        pocEmail: '',
        pocLinkedin: ''
      }));
      setSelectedPOCIndex(null);
      setAvailablePOCs([]);
      setIsOrgDropdownOpen(false);
      await fetchOrganizationDetails(orgId);
    }
  };

  const handleClearOrg = () => {
    setOrgSearchTerm('');
    setFormData((prev) => ({
      ...prev,
      organizationId: '',
      pocId: '',
      pocName: '',
      pocPhone: '',
      pocEmail: '',
      pocLinkedin: ''
    }));
    setSelectedPOCIndex(null);
    setAvailablePOCs([]);
    setSelectedOrgDetails(null);
    setIsOrgDropdownOpen(false);
  };

  // ✅ FIX: Open close modal with EMPTY production form
  const openCloseLeadModal = (lead) => {
    setSelectedLeadForClose(lead);
    setClosingData({ reason: 'won', description: '' });
    setShowCloseModal(true);
    setShowProductionForm(false);
    setProductionAttachment(null);
    // ✅ ALL FIELDS EMPTY
    setProductionForm({
      name: '',
      projectManager: '',
      description: '',
      country: '',
      industry: '',
    });
  };

  // frontend/src/pages/LeadGeneration.jsx - Updated handleProductionSubmit

   // frontend/src/pages/LeadGeneration.jsx - handleProductionSubmit

const handleProductionSubmit = async (e) => {
  e.preventDefault();
  
  // Validate required fields
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
    
    // Upload attachment if exists
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
        console.log('📎 Attachment uploaded:', attachmentUrl);
      }
    }

    // ✅ Send the attachment info to the backend
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
    
    console.log('📦 Production Ready Payload:', payload);
    
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
    
    fetchData();
    
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
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      toast.success('Lead marked as Closed');
      setShowCloseModal(false);
      setSelectedLeadForClose(null);
      setClosingData({ reason: 'won', description: '' });
      fetchData();
    } catch (err) {
      console.error("Close Lead Error:", err);
      toast.error(err.response?.data?.error || "Failed to close lead");
    } finally {
      setIsClosing(false);
    }
  };

  const openFeasibilityModal = (lead) => {
    if (lead.feasibilityDate) {
      toast.info("This lead already has a feasibility date set.");
      return;
    }
    setSelectedLeadForFeasibility(lead);
    setFeasibilityData({
      feasibilityId: generateFeasibilityId(lead.leadNumber),
      taskDetails: '',
      attachment: null,
      feasibilityDate: new Date().toISOString().split('T')[0],
      nextFollowUpDate: ''
    });
    setFeasibilityPM('');
    setShowFeasibilityModal(true);
    setIsUploading(false);
    setShowSuccess(false);
  };

  const closeFeasibilityModal = () => {
    setShowFeasibilityModal(false);
    setSelectedLeadForFeasibility(null);
    setFeasibilityData({
      feasibilityId: '',
      taskDetails: '',
      attachment: null,
      feasibilityDate: new Date().toISOString().split('T')[0],
      nextFollowUpDate: ''
    });
    setFeasibilityPM('');
    setIsUploading(false);
    setShowSuccess(false);
  };

  const handleFeasibilitySubmit = async (e) => {
    e.preventDefault();
    if (!feasibilityPM) {
      toast.error("Please select a Project Manager");
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
      formData.append('followUpDate', safeFollowUpDate || safeFeasibilityDate);
      formData.append('projectManagerId', feasibilityPM);
      if (feasibilityData.attachment) {
        formData.append('file', feasibilityData.attachment);
      }

      await axios.patch(`${API_BASE_URL}/api/lead-generation/${selectedLeadForFeasibility._id}/action`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      setIsUploading(false);
      setShowSuccess(true);
      setTimeout(() => { 
        setShowSuccess(false); 
        fetchData(); 
        closeFeasibilityModal(); 
      }, 2500);
    } catch (err) {
      setIsUploading(false);
      console.error("Submission Error:", err);
      toast.error(err.response?.data?.error || "Feasibility submission failed");
    }
  };

  const handleQuickAction = async (leadId, actionType) => {
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString();
      let payload = {};
      if (actionType === 'Follow-up Scheduled') {
        payload = { status: 'Follow-up Scheduled', followUpDate: today };
      }
      await axios.patch(`${API_BASE_URL}/api/lead-generation/${leadId}/action`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      toast.success("Lead updated successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to update lead');
    }
  };

  const filteredLeads = generatedLeads.filter((lead) => {
    const matchesStatus = filterStatus === 'All' ? true : lead.status === filterStatus;
    const formattedId = formatId(lead.leadNumber).toLowerCase();
    const pocName = lead.pocName?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return matchesStatus && (pocName.includes(search) || formattedId.includes(search));
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAlreadyConverted) {
      toast.error("This prospect already has a lead generated.");
      return;
    }
    if (!formData.organizationId) {
      toast.error("Please select an Organization first.");
      return;
    }
    if (!formData.pocName) {
      toast.error("Please select a Point of Contact.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const prospectId = prospectData?._id || window.history.state?.usr?.prospect?._id;
      const finalData = {
        leadType: formData.leadType,
        organizationId: formData.organizationId,
        pocName: formData.pocName,
        pocPhone: formData.pocPhone,
        pocEmail: formData.pocEmail,
        linkedin: formData.pocLinkedin,
        referredBy: formData.leadType === 'Reference' ? formData.referredBy : '',
        prospectId: prospectId || null
      };

      await axios.post(`${API_BASE_URL}/api/lead-generation`, finalData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      toast.success("Lead Generated Successfully!");
      setIsModalOpen(false);
      setFormData({
        leadType: 'Inbound',
        organizationId: '',
        pocId: '',
        pocName: '',
        pocPhone: '',
        pocEmail: '',
        pocLinkedin: '',
        referredBy: ''
      });
      setSelectedPOCIndex(null);
      setAvailablePOCs([]);
      setSelectedOrgDetails(null);
      setOrgSearchTerm('');
      setIsOrgDropdownOpen(false);
      fetchData();
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Submission failed";
      toast.error(`Failed to create lead: ${errorMessage}`);
    }
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Lead Generation
          </h1>
          <p className="text-slate-500 font-medium">
            Manage your active opportunities
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        >
          <Plus size={20} strokeWidth={3} />
          New Lead
        </button>
      </div>

      {/* SEARCH */}
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
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Dropdown - Fixed positioning */}
        <div className="relative z-50">
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-700 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm min-w-[160px] justify-between"
          >
            <span className="flex items-center gap-2">
              <Filter size={14} />
              {filterStatus === 'All' ? 'All Status' : filterStatus}
            </span>
            <ChevronDown 
              size={14} 
              className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          
          {isFilterDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl z-[100] overflow-hidden">
              {statuses.map((status, index) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setIsFilterDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-50 flex items-center justify-between ${
                    filterStatus === status
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600'
                  } ${index !== statuses.length - 1 ? 'border-b border-slate-50' : ''}`}
                >
                  {status === 'All' ? 'All Status' : status}
                  {filterStatus === status && (
                    <CheckCircle size={14} className="text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LEADS */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold">Loading leads...</p>
          </div>
        ) : currentLeads.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 border border-slate-100 text-center shadow-sm">
            <Target size={40} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-xl font-black text-slate-800 mb-2">
              No leads found
            </h3>
            <p className="text-slate-400 font-medium">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {currentLeads.map((lead) => (
                <LeadCard
                  key={lead._id}
                  lead={lead}
                  onQuickAction={handleQuickAction}
                  onFeasibilityClick={openFeasibilityModal}
                  onCloseLead={openCloseLeadModal}
                  projectManagers={projectManagers}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm mt-10">
                <div className="text-xs font-bold text-slate-400 ml-4">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length} Leads
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
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
                    onClick={() => setCurrentPage((p) => p + 1)}
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

      {/* CREATE LEAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 relative animate-in fade-in zoom-in duration-300 max-h-[95vh] overflow-y-auto border border-slate-100">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full"
            >
              <X size={24} />
            </button>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-800 mb-1">
                Create New Lead
              </h2>
              <p className="text-slate-400 text-sm font-medium">
                Verify organization details before generating.
              </p>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Lead Source
                  </label>
                  <select
                    disabled={isAlreadyConverted}
                    className={`w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold ${
                      isAlreadyConverted
                        ? 'bg-slate-100 border-transparent text-slate-400'
                        : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white text-slate-700'
                    }`}
                    value={formData.leadType}
                    onChange={(e) => setFormData({ ...formData, leadType: e.target.value })}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-2">
                      Ref By:
                    </label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                      <input
                        required
                        disabled={isAlreadyConverted}
                        placeholder="Who referred this lead?"
                        className="w-full p-4 pl-12 bg-blue-50/50 rounded-2xl border-2 border-blue-100 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                        value={formData.referredBy}
                        onChange={(e) => setFormData({ ...formData, referredBy: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2" ref={orgDropdownRef}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 flex items-center gap-2">
                    <Building2 size={14} />
                    Select Organization *
                  </label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      disabled={isAlreadyConverted}
                      placeholder="Search for an organization..."
                      className={`w-full p-4 pl-12 pr-24 rounded-2xl border-2 transition-all outline-none font-bold ${
                        isAlreadyConverted
                          ? 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed'
                          : formData.organizationId
                          ? 'bg-emerald-50 border-emerald-300 text-slate-700'
                          : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white text-slate-700'
                      }`}
                      value={orgSearchTerm}
                      onChange={(e) => {
                        setOrgSearchTerm(e.target.value);
                        setIsOrgDropdownOpen(true);
                        if (formData.organizationId) {
                          setFormData(prev => ({ ...prev, organizationId: '', pocId: '', pocName: '', pocPhone: '', pocEmail: '', pocLinkedin: '' }));
                          setSelectedPOCIndex(null);
                          setAvailablePOCs([]);
                          setSelectedOrgDetails(null);
                        }
                      }}
                      onFocus={() => setIsOrgDropdownOpen(true)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {formData.organizationId && (
                        <button
                          type="button"
                          onClick={handleClearOrg}
                          className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                          title="Clear selection"
                        >
                          <X size={14} className="text-slate-400 hover:text-slate-600" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <ChevronDown 
                          size={16} 
                          className={`text-slate-400 transition-transform duration-200 ${
                            isOrgDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {formData.organizationId && (
                        <CheckCircle size={16} className="text-emerald-500 ml-1" />
                      )}
                    </div>
                  </div>

                  {isOrgDropdownOpen && !isAlreadyConverted && (
                    <div className="absolute z-50 w-full max-w-[calc(100%-2rem)] bg-white rounded-2xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto mt-1 animate-in slide-in-from-top-2 duration-200">
                      {filteredOrgs.length === 0 ? (
                        <div className="p-6 text-center">
                          <Building2 size={24} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-500">No organizations found</p>
                          <p className="text-[10px] text-slate-400 mt-1">Try a different search term</p>
                        </div>
                      ) : (
                        filteredOrgs.map((org) => (
                          <div
                            key={org._id}
                            onClick={() => handleOrgSelect(org._id)}
                            className={`flex items-center justify-between p-4 cursor-pointer transition-all hover:bg-blue-50 border-b border-slate-50 last:border-0 ${
                              formData.organizationId === org._id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-800 text-sm">
                                {org.companyName || org.name || 'Unnamed Organization'}
                              </p>
                              {org.website && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Globe size={10} />
                                  {org.website}
                                </p>
                              )}
                              {org.pocName && (
                                <p className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Users size={8} />
                                  Contact: {org.pocName}
                                </p>
                              )}
                            </div>
                            {formData.organizationId === org._id && (
                              <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <Users size={14} />
                  Point of Contact Selection
                </h4>

                {availablePOCs.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        Select POC
                      </label>
                      <select
                        required
                        disabled={isAlreadyConverted}
                        className="w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold bg-white border-transparent focus:border-blue-500 text-slate-700"
                        value={selectedPOCIndex || ''}
                        onChange={(e) => {
                          const selectedPoc = availablePOCs.find(p => p.id === e.target.value);
                          if (selectedPoc) handlePOCSelect(selectedPoc);
                        }}
                      >
                        <option value="">Select a Point of Contact...</option>
                        {availablePOCs.map((poc) => (
                          <option key={poc.id} value={poc.id}>
                            {poc.name} {poc.isPrimary ? "(Primary)" : ""} - {poc.department}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.pocName && (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            Selected Contact Details
                          </span>
                          {selectedOrgDetails && (
                            <span className="text-[8px] font-bold text-slate-400">
                              {selectedOrgDetails.companyName}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                            <Target size={14} className="text-blue-500" />
                            <div className="flex-1">
                              <p className="text-[9px] font-bold text-slate-400">Name</p>
                              <p className="text-sm font-bold text-slate-700">{formData.pocName}</p>
                            </div>
                          </div>
                          {formData.pocEmail && (
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                              <Mail size={14} className="text-emerald-500" />
                              <div className="flex-1">
                                <p className="text-[9px] font-bold text-slate-400">Email</p>
                                <p className="text-sm font-bold text-slate-700">{formData.pocEmail}</p>
                              </div>
                            </div>
                          )}
                          {formData.pocPhone && (
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                              <Phone size={14} className="text-purple-500" />
                              <div className="flex-1">
                                <p className="text-[9px] font-bold text-slate-400">Phone</p>
                                <p className="text-sm font-bold text-slate-700">{formData.pocPhone}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : formData.organizationId ? (
                  <div className="text-center py-6 text-slate-400">
                    <Users size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No POCs found for this organization.</p>
                    <p className="text-[10px] mt-1">Please add POCs to the organization first.</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <Building2 size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">Select an organization to view POCs.</p>
                  </div>
                )}
              </div>

              <button
                disabled={isAlreadyConverted || !formData.pocName || !formData.organizationId}
                className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                  isAlreadyConverted || !formData.pocName || !formData.organizationId
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                }`}
              >
                {isAlreadyConverted
                  ? "Lead Already Generated"
                  : !formData.organizationId
                  ? "Select an Organization First"
                  : !formData.pocName
                  ? "Select a POC to Continue"
                  : "Generate Lead Now"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FEASIBILITY MODAL */}
      {showFeasibilityModal && selectedLeadForFeasibility && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in duration-300 overflow-hidden">
            {showSuccess && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in fade-in">
                <div className="p-6 bg-green-100 text-green-600 rounded-full mb-6">
                  <CheckCircle size={60} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase">Feasibility Sent</h2>
                <p className="text-slate-500 text-sm mt-2">Feasibility request has been submitted successfully.</p>
              </div>
            )}
            
            <button onClick={closeFeasibilityModal} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors">
              <X size={24}/>
            </button>
            
            <h2 className="text-3xl font-black text-slate-900 mb-2">Feasibility Request</h2>
            <p className="text-slate-400 mb-6 font-medium italic">
              Client: <span className="text-purple-600 font-bold">{selectedLeadForFeasibility?.pocName}</span>
            </p>
            
            <form onSubmit={handleFeasibilitySubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Feasibility ID
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    className="w-full p-4 bg-purple-50 border border-purple-100 rounded-2xl font-black text-purple-700 outline-none" 
                    value={feasibilityData.feasibilityId} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Feasibility Date
                  </label>
                  <input 
                    type="date" 
                    readOnly 
                    className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed" 
                    value={feasibilityData.feasibilityDate} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Next Follow-up Date
                  </label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-purple-400 transition-colors" 
                    value={feasibilityData.nextFollowUpDate || ''} 
                    min={new Date().toISOString().split('T')[0]} 
                    onChange={(e) => setFeasibilityData({...feasibilityData, nextFollowUpDate: e.target.value})} 
                  />
                  <p className="text-[8px] text-slate-400 mt-1 italic">* This task will reappear on this date</p>
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block flex items-center gap-2">
                    <Briefcase size={14} className="text-purple-600" />
                    Assign Project Manager
                  </label>
                  <select
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-purple-400 transition-colors cursor-pointer"
                    value={feasibilityPM}
                    onChange={(e) => setFeasibilityPM(e.target.value)}
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
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                  Task Details
                </label>
                <textarea 
                  required 
                  placeholder="Requirement details..." 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none h-20 md:h-24 resize-none focus:border-purple-400 transition-colors" 
                  value={feasibilityData.taskDetails} 
                  onChange={(e) => setFeasibilityData({...feasibilityData, taskDetails: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                  Attachment (PDF, Word, Excel, Images, ZIP)
                </label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    onChange={(e) => setFeasibilityData({...feasibilityData, attachment: e.target.files[0]})} 
                  />
                  <div className="w-full p-4 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 group-hover:border-purple-400 transition-colors bg-slate-50">
                    <Upload size={24} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 truncate w-full px-4 text-center">
                      {feasibilityData.attachment ? feasibilityData.attachment.name : "Click to upload files (Max 20MB)"}
                    </span>
                    {feasibilityData.attachment && (
                      <span className="text-[8px] text-green-600">
                        {(feasibilityData.attachment.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={closeFeasibilityModal} 
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
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
                    <>Select PM First</>
                  ) : (
                    <><Send size={16} /> Submit Feasibility</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE LEAD MODAL WITH ATTACHMENT UPLOAD - EMPTY FORM */}
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
              // Production Ready Form - ALL FIELDS EMPTY
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
                    Description (Optional)
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

export default LeadGeneration;