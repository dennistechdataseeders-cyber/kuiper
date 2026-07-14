// frontend/src/pages/ProjectManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  MessageSquare
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../components/CommentSection';

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

const ProjectManagement = () => {
  const navigate = useNavigate();
  
  // --- Data State ---
  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const { isCollapsed } = useSidebar();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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

  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeFeed, setActiveFeed] = useState(null);
  const [activeFeedId, setActiveFeedId] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingFeed, setIsEditingFeed] = useState(false);

  // --- Comment Modal State ---
  const [showProjectCommentModal, setShowProjectCommentModal] = useState(false);
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

  const industries = useMemo(() => [
    { label: "ECOM", value: "ECOM" },
    { label: "FOOD", value: "FOOD" },
    { label: "HTL", value: "HTL" },
    { label: "TRVL", value: "TRVL" },
    { label: "FNC", value: "FNC" },
    { label: "SCLM", value: "SCLM" },
    { label: "JOB", value: "JOB" },
    { label: "AUTO", value: "AUTO" }
  ], []);

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

  const getFeedStatusColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (status === 'New') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status.includes('In progress')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status.includes('Delivered')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status.includes('ON hold')) {
      if (status.includes('Sales')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (status.includes('Technical')) return 'bg-red-100 text-red-700 border-red-200';
      if (status.includes('Client')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const isOnHoldStatus = (status) => {
    return status && status.includes('ON hold');
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

  const updateTeamLead = async (projectId, teamLeadId) => {
    try {
      await axios.post(`${ADMIN_BASE}/projects/${projectId}/assign-teamlead`,
        { teamLeadId: teamLeadId || null },
        authHeader
      );
      toast.success('Team Lead updated successfully');
      fetchInitialData();
    } catch (err) {
      console.error('Error updating Team Lead:', err);
      toast.error(err.response?.data?.error || 'Failed to update Team Lead');
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
      const [projRes, devRes, pmRes, tlRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/projects`, authHeader),
        axios.get(`${ADMIN_BASE}/users/developers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/project-managers`, authHeader),
        axios.get(`${ADMIN_BASE}/users/teamleads`, authHeader)
      ]);

      setProjects(projRes.data);
      setDevelopers(devRes.data);
      setProjectManagers(pmRes.data);
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

    // FILTER PROJECTS FOR CURRENT PM
    result = result.filter(
      (p) =>
        p.projectManager?._id === currentUserId ||
        p.projectManager === currentUserId
    );

    // FILTER BY STATUS
    if (statusFilter === 'Active') {
      result = result.filter(p => p.projectStatus !== 'Closed');
    } else if (statusFilter === 'Inactive') {
      result = result.filter(p => p.projectStatus === 'Closed');
    } else if (statusFilter === 'On Hold') {
      result = result.filter(p => isOnHoldStatus(p.projectStatus));
    }
    // 'All' shows everything

    // SEARCH FILTER
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

    // SORT PROJECTS
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

    if (projectForm.organizations.length === 0 && !showNewOrgForm) {
      toast.error("Please select at least one client organization for this project, or create a new organization");
      return;
    }

    let finalOrgId = null;
    
    // If creating new organization
    if (showNewOrgForm && newOrgData.companyName.trim()) {
      const newOrg = await createNewOrganization();
      if (newOrg) {
        finalOrgId = newOrg._id;
        // Add the new organization to the organizations list
        projectForm.organizations.push(finalOrgId);
      } else {
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

    try {
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
    }
  };

  const closeProjectModal = () => {
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
    }
  };

  const closeFeedModal = () => {
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

  const handleEditFeedClick = (project, feed) => {
    setIsEditingFeed(true);
    setActiveProjectId(project._id);
    setActiveFeedId(feed._id);
    setFeedForm({
      name: feed.name,
      assignedDevelopers: feed.assignedDevelopers?.map(d => typeof d === 'object' ? d._id : d) || [],
      feedType: feed.feedType || 'Daily',
      weekDay: feed.weekDay || '',
      monthDay: feed.monthDay || '',
      feedPlatform: feed.feedPlatform || '',
      webDomain: feed.webDomain || '',
      feedStatus: feed.feedStatus || 'New'
    });
    setShowFeedModal(true);
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

  return (
    <div className={`min-h-screen bg-slate-50 p-3 sm:p-6 transition-all duration-300 ${isCollapsed ? 'ml-10 sm:ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-6 gap-3 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[#1B2559]">
            Workspace Project
          </h1>
          <p className="text-[#A3AED0] font-bold text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">
            Manage system flows and feeds.
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditing(false);
            setShowProjectModal(true);
          }}
          className="bg-[#111C44] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 text-[8px] sm:text-[10px] uppercase tracking-widest w-full sm:w-auto justify-center"
        >
          <FolderPlus size={isMobile ? 14 : 16} />
          New Project
        </button>
      </div>

      {/* Stats - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-3xl flex items-center gap-3 sm:gap-4 border border-slate-100 shadow-sm">
          <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <LayoutGrid size={isMobile ? 16 : 20} />
          </div>
          <div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Projects</p>
            <p className="text-lg sm:text-xl font-black text-[#1B2559]">{filteredProjects.length}</p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-3xl flex items-center gap-3 sm:gap-4 border border-slate-100 shadow-sm">
          <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity size={isMobile ? 16 : 20} />
          </div>
          <div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Feeds</p>
            <p className="text-lg sm:text-xl font-black text-[#1B2559]">
              {projects.reduce((acc, curr) => acc + (curr.feeds?.length || 0), 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-3xl flex items-center gap-3 sm:gap-4 border border-slate-100 shadow-sm">
          <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 size={isMobile ? 16 : 20} />
          </div>
          <div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">On Hold Projects</p>
            <p className="text-lg sm:text-xl font-black text-[#1B2559]">
              {projects.filter(p => isOnHoldStatus(p.projectStatus)).length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar - Responsive */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
          {/* Search Input */}
          <div className="relative sm:col-span-4">
            <Search size={isMobile ? 14 : 16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isMobile ? "Search..." : "Search by project ID, name, or organization..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium text-xs sm:text-sm focus:border-blue-400 transition-all"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative sm:col-span-3">
            <Filter size={isMobile ? 14 : 16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 sm:pl-10 pr-7 sm:pr-8 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-semibold text-xs sm:text-sm text-slate-700 appearance-none cursor-pointer hover:border-blue-400 transition-all"
            >
              <option value="All">All Projects</option>
              <option value="Active">Active </option>
              <option value="Inactive">Inactive (Closed)</option>
              <option value="On Hold">On Hold</option>
            </select>
            <ChevronDown size={isMobile ? 12 : 14} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Items Per Page Selector */}
          <div className="relative sm:col-span-3">
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 rounded-xl border border-slate-200 px-2 sm:px-3 py-1 sm:py-1.5 h-[36px] sm:h-[42px]">
              <span className="text-[7px] sm:text-[9px] font-black text-slate-500 uppercase hidden xs:inline">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="flex-1 text-[9px] sm:text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[7px] sm:text-[9px] font-black text-slate-500 hidden sm:inline">per page</span>
            </div>
          </div>

          {/* Reset Button */}
          {(searchTerm || statusFilter !== 'All') && (
            <div className="sm:col-span-2">
              <button
                onClick={resetFilters}
                className="w-full py-1.5 sm:py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold text-[9px] sm:text-xs uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <X size={isMobile ? 12 : 14} />
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TABLE VIEW - Responsive */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] sm:min-w-[1300px]">
            <thead className="bg-[#F8FAFC] border-b-2 border-slate-100">
              <tr>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[120px] sm:min-w-[240px]">Project</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[100px] sm:min-w-[160px] hidden sm:table-cell">Client Org</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[80px] sm:min-w-[120px] hidden md:table-cell">Industry</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[70px] sm:min-w-[110px] hidden lg:table-cell">Country</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[60px] sm:min-w-[90px]">Feeds</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[100px] sm:min-w-[180px] hidden md:table-cell">TL</th>
                <th className="text-left px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[100px] sm:min-w-[180px]">Status</th>
                <th className="text-right px-3 sm:px-8 py-3 sm:py-6 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[90px] sm:min-w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentProjectSlice.length > 0 ? (
                currentProjectSlice.map((project) => {
                  const isFromSales = project.projectCustomId?.includes('PRJ');
                  const orgList = project.organizations || [];
                  return (
                    <tr key={project._id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-all">
                      <td className="px-3 sm:px-8 py-3 sm:py-6">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className={`w-10 sm:w-14 h-10 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                            isFromSales ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {isFromSales ? <ShoppingBag size={isMobile ? 16 : 22} /> : <Activity size={isMobile ? 16 : 22} />}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-black text-[#1B2559] leading-tight truncate max-w-[80px] sm:max-w-none">
                              {project.projectCustomId?.substring(0, 15) || 'NO_ID'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-6 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-0.5 sm:gap-1.5">
                          {orgList.length > 0 ? (
                            orgList.slice(0, 2).map((org, idx) => {
                              const orgName = typeof org === 'object' ? org?.companyName : organizations.find(o => o._id === org)?.companyName;
                              return (
                                <span key={idx} className="inline-flex items-center gap-1 sm:gap-1.5 bg-purple-50 text-purple-700 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[7px] sm:text-[9px] font-bold truncate max-w-[60px] sm:max-w-none">
                                  <Building2 size={isMobile ? 7 : 9} />
                                  {orgName?.substring(0, 10) || 'Org'}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-slate-400 text-[8px] sm:text-[10px] font-medium">No clients</span>
                          )}
                          {orgList.length > 2 && (
                            <span className="text-[7px] sm:text-[9px] font-bold text-slate-400">+{orgList.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-6 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 sm:gap-2 bg-blue-50 text-blue-600 px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-blue-100 whitespace-nowrap">
                          <Briefcase size={isMobile ? 10 : 12} />
                          {project.industry?.substring(0, 6) || project.industry}
                        </span>
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-6 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 sm:gap-2 bg-slate-50 text-slate-600 px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-slate-100 whitespace-nowrap">
                          <Globe size={isMobile ? 10 : 12} />
                          {POPULAR_COUNTRIES.find(c => c.label === project.country)?.value ||
                           (project.country?.substring(0, 2).toUpperCase()) || 'XX'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-6">
                        <div 
                          className="flex items-center gap-1 sm:gap-2 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => navigateToFeedExplorer(project)}
                        >
                          <Hash size={isMobile ? 12 : 14} className="text-slate-400 group-hover:text-blue-600" />
                          <span className="text-sm sm:text-base font-black text-[#1B2559] group-hover:text-blue-600">
                            {project.feeds?.length || 0}
                          </span>
                          <span className="text-[8px] sm:text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline">
                            View →
                          </span>
                        </div>
                      </td>
                      
              {/* TL COLUMN */}
<td className="px-3 sm:px-8 py-3 sm:py-6 hidden md:table-cell">
  <div className="relative">
    <select
      value={project.teamLead?._id || project.teamLead || ''}
      onChange={(e) => updateTeamLead(project._id, e.target.value)}
      className="w-full inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all appearance-none bg-indigo-50 text-indigo-700 border-indigo-200 min-w-[90px] sm:min-w-[140px] pr-6 sm:pr-8"
    >
      <option value="">— None —</option>
      {teamLeads.map(tl => (
        <option key={tl._id} value={tl._id}>{tl.name}</option>
      ))}
    </select>
    {/* Custom arrow */}
    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="text-indigo-500">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  </div>
</td>

{/* STATUS COLUMN */}
<td className="px-3 sm:px-8 py-3 sm:py-6">
  <div className="relative">
    <select
      value={project.projectStatus || 'New'}
      onChange={(e) => updateProjectStatus(project._id, e.target.value)}
      disabled={updatingStatus[project._id]}
      className={`w-full inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all appearance-none pr-6 sm:pr-8 min-w-[90px] sm:min-w-[140px] ${getProjectStatusColor(project.projectStatus)}`}
    >
      {projectStatuses.map(status => (
        <option key={status} value={status}>{status}</option>
      ))}
    </select>
    {/* Custom arrow */}
    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="text-slate-500">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
    {updatingStatus[project._id] && (
      <div className="absolute right-6 sm:right-8 top-1/2 -translate-y-1/2">
        <div className="w-2 sm:w-3 h-2 sm:h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    )}
  </div>
</td>        
                      <td className="px-3 sm:px-8 py-3 sm:py-6">
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
                          <button 
                            onClick={() => handleEditClick(project)} 
                            className="w-8 sm:w-11 h-8 sm:h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                            title="Edit Project"
                          >
                            <Settings2 size={isMobile ? 14 : 16} />
                          </button>
                          <button 
                            onClick={() => { setActiveProjectId(project._id); setIsEditingFeed(false); setShowFeedModal(true); }} 
                            className="w-8 sm:w-11 h-8 sm:h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
                            title="Add Feed"
                          >
                            <Plus size={isMobile ? 14 : 16} />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedProjectForComments(project);
                              setShowProjectCommentModal(true);
                              setCommentRefreshTrigger(prev => prev + 1);
                            }}
                            className="w-8 sm:w-11 h-8 sm:h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-all shadow-sm"
                            title="View Comments"
                          >
                            <MessageSquare size={isMobile ? 14 : 16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-6 py-12 sm:py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 sm:mb-4">
                        <Activity size={isMobile ? 20 : 28} className="text-slate-300" />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-500">No projects found</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Responsive */}
      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
          <div className="text-[7px] sm:text-[9px] font-bold text-slate-400 text-center sm:text-left">
            Showing {indexOfFirstProject + 1} to {Math.min(indexOfLastProject, filteredProjects.length)} of {filteredProjects.length} projects
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="w-6 sm:w-8 h-6 sm:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={isMobile ? 12 : 14} />
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
                  return <span key="ellipsis1" className="w-4 sm:w-6 h-4 sm:h-6 flex items-center justify-center text-slate-400 text-[7px] sm:text-xs">…</span>;
                }
                
                if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                  return <span key="ellipsis2" className="w-4 sm:w-6 h-4 sm:h-6 flex items-center justify-center text-slate-400 text-[7px] sm:text-xs">…</span>;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-5 sm:w-6 h-5 sm:h-6 rounded-md text-[8px] sm:text-[10px] font-black transition-all ${
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
              className="w-6 sm:w-8 h-6 sm:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={isMobile ? 12 : 14} />
            </button>
          </div>
        </div>
      )}

      {/* PROJECT MODAL - Responsive */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[100] p-3 sm:p-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl p-6 sm:p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditing ? 'Modify Workspace' : 'Launch New Project'}
              </h2>
              <button onClick={closeProjectModal} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={isMobile ? 20 : 28} />
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Brief Title</label>
                <input type="text" placeholder="Title" required className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm sm:text-base" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              </div>
              
              {/* ORGANIZATION SELECTION SECTION */}
              <div className="space-y-1 sm:space-y-2" ref={orgDropdownRef}>
                <label className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1 sm:gap-2">
                  <Building2 size={isMobile ? 10 : 12} />
                  Assign Client Organizations *
                </label>
                
                {/* Selected Organizations Display */}
                {projectForm.organizations.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 p-2 sm:p-3 bg-purple-50 rounded-xl border border-purple-100">
                    {projectForm.organizations.map(orgId => {
                      const org = organizations.find(o => o._id === orgId);
                      return org ? (
                        <span key={orgId} className="inline-flex items-center gap-1 sm:gap-1.5 bg-purple-600 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-wider">
                          <Building2 size={isMobile ? 8 : 10} />
                          {org.companyName?.substring(0, 12) || org.companyName}
                          <button
                            type="button"
                            onClick={() => removeOrg(orgId)}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={isMobile ? 8 : 10} />
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
                      <Search size={isMobile ? 12 : 14} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={isMobile ? "Search orgs..." : "Search organizations by name or website..."}
                        value={orgSearchTerm}
                        onChange={(e) => {
                          setOrgSearchTerm(e.target.value);
                          setIsOrgDropdownOpen(true);
                        }}
                        onFocus={() => setIsOrgDropdownOpen(true)}
                        className="w-full h-9 sm:h-11 rounded-xl border border-slate-200 pl-8 sm:pl-9 pr-7 sm:pr-8 font-medium text-xs sm:text-sm outline-none focus:border-purple-500 bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {isOrgDropdownOpen ? <ChevronUp size={isMobile ? 12 : 14} /> : <ChevronDown size={isMobile ? 12 : 14} />}
                      </button>
                    </div>

                    {/* Dropdown List for Organizations */}
                    {isOrgDropdownOpen && (
                      <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-40 sm:max-h-48 overflow-y-auto z-50">
                        {filteredOrganizations.length === 0 ? (
                          <div className="p-3 sm:p-4 text-center text-slate-400 text-[10px] sm:text-xs">No organizations found</div>
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
                                  <p className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">{org.companyName}</p>
                                  <p className="text-[8px] sm:text-[9px] text-slate-400 truncate max-w-[100px] sm:max-w-none">{org.website || 'No website'}</p>
                                </div>
                                {isSelected && <CheckCircle size={isMobile ? 12 : 14} className="text-purple-600 flex-shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewOrgForm(true);
                        setIsOrgDropdownOpen(false);
                      }}
                      className="w-full mt-1 sm:mt-2 py-1.5 sm:py-2 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-[8px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-blue-50 transition-all flex items-center justify-center gap-1 sm:gap-2"
                    >
                      <Plus size={isMobile ? 12 : 14} />
                      Create New Organization
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] sm:text-[10px] font-black uppercase text-blue-600 ml-1">New Organization</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewOrgForm(false);
                          setNewOrgData({ companyName: '', website: '', address: '' });
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={isMobile ? 12 : 14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Organization Name *"
                      required
                      className="w-full p-2 sm:p-3 bg-white rounded-xl border border-slate-200 outline-none font-bold text-xs sm:text-sm"
                      value={newOrgData.companyName}
                      onChange={(e) => setNewOrgData({...newOrgData, companyName: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Website (optional)"
                      className="w-full p-2 sm:p-3 bg-white rounded-xl border border-slate-200 outline-none text-xs sm:text-sm"
                      value={newOrgData.website}
                      onChange={(e) => setNewOrgData({...newOrgData, website: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Address (optional)"
                      className="w-full p-2 sm:p-3 bg-white rounded-xl border border-slate-200 outline-none text-xs sm:text-sm"
                      value={newOrgData.address}
                      onChange={(e) => setNewOrgData({...newOrgData, address: e.target.value})}
                    />
                  </div>
                )}
                
                <p className="text-[7px] sm:text-[8px] text-slate-400 mt-0.5 sm:mt-1">
                  {projectForm.organizations.length} client organization(s) selected
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <CreatableSelect isClearable options={POPULAR_COUNTRIES} placeholder="Select Country" value={POPULAR_COUNTRIES.find(opt => opt.label === projectForm.country) || { label: projectForm.country, value: projectForm.country }} onChange={(v) => setProjectForm({ ...projectForm, country: v?.label || '' })} styles={customDropdownStyles} />
                <CreatableSelect isClearable options={industries} value={industries.find(opt => opt.value === projectForm.industry) || { label: projectForm.industry, value: projectForm.industry }} onChange={(v) => setProjectForm({ ...projectForm, industry: v?.value || '' })} styles={customDropdownStyles} />
              </div>
              <select className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs sm:text-sm text-slate-700" value={projectForm.projectManager} onChange={(e) => setProjectForm({ ...projectForm, projectManager: e.target.value })}>
                <option value="">Select Manager</option>
                {projectManagers.map(pm => <option key={pm._id} value={pm._id}>{pm.name}</option>)}
              </select>
              <button type="submit" className="w-full py-3 sm:py-5 bg-[#111C44] text-white font-black rounded-2xl hover:bg-blue-600 transition-all uppercase text-[10px] sm:text-xs tracking-widest shadow-xl">
                {isEditing ? 'Save Changes' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FEED MODAL - Responsive */}
      {showFeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[110] p-3 sm:p-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 sm:p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-[#1B2559] tracking-tight">
                {isEditingFeed ? 'Update Stream' : 'New Feed'}
              </h2>
              <button onClick={closeFeedModal} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={isMobile ? 20 : 28} />
              </button>
            </div>

            <form onSubmit={handleFeedSubmit} className="space-y-4 sm:space-y-6">
              <input
                type="text"
                placeholder="Stream Name"
                required
                className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm sm:text-base"
                value={feedForm.name}
                onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
              />

              <select
                className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs sm:text-sm text-slate-700"
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
                  <label className="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-2 ml-1">Select Weekly Day</label>
                  <select required value={feedForm.weekDay} onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs sm:text-sm text-slate-700">
                    <option value="">Choose Day</option>
                    {weekDays.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
              )}

              {feedForm.feedType === 'Monthly' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-2 ml-1">Day of Month (1-31)</label>
                  <select required value={feedForm.monthDay} onChange={(e) => setFeedForm({ ...feedForm, monthDay: e.target.value })} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs sm:text-sm text-slate-700">
                    <option value="">Select Day</option>
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* FEED STATUS SELECTION */}
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1 sm:gap-2">
                  <Activity size={isMobile ? 10 : 12} />
                  Feed Status
                </label>
                <select
                  className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs sm:text-sm text-slate-700 cursor-pointer"
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
                <label className="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Platform Type</label>
                <div className="flex gap-2 sm:gap-3">
                  {['Web', 'App', 'Both'].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => {
                        setFeedForm({ 
                          ...feedForm, 
                          feedPlatform: platform,
                          webDomain: platform === 'App' ? '' : feedForm.webDomain
                        });
                      }}
                      className={`flex-1 py-2 sm:py-3 rounded-xl font-black text-[8px] sm:text-xs uppercase tracking-wider transition-all ${
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
                  <label className="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-2 ml-1">Domain URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={feedForm.webDomain}
                    onChange={(e) => setFeedForm({ ...feedForm, webDomain: e.target.value })}
                    className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm text-slate-700 focus:border-blue-400 transition-all"
                  />
                  <p className="text-[7px] sm:text-[8px] text-slate-400 mt-0.5 sm:mt-1 ml-1">Enter full URL including https://</p>
                </div>
              )}

              {/* SEARCHABLE DEVELOPER DROPDOWN WITH GITHUB STATUS - Responsive */}
              <div className="space-y-1 sm:space-y-2" ref={developerDropdownRef}>
                <label className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1 sm:gap-2">
                  <UserCheck size={isMobile ? 10 : 12} />
                  Assign Developers
                </label>
                
                {/* Selected Developers Display */}
                {feedForm.assignedDevelopers.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 rounded-xl border border-blue-100">
                    {feedForm.assignedDevelopers.map(devId => {
                      const dev = developers.find(d => d._id === devId);
                      return dev ? (
                        <span key={devId} className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-wider ${
                          dev.githubLinked && dev.githubUsername 
                            ? 'bg-green-600 text-white' 
                            : 'bg-orange-500 text-white'
                        }`}>
                          <GitFork size={isMobile ? 8 : 10} />
                          {dev.name?.substring(0, 10) || dev.name}
                          {(!dev.githubLinked || !dev.githubUsername) && (
                            <span className="text-[6px] sm:text-[7px] bg-orange-700 px-0.5 sm:px-1 rounded ml-0.5 sm:ml-1">No GitHub</span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleDeveloperSelection(devId)}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={isMobile ? 8 : 10} />
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
                      <GitFork size={isMobile ? 8 : 10} className="text-blue-600" />
                      <p className="text-[6px] sm:text-[7px] font-bold text-blue-700">
                        Linked GitHub accounts receive repo invitations.
                      </p>
                    </div>
                  </div>
                )}

                {/* Search Input with Refresh Button */}
                <div className="relative flex gap-1.5 sm:gap-2">
                  <div className="relative flex-1">
                    <Search size={isMobile ? 12 : 14} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isMobile ? "Search devs..." : "Search developers by name or email..."}
                      value={developerSearchTerm}
                      onChange={(e) => {
                        setDeveloperSearchTerm(e.target.value);
                        setIsDeveloperDropdownOpen(true);
                      }}
                      onFocus={() => setIsDeveloperDropdownOpen(true)}
                      className="w-full h-9 sm:h-11 rounded-xl border border-slate-200 pl-8 sm:pl-9 pr-7 sm:pr-8 font-medium text-xs sm:text-sm outline-none focus:border-blue-500 bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => setIsDeveloperDropdownOpen(!isDeveloperDropdownOpen)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {isDeveloperDropdownOpen ? <ChevronUp size={isMobile ? 12 : 14} /> : <ChevronDown size={isMobile ? 12 : 14} />}
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => fetchInitialData()}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                    title="Refresh developers list"
                  >
                    <RefreshCw size={isMobile ? 14 : 16} />
                  </button>
                </div>

                {/* Dropdown List with GitHub Status */}
                {isDeveloperDropdownOpen && (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 sm:max-h-64 overflow-y-auto z-50">
                    {filteredDevelopers.length === 0 ? (
                      <div className="p-3 sm:p-4 text-center text-slate-400 text-[10px] sm:text-xs">No developers found</div>
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
                                <p className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[80px] sm:max-w-none">{dev.name}</p>
                                {hasGitHub ? (
                                  <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[6px] sm:text-[7px] font-black text-green-600 bg-green-50 px-1 sm:px-1.5 py-0.5 rounded-full">
                                    <CheckCircle size={isMobile ? 6 : 8} />
                                    {dev.githubUsername?.substring(0, 8) || dev.githubUsername}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[6px] sm:text-[7px] font-black text-orange-600 bg-orange-50 px-1 sm:px-1.5 py-0.5 rounded-full">
                                    <AlertCircle size={isMobile ? 6 : 8} />
                                    No GitHub
                                  </span>
                                )}
                              </div>
                              <p className="text-[7px] sm:text-[9px] text-slate-400 truncate max-w-[80px] sm:max-w-none">{dev.email}</p>
                              {!hasGitHub && dev.role === 'Developer' && (
                                <p className="text-[6px] sm:text-[7px] text-orange-500 mt-0.5">
                                  ⚠️ No GitHub invites
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              {!hasGitHub && dev.role === 'Developer' && (
                                <button
                                  onClick={(e) => handleQuickLinkGitHub(dev, e)}
                                  className="p-1 sm:p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Link GitHub Account"
                                >
                                  <GitFork size={isMobile ? 12 : 14} />
                                </button>
                              )}
                              {isSelected && <CheckCircle size={isMobile ? 12 : 14} className="text-blue-600 flex-shrink-0" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {filteredDevelopers.length === 0 && developers.length > 0 && (
                      <div className="p-3 sm:p-4 text-center text-slate-400 text-[10px] sm:text-xs">
                        No matching developers. Try different search.
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-0.5 sm:mt-1">
                  <p className="text-[7px] sm:text-[8px] text-slate-400">
                    {feedForm.assignedDevelopers.length} developer(s) selected
                  </p>
                  <p className="text-[7px] sm:text-[8px] text-slate-400">
                    {feedForm.assignedDevelopers.filter(id => {
                      const dev = developers.find(d => d._id === id);
                      return dev && dev.githubLinked && dev.githubUsername;
                    }).length} with GitHub
                  </p>
                </div>
              </div>

              <button type="submit" className="w-full py-3 sm:py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-[#111C44] transition-all uppercase text-[10px] sm:text-xs tracking-widest shadow-xl">
                {isEditingFeed ? 'Save Configuration' : 'Connect Stream'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TASK MODAL - Responsive */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[120] p-3 sm:p-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md p-6 sm:p-10 border border-white/20">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-[#1B2559] tracking-tight">Deploy Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                <X size={isMobile ? 20 : 28} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4 sm:space-y-6">
              <p className="text-[8px] sm:text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1 sm:gap-2">
                <Hash size={isMobile ? 10 : 12} />
                Stream: {activeFeed?.name}
              </p>
              <textarea required placeholder="Enter specific instructions for developers..." className="w-full p-4 sm:p-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-xs sm:text-sm text-slate-700 min-h-[120px] sm:min-h-[150px] focus:border-blue-300" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
              <button type="submit" className="w-full py-3 sm:py-5 bg-[#111C44] text-white font-black rounded-2xl uppercase text-[10px] sm:text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl">
                Push to Bucket
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT COMMENT MODAL - Responsive */}
      {showProjectCommentModal && selectedProjectForComments && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[150] p-4 sm:p-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#1B2559]">Project Comments</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 truncate max-w-[150px] sm:max-w-none">
                  {selectedProjectForComments.projectCustomId || selectedProjectForComments.name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowProjectCommentModal(false);
                  setSelectedProjectForComments(null);
                }}
                className="text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X size={isMobile ? 20 : 28} />
              </button>
            </div>
            
            <CommentSection
              type="project"
              entityId={selectedProjectForComments._id}
              userRole={userRole}
              userId={currentUserId}
              currentUserName={userName}
              canComment={userRole === 'Admin' || userRole === 'Project Manager'}
              refreshTrigger={commentRefreshTrigger}
            />
          </div>
        </div>
      )}
      
      {/* SUCCESS POPUP - Responsive */}
      {showSuccessPopup && (
        <div className="fixed top-3 sm:top-6 right-3 sm:right-6 z-[200] animate-in slide-in-from-top-5 duration-300 max-w-[90vw] sm:max-w-[280px]">
          <div className="bg-emerald-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl border border-emerald-400">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div>
                <p className="text-[8px] sm:text-xs font-black uppercase tracking-widest opacity-80">Success</p>
                <p className="text-xs sm:text-sm font-bold mt-0.5 sm:mt-1 truncate">{successMessage}</p>
              </div>
              <button onClick={() => setShowSuccessPopup(false)} className="text-white/80 hover:text-white flex-shrink-0">
                <X size={isMobile ? 14 : 18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;