// frontend/src/pages/ProjectFeeds.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

import {
  Hash,
  ChevronLeft,
  ChevronRight,
  Activity,
  Edit3,
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
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../components/CommentSection';
import DeveloperPicker from '../components/DeveloperPicker';
import AssignDevelopersCell from '../components/AssignDevelopersCell';
import FeedFilterBar from '../components/FeedFilterBar';
import { isProjectManagerOf } from '../utils/projectAccess';
import useFeedFilters, { assignedPeople, countFeedsByDeveloper, feedTypeLabel } from '../utils/useFeedFilters';
import useIsMobile from '../utils/useIsMobile';

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
  const location = useLocation();
  const isMobile = useIsMobile();

  // FILTERS + PAGE (kept in the URL; a project can also come from Project Management)
  const {
    filters, setFilter, clearFilters, isFiltered,
    filteredFeeds: matchingFeeds,
    page, setPage: setCurrentPage
  } = useFeedFilters(feeds, projects, location.state?.selectedProjectId);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // EDIT MODAL
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);

  // State for expanded feed row (for detailed view)
  const [expandedFeedId, setExpandedFeedId] = useState(null);

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

  // For the developer pickers: how many of these feeds each developer has, and who is on them
  const feedCounts = useMemo(() => countFeedsByDeveloper(feeds), [feeds]);
  const knownPeople = useMemo(() => assignedPeople(feeds), [feeds]);

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
        p => isProjectManagerOf(p, currentUserId)
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
  const result = [...matchingFeeds];

  result.sort((a, b) =>
    (a.projectCustomId || '').localeCompare(
      b.projectCustomId || '',
      undefined,
      { numeric: true, sensitivity: 'base' }
    )
  );

  return result;
}, [matchingFeeds]);
  // PAGINATION
  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);
  // the last page can disappear when an assignment moves a feed out of the filters
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const indexOfLastFeed = currentPage * itemsPerPage;
  const indexOfFirstFeed = indexOfLastFeed - itemsPerPage;
  const currentFeeds = filteredFeeds.slice(indexOfFirstFeed, indexOfLastFeed);

  // ASSIGN DEVELOPERS FROM THE TABLE: saves only the developers and updates only this row
  const handleAssignDevelopers = async (feed, developerIds) => {
    try {
      const res = await axios.put(
        `${ADMIN_BASE}/feeds/${feed._id}`,
        { assignedDevelopers: developerIds },
        authHeader
      );
      setFeeds(prev => prev.map(f =>
        f._id === feed._id ? { ...f, assignedDevelopers: res.data.assignedDevelopers } : f
      ));
      toast.success(`Developers updated for ${feed.name}`);
      return true;
    } catch (err) {
      console.error('Error assigning developers:', err);
      toast.error(err.response?.data?.error || 'Failed to update developers');
      return false;
    }
  };

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
    <div className="page bg-slate-50">
      <div className="w-full max-w-full">
        {/* HEADER SECTION */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3">
            <div>
              <h1 className="page-title">
                Feed Center
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Monitor and manage all active project feeds
              </p>
            </div>

            {/* FILTERS SECTION */}
            <FeedFilterBar
              filters={filters}
              setFilter={setFilter}
              clearFilters={clearFilters}
              isFiltered={isFiltered}
              projects={projects}
              statuses={feedStatuses}
              developers={developers}
              feedCounts={feedCounts}
              knownPeople={knownPeople}
              shown={filteredFeeds.length}
              total={feeds.length}
            />
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
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs font-semibold text-slate-500">per page</span>
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
                  const gitUrl = feed.gitRepoUrl || feed.projectId?.gitRepoUrl;
                  const gitName = feed.gitRepoName || feed.projectId?.gitRepoName;
                  const lastUpdated = feed.gitLastUpdated; // stored in DB, synced weekly
                  
                  return (
                    <div key={feed._id} className="p-3 hover:bg-slate-50/60 transition-all">
                      {/* Feed Header */}
                      <div 
                        className="flex flex-col gap-2 cursor-pointer"
                        onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                              <Hash size={12} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-sm font-semibold text-slate-800 min-w-0 break-words">{feed.name}</p>
                                {lastUpdated && (
                                  <span className="text-xs text-slate-400 flex items-center gap-0.5" title={formatDate(lastUpdated)}>
                                    <GitBranch size={12} className="text-blue-400" />
                                    {getTimeAgo(lastUpdated)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="badge bg-slate-100 text-slate-700">
                            <Briefcase size={12} />
                            <span>{feed.projectCustomId}</span>
                          </span>
                          <span className={`badge border ${getFeedTypeColor(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {feedTypeLabel(feed.feedType)}
                          </span>
                          {isExpanded ? <ChevronUp size={16} className="text-slate-400 ml-auto" /> : <ChevronDown size={16} className="text-slate-400 ml-auto" />}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="mt-2">
                        <div className="relative w-full">
                          <select
                            value={feed.feedStatus || 'New'}
                            onChange={(e) => updateFeedStatus(feed._id, e.target.value)}
                            disabled={updatingStatus[feed._id]}
                            className={`w-full px-2 py-1 rounded-md text-xs font-semibold uppercase border cursor-pointer transition-all ${getFeedStatusColor(feed.feedStatus)}`}
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
                      <div className="mt-1.5">
                        <AssignDevelopersCell
                          feed={feed}
                          developers={developers}
                          feedCounts={feedCounts}
                          onSave={handleAssignDevelopers}
                          maxNames={3}
                        />
                      </div>

                      {/* Actions */}
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                        <button
                          onClick={() => openFeedCommentModal(feed)}
                          className="btn-icon bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white"
                          title="Comments"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => handleEditClick(feed)}
                          className="btn-icon bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => openTicketModal(feed)}
                          className="btn-icon bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white"
                          title="Generate Ticket"
                        >
                          <Ticket size={14} />
                        </button>
                        {gitUrl && (
                          <a 
                            href={gitUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn-icon bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">Platform:</span>
                              <span className={`badge ${getPlatformColor(feed.feedPlatform)}`}>
                                {getPlatformIcon(feed.feedPlatform)}
                                {feed.feedPlatform}
                              </span>
                              {(feed.feedPlatform === 'Web' || feed.feedPlatform === 'Both') && feed.webDomain && (
                                <a href={feed.webDomain} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                                  {feed.webDomain}
                                </a>
                              )}
                            </div>
                          )}

                          {/* Schedule */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Schedule:</span>
                            <span className="text-xs font-medium text-slate-700">{getScheduleDisplay(feed)}</span>
                          </div>

                          {/* Git Last Updated Info */}
                          {lastUpdated && (
                            <div className="flex items-center gap-2">
                              <GitBranch size={12} className="text-blue-500" />
                              <span className="text-xs font-semibold text-slate-500">Last Git Update:</span>
                              <span className="text-xs text-slate-600">{formatDate(lastUpdated)}</span>
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
                  <p className="text-xs text-slate-300 mt-0.5">Try adjusting your filters</p>
                </div>
              )}
            </div>
          ) : (
            // Desktop Table View - Only this is horizontally scrollable
            <div className="table-scroll table-sticky-first overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="th">Feed Details</th>
                    <th className="th">Project</th>
                    <th className="th">Type</th>
                    <th className="th">Status</th>
                    <th className="th">Git Last Updated</th>
                    <th className="th">Assigned Developers</th>
                    <th className="th">Git Repository</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFeeds.length > 0 ? (
                    currentFeeds.map((feed, idx) => {
                      const isExpanded = expandedFeedId === feed._id;
                      const gitUrl = feed.gitRepoUrl || feed.projectId?.gitRepoUrl;
                      const gitName = feed.gitRepoName || feed.projectId?.gitRepoName;
                      const lastUpdated = feed.gitLastUpdated; // stored in DB, synced weekly
                      
                      return (
                        <React.Fragment key={feed._id}>
                          <tr
                            className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-200 cursor-pointer ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                            } ${isExpanded ? 'bg-blue-50/40' : ''}`}
                            onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                          >
                            <td className="td">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                                  <Hash size={12} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">{feed.name}</p>
                                </div>
                              </div>
                            </td>

                            <td className="td">
                              <span className="badge bg-slate-100 text-slate-700 whitespace-nowrap">
                                <Briefcase size={12} />
                                {feed.projectCustomId}
                              </span>
                            </td>

                            <td className="td">
                              <span className={`badge border whitespace-nowrap ${getFeedTypeColor(feed.feedType)}`}>
                                {getFeedTypeIcon(feed.feedType)}
                                {feedTypeLabel(feed.feedType)}
                              </span>
                            </td>

                            <td className="td" onClick={(e) => e.stopPropagation()}>
                              <div className="relative min-w-[120px]">
                                <select
                                  value={feed.feedStatus || 'New'}
                                  onChange={(e) => updateFeedStatus(feed._id, e.target.value)}
                                  disabled={updatingStatus[feed._id]}
                                  className={`inline-flex w-full items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold uppercase border cursor-pointer transition-all appearance-none pr-6 ${getFeedStatusColor(feed.feedStatus)}`}
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

                            <td className="td">
                              {lastUpdated ? (
                                <div className="flex items-center gap-1.5">
                                  <GitBranch size={12} className="text-blue-500" />
                                  <span className="text-xs font-medium text-slate-600" title={formatDate(lastUpdated)}>
                                    {getTimeAgo(lastUpdated)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic whitespace-nowrap">Never</span>
                              )}
                            </td>

                            <td className="td" onClick={(e) => e.stopPropagation()}>
                              <AssignDevelopersCell
                                feed={feed}
                                developers={developers}
                                feedCounts={feedCounts}
                                onSave={handleAssignDevelopers}
                              />
                            </td>

                            <td className="td">
                              {gitUrl ? (
                                <a 
                                  href={gitUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GitFork size={12} />
                                  {gitName || 'View Repo'}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic whitespace-nowrap">No Git repo</span>
                              )}
                            </td>

                            <td className="td">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                                  className="btn-icon group bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"
                                  title={isExpanded ? "Collapse Details" : "Expand Details"}
                                >
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                <button
                                  onClick={() => openFeedCommentModal(feed)}
                                  className="btn-icon group bg-slate-50 border border-slate-200 text-slate-500 hover:bg-purple-50 hover:text-purple-600 flex-shrink-0"
                                  title="View Comments"
                                >
                                  <MessageSquare size={12} />
                                </button>
                                <button
                                  onClick={() => handleEditClick(feed)}
                                  className="btn-icon group bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"
                                  title="Edit Feed"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={() => openTicketModal(feed)}
                                  className="btn-icon group bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-600 hover:text-white flex-shrink-0"
                                  title="Generate Ticket"
                                >
                                  <Ticket size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-blue-50/30">
                              <td colSpan={8} className="td">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                  <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                        <Globe size={12} />
                                      </div>
                                      <h4 className="text-sm font-semibold text-slate-500 whitespace-nowrap">Platform & URL</h4>
                                    </div>
                                    {feed.feedPlatform ? (
                                      <div>
                                        <p className="text-xs font-semibold text-slate-700 mb-1 whitespace-nowrap">{feed.feedPlatform}</p>
                                        {(feed.feedPlatform === 'Web' || feed.feedPlatform === 'Both') && feed.webDomain && (
                                          <a 
                                            href={feed.webDomain} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline break-all flex items-center gap-1"
                                          >
                                            <ExternalLink size={12} />
                                            {feed.webDomain}
                                          </a>
                                        )}
                                        {feed.feedPlatform === 'App' && (
                                          <p className="text-xs text-slate-500 italic whitespace-nowrap">Mobile application platform</p>
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
                                      <h4 className="text-sm font-semibold text-slate-500 whitespace-nowrap">Schedule</h4>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">{getScheduleDisplay(feed)}</p>
                                    {feed.feedType === 'Weekly' && feed.weekDay && (
                                      <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Every {feed.weekDay}</p>
                                    )}
                                    {feed.feedType === 'Monthly' && feed.monthDay && (
                                      <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Day {feed.monthDay} of each month</p>
                                    )}
                                    {feed.feedType === 'Once off' && (
                                      <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">One-time execution</p>
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
                                      <h4 className="text-sm font-semibold text-slate-500 whitespace-nowrap">Git Last Updated</h4>
                                    </div>
                                    <p className="text-xs font-medium text-slate-700">{formatDate(lastUpdated)}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{getTimeAgo(lastUpdated)}</p>
                                  </div>
                                )}

                                <div className="mt-3 bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                      <MessageSquare size={12} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-500 whitespace-nowrap">Feed Comments</h4>
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
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 shrink-0">
                            <Activity size={20} className="text-slate-300" />
                          </div>
                          <p className="text-xs font-semibold uppercase text-slate-400">No feeds found</p>
                          <p className="text-xs text-slate-300 mt-0.5">Try adjusting your filters</p>
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
            <div className="text-xs font-semibold text-slate-400">
              Showing {indexOfFirstFeed + 1} to {Math.min(indexOfLastFeed, filteredFeeds.length)} of {filteredFeeds.length} feeds
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
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
                onClick={() => setCurrentPage(currentPage + 1)}
                className="btn-icon bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* MODALS - Same as before */}
        {/* EDIT MODAL */}
        {showEditModal && (
          <div className="modal-backdrop">
            <div className="modal-panel max-w-lg">
              <div className="modal-header">
                <div>
                  <h2 className="section-title">Edit Feed</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Update feed configuration</p>
                </div>
                <button onClick={closeModal} className="btn-icon bg-slate-100 text-slate-500 hover:bg-slate-200">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateFeed} className="modal-body space-y-4">
                <div>
                  <label className="label block mb-1.5">Feed Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter feed name"
                    value={feedForm.name}
                    onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                    className="input bg-slate-50"
                  />
                </div>

                <div>
                  <label className="label block mb-1.5">Feed Type</label>
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
                    className="input bg-slate-50 cursor-pointer"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Once off">Once off</option>
                  </select>
                </div>

                {feedForm.feedType === 'Weekly' && (
                  <div>
                    <label className="label block mb-1.5">Select Day</label>
                    <select
                      required
                      value={feedForm.weekDay}
                      onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })}
                      className="input bg-slate-50 cursor-pointer"
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
                    <label className="label block mb-1.5">Day of Month (1-31)</label>
                    <select
                      required
                      value={feedForm.monthDay}
                      onChange={(e) => setFeedForm({ ...feedForm, monthDay: e.target.value })}
                      className="input bg-slate-50 cursor-pointer"
                    >
                      <option value="">Select day</option>
                      {[...Array(31)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}{getOrdinalSuffix(i + 1)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label block mb-1.5">Feed Status</label>
                  <select
                    value={feedForm.feedStatus}
                    onChange={(e) => setFeedForm({ ...feedForm, feedStatus: e.target.value })}
                    className="input bg-slate-50 cursor-pointer"
                  >
                    {feedStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label block mb-1.5">Platform Type</label>
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
                        className={`btn btn-md flex-1 ${
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
                    <label className="label block mb-1.5">Domain URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={feedForm.webDomain}
                      onChange={(e) => setFeedForm({ ...feedForm, webDomain: e.target.value })}
                      className="input bg-slate-50"
                    />
                  </div>
                )}

                <div>
                  <label className="label mb-1.5 flex items-center gap-1">
                    <UserCheck size={12} />
                    Assign Developers
                  </label>
                  <DeveloperPicker
                    developers={developers}
                    value={feedForm.assignedDevelopers}
                    onChange={(ids) => setFeedForm({ ...feedForm, assignedDevelopers: ids })}
                    feedCounts={feedCounts}
                    knownPeople={knownPeople}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-md w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-blue-600 hover:to-blue-700 shadow-md"
                >
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {/* FEED COMMENT MODAL */}
        {showFeedCommentModal && selectedFeedForComments && (
          <div className="modal-backdrop">
            <div className="modal-panel max-w-2xl">
              <div className="modal-header">
                <div>
                  <h2 className="section-title">Feed Comments</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selectedFeedForComments.name}
                    <span className="text-xs text-slate-400 ml-2">
                      {selectedFeedForComments.projectCustomId}
                    </span>
                  </p>
                </div>
                <button 
                  onClick={closeFeedCommentModal}
                  className="btn-icon text-slate-300 hover:text-slate-600"
                >
                  <X size={28} />
                </button>
              </div>
              
              <div className="modal-body">
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
          </div>
        )}

        {/* GENERATE TICKET MODAL */}
        {showTicketModal && selectedTicketFeed && (
          <div className="modal-backdrop">
            <div className="modal-panel max-w-lg">
              <div className="modal-header !block">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="section-title">Generate Support Ticket</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Feed: <span className="font-bold text-blue-600">{selectedTicketFeed.name}</span>
                    </p>
                  </div>
                  <button onClick={closeTicketModal} className="btn-icon bg-slate-100 text-slate-500 hover:bg-slate-200">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="modal-body space-y-4">
                <div>
                  <label className="label block mb-1.5">Ticket Title *</label>
                  <input
                    type="text"
                    placeholder="Brief summary of the issue"
                    value={ticketForm.title}
                    onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                    className="input bg-slate-50"
                  />
                </div>

                <div>
                  <label className="label block mb-1.5">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="input bg-slate-50 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="label block mb-1.5">Description *</label>
                  <textarea
                    placeholder="Detailed description of the issue..."
                    rows={3}
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                    className="input bg-slate-50 resize-none"
                  />
                </div>
              </div>

              <div className="modal-footer [&>button]:flex-1">
                <button onClick={closeTicketModal} className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200">
                  Cancel
                </button>
                <button
                  onClick={handleGenerateTicket}
                  disabled={generatingTicket}
                  className="btn btn-md flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-md disabled:opacity-50"
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
          <div className="modal-backdrop">
            <div className="modal-panel max-w-md">
              <div className="modal-header">
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <h3 className="section-title">Completion Comment</h3>
                </div>
                <button onClick={() => setShowCommentModal(false)} className="btn-icon bg-slate-100 hover:bg-slate-200">
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Feed</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCommentFeed.name}</p>
                  <p className="text-xs text-slate-500">{selectedCommentFeed.projectCustomId}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Comment</p>
                  <div className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-700 leading-relaxed">"{selectedCommentFeed.description}"</p>
                  </div>
                </div>
                {selectedCommentFeed.completedAt && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Completed At</p>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(selectedCommentFeed.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowCommentModal(false)} className="btn btn-md w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700">
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