// frontend/src/pages/ProjectFeeds.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

import {
  Search,
  Hash,
  ChevronLeft,
  ChevronRight,
  Activity,
  Filter,
  Edit3,
  Users,
  Clock,
  Send,
  X,
  Calendar,
  Tag,
  Briefcase,
  UserCheck,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Eye,
  Globe,
  Smartphone,
  Monitor,
  Ticket,
  Circle,
  PauseCircle,
  CheckCircle2,
  GitFork,
  ExternalLink,
  GitBranch
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../components/CommentSection';

const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const ProjectFeeds = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const { isCollapsed } = useSidebar();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);

  // Handle resize for responsive detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FILTERS
  const [feedTypeFilter, setFeedTypeFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // EDIT MODAL
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);

  // State for expanded feed row (for detailed view)
  const [expandedFeedId, setExpandedFeedId] = useState(null);

  // State for Git last updated dates
  const [gitLastUpdated, setGitLastUpdated] = useState({});
  const [loadingGitDates, setLoadingGitDates] = useState(false);

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

  const [developers, setDevelopers] = useState([]);
  const [feedStatuses, setFeedStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState({});

  // State for comment modal
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentFeed, setSelectedCommentFeed] = useState(null);

  // State for Feed Comments Modal
  const [showFeedCommentModal, setShowFeedCommentModal] = useState(false);
  const [selectedFeedForComments, setSelectedFeedForComments] = useState(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);

  // State for Generate Ticket Modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketFeed, setSelectedTicketFeed] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'Medium'
  });
  const [generatingTicket, setGeneratingTicket] = useState(false);

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('role') || 'User';

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  // Get today's day name
  const getTodayDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Get today's day of month
  const getTodayDayOfMonth = () => {
    return new Date().getDate();
  };

  // Check if feed is scheduled for today
  const isFeedForToday = (feed) => {
    if (feed.feedType === 'Daily') return true;
    if (feed.feedType === 'Weekly') {
      return feed.weekDay === getTodayDayName();
    }
    if (feed.feedType === 'Monthly') {
      return feed.monthDay === getTodayDayOfMonth();
    }
    return false;
  };

  // Check if feed is completed for today
  const isCompletedToday = (feed) => {
    const today = new Date().toISOString().split('T')[0];
    if (feed.completionHistory && Array.isArray(feed.completionHistory)) {
      return feed.completionHistory.some(h => h && h.date === today);
    }
    return false;
  };

  // Get developer names by IDs
  const getDeveloperNames = (developerList) => {
    if (!developerList || developerList.length === 0) return [];
    
    return developerList.map(dev => {
      if (dev && typeof dev === 'object' && dev.name) {
        return dev.name;
      }
      if (dev && typeof dev === 'object' && dev._id) {
        const found = developers.find(d => d._id === dev._id);
        return found ? found.name : dev._id.substring(0, 8);
      }
      if (typeof dev === 'string') {
        const found = developers.find(d => d._id === dev);
        return found ? found.name : dev.substring(0, 8);
      }
      return 'Unknown';
    });
  };

  // Get schedule display text for feed
  const getScheduleDisplay = (feed) => {
    if (feed.feedType === 'Weekly' && feed.weekDay) {
      return `Every ${feed.weekDay}`;
    }
    if (feed.feedType === 'Monthly' && feed.monthDay) {
      const suffix = getOrdinalSuffix(feed.monthDay);
      return `Day ${feed.monthDay}${suffix}`;
    }
    if (feed.feedType === 'Daily') {
      return 'Every Day';
    }
    return '—';
  };

  // Get ordinal suffix for day numbers
  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch(platform) {
      case 'Web': return <Globe size={12} />;
      case 'App': return <Smartphone size={12} />;
      case 'Both': return <Monitor size={12} />;
      default: return null;
    }
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    switch(platform) {
      case 'Web': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'App': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Both': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  // Get feed type color
  const getFeedTypeColor = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Monthly': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Once off': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Get feed status color
  const getFeedStatusColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (status === 'New') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'In process') return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (status === 'Awaiting Client Approval') return 'bg-pink-100 text-pink-700 border-pink-200';
    if (status.includes('In progress')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status.includes('Delivered')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'BAU Initiated') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (status === 'Closed') return 'bg-slate-100 text-slate-700 border-slate-200';
    if (status.includes('ON hold')) {
      if (status.includes('Sales')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (status.includes('Technical')) return 'bg-red-100 text-red-700 border-red-200';
      if (status.includes('Client')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={12} />;
      case 'Weekly': return <Calendar size={12} />;
      case 'Monthly': return <Calendar size={12} />;
      case 'Once off': return <Tag size={12} />;
      default: return <Clock size={12} />;
    }
  };

  // Update feed status
  const updateFeedStatus = async (feedId, newStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [feedId]: true }));
    try {
      await axios.patch(`${ADMIN_BASE}/feeds/${feedId}/status`,
        { feedStatus: newStatus },
        authHeader
      );
      toast.success(`Feed status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      console.error('Error updating feed status:', err);
      toast.error(err.response?.data?.error || 'Failed to update feed status');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [feedId]: false }));
    }
  };

  // Fetch feed status options
  const fetchFeedStatusOptions = async () => {
    try {
      const res = await axios.get(`${ADMIN_BASE}/feed-status-options`, authHeader);
      setFeedStatuses(res.data);
    } catch (err) {
      console.error('Error fetching feed status options:', err);
    }
  };

  // Fetch Git last updated date for a feed folder
  const fetchGitLastUpdated = async (feed) => {
    if (!feed.gitRepoName || !feed.gitRepoUrl) return null;
    
    try {
      const token = localStorage.getItem('token');
      const feedFolderName = feed.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Use GitHub API to get the last commit date for the feed folder
      const response = await axios.get(
        `${API_BASE_URL}/api/admin/projects/${feed.projectId}/repo-folder-last-updated`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { folderPath: feedFolderName }
        }
      );
      
      if (response.data.success && response.data.lastUpdated) {
        return response.data.lastUpdated;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching Git last updated for feed ${feed.name}:`, error);
      return null;
    }
  };

  // Fetch Git last updated dates for all feeds
  const fetchAllGitLastUpdated = async (feedsList) => {
    if (!feedsList || feedsList.length === 0) return;
    
    setLoadingGitDates(true);
    const updates = {};
    
    // Process feeds in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < feedsList.length; i += batchSize) {
      const batch = feedsList.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (feed) => {
          if (feed.gitRepoName && feed.gitRepoUrl) {
            const date = await fetchGitLastUpdated(feed);
            if (date) {
              updates[feed._id] = date;
            }
          }
        })
      );
      // Small delay between batches
      if (i + batchSize < feedsList.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setGitLastUpdated(prev => ({ ...prev, ...updates }));
    setLoadingGitDates(false);
  };

  // Get human-readable time difference
  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${Math.floor(diffMonths / 12)}y ago`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openCommentModal = (feed) => {
    const today = new Date().toISOString().split('T')[0];
    if (feed.completionHistory && Array.isArray(feed.completionHistory)) {
      const todayCompletion = feed.completionHistory.find(h => h && h.date === today);
      if (todayCompletion) {
        setSelectedCommentFeed({
          name: feed.name,
          projectName: feed.projectName,
          projectCustomId: feed.projectCustomId,
          description: todayCompletion.description || 'No description provided',
          completedAt: todayCompletion.completedAt
        });
        setShowCommentModal(true);
      }
    }
  };

  // Open Feed Comment Modal
  const openFeedCommentModal = (feed) => {
    setSelectedFeedForComments(feed);
    setShowFeedCommentModal(true);
    setCommentRefreshTrigger(prev => prev + 1);
  };

  // Close Feed Comment Modal
  const closeFeedCommentModal = () => {
    setShowFeedCommentModal(false);
    setSelectedFeedForComments(null);
  };

  // Open Generate Ticket Modal
  const openTicketModal = (feed) => {
    setSelectedTicketFeed(feed);
    setTicketForm({
      title: `Issue with feed: ${feed.name}`,
      description: `Feed: ${feed.name}\nProject: ${feed.projectCustomId}\n\nDescription:`,
      priority: 'Medium'
    });
    setShowTicketModal(true);
  };

  // Close Ticket Modal
  const closeTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicketFeed(null);
    setTicketForm({
      title: '',
      description: '',
      priority: 'Medium'
    });
  };

  // Handle Generate Ticket
  const handleGenerateTicket = async () => {
    if (!ticketForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!ticketForm.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setGeneratingTicket(true);

    try {
      const payload = {
        title: ticketForm.title,
        description: ticketForm.description,
        priority: ticketForm.priority,
        projectId: selectedTicketFeed.projectId,
        feedId: selectedTicketFeed._id
      };

      await axios.post(`${API_BASE_URL}/api/tickets`, payload, authHeader);
      
      toast.success(`Ticket generated successfully for feed: ${selectedTicketFeed.name}`);
      closeTicketModal();
      navigate('/tickets');
      
    } catch (err) {
      console.error('Error generating ticket:', err);
      toast.error(err.response?.data?.error || 'Failed to generate ticket');
    } finally {
      setGeneratingTicket(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFeedStatusOptions();
  }, []);

  useEffect(() => {
    if (projects.length > 0 && location.state?.selectedProjectId) {
      const projectExists = projects.some(p => p._id === location.state.selectedProjectId);
      if (projectExists) {
        setSelectedProject(location.state.selectedProjectId);
        window.history.replaceState({}, document.title);
      } else {
        setSelectedProject('ALL');
      }
    }
  }, [projects, location.state]);

  // Fetch Git last updated dates when feeds change
  useEffect(() => {
    if (feeds.length > 0) {
      fetchAllGitLastUpdated(feeds);
    }
  }, [feeds]);

  // RESET PAGE
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, searchTerm, feedTypeFilter, itemsPerPage]);
  
 // frontend/src/pages/ProjectFeeds.jsx - UPDATED fetchData

const fetchData = async () => {
  try {
    const [projectRes, devRes] = await Promise.all([
      axios.get(`${ADMIN_BASE}/projects`, authHeader),
      axios.get(`${ADMIN_BASE}/users/developers`, authHeader)
    ]);

    const allProjects = projectRes.data || [];

    // ✅ FIX: For Super Admin and Admin, show ALL projects
    // For Project Manager, filter by projectManager
    let filteredProjects;
    const userRole = localStorage.getItem('role');
    
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      // Super Admin and Admin see ALL projects
      filteredProjects = allProjects;
    } else {
      // Project Manager sees only their projects
      filteredProjects = allProjects.filter(
        p =>
          p.projectManager?._id === currentUserId ||
          p.projectManager === currentUserId
      );
    }

    setProjects(filteredProjects);
    setDevelopers(devRes.data || []);

    // Extract all feeds from projects
    const allFeeds = filteredProjects.flatMap(project =>
      (project.feeds || []).map(feed => ({
        ...feed,
        projectId: project._id,
        projectName: project.name,
        projectCustomId: project.projectCustomId,
        gitRepoUrl: project.gitRepoUrl,
        gitRepoName: project.gitRepoName
      }))
    );

    setFeeds(allFeeds);

  } catch (err) {
    console.error(err);
    toast.error('Failed to fetch data');
  }
};

// frontend/src/pages/ProjectFeeds.jsx - UPDATED filteredFeeds

const filteredFeeds = useMemo(() => {
  let result = [...feeds];

  // ✅ FIX: For Super Admin and Admin, show ALL projects in dropdown
  // The project filter dropdown will still work, but now shows all projects
  if (selectedProject !== 'ALL') {
    result = result.filter(
      feed => feed.projectId === selectedProject
    );
  }

  if (feedTypeFilter !== 'ALL') {
    result = result.filter(
      feed => feed.feedType === feedTypeFilter
    );
  }

  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase();
    result = result.filter(feed =>
      feed.name?.toLowerCase().includes(search) ||
      feed.projectCustomId?.toLowerCase().includes(search) ||
      feed.webDomain?.toLowerCase().includes(search)
    );
  }

  result.sort((a, b) =>
    (a.projectCustomId || '').localeCompare(
      b.projectCustomId || '',
      undefined,
      { numeric: true, sensitivity: 'base' }
    )
  );

  return result;
}, [feeds, selectedProject, searchTerm, feedTypeFilter]);
  // PAGINATION
  const indexOfLastFeed = currentPage * itemsPerPage;
  const indexOfFirstFeed = indexOfLastFeed - itemsPerPage;
  const currentFeeds = filteredFeeds.slice(indexOfFirstFeed, indexOfLastFeed);
  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);

  // EDIT FEED
  const handleEditClick = (feed) => {
    setEditingFeedId(feed._id);
    setFeedForm({
      name: feed.name || '',
      assignedDevelopers: feed.assignedDevelopers?.map(d =>
        typeof d === 'object' ? d._id : d
      ) || [],
      feedType: feed.feedType || 'Daily',
      weekDay: feed.weekDay || '',
      monthDay: feed.monthDay || '',
      feedPlatform: feed.feedPlatform || '',
      webDomain: feed.webDomain || '',
      feedStatus: feed.feedStatus || 'New'
    });
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
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
    setEditingFeedId(null);
  };

  const handleUpdateFeed = async (e) => {
    e.preventDefault();
    try {
      const updatePayload = {
        name: feedForm.name,
        assignedDevelopers: feedForm.assignedDevelopers,
        feedType: feedForm.feedType,
        weekDay: feedForm.feedType === 'Weekly' ? feedForm.weekDay : '',
        monthDay: feedForm.feedType === 'Monthly' ? feedForm.monthDay : null,
        feedPlatform: feedForm.feedPlatform || null,
        webDomain: (feedForm.feedPlatform === 'Web' || feedForm.feedPlatform === 'Both') ? feedForm.webDomain : null,
        feedStatus: feedForm.feedStatus
      };
      
      await axios.put(
        `${ADMIN_BASE}/feeds/${editingFeedId}`,
        updatePayload,
        authHeader
      );
      closeModal();
      fetchData();
      toast.success('Feed updated successfully');
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.error || 'Failed to update feed');
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-3 sm:p-6 transition-all duration-300 ${isCollapsed ? 'ml-10 sm:ml-20' : 'ml-64'}`}>
      <div className="w-full max-w-full">
        {/* HEADER SECTION */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Feed Center
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 mt-0.5 sm:mt-1">
                Monitor and manage all active project feeds
              </p>
            </div>

            {/* FILTERS SECTION - Responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 sm:p-3 rounded-xl shadow-sm border border-slate-200">
              {/* Project Select */}
              <div className="relative">
                <Briefcase size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none font-semibold text-xs text-slate-700 hover:border-slate-300 focus:border-blue-400 transition-colors cursor-pointer"
                >
                  <option value="ALL">All Projects</option>
                  {projects.slice(0, 20).map(project => (
                    <option key={project._id} value={project._id}>
                      {project.projectCustomId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="relative">
                <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={feedTypeFilter}
                  onChange={(e) => setFeedTypeFilter(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none font-semibold text-xs text-slate-700 hover:border-slate-300 focus:border-blue-400 transition-colors cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Once off">Once off</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search feeds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none font-medium text-xs placeholder:text-slate-400 focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items Per Page Selector */}
        <div className="flex justify-end mb-3 sm:mb-4">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm">
            <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs sm:text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-[8px] sm:text-[10px] font-black text-slate-500">per page</span>
          </div>
        </div>

        {/* TABLE SECTION - Only the table is horizontally scrollable */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isMobile ? (
            // Mobile Card View - No horizontal scroll needed
            <div className="divide-y divide-slate-100">
              {currentFeeds.length > 0 ? (
                currentFeeds.map((feed) => {
                  const isExpanded = expandedFeedId === feed._id;
                  const developerNames = getDeveloperNames(feed.assignedDevelopers || []);
                  const gitUrl = feed.gitRepoUrl || feed.projectId?.gitRepoUrl;
                  const gitName = feed.gitRepoName || feed.projectId?.gitRepoName;
                  const lastUpdated = gitLastUpdated[feed._id];
                  
                  return (
                    <div key={feed._id} className="p-3 hover:bg-slate-50/60 transition-all">
                      {/* Feed Header */}
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                              <Hash size={12} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-sm font-bold text-slate-800 truncate">{feed.name}</p>
                                {lastUpdated && (
                                  <span className="text-[8px] text-slate-400 flex items-center gap-0.5" title={formatDate(lastUpdated)}>
                                    <GitBranch size={10} className="text-blue-400" />
                                    {getTimeAgo(lastUpdated)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase">
                            <Briefcase size={8} />
                            <span className="max-w-[50px] truncate">{feed.projectCustomId}</span>
                          </span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase border ${getFeedTypeColor(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {feed.feedType}
                          </span>
                          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="mt-2">
                        <div className="relative w-full">
                          <select
                            value={feed.feedStatus || 'New'}
                            onChange={(e) => updateFeedStatus(feed._id, e.target.value)}
                            disabled={updatingStatus[feed._id]}
                            className={`w-full px-2 py-1 rounded-md text-[8px] font-black uppercase border cursor-pointer transition-all ${getFeedStatusColor(feed.feedStatus)}`}
                          >
                            {feedStatuses.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          {updatingStatus[feed._id] && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Developers */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {developerNames.slice(0, 3).map((devName, idx) => (
                          <span key={idx} className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md text-[7px] font-bold">
                            <Users size={8} />
                            {devName.length > 12 ? devName.substring(0, 10) + '..' : devName}
                          </span>
                        ))}
                        {developerNames.length > 3 && (
                          <span className="text-[7px] font-bold text-blue-500">+{developerNames.length - 3}</span>
                        )}
                        {developerNames.length === 0 && (
                          <span className="text-[7px] font-bold text-slate-400 italic">Unassigned</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                        <button
                          onClick={() => openFeedCommentModal(feed)}
                          className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white transition-all"
                          title="Comments"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => handleEditClick(feed)}
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => openTicketModal(feed)}
                          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all"
                          title="Generate Ticket"
                        >
                          <Ticket size={14} />
                        </button>
                        {gitUrl && (
                          <a 
                            href={gitUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                            title="Git Repository"
                          >
                            <GitFork size={14} />
                          </a>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                          {/* Platform */}
                          {feed.feedPlatform && (
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-bold text-slate-500">Platform:</span>
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[7px] font-black ${getPlatformColor(feed.feedPlatform)}`}>
                                {getPlatformIcon(feed.feedPlatform)}
                                {feed.feedPlatform}
                              </span>
                              {(feed.feedPlatform === 'Web' || feed.feedPlatform === 'Both') && feed.webDomain && (
                                <a href={feed.webDomain} target="_blank" rel="noopener noreferrer" className="text-[7px] text-blue-600 hover:underline truncate max-w-[120px]">
                                  {feed.webDomain}
                                </a>
                              )}
                            </div>
                          )}

                          {/* Schedule */}
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-slate-500">Schedule:</span>
                            <span className="text-[8px] font-medium text-slate-700">{getScheduleDisplay(feed)}</span>
                          </div>

                          {/* Git Last Updated Info */}
                          {lastUpdated && (
                            <div className="flex items-center gap-2">
                              <GitBranch size={12} className="text-blue-500" />
                              <span className="text-[8px] font-bold text-slate-500">Last Git Update:</span>
                              <span className="text-[8px] text-slate-600">{formatDate(lastUpdated)}</span>
                            </div>
                          )}

                          {/* Comments */}
                          <div className="mt-1">
                            <CommentSection
                              type="feed"
                              entityId={feed._id}
                              userRole={userRole}
                              userId={currentUserId}
                              currentUserName={userName}
                              canComment={true}
                              refreshTrigger={commentRefreshTrigger}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <Activity size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold uppercase text-slate-400">No feeds found</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Try adjusting your filters</p>
                </div>
              )}
            </div>
          ) : (
            // Desktop Table View - Only this is horizontally scrollable
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Feed Details</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Project</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Git Last Updated</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Developers</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Git Repository</th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFeeds.length > 0 ? (
                    currentFeeds.map((feed, idx) => {
                      const isExpanded = expandedFeedId === feed._id;
                      const developerNames = getDeveloperNames(feed.assignedDevelopers || []);
                      const displayDevelopers = developerNames.slice(0, 2);
                      const hasMoreDevelopers = developerNames.length > 2;
                      const gitUrl = feed.gitRepoUrl || feed.projectId?.gitRepoUrl;
                      const gitName = feed.gitRepoName || feed.projectId?.gitRepoName;
                      const lastUpdated = gitLastUpdated[feed._id];
                      
                      return (
                        <React.Fragment key={feed._id}>
                          <tr
                            className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-200 cursor-pointer ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                            } ${isExpanded ? 'bg-blue-50/40' : ''}`}
                            onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                                  <Hash size={12} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800 whitespace-nowrap">{feed.name}</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[8px] font-black uppercase whitespace-nowrap">
                                <Briefcase size={8} />
                                {feed.projectCustomId}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase border whitespace-nowrap ${getFeedTypeColor(feed.feedType)}`}>
                                {getFeedTypeIcon(feed.feedType)}
                                {feed.feedType}
                              </span>
                            </td>

                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="relative min-w-[120px]">
                                <select
                                  value={feed.feedStatus || 'New'}
                                  onChange={(e) => updateFeedStatus(feed._id, e.target.value)}
                                  disabled={updatingStatus[feed._id]}
                                  className={`inline-flex w-full items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black uppercase border cursor-pointer transition-all appearance-none pr-6 ${getFeedStatusColor(feed.feedStatus)}`}
                                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '8px' }}
                                >
                                  {feedStatuses.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                                {updatingStatus[feed._id] && (
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {loadingGitDates ? (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              ) : lastUpdated ? (
                                <div className="flex items-center gap-1.5">
                                  <GitBranch size={12} className="text-blue-500" />
                                  <span className="text-[9px] font-medium text-slate-600" title={formatDate(lastUpdated)}>
                                    {getTimeAgo(lastUpdated)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[8px] text-slate-400 italic whitespace-nowrap">Never</span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {displayDevelopers.map((devName, devIdx) => (
                                    <span
                                      key={devIdx}
                                      className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md text-[7px] font-bold whitespace-nowrap"
                                    >
                                      <Users size={6} />
                                      {devName.length > 12 ? devName.substring(0, 10) + '..' : devName}
                                    </span>
                                  ))}
                                </div>
                                {hasMoreDevelopers && (
                                  <span className="text-[7px] font-bold text-blue-500 whitespace-nowrap">
                                    +{developerNames.length - 2} more
                                  </span>
                                )}
                                {developerNames.length === 0 && (
                                  <span className="text-[7px] font-bold text-slate-400 italic whitespace-nowrap">Unassigned</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {gitUrl ? (
                                <a 
                                  href={gitUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[8px] text-blue-600 hover:underline whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GitFork size={10} />
                                  {gitName || 'View Repo'}
                                </a>
                              ) : (
                                <span className="text-[8px] text-slate-400 italic whitespace-nowrap">No Git repo</span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                                  className="group w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all flex-shrink-0"
                                  title={isExpanded ? "Collapse Details" : "Expand Details"}
                                >
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                <button
                                  onClick={() => openFeedCommentModal(feed)}
                                  className="group w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-purple-50 hover:text-purple-600 transition-all flex-shrink-0"
                                  title="View Comments"
                                >
                                  <MessageSquare size={12} />
                                </button>
                                <button
                                  onClick={() => handleEditClick(feed)}
                                  className="group w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all flex-shrink-0"
                                  title="Edit Feed"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={() => openTicketModal(feed)}
                                  className="group w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 hover:bg-amber-600 hover:text-white transition-all flex-shrink-0"
                                  title="Generate Ticket"
                                >
                                  <Ticket size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-blue-50/30">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                        <Globe size={12} />
                                      </div>
                                      <h4 className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Platform & URL</h4>
                                    </div>
                                    {feed.feedPlatform ? (
                                      <div>
                                        <p className="text-xs font-bold text-slate-700 mb-1 whitespace-nowrap">{feed.feedPlatform}</p>
                                        {(feed.feedPlatform === 'Web' || feed.feedPlatform === 'Both') && feed.webDomain && (
                                          <a 
                                            href={feed.webDomain} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[9px] text-blue-600 hover:underline break-all flex items-center gap-1"
                                          >
                                            <ExternalLink size={10} />
                                            {feed.webDomain}
                                          </a>
                                        )}
                                        {feed.feedPlatform === 'App' && (
                                          <p className="text-[9px] text-slate-500 italic whitespace-nowrap">Mobile application platform</p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic whitespace-nowrap">No platform specified</p>
                                    )}
                                  </div>

                                  <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                                        <Calendar size={12} />
                                      </div>
                                      <h4 className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Schedule</h4>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 whitespace-nowrap">{getScheduleDisplay(feed)}</p>
                                    {feed.feedType === 'Weekly' && feed.weekDay && (
                                      <p className="text-[8px] text-slate-500 mt-1 whitespace-nowrap">Every {feed.weekDay}</p>
                                    )}
                                    {feed.feedType === 'Monthly' && feed.monthDay && (
                                      <p className="text-[8px] text-slate-500 mt-1 whitespace-nowrap">Day {feed.monthDay} of each month</p>
                                    )}
                                    {feed.feedType === 'Once off' && (
                                      <p className="text-[8px] text-slate-500 mt-1 whitespace-nowrap">One-time execution</p>
                                    )}
                                  </div>
                                </div>

                                {/* Git Last Updated Details */}
                                {lastUpdated && (
                                  <div className="mt-3 bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                        <GitBranch size={12} />
                                      </div>
                                      <h4 className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Git Last Updated</h4>
                                    </div>
                                    <p className="text-xs font-medium text-slate-700">{formatDate(lastUpdated)}</p>
                                    <p className="text-[8px] text-slate-400 mt-0.5">{getTimeAgo(lastUpdated)}</p>
                                  </div>
                                )}

                                <div className="mt-3 bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                      <MessageSquare size={12} />
                                    </div>
                                    <h4 className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Feed Comments</h4>
                                  </div>
                                  <CommentSection
                                    type="feed"
                                    entityId={feed._id}
                                    userRole={userRole}
                                    userId={currentUserId}
                                    currentUserName={userName}
                                    canComment={true}
                                    refreshTrigger={commentRefreshTrigger}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                            <Activity size={20} className="text-slate-300" />
                          </div>
                          <p className="text-xs font-bold uppercase text-slate-400">No feeds found</p>
                          <p className="text-[9px] text-slate-300 mt-0.5">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
            <div className="text-[8px] sm:text-[10px] font-bold text-slate-400">
              Showing {indexOfFirstFeed + 1} to {Math.min(indexOfLastFeed, filteredFeeds.length)} of {filteredFeeds.length} feeds
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={isMobile ? 14 : 16} />
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
                    return <span key="ellipsis1" className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center text-slate-400 text-[10px] sm:text-xs">...</span>;
                  }
                  
                  if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                    return <span key="ellipsis2" className="w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center text-slate-400 text-[10px] sm:text-xs">...</span>;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 sm:w-7 h-6 sm:h-7 rounded-md text-[9px] sm:text-[11px] font-black transition-all ${
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
                className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={isMobile ? 14 : 16} />
              </button>
            </div>
          </div>
        )}

        {/* MODALS - Same as before */}
        {/* EDIT MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex justify-center items-center z-[120] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Edit Feed</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Update feed configuration</p>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateFeed} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Feed Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter feed name"
                    value={feedForm.name}
                    onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Feed Type</label>
                  <select
                    value={feedForm.feedType}
                    onChange={(e) =>
                      setFeedForm({
                        ...feedForm,
                        feedType: e.target.value,
                        weekDay: e.target.value !== 'Weekly' ? '' : feedForm.weekDay,
                        monthDay: e.target.value !== 'Monthly' ? '' : feedForm.monthDay
                      })
                    }
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Once off">Once off</option>
                  </select>
                </div>

                {feedForm.feedType === 'Weekly' && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Select Day</label>
                    <select
                      required
                      value={feedForm.weekDay}
                      onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                    >
                      <option value="">Choose a day</option>
                      {weekDays.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}

                {feedForm.feedType === 'Monthly' && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Day of Month (1-31)</label>
                    <select
                      required
                      value={feedForm.monthDay}
                      onChange={(e) => setFeedForm({ ...feedForm, monthDay: e.target.value })}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                    >
                      <option value="">Select day</option>
                      {[...Array(31)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}{getOrdinalSuffix(i + 1)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Feed Status</label>
                  <select
                    value={feedForm.feedStatus}
                    onChange={(e) => setFeedForm({ ...feedForm, feedStatus: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                  >
                    {feedStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Platform Type</label>
                  <div className="flex gap-2">
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
                        className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                          feedForm.feedPlatform === platform
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>

                {(feedForm.feedPlatform === 'Web' || feedForm.feedPlatform === 'Both') && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Domain URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={feedForm.webDomain}
                      onChange={(e) => setFeedForm({ ...feedForm, webDomain: e.target.value })}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-2 block flex items-center gap-1">
                    <UserCheck size={10} />
                    Assign Developers
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {developers.map(dev => (
                      <label
                        key={dev._id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          feedForm.assignedDevelopers.includes(dev._id)
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={feedForm.assignedDevelopers.includes(dev._id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...feedForm.assignedDevelopers, dev._id]
                              : feedForm.assignedDevelopers.filter(id => id !== dev._id);
                            setFeedForm({ ...feedForm, assignedDevelopers: updated });
                          }}
                          className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[10px] font-bold text-slate-700 truncate">{dev.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-black rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all uppercase text-[10px] tracking-wider shadow-md"
                >
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {/* FEED COMMENT MODAL */}
        {showFeedCommentModal && selectedFeedForComments && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[140] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-black text-[#1B2559]">Feed Comments</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selectedFeedForComments.name}
                    <span className="text-[9px] text-slate-400 ml-2">
                      {selectedFeedForComments.projectCustomId}
                    </span>
                  </p>
                </div>
                <button 
                  onClick={closeFeedCommentModal}
                  className="text-slate-300 hover:text-slate-600 transition-colors"
                >
                  <X size={28} />
                </button>
              </div>
              
              <CommentSection
                type="feed"
                entityId={selectedFeedForComments._id}
                userRole={userRole}
                userId={currentUserId}
                currentUserName={userName}
                canComment={true}
                refreshTrigger={commentRefreshTrigger}
              />
            </div>
          </div>
        )}

        {/* GENERATE TICKET MODAL */}
        {showTicketModal && selectedTicketFeed && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl">
              <div className="p-5 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Generate Support Ticket</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Feed: <span className="font-bold text-blue-600">{selectedTicketFeed.name}</span>
                    </p>
                  </div>
                  <button onClick={closeTicketModal} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Ticket Title *</label>
                  <input
                    type="text"
                    placeholder="Brief summary of the issue"
                    value={ticketForm.title}
                    onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">Description *</label>
                  <textarea
                    placeholder="Detailed description of the issue..."
                    rows={3}
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 flex gap-2">
                <button onClick={closeTicketModal} className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleGenerateTicket}
                  disabled={generatingTicket}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black uppercase text-[10px] tracking-wider hover:from-amber-600 hover:to-amber-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {generatingTicket ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Ticket size={12} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COMMENT VIEW MODAL */}
        {showCommentModal && selectedCommentFeed && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <h3 className="text-base font-black text-slate-800">Completion Comment</h3>
                </div>
                <button onClick={() => setShowCommentModal(false)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Feed</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCommentFeed.name}</p>
                  <p className="text-[10px] text-slate-500">{selectedCommentFeed.projectCustomId}</p>
                </div>
                <div className="mb-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Comment</p>
                  <div className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-700 leading-relaxed">"{selectedCommentFeed.description}"</p>
                  </div>
                </div>
                {selectedCommentFeed.completedAt && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Completed At</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(selectedCommentFeed.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={() => setShowCommentModal(false)} className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black uppercase text-[10px] tracking-wider hover:from-emerald-600 hover:to-emerald-700 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFeeds;