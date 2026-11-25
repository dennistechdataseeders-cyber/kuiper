// frontend/src/pages/ProjectManagement.jsx - ADD MULTIPLE FEEDS VIA EXCEL

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  FolderPlus,
  Activity,
  X,
  Plus,
  Hash,
  Edit3,
  Settings2,
  Globe,
  Briefcase,
  Send,
  ShoppingBag,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Users,
  UserPlus,
  Trash2,
  AlertCircle,
  GitFork,
  RefreshCw,
  Circle,
  PauseCircle,
  CheckCircle2,
  Clock,
  Building2,
  Filter,
  MessageSquare,
  Upload,
  FileSpreadsheet,
  Loader2,
  GitBranch
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import { isPMRole } from '../utils/roles';

import { isProjectManagerOf, projectTeamLeads, canEditProjectTeam } from '../utils/projectAccess';
import ProjectTeamModal from '../components/ProjectTeamModal';
import useIsMobile from '../utils/useIsMobile';
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

const ProjectManagement = () => {
  const navigate = useNavigate();
  
  // --- Data State ---
  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [coordinators, setCoordinators] = useState([]); // who can be a project coordinator (PCs and PMs)
  const [teamLeads, setTeamLeads] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const isMobile = useIsMobile();

  // --- Loading States ---
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [isSubmittingFeed, setIsSubmittingFeed] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  // --- Filter State ---
  const [statusFilter, setStatusFilter] = useState('Active');
  const [searchTerm, setSearchTerm] = useState('');

  // --- UI State ---
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    companyName: '',
    website: '',
    address: ''
  });

  // --- Bulk Feed Import State ---
  const [showBulkFeedModal, setShowBulkFeedModal] = useState(false);
  const [bulkFeedFile, setBulkFeedFile] = useState(null);
  const [bulkFeedPreview, setBulkFeedPreview] = useState([]);
  const [bulkFeedUploading, setBulkFeedUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeFeed, setActiveFeed] = useState(null);
  const [activeFeedId, setActiveFeedId] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingFeed, setIsEditingFeed] = useState(false);

  // --- Comment Modal State ---
  const [showProjectCommentModal, setShowProjectCommentModal] = useState(false);
  const [teamModalProject, setTeamModalProject] = useState(null); // Project Settings (PM, coordinators, team leads)
  const [selectedProjectForComments, setSelectedProjectForComments] = useState(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);

  // --- Organization Selection State ---
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const orgDropdownRef = React.useRef(null);

  // --- Developer Selection State ---
  const [developerSearchTerm, setDeveloperSearchTerm] = useState('');
  const [isDeveloperDropdownOpen, setIsDeveloperDropdownOpen] = useState(false);
  const developerDropdownRef = React.useRef(null);

  // --- Status Options State ---
  const [projectStatuses, setProjectStatuses] = useState([]);
  const [feedStatuses, setFeedStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState({});

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('role') || 'User';

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  // --- Forms ---
  const [projectForm, setProjectForm] = useState({
    name: '',
    projectManager: '',
    description: '',
    country: 'United States',
    industry: 'Tech',
    organizations: []
  });

  const [feedForm, setFeedForm] = useState({
    name: '',
    assignedDevelopers: [],
    feedType: 'Daily',
    weekDay: '',
    monthDay: '',
    feedPlatform: '',
    webDomain: '',
    feedStatus: 'New'
  });

  const [taskText, setTaskText] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // --- Status Helper Functions ---
  const getProjectStatusColor = (status) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Once off': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Automation': return 'bg-teal-100 text-teal-700 border-teal-200';  
      case 'Ad hoc': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'BAU Initiated': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'BAU Not Initiated': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'ON hold[Sales]': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ON hold[Technical]': return 'bg-red-100 text-red-700 border-red-200';
      case 'ON hold[Client]': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Closed': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const isOnHoldStatus = (status) => {
    return status && status.includes('ON hold');
  };

  // --- Git Activity helpers (reads stored feed.gitLastUpdated, refreshed weekly by the server) ---
  const getProjectGitActivity = (project) => {
    let latest = null;
    (project.feeds || []).forEach((feed) => {
      if (!feed || typeof feed !== 'object' || !feed.gitLastUpdated) return;
      const time = new Date(feed.gitLastUpdated).getTime();
      if (!Number.isNaN(time) && (!latest || time > latest.time)) {
        latest = { time, feedName: feed.name };
      }
    });
    return latest;
  };

  const getGitFreshness = (time) => {
    const days = (Date.now() - time) / 86400000;
    if (days <= 7) {
      return { label: 'Active', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    }
    if (days <= 30) {
      return { label: 'Slowing', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    return { label: 'Stale', chip: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
  };

  const getTimeAgo = (time) => {
    const diffMins = Math.floor((Date.now() - time) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  // Navigate to Feed Explorer with selected project filter
  const navigateToFeedExplorer = (project) => {
    navigate('/pm/feeds', { state: { selectedProjectId: project._id, selectedProjectName: project.projectCustomId } });
  };

  // Fetch status options
  const fetchStatusOptions = async () => {
    try {
      const [projectRes, feedRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/project-status-options`, authHeader),
        axios.get(`${ADMIN_BASE}/feed-status-options`, authHeader)
      ]);
      setProjectStatuses(projectRes.data);
      setFeedStatuses(feedRes.data);
    } catch (err) {
      console.error('Error fetching status options:', err);
    }
  };

  // Update project status
  const updateProjectStatus = async (projectId, newStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [projectId]: true }));
    try {
      await axios.patch(`${ADMIN_BASE}/projects/${projectId}/status`, 
        { projectStatus: newStatus },
        authHeader
      );
      toast.success(`Project status updated to ${newStatus}`);
      fetchInitialData();
    } catch (err) {
      console.error('Error updating project status:', err);
      toast.error(err.response?.data?.error || 'Failed to update project status');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [projectId]: false }));
    }
  };


  const fetchOrganizations = async () => {
    try {
      const res = await axios.get(`${ADMIN_BASE}/organizations`, authHeader);
      setOrganizations(res.data);
    } catch (err) {
      console.error("Error fetching organizations:", err);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrganizations(res.data);
      } catch (fallbackErr) {
        console.error("Fallback error fetching organizations:", fallbackErr);
        setOrganizations([]);
        toast.warning("Unable to load organizations. You can still create projects by selecting existing clients or creating new organizations.", {
          duration: 5000
        });
      }
    }
  };

  // Create new organization
  const createNewOrganization = async () => {
    if (!newOrgData.companyName.trim()) {
      toast.error("Organization name is required");
      return null;
    }

    setIsCreatingOrg(true);
    try {
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
    } finally {
      setIsCreatingOrg(false);
    }
  };

  // Filter organizations based on search term
  const filteredOrganizations = useMemo(() => {
    if (!orgSearchTerm.trim()) return organizations;
    const search = orgSearchTerm.toLowerCase();
    return organizations.filter(org => 
      org.companyName?.toLowerCase().includes(search) ||
      org.website?.toLowerCase().includes(search)
    );
  }, [organizations, orgSearchTerm]);

  // Toggle organization selection
  const toggleOrgSelection = (orgId) => {
    setProjectForm(prev => {
      const isSelected = prev.organizations.includes(orgId);
      return {
        ...prev,
        organizations: isSelected 
          ? prev.organizations.filter(id => id !== orgId)
          : [...prev.organizations, orgId]
      };
    });
  };

  // Remove organization from selection
  const removeOrg = (orgId) => {
    setProjectForm(prev => ({
      ...prev,
      organizations: prev.organizations.filter(id => id !== orgId)
    }));
  };

  // Close organization dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close developer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (developerDropdownRef.current && !developerDropdownRef.current.contains(event.target)) {
        setIsDeveloperDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchInitialData();
    fetchOrganizations();
    fetchStatusOptions();
  }, []);

  const fetchInitialData = async () => {
    try {
      const userRole = localStorage.getItem('role');
      let endpoint = `${ADMIN_BASE}/projects`;
      
      const [projRes, devRes, pmRes, pcRes, tlRes] = await Promise.all([
        axios.get(endpoint, authHeader),
        axios.get(`${ADMIN_BASE}/users/developers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/project-managers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/project-coordinators`, authHeader),
        axios.get(`${ADMIN_BASE}/users/teamleads`, authHeader)
      ]);

      let projectsData = projRes.data;
      
      if (isPMRole(userRole)) {
        projectsData = projRes.data;
      }
      
      setProjects(projectsData);
      setDevelopers(devRes.data);
      setProjectManagers(pmRes.data);
      setCoordinators(pcRes.data);
      setTeamLeads(tlRes.data);

    } catch (err) {
      console.error("Data fetch failed:", err);
      toast.error("Failed to load data");
    }
  };

  // Filter developers based on search term
  const filteredDevelopers = useMemo(() => {
    if (!developerSearchTerm.trim()) return developers;
    const search = developerSearchTerm.toLowerCase();
    return developers.filter(dev => 
      dev.name?.toLowerCase().includes(search) ||
      dev.email?.toLowerCase().includes(search)
    );
  }, [developers, developerSearchTerm]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    const userRole = localStorage.getItem('role');
    
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      result = result.filter(
        (p) => isProjectManagerOf(p, currentUserId)
      );
    }

    if (statusFilter === 'Active') {
      result = result.filter(p => p.projectStatus !== 'Closed');
    } else if (statusFilter === 'Inactive') {
      result = result.filter(p => p.projectStatus === 'Closed');
    } else if (statusFilter === 'On Hold') {
      result = result.filter(p => isOnHoldStatus(p.projectStatus));
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();

      result = result.filter((project) => {
        const orgNames = (project.organizations || []).map(org => {
          if (typeof org === 'object') return org?.companyName || '';
          const orgObj = organizations.find(o => o._id === org);
          return orgObj?.companyName || '';
        }).join(' ') || '';
        
        const searchableFields = [
          project.projectCustomId,
          project.name,
          project.industry,
          project.country,
          project.projectManager?.name,
          orgNames
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableFields.includes(search);
      });
    }

    result.sort((a, b) => {
      const aId = a.projectCustomId || '';
      const bId = b.projectCustomId || '';

      return aId.localeCompare(bId, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return result;
  }, [
    projects,
    organizations,
    statusFilter,
    currentUserId,
    searchTerm
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, itemsPerPage]);

  const indexOfLastProject = currentPage * itemsPerPage;
  const indexOfFirstProject = indexOfLastProject - itemsPerPage;
  const currentProjectSlice = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  // --- Quick Link GitHub Handler (for existing developers without GitHub) ---
  const handleQuickLinkGitHub = async (developer, e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(
        `${ADMIN_BASE}/users/${developer._id}/link-github`,
        {},
        authHeader
      );
      
      if (res.data.success) {
        toast.success(`GitHub account ${res.data.githubUsername} linked for ${developer.name}!`);
        fetchInitialData();
      } else {
        toast.error(res.data.error || 'Failed to link GitHub account');
      }
    } catch (err) {
      console.error('GitHub linking error:', err);
      toast.error(err.response?.data?.error || 'Failed to link GitHub account');
    }
  };

  // --- Project Handlers ---
  const handleProjectSubmit = async (e) => {
    e.preventDefault();

    if (isSubmittingProject) return;

    if (projectForm.organizations.length === 0 && !showNewOrgForm) {
      toast.error("Please select at least one client organization for this project, or create a new organization");
      return;
    }

    setIsSubmittingProject(true);

    try {
      let finalOrgId = null;
      
      // If creating new organization
      if (showNewOrgForm && newOrgData.companyName.trim()) {
        const newOrg = await createNewOrganization();
        if (newOrg) {
          finalOrgId = newOrg._id;
          projectForm.organizations.push(finalOrgId);
        } else {
          setIsSubmittingProject(false);
          return;
        }
      }

      let customId = projectForm.projectCustomId;
      let finalName = projectForm.name;

      if (isEditing || projectForm.name.includes('PRJ') || projectForm.name.includes('TDS')) {
        const sequenceMatch = projectForm.name.match(/TDS(\d{4})/) || projectForm.name.match(/PRJ(\d{4})/);
        const sequence = sequenceMatch ? sequenceMatch[1] : "0000";
        const prefix = projectForm.name.includes('PRJ') ? 'PRJ' : 'TDS';

        const selectedCountryObj = POPULAR_COUNTRIES.find(c => c.label === projectForm.country);
        const countryCode = selectedCountryObj ? selectedCountryObj.value : (projectForm.country?.substring(0, 2).toUpperCase() || "XX");
        const industryCode = (projectForm.industry || 'GEN').toUpperCase().substring(0, 4);
        const nameParts = projectForm.name.split('|');
        const companyName = nameParts[nameParts.length - 1].trim();
        const updatedFormattedString = `${prefix}${sequence}-${industryCode} | ${countryCode} | ${companyName}`;

        customId = updatedFormattedString;
        finalName = updatedFormattedString;
      }

      const finalData = {
        ...projectForm,
        name: finalName,
        projectCustomId: customId,
        projectManager: projectForm.projectManager || currentUserId,
        adminId: currentUserId,
        organizations: projectForm.organizations
      };

      if (isEditing) {
        await axios.put(`${ADMIN_BASE}/projects/${activeProjectId}`, finalData, authHeader);
        toast.success("Project updated successfully");
      } else {
        await axios.post(`${ADMIN_BASE}/projects`, finalData, authHeader);
        toast.success("Project created successfully");
      }

      setShowProjectModal(false);
      await fetchInitialData();

      setProjectForm({
        name: '',
        projectManager: '',
        description: '',
        country: '',
        industry: '',
        organizations: []
      });
      setOrgSearchTerm('');
      setIsOrgDropdownOpen(false);
      setShowNewOrgForm(false);
      setNewOrgData({ companyName: '', website: '', address: '' });

    } catch (err) {
      toast.error(err.response?.data?.error || "Project save failed");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const closeProjectModal = () => {
    if (isSubmittingProject) return;
    setShowProjectModal(false);
    setIsEditing(false);
    setShowNewOrgForm(false);
    setProjectForm({
      name: '',
      projectManager: '',
      description: '',
      country: 'United States',
      industry: 'Tech',
      organizations: []
    });
    setOrgSearchTerm('');
    setIsOrgDropdownOpen(false);
    setNewOrgData({ companyName: '', website: '', address: '' });
  };

  // PM saved on the project being edited, when it is not a Project Manager (e.g. an older project
  // with a Project Coordinator): kept as an option so the saved value is never shown as blank.
  const legacyPm = (() => {
    const saved = isEditing ? projects.find(p => p._id === activeProjectId)?.projectManager : null;
    const savedId = saved?._id || saved;
    if (!savedId || projectManagers.some(pm => pm._id === savedId)) return null;
    return coordinators.find(u => u._id === savedId) || { _id: savedId, name: saved.name || 'Current manager' };
  })();

  const handleEditClick = (project) => {
    setIsEditing(true);
    setActiveProjectId(project._id);
    setProjectForm({
      name: project.name,
      projectManager: project.projectManager?._id || project.projectManager || '',
      description: project.description || '',
      country: project.country || 'United States',
      industry: project.industry || 'Tech',
      organizations: (project.organizations || []).map(c => c._id || c) || []
    });
    setShowNewOrgForm(false);
    setShowProjectModal(true);
  };

  // Toggle developer selection
  const toggleDeveloperSelection = (developerId) => {
    setFeedForm(prev => {
      const isSelected = prev.assignedDevelopers.includes(developerId);
      return {
        ...prev,
        assignedDevelopers: isSelected 
          ? prev.assignedDevelopers.filter(id => id !== developerId)
          : [...prev.assignedDevelopers, developerId]
      };
    });
  };

  const handleFeedSubmit = async (e) => {
    e.preventDefault();

    if (isSubmittingFeed) return;

    if (feedForm.feedType === 'Weekly' && !feedForm.weekDay) {
      toast.error('Please select a day for weekly feed');
      return;
    }

    if (feedForm.feedType === 'Monthly' && !feedForm.monthDay) {
      toast.error('Please select a day of the month for monthly feed');
      return;
    }

    const selectedDevelopers = developers.filter(dev => feedForm.assignedDevelopers.includes(dev._id));
    const developersWithoutGitHub = selectedDevelopers.filter(dev => !dev.githubLinked || !dev.githubUsername);
    
    if (developersWithoutGitHub.length > 0) {
      const names = developersWithoutGitHub.map(d => d.name).join(', ');
      toast.error(`⚠️ Warning: ${developersWithoutGitHub.length} developer(s) (${names}) don't have GitHub accounts linked. They won't receive GitHub invitations. You can link their accounts from User Management.`, {
        duration: 5000,
        icon: '⚠️'
      });
    }

    setIsSubmittingFeed(true);

    try {
      const payload = {
        ...feedForm,
        weekDay: feedForm.feedType === 'Weekly' ? feedForm.weekDay : '',
        monthDay: feedForm.feedType === 'Monthly' ? feedForm.monthDay : null,
        feedPlatform: feedForm.feedPlatform || null,
        webDomain: (feedForm.feedPlatform === 'Web' || feedForm.feedPlatform === 'Both') ? feedForm.webDomain : null,
        projectId: activeProjectId,
        adminId: currentUserId,
        feedStatus: feedForm.feedStatus || 'New'
      };

      if (isEditingFeed) {
        await axios.put(`${ADMIN_BASE}/feeds/${activeFeedId}`, payload, authHeader);
        toast.success("Feed updated successfully");
      } else {
        await axios.post(`${ADMIN_BASE}/feeds`, payload, authHeader);
        
        if (developersWithoutGitHub.length === 0 && feedForm.assignedDevelopers.length > 0) {
          toast.success(`Feed added successfully! GitHub invitations sent to ${feedForm.assignedDevelopers.length} developer(s).`);
        } else if (feedForm.assignedDevelopers.length > 0) {
          const invitedCount = feedForm.assignedDevelopers.length - developersWithoutGitHub.length;
          if (invitedCount > 0) {
            toast.success(`Feed added successfully! ${invitedCount} GitHub invitation(s) sent. ${developersWithoutGitHub.length} developer(s) need GitHub accounts linked.`);
          } else {
            toast.success("Feed added successfully, but no GitHub invitations were sent because developers don't have linked GitHub accounts.");
          }
        } else {
          toast.success("Feed added successfully");
        }
      }

      closeFeedModal();
      fetchInitialData();

    } catch (err) {
      console.error("Feed save error:", err);
      toast.error(err.response?.data?.error || "Feed save failed");
    } finally {
      setIsSubmittingFeed(false);
    }
  };

  const closeFeedModal = () => {
    if (isSubmittingFeed) return;
    setShowFeedModal(false);
    setIsEditingFeed(false);
    setDeveloperSearchTerm('');
    setIsDeveloperDropdownOpen(false);
    setFeedForm({
      name: '',
      assignedDevelopers: [],
      feedType: 'Daily',
      weekDay: '',
      monthDay: '',
      feedPlatform: '',
      webDomain: '',
      feedStatus: 'New'
    });
  };

  // ============================================
  // BULK FEED IMPORT HANDLERS
  // ============================================

  const openBulkFeedModal = (projectId) => {
    setActiveProjectId(projectId);
    setBulkFeedFile(null);
    setBulkFeedPreview([]);
    setShowBulkFeedModal(true);
  };

  const handleBulkFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setBulkFeedFile(file);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      // xlsx (~320 KB) is only downloaded when a sheet is actually imported
      const XLSX = await import('xlsx');
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setBulkFeedPreview(json);
        toast.success(`Loaded ${json.length} feed(s) from Excel`);
      } catch (error) {
        console.error('Error reading Excel file:', error);
        toast.error('Failed to read Excel file. Please check the format.');
        setBulkFeedPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleBulkFeedSubmit = async () => {
    if (bulkFeedUploading) return;

    if (!activeProjectId) {
      toast.error('No project selected');
      return;
    }

    if (bulkFeedPreview.length === 0) {
      toast.error('Please upload an Excel file with feed data');
      return;
    }

    setBulkFeedUploading(true);

    try {
      const feedsToCreate = bulkFeedPreview.map(row => ({
        name: row.name || row.Name || row.feedName || row['Feed Name'] || '',
        feedType: row.feedType || row['Feed Type'] || 'Daily',
        weekDay: row.weekDay || row['Week Day'] || '',
        monthDay: row.monthDay || row['Month Day'] || null,
        feedPlatform: row.feedPlatform || row['Platform'] || '',
        webDomain: row.webDomain || row['Domain'] || '',
        assignedDevelopers: row.assignedDevelopers || row['Developers'] || '',
        feedStatus: row.feedStatus || row['Status'] || 'New'
      })).filter(f => f.name.trim() !== '');

      if (feedsToCreate.length === 0) {
        toast.error('No valid feed data found in Excel. Please ensure "name" column exists.');
        setBulkFeedUploading(false);
        return;
      }

      const response = await axios.post(
        `${ADMIN_BASE}/feeds/bulk`,
        {
          projectId: activeProjectId,
          feeds: feedsToCreate
        },
        authHeader
      );

      if (response.data.success) {
        toast.success(`✅ ${response.data.created} feed(s) created successfully! ${response.data.failed || 0} failed.`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Bulk feed import errors:', response.data.errors);
          toast.warning(`${response.data.errors.length} feed(s) had issues. Check console for details.`);
        }
        setShowBulkFeedModal(false);
        setBulkFeedFile(null);
        setBulkFeedPreview([]);
        fetchInitialData();
      } else {
        toast.error(response.data.error || 'Failed to import feeds');
      }
    } catch (error) {
      console.error('Bulk feed import error:', error);
      toast.error(error.response?.data?.error || 'Failed to import feeds');
    } finally {
      setBulkFeedUploading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskText.trim()) {
      toast.error("Please enter task details");
      return;
    }

    try {
      await axios.post(`${ADMIN_BASE}/tasks/create`, {
        projectId: activeProjectId,
        feedId: activeFeed?._id,
        performerId: currentUserId,
        details: taskText,
        assignedDevelopers: activeFeed?.assignedDevelopers?.map(d => d._id || d)
      }, authHeader);

      setTaskText("");
      setShowTaskModal(false);
      toast.success("Task pushed to developers");
      fetchInitialData();

    } catch (err) {
      toast.error("Failed to push task");
    }
  };

  const customDropdownStyles = {
    control: (base) => ({
      ...base,
      padding: '8px',
      borderRadius: '1.25rem',
      border: '1px solid #f1f5f9',
      backgroundColor: '#f8fafc',
      fontWeight: '700',
      boxShadow: 'none',
      '&:hover': { border: '1px solid #3b82f6' }
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '1rem',
      overflow: 'hidden',
      padding: '5px',
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1e293b',
      fontWeight: '600',
      borderRadius: '0.5rem',
      cursor: 'pointer'
    })
  };

  // Reset filters handler
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  const selectArrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`;
  const selectArrowStyle = {
    backgroundImage: selectArrow,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 4px center',
    backgroundSize: '8px'
  };

  return (
    <div className="page bg-slate-50">
      <div className="w-full max-w-full">
        {/* HEADER SECTION */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="page-title">
                  Workspace Project
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Manage system flows and feeds
                </p>
              </div>

              <button
                onClick={() => {
                  setIsEditing(false);
                  setShowProjectModal(true);
                }}
                className="btn btn-md bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-blue-600 hover:to-blue-700 shadow-md w-full sm:w-auto"
              >
                <FolderPlus size={14} />
                New Project
              </button>
            </div>

            {/* STATS - compact */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="card !p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <LayoutGrid size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Projects</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-800">{filteredProjects.length}</p>
                </div>
              </div>

              <div className="card !p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Activity size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Active Feeds</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-800">
                    {projects.reduce((acc, curr) => acc + (curr.feeds?.length || 0), 0)}
                  </p>
                </div>
              </div>

              <div className="card !p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">On Hold</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-800">
                    {projects.filter(p => isOnHoldStatus(p.projectStatus)).length}
                  </p>
                </div>
              </div>
            </div>

            {/* FILTERS SECTION */}
            <div className="card !p-3 sm:!p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input pl-8 bg-slate-50"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input pl-8 bg-slate-50 cursor-pointer"
                >
                  <option value="All">All Projects</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive (Closed)</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              {/* Reset */}
              {(searchTerm || statusFilter !== 'All') && (
                <button
                  onClick={resetFilters}
                  className="btn btn-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                >
                  <X size={12} />
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Items Per Page Selector */}
        <div className="flex justify-end mb-3 sm:mb-4">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-0.5 md:py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs font-semibold text-slate-500">per page</span>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="table-scroll table-sticky-first overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="th">Project</th>
                  <th className="th">Client Org</th>
                  <th className="th">Industry</th>
                  <th className="th">Country</th>
                  <th className="th">Feeds</th>
                  <th className="th">Git Activity</th>
                  <th className="th">Team Leads</th>
                  <th className="th">Project Coordinators</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentProjectSlice.length > 0 ? (
                  currentProjectSlice.map((project, idx) => {
                    const isFromSales = project.projectCustomId?.includes('PRJ');
                    const orgList = project.organizations || [];
                    const gitActivity = getProjectGitActivity(project);
                    const gitFresh = gitActivity ? getGitFreshness(gitActivity.time) : null;

                    return (
                      <tr
                        key={project._id}
                        className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-200 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        {/* Project */}
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                              {isFromSales ? <ShoppingBag size={12} /> : <Activity size={12} />}
                            </div>
                            <p className="text-xs font-semibold text-slate-800 md:whitespace-nowrap">
                              {project.projectCustomId || 'NO_ID'}
                            </p>
                          </div>
                        </td>

                        {/* Client Org */}
                        <td className="td">
                          <div className="flex flex-wrap items-center gap-1">
                            {orgList.length > 0 ? (
                              orgList.slice(0, 2).map((org, orgIdx) => {
                                const orgName = typeof org === 'object' ? org?.companyName : organizations.find(o => o._id === org)?.companyName;
                                return (
                                  <span key={orgIdx} className="badge bg-purple-50 text-purple-700 whitespace-nowrap">
                                    <Building2 size={12} />
                                    {orgName?.substring(0, 10) || 'Org'}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-xs text-slate-400 italic whitespace-nowrap">No clients</span>
                            )}
                            {orgList.length > 2 && (
                              <span className="text-xs font-semibold text-slate-400">+{orgList.length - 2}</span>
                            )}
                          </div>
                        </td>

                        {/* Industry */}
                        <td className="td">
                          <span className="badge bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                            <Briefcase size={12} />
                            {project.industry?.substring(0, 6) || project.industry}
                          </span>
                        </td>

                        {/* Country */}
                        <td className="td">
                          <span className="badge bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                            <Globe size={12} />
                            {POPULAR_COUNTRIES.find(c => c.label === project.country)?.value ||
                              (project.country?.substring(0, 2).toUpperCase()) || 'XX'}
                          </span>
                        </td>

                        {/* Feeds */}
                        <td className="td">
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors group"
                            onClick={() => navigateToFeedExplorer(project)}
                          >
                            <Hash size={12} className="text-slate-400 group-hover:text-blue-600" />
                            <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                              {project.feeds?.length || 0}
                            </span>
                            <span className="text-xs text-blue-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              View →
                            </span>
                          </div>
                        </td>

                        {/* Git Activity */}
                        <td className="td">
                          {gitActivity ? (
                            <div
                              title={`${new Date(gitActivity.time).toLocaleString()}${gitActivity.feedName ? ` • ${gitActivity.feedName}` : ''}`}
                            >
                              <span className={`badge border whitespace-nowrap ${gitFresh.chip}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${gitFresh.dot}`}></span>
                                <GitBranch size={12} />
                                {getTimeAgo(gitActivity.time)}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 italic whitespace-nowrap">
                              <GitBranch size={12} />
                              No commits yet
                            </span>
                          )}
                        </td>

                        {/* Team Leads / Project Coordinators: clickable (opens Project Settings) only for
                            Admin, Super Admin and this project's own Project Manager; view-only for others */}
                        {(() => {
                          const canEdit = canEditProjectTeam(userRole, currentUserId, project);
                          const leads = projectTeamLeads(project);
                          const coordinators = (project.projectCoordinators || []).filter((c) => c && typeof c === 'object');
                          const cell = (people, chipClass) => {
                            const chips = people.length === 0
                              ? <span className="text-xs text-slate-400">—</span>
                              : people.map((p, i) => (
                                <span key={p._id || i} className={`badge border whitespace-nowrap ${chipClass}`}>
                                  {p.name}
                                </span>
                              ));
                            return canEdit ? (
                              <button
                                type="button"
                                onClick={() => setTeamModalProject(project)}
                                title="Project Settings: Project Manager, Coordinators, Team Leads"
                                className="min-w-[100px] max-w-[200px] text-left flex flex-wrap items-center gap-1"
                              >
                                {chips}
                              </button>
                            ) : (
                              <div className="min-w-[100px] max-w-[200px] flex flex-wrap gap-1">{chips}</div>
                            );
                          };
                          return (
                            <>
                              <td className="td">
                                {cell(leads, 'bg-indigo-50 text-indigo-700 border-indigo-200')}
                              </td>
                              <td className="td">
                                {cell(coordinators, 'bg-cyan-50 text-cyan-700 border-cyan-200')}
                              </td>
                            </>
                          );
                        })()}

                        {/* Status */}
                        <td className="td">
                          <div className="relative min-w-[120px]">
                            <select
                              value={project.projectStatus || 'New'}
                              onChange={(e) => updateProjectStatus(project._id, e.target.value)}
                              disabled={updatingStatus[project._id]}
                              className={`w-full px-2 py-1 rounded-md text-xs font-semibold uppercase border cursor-pointer transition-all appearance-none pr-6 ${getProjectStatusColor(project.projectStatus)}`}
                              style={selectArrowStyle}
                            >
                              {projectStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            {updatingStatus[project._id] && (
                              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="td">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(project)}
                              className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"
                              title="Edit Project"
                            >
                              <Settings2 size={12} />
                            </button>
                            {canEditProjectTeam(userRole, currentUserId, project) && (
                              <button
                                onClick={() => setTeamModalProject(project)}
                                className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 flex-shrink-0"
                                title="Project Settings (Manager, Coordinators, Team Leads)"
                              >
                                <Users size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => { setActiveProjectId(project._id); setIsEditingFeed(false); setShowFeedModal(true); }}
                              className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex-shrink-0"
                              title="Add Feed"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              onClick={() => openBulkFeedModal(project._id)}
                              className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex-shrink-0"
                              title="Bulk Import Feeds"
                            >
                              <FileSpreadsheet size={12} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProjectForComments(project);
                                setShowProjectCommentModal(true);
                                setCommentRefreshTrigger(prev => prev + 1);
                              }}
                              className="btn-icon bg-slate-50 border border-slate-200 text-slate-500 hover:bg-purple-50 hover:text-purple-600 flex-shrink-0"
                              title="View Comments"
                            >
                              <MessageSquare size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 shrink-0">
                          <Activity size={20} className="text-slate-300" />
                        </div>
                        <p className="text-xs font-semibold uppercase text-slate-400">No projects found</p>
                        <p className="text-xs text-slate-300 mt-0.5">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col lg:flex-row justify-between items-center gap-3">
            <div className="text-sm text-slate-500">
              Showing {indexOfFirstProject + 1} to {Math.min(indexOfLastProject, filteredProjects.length)} of {filteredProjects.length} projects
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex gap-0.5 sm:gap-1 bg-white p-0.5 sm:p-1 rounded-lg border border-slate-200 shadow-sm">
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                    if (i === 4) pageNum = totalPages;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                    if (i === 0) pageNum = 1;
                    if (i === 4) pageNum = totalPages;
                  }

                  if (pageNum === 1 && i > 0 && currentPage > 3 && totalPages > 5) {
                    return <span key="ellipsis1" className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">...</span>;
                  }

                  if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                    return <span key="ellipsis2" className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center text-slate-400 text-xs shrink-0">...</span>;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`btn-icon ${
                        currentPage === pageNum
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PROJECT MODAL - Responsive */}
      {teamModalProject && (
        <ProjectTeamModal
          project={teamModalProject}
          projectManagers={projectManagers}
          coordinators={coordinators}
          teamLeads={teamLeads}
          adminBase={ADMIN_BASE}
          authHeader={authHeader}
          onClose={() => setTeamModalProject(null)}
          onSaved={() => { setTeamModalProject(null); fetchInitialData(); }}
        />
      )}

      {showProjectModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-xl">
            <div className="modal-header">
              <h2 className="section-title">
                {isEditing ? 'Modify Workspace' : 'Launch New Project'}
              </h2>
              <button 
                onClick={closeProjectModal} 
                disabled={isSubmittingProject}
                className="btn-icon text-slate-300 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="modal-body space-y-4 sm:space-y-6">
              <div className="space-y-1 sm:space-y-2">
                <label className="label block mb-1.5">Project Brief Title</label>
                <input 
                  type="text" 
                  placeholder="Title" 
                  required 
                  disabled={isSubmittingProject}
                  className="input bg-slate-50" 
                  value={projectForm.name} 
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} 
                />
              </div>
              
              {/* ORGANIZATION SELECTION SECTION */}
              <div className="space-y-1 sm:space-y-2" ref={orgDropdownRef}>
                <label className="label mb-1.5 flex items-center gap-1 sm:gap-2">
                  <Building2 size={12} />
                  Assign Client Organizations *
                </label>
                
                {/* Selected Organizations Display */}
                {projectForm.organizations.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 p-2 sm:p-3 bg-purple-50 rounded-xl border border-purple-100">
                    {projectForm.organizations.map(orgId => {
                      const org = organizations.find(o => o._id === orgId);
                      return org ? (
                        <span key={orgId} className="badge max-md:py-0 max-md:pr-0 bg-purple-600 text-white">
                          <Building2 size={12} />
                          {org.companyName?.substring(0, 12) || org.companyName}
                          <button
                            type="button"
                            disabled={isSubmittingProject}
                            onClick={() => removeOrg(orgId)}
                            className="btn-icon hover:text-red-200 disabled:opacity-50"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {!showNewOrgForm ? (
                  <>
                    {/* Search Input for Organizations */}
                    <div className="relative">
                      <Search size={14} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={isMobile ? "Search orgs..." : "Search organizations by name or website..."}
                        value={orgSearchTerm}
                        disabled={isSubmittingProject}
                        onChange={(e) => {
                          setOrgSearchTerm(e.target.value);
                          setIsOrgDropdownOpen(true);
                        }}
                        onFocus={() => setIsOrgDropdownOpen(true)}
                        className="input pl-8 bg-slate-50"
                      />
                      <button
                        type="button"
                        disabled={isSubmittingProject}
                        onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                        className="btn-icon absolute right-0 md:right-1 top-1/2 -translate-y-1/2 text-slate-400 disabled:opacity-50"
                      >
                        {isOrgDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {/* Dropdown List for Organizations */}
                    {isOrgDropdownOpen && !isSubmittingProject && (
                      <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-40 sm:max-h-48 overflow-y-auto z-50">
                        {filteredOrganizations.length === 0 ? (
                          <div className="p-3 sm:p-4 text-center text-slate-400 text-xs">No organizations found</div>
                        ) : (
                          filteredOrganizations.map(org => {
                            const isSelected = projectForm.organizations.includes(org._id);
                            return (
                              <div
                                key={org._id}
                                onClick={() => toggleOrgSelection(org._id)}
                                className={`flex items-center justify-between p-2 sm:p-3 cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-purple-50' : ''}`}
                              >
                                <div>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-800 break-words">{org.companyName}</p>
                                  <p className="text-xs text-slate-400 break-words">{org.website || 'No website'}</p>
                                </div>
                                {isSelected && <CheckCircle size={14} className="text-purple-600 flex-shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isSubmittingProject}
                      onClick={() => {
                        setShowNewOrgForm(true);
                        setIsOrgDropdownOpen(false);
                      }}
                      className="btn btn-sm w-full mt-1 sm:mt-2 border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Create New Organization
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <label className="label block mb-1.5 text-blue-600">New Organization</label>
                      <button
                        type="button"
                        disabled={isSubmittingProject || isCreatingOrg}
                        onClick={() => {
                          setShowNewOrgForm(false);
                          setNewOrgData({ companyName: '', website: '', address: '' });
                        }}
                        className="btn-icon text-slate-400 hover:text-slate-600 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Organization Name *"
                      required
                      disabled={isSubmittingProject || isCreatingOrg}
                      className="input"
                      value={newOrgData.companyName}
                      onChange={(e) => setNewOrgData({...newOrgData, companyName: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Website (optional)"
                      disabled={isSubmittingProject || isCreatingOrg}
                      className="input"
                      value={newOrgData.website}
                      onChange={(e) => setNewOrgData({...newOrgData, website: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Address (optional)"
                      disabled={isSubmittingProject || isCreatingOrg}
                      className="input"
                      value={newOrgData.address}
                      onChange={(e) => setNewOrgData({...newOrgData, address: e.target.value})}
                    />
                  </div>
                )}
                
                <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">
                  {projectForm.organizations.length} client organization(s) selected
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <CreatableSelect 
                  isClearable 
                  isDisabled={isSubmittingProject}
                  options={POPULAR_COUNTRIES} 
                  placeholder="Select Country" 
                  value={POPULAR_COUNTRIES.find(opt => opt.label === projectForm.country) || { label: projectForm.country, value: projectForm.country }} 
                  onChange={(v) => setProjectForm({ ...projectForm, country: v?.label || '' })} 
                  styles={customDropdownStyles} 
                />
                <CreatableSelect 
                  isClearable 
                  isDisabled={isSubmittingProject}
                  options={INDUSTRY_OPTIONS} 
                  value={INDUSTRY_OPTIONS.find(opt => opt.value === projectForm.industry) || { label: projectForm.industry, value: projectForm.industry }} 
                  onChange={(v) => setProjectForm({ ...projectForm, industry: v?.value || '' })} 
                  styles={customDropdownStyles} 
                />
              </div>
              <select 
                disabled={isSubmittingProject}
                className="input bg-slate-50" 
                value={projectForm.projectManager} 
                onChange={(e) => setProjectForm({ ...projectForm, projectManager: e.target.value })}
              >
                <option value="">Select Manager</option>
                {legacyPm && <option value={legacyPm._id}>{legacyPm.name}{legacyPm.role ? ` (${legacyPm.role})` : ''}</option>}
                {projectManagers.map(pm => <option key={pm._id} value={pm._id}>{pm.name}</option>)}
              </select>
              <button 
                type="submit" 
                disabled={isSubmittingProject}
                className={`btn btn-md w-full shadow-xl ${
                  isSubmittingProject 
                    ? 'bg-slate-400 text-white cursor-not-allowed' 
                    : 'bg-[#111C44] text-white hover:bg-blue-600'
                }`}
              >
                {isSubmittingProject ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isEditing ? 'Saving...' : 'Creating Project...'}
                  </>
                ) : (
                  isEditing ? 'Save Changes' : 'Create Project'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FEED MODAL - Responsive */}
      {showFeedModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg">
            <div className="modal-header">
              <h2 className="section-title">
                {isEditingFeed ? 'Update Stream' : 'New Feed'}
              </h2>
              <button 
                onClick={closeFeedModal} 
                disabled={isSubmittingFeed}
                className="btn-icon text-slate-300 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleFeedSubmit} className="modal-body space-y-4 sm:space-y-6">
              <input
                type="text"
                placeholder="Stream Name"
                required
                disabled={isSubmittingFeed}
                className="input bg-slate-50"
                value={feedForm.name}
                onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
              />

              <select
                disabled={isSubmittingFeed}
                className="input bg-slate-50"
                value={feedForm.feedType}
                onChange={(e) => setFeedForm({ 
                  ...feedForm, 
                  feedType: e.target.value, 
                  weekDay: e.target.value !== 'Weekly' ? '' : feedForm.weekDay,
                  monthDay: e.target.value !== 'Monthly' ? '' : feedForm.monthDay
                })}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Once off">Once off</option>
              </select>

              {feedForm.feedType === 'Weekly' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="label block mb-1.5 sm:mb-2">Select Weekly Day</label>
                  <select 
                    required 
                    disabled={isSubmittingFeed}
                    value={feedForm.weekDay} 
                    onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })} 
                    className="input bg-slate-50"
                  >
                    <option value="">Choose Day</option>
                    {weekDays.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
              )}

              {feedForm.feedType === 'Monthly' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="label block mb-1.5 sm:mb-2">Day of Month (1-31)</label>
                  <select 
                    required 
                    disabled={isSubmittingFeed}
                    value={feedForm.monthDay} 
                    onChange={(e) => setFeedForm({ ...feedForm, monthDay: e.target.value })} 
                    className="input bg-slate-50"
                  >
                    <option value="">Select Day</option>
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* FEED STATUS SELECTION */}
              <div className="space-y-1 sm:space-y-2">
                <label className="label mb-1.5 flex items-center gap-1 sm:gap-2">
                  <Activity size={12} />
                  Feed Status
                </label>
                <select
                  disabled={isSubmittingFeed}
                  className="input bg-slate-50 cursor-pointer"
                  value={feedForm.feedStatus}
                  onChange={(e) => setFeedForm({ ...feedForm, feedStatus: e.target.value })}
                >
                  {feedStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              {/* WEB / APP SELECTION */}
              <div className="space-y-2 sm:space-y-3">
                <label className="label block mb-1.5">Platform Type</label>
                <div className="flex gap-2 sm:gap-3">
                  {['Web', 'App', 'Both'].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      disabled={isSubmittingFeed}
                      onClick={() => {
                        setFeedForm({ 
                          ...feedForm, 
                          feedPlatform: platform,
                          webDomain: platform === 'App' ? '' : feedForm.webDomain
                        });
                      }}
                      className={`btn btn-md flex-1 disabled:opacity-50 ${
                        feedForm.feedPlatform === platform
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* DOMAIN FIELD */}
              {(feedForm.feedPlatform === 'Web' || feedForm.feedPlatform === 'Both') && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="label block mb-1.5 sm:mb-2">Domain URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    disabled={isSubmittingFeed}
                    value={feedForm.webDomain}
                    onChange={(e) => setFeedForm({ ...feedForm, webDomain: e.target.value })}
                    className="input bg-slate-50"
                  />
                  <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 ml-1">Enter full URL including https://</p>
                </div>
              )}

              {/* SEARCHABLE DEVELOPER DROPDOWN WITH GITHUB STATUS - Responsive */}
              <div className="space-y-1 sm:space-y-2" ref={developerDropdownRef}>
                <label className="label mb-1.5 flex items-center gap-1 sm:gap-2">
                  <UserCheck size={12} />
                  Assign Developers
                </label>
                
                {/* Selected Developers Display */}
                {feedForm.assignedDevelopers.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 rounded-xl border border-blue-100">
                    {feedForm.assignedDevelopers.map(devId => {
                      const dev = developers.find(d => d._id === devId);
                      return dev ? (
                        <span key={devId} className={`badge sm:gap-1.5 ${
                          dev.githubLinked && dev.githubUsername 
                            ? 'bg-green-600 text-white' 
                            : 'bg-orange-500 text-white'
                        }`}>
                          <GitFork size={12} />
                          {dev.name?.substring(0, 10) || dev.name}
                          {(!dev.githubLinked || !dev.githubUsername) && (
                            <span className="text-xs bg-orange-700 px-0.5 sm:px-1 rounded ml-0.5 sm:ml-1">No GitHub</span>
                          )}
                          <button
                            type="button"
                            disabled={isSubmittingFeed}
                            onClick={() => toggleDeveloperSelection(devId)}
                            className="btn-icon hover:text-red-200 disabled:opacity-50"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* GitHub Info Note */}
                {feedForm.assignedDevelopers.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 mb-1 sm:mb-2">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <GitFork size={12} className="text-blue-600" />
                      <p className="text-xs font-semibold text-blue-700">
                        Linked GitHub accounts receive repo invitations.
                      </p>
                    </div>
                  </div>
                )}

                {/* Search Input with Refresh Button */}
                <div className="relative flex gap-1.5 sm:gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isMobile ? "Search devs..." : "Search developers by name or email..."}
                      value={developerSearchTerm}
                      disabled={isSubmittingFeed}
                      onChange={(e) => {
                        setDeveloperSearchTerm(e.target.value);
                        setIsDeveloperDropdownOpen(true);
                      }}
                      onFocus={() => setIsDeveloperDropdownOpen(true)}
                      className="input pl-8 bg-slate-50"
                    />
                    <button
                      type="button"
                      disabled={isSubmittingFeed}
                      onClick={() => setIsDeveloperDropdownOpen(!isDeveloperDropdownOpen)}
                      className="btn-icon absolute right-0 md:right-1 top-1/2 -translate-y-1/2 text-slate-400 disabled:opacity-50"
                    >
                      {isDeveloperDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    disabled={isSubmittingFeed}
                    onClick={() => fetchInitialData()}
                    className="btn btn-sm bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    title="Refresh developers list"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Dropdown List with GitHub Status */}
                {isDeveloperDropdownOpen && !isSubmittingFeed && (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 sm:max-h-64 overflow-y-auto z-50">
                    {filteredDevelopers.length === 0 ? (
                      <div className="p-3 sm:p-4 text-center text-slate-400 text-xs">No developers found</div>
                    ) : (
                      filteredDevelopers.map(dev => {
                        const isSelected = feedForm.assignedDevelopers.includes(dev._id);
                        const hasGitHub = dev.githubLinked && dev.githubUsername;
                        return (
                          <div
                            key={dev._id}
                            className={`flex items-center justify-between p-2 sm:p-3 cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                          >
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => toggleDeveloperSelection(dev._id)}
                            >
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate max-w-[80px] sm:max-w-none">{dev.name}</p>
                                {hasGitHub ? (
                                  <span className="badge rounded-full sm:gap-1 text-green-600 bg-green-50">
                                    <CheckCircle size={12} />
                                    {dev.githubUsername?.substring(0, 8) || dev.githubUsername}
                                  </span>
                                ) : (
                                  <span className="badge rounded-full sm:gap-1 text-orange-600 bg-orange-50">
                                    <AlertCircle size={12} />
                                    No GitHub
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate max-w-[80px] sm:max-w-none">{dev.email}</p>
                              {!hasGitHub && dev.role === 'Developer' && (
                                <p className="text-xs text-orange-500 mt-0.5">
                                  ⚠️ No GitHub invites
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              {!hasGitHub && dev.role === 'Developer' && (
                                <button
                                  onClick={(e) => handleQuickLinkGitHub(dev, e)}
                                  disabled={isSubmittingFeed}
                                  className="btn-icon text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                  title="Link GitHub Account"
                                >
                                  <GitFork size={14} />
                                </button>
                              )}
                              {isSelected && <CheckCircle size={14} className="text-blue-600 flex-shrink-0" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {filteredDevelopers.length === 0 && developers.length > 0 && (
                      <div className="p-3 sm:p-4 text-center text-slate-400 text-xs">
                        No matching developers. Try different search.
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-0.5 sm:mt-1">
                  <p className="text-xs text-slate-400">
                    {feedForm.assignedDevelopers.length} developer(s) selected
                  </p>
                  <p className="text-xs text-slate-400">
                    {feedForm.assignedDevelopers.filter(id => {
                      const dev = developers.find(d => d._id === id);
                      return dev && dev.githubLinked && dev.githubUsername;
                    }).length} with GitHub
                  </p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingFeed}
                className={`btn btn-md w-full shadow-xl ${
                  isSubmittingFeed 
                    ? 'bg-slate-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-[#111C44]'
                }`}
              >
                {isSubmittingFeed ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isEditingFeed ? 'Saving...' : 'Creating Feed...'}
                  </>
                ) : (
                  isEditingFeed ? 'Save Configuration' : 'Connect Stream'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          BULK FEED IMPORT MODAL
          ============================================ */}
      {showBulkFeedModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="section-title">
                  Bulk Import Feeds
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload an Excel file to create multiple feeds at once
                </p>
              </div>
              <button 
                onClick={() => {
                  if (bulkFeedUploading) return;
                  setShowBulkFeedModal(false);
                  setBulkFeedFile(null);
                  setBulkFeedPreview([]);
                }} 
                disabled={bulkFeedUploading}
                className="btn-icon text-slate-300 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X size={28} />
              </button>
            </div>

            <div className="modal-body stack">
              {/* Excel Format Guide */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Excel Format Guide</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Include these columns in your Excel file (headers are case-sensitive):
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="badge bg-red-100 text-red-700">name *</span>
                      <span className="badge bg-blue-50 text-blue-600">feedType</span>
                      <span className="badge bg-blue-50 text-blue-600">weekDay</span>
                      <span className="badge bg-blue-50 text-blue-600">monthDay</span>
                      <span className="badge bg-blue-50 text-blue-600">feedPlatform</span>
                      <span className="badge bg-blue-50 text-blue-600">webDomain</span>
                      <span className="badge bg-blue-50 text-blue-600">assignedDevelopers</span>
                      <span className="badge bg-blue-50 text-blue-600">feedStatus</span>
                    </div>
                    <p className="text-xs text-blue-500 mt-2">
                      * Required column. Order doesn't matter. Supports .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleBulkFileSelect}
                  disabled={bulkFeedUploading}
                  className="hidden"
                />
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    bulkFeedUploading 
                      ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60' 
                      : bulkFeedFile 
                        ? 'border-emerald-400 bg-emerald-50 cursor-pointer' 
                        : 'border-slate-300 hover:border-blue-400 cursor-pointer'
                  }`}
                  onClick={() => !bulkFeedUploading && fileInputRef.current?.click()}
                >
                  {bulkFeedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet size={40} className="text-emerald-600" />
                      <p className="text-sm font-bold text-emerald-700">{bulkFeedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(bulkFeedFile.size / 1024).toFixed(1)} KB • {bulkFeedPreview.length} feed(s) found
                      </p>
                      <button
                        type="button"
                        disabled={bulkFeedUploading}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBulkFeedFile(null);
                          setBulkFeedPreview([]);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-50"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={40} className="text-slate-400" />
                      <p className="text-sm font-bold text-slate-600">Click to upload Excel file</p>
                      <p className="text-xs text-slate-400">or drag and drop</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              {bulkFeedPreview.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Preview ({bulkFeedPreview.length} feeds)
                    </p>
                    <span className="text-xs text-slate-400">
                      Showing first {Math.min(bulkFeedPreview.length, 10)} rows
                    </span>
                  </div>
                  <div className="table-scroll table-sticky-first overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead className="bg-slate-50/80 sticky top-0">
                        <tr>
                          {Object.keys(bulkFeedPreview[0] || {}).map((key, idx) => (
                            <th key={idx} className="th border-b border-slate-200">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkFeedPreview.slice(0, 10).map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-slate-100 hover:bg-slate-50">
                            {Object.values(row).map((val, colIdx) => (
                              <td key={colIdx} className="td truncate max-w-[150px]">
                                {String(val || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bulkFeedPreview.length > 10 && (
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
                      + {bulkFeedPreview.length - 10} more rows not shown
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 sm:gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={bulkFeedUploading}
                  onClick={() => {
                    setShowBulkFeedModal(false);
                    setBulkFeedFile(null);
                    setBulkFeedPreview([]);
                  }}
                  className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkFeedSubmit}
                  disabled={bulkFeedUploading || bulkFeedPreview.length === 0}
                  className="btn btn-md flex-[2] bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {bulkFeedUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Import {bulkFeedPreview.length} Feed(s)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASK MODAL - Responsive */}
      {showTaskModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="modal-header">
              <h2 className="section-title">Deploy Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="btn-icon text-slate-300 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="modal-body space-y-4">
              <p className="text-xs font-semibold uppercase text-blue-600 tracking-wide flex items-center gap-1 sm:gap-2">
                <Hash size={12} />
                Stream: {activeFeed?.name}
              </p>
              <textarea required placeholder="Enter specific instructions for developers..." className="input bg-slate-50 min-h-[120px]" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
              <button type="submit" className="btn btn-md w-full bg-[#111C44] text-white hover:bg-blue-600 shadow-xl">
                Push to Bucket
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT COMMENT MODAL - Responsive */}
      {showProjectCommentModal && selectedProjectForComments && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <div>
                <h2 className="section-title">Project Comments</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 break-words">
                  {selectedProjectForComments.projectCustomId || selectedProjectForComments.name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowProjectCommentModal(false);
                  setSelectedProjectForComments(null);
                }}
                className="btn-icon text-slate-300 hover:text-slate-600"
              >
                <X size={28} />
              </button>
            </div>
            
            <div className="modal-body">
            <CommentSection
              type="project"
              entityId={selectedProjectForComments._id}
              userRole={userRole}
              userId={currentUserId}
              currentUserName={userName}
              canComment={userRole === 'Admin' || isPMRole(userRole)}
              refreshTrigger={commentRefreshTrigger}
            />
            </div>
          </div>
        </div>
      )}
      
      {/* SUCCESS POPUP - Responsive */}
      {showSuccessPopup && (
        <div className="fixed top-16 md:top-6 right-3 sm:right-6 z-[200] animate-in slide-in-from-top-5 duration-300 max-w-[90vw] sm:max-w-[320px]">
          <div className="bg-emerald-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl border border-emerald-400">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Success</p>
                <p className="text-sm font-semibold mt-0.5 sm:mt-1 break-words">{successMessage}</p>
              </div>
              <button onClick={() => setShowSuccessPopup(false)} className="btn-icon text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;