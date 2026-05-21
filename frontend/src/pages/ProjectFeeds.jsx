import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
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
  Eye
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

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
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const { isCollapsed } = useSidebar();
  
  // FILTERS
  const [feedTypeFilter, setFeedTypeFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const feedsPerPage = 10;

  // EDIT MODAL
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);

  const [feedForm, setFeedForm] = useState({
    name: '',
    assignedDevelopers: [],
    feedType: 'Daily',
    weekDay: ''
  });

  const [developers, setDevelopers] = useState([]);
  const [todayFeedStats, setTodayFeedStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    percentage: 0,
    completedFeedsDetails: [] // Add this to store completed feed details
  });

  // State for expanded developers list
  const [expandedDeveloperFeedId, setExpandedDeveloperFeedId] = useState(null);
  
  // State for comment modal
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentFeed, setSelectedCommentFeed] = useState(null);

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
  
  const [showPushModal, setShowPushModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [isPushing, setIsPushing] = useState(false);

  const [taskForm, setTaskForm] = useState({
    details: '',
    targetUsers: []
  });
  
  // Get today's day name
  const getTodayDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Check if feed is scheduled for today
  const isFeedForToday = (feed) => {
    if (feed.feedType === 'Daily') return true;
    if (feed.feedType === 'Weekly') {
      return feed.weekDay === getTodayDayName();
    }
    return false;
  };

  // Check if feed is completed for today and get completion details
  const getTodayCompletionDetails = (feed) => {
    const today = new Date().toISOString().split('T')[0];
    if (feed.completionHistory && Array.isArray(feed.completionHistory)) {
      const todayCompletion = feed.completionHistory.find(h => h && h.date === today);
      if (todayCompletion) {
        return {
          isCompleted: true,
          description: todayCompletion.description || 'No description provided',
          completedBy: todayCompletion.completedBy,
          completedAt: todayCompletion.completedAt
        };
      }
    }
    return { isCompleted: false, description: null, completedBy: null, completedAt: null };
  };

  // Calculate today's feed stats with completion details
  const calculateTodayFeedStats = (allFeeds) => {
    const todayFeeds = allFeeds.filter(feed => isFeedForToday(feed));
    const completedFeedsDetails = [];
    let completedCount = 0;
    
    todayFeeds.forEach(feed => {
      const completion = getTodayCompletionDetails(feed);
      if (completion.isCompleted) {
        completedCount++;
        completedFeedsDetails.push({
          feedId: feed._id,
          feedName: feed.name,
          projectName: feed.projectName,
          projectCustomId: feed.projectCustomId,
          description: completion.description,
          completedBy: completion.completedBy,
          completedAt: completion.completedAt
        });
      }
    });
    
    const total = todayFeeds.length;
    const completed = completedCount;
    const pending = total - completed;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { total, completed, pending, percentage, completedFeedsDetails };
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

  useEffect(() => {
    fetchData();
  }, []);

  // Update stats when feeds change
  useEffect(() => {
    const stats = calculateTodayFeedStats(feeds);
    setTodayFeedStats(stats);
  }, [feeds]);

  // RESET PAGE
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, searchTerm, feedTypeFilter]);

  const fetchData = async () => {
    try {
      const [projectRes, devRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/projects`, authHeader),
        axios.get(`${ADMIN_BASE}/users/developers`, authHeader)
      ]);

      const allProjects = projectRes.data || [];

      const filteredProjects = allProjects.filter(
        p =>
          p.projectManager?._id === currentUserId ||
          p.projectManager === currentUserId
      );

      setProjects(filteredProjects);
      setDevelopers(devRes.data || []);

      // FLATTEN FEEDS
      const allFeeds = filteredProjects.flatMap(project =>
        (project.feeds || []).map(feed => ({
          ...feed,
          projectId: project._id,
          projectName: project.name,
          projectCustomId: project.projectCustomId
        }))
      );

      setFeeds(allFeeds);

    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch data');
    }
  };

  // FILTER + SORT
  const filteredFeeds = useMemo(() => {
    let result = [...feeds];

    // PROJECT FILTER
    if (selectedProject !== 'ALL') {
      result = result.filter(
        feed => feed.projectId === selectedProject
      );
    }

    // FEED TYPE FILTER
    if (feedTypeFilter !== 'ALL') {
      result = result.filter(
        feed => feed.feedType === feedTypeFilter
      );
    }

    // SEARCH
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(feed =>
        feed.name?.toLowerCase().includes(search) ||
        feed.projectCustomId?.toLowerCase().includes(search)
      );
    }

    // SORT ASCENDING
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
  const indexOfLastFeed = currentPage * feedsPerPage;
  const indexOfFirstFeed = indexOfLastFeed - feedsPerPage;
  const currentFeeds = filteredFeeds.slice(indexOfFirstFeed, indexOfLastFeed);
  const totalPages = Math.ceil(filteredFeeds.length / feedsPerPage);

  // EDIT FEED
  const handleEditClick = (feed) => {
    setEditingFeedId(feed._id);
    setFeedForm({
      name: feed.name || '',
      assignedDevelopers: feed.assignedDevelopers?.map(d =>
        typeof d === 'object' ? d._id : d
      ) || [],
      feedType: feed.feedType || 'Daily',
      weekDay: feed.weekDay || ''
    });
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setFeedForm({
      name: '',
      assignedDevelopers: [],
      feedType: 'Daily',
      weekDay: ''
    });
    setEditingFeedId(null);
  };

  const handleUpdateFeed = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${ADMIN_BASE}/feeds/${editingFeedId}`,
        feedForm,
        authHeader
      );
      closeModal();
      fetchData();
      toast.success('Feed updated successfully');
    } catch (err) {
      toast.error('Failed to update feed');
    }
  };

  const handlePushTask = async () => {
    if (!taskForm.details.trim()) {
      toast.error('Please enter task details');
      return;
    }
    
    if (taskForm.targetUsers.length === 0) {
      toast.error('Please select at least one developer');
      return;
    }

    setIsPushing(true);
    
    try {
      await axios.post(
        `${ADMIN_BASE}/feeds/push-task`,
        {
          feedId: selectedFeed._id,
          projectId: selectedFeed.projectId,
          details: taskForm.details,
          targetUsers: taskForm.targetUsers
        },
        authHeader
      );

      setShowPushModal(false);
      setTaskForm({ details: '', targetUsers: [] });
      toast.success('Task pushed successfully');
      
    } catch (err) {
      toast.error('Failed to push task');
    } finally {
      setIsPushing(false);
    }
  };

  const getFeedTypeColor = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Once off': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={12} />;
      case 'Weekly': return <Calendar size={12} />;
      case 'Once off': return <Tag size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return 'from-emerald-500 to-emerald-600';
    if (percentage >= 50) return 'from-blue-500 to-blue-600';
    if (percentage >= 25) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };

  const openCommentModal = (feed) => {
    const completion = getTodayCompletionDetails(feed);
    if (completion.isCompleted) {
      setSelectedCommentFeed({
        name: feed.name,
        projectName: feed.projectName,
        projectCustomId: feed.projectCustomId,
        description: completion.description,
        completedAt: completion.completedAt
      });
      setShowCommentModal(true);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* HEADER SECTION */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Feed Center
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-2">
              Monitor and manage all active project feeds
            </p>
          </div>

          {/* FILTERS SECTION */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
            {/* PROJECT FILTER */}
            <div className="relative">
              <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-sm text-slate-700 min-w-[200px] hover:border-slate-300 focus:border-blue-400 transition-colors cursor-pointer"
              >
                <option value="ALL">All Projects</option>
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.projectCustomId}
                  </option>
                ))}
              </select>
            </div>

            {/* FEED TYPE FILTER */}
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={feedTypeFilter}
                onChange={(e) => setFeedTypeFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-sm text-slate-700 min-w-[160px] hover:border-slate-300 focus:border-blue-400 transition-colors cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Once off">Once off</option>
              </select>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search feeds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-medium text-sm w-[220px] placeholder:text-slate-400 focus:border-blue-400 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* STATS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Feeds
              </p>
              <p className="text-3xl font-black text-slate-800">
                {filteredFeeds.length}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Active Projects
            </p>
            <p className="text-2xl font-black text-slate-800">
              {projects.length}
            </p>
          </div>
        </div>
      </div>

      {/* TODAY'S FEED PROGRESS CARD WITH COMMENTS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  Today's Feed Progress
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {getTodayDayName()}, {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Completed</p>
                <p className="text-xl font-black text-emerald-600">
                  {todayFeedStats.completed} / {todayFeedStats.total}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-5">
            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2">
              <span className="flex items-center gap-1">
                Overall Progress
              </span>
              <span>{todayFeedStats.percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getProgressColor(todayFeedStats.percentage)} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${todayFeedStats.percentage}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar size={12} className="text-purple-600" />
                <p className="text-[8px] font-black text-purple-600 uppercase tracking-wider">Total Today</p>
              </div>
              <p className="text-2xl font-black text-purple-700">{todayFeedStats.total}</p>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle size={12} className="text-emerald-600" />
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Completed</p>
              </div>
              <p className="text-2xl font-black text-emerald-700">{todayFeedStats.completed}</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle size={12} className="text-amber-600" />
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-wider">Pending</p>
              </div>
              <p className="text-2xl font-black text-amber-700">{todayFeedStats.pending}</p>
            </div>
          </div>

          {/* Completed Feeds Comments Section */}
          {todayFeedStats.completedFeedsDetails.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-emerald-600" />
                <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">
                  Completion Comments ({todayFeedStats.completedFeedsDetails.length})
                </p>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {todayFeedStats.completedFeedsDetails.map((feed, index) => (
                  <div key={index} className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{feed.feedName}</p>
                        <p className="text-[9px] text-slate-500">{feed.projectCustomId}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCommentFeed({
                            name: feed.feedName,
                            projectName: feed.projectName,
                            projectCustomId: feed.projectCustomId,
                            description: feed.description,
                            completedAt: feed.completedAt
                          });
                          setShowCommentModal(true);
                        }}
                        className="p-1.5 bg-white rounded-lg text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                        title="View Comment"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-600 line-clamp-2 italic">
                      "{feed.description.substring(0, 100)}{feed.description.length > 100 ? '...' : ''}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayFeedStats.pending > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[9px] font-bold text-amber-700 text-center">
                {todayFeedStats.pending} feed{todayFeedStats.pending !== 1 ? 's' : ''} remaining for today
              </p>
            </div>
          )}

          {todayFeedStats.total === 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-500 text-center">
                No feeds scheduled for today
              </p>
            </div>
          )}

          {todayFeedStats.total > 0 && todayFeedStats.percentage === 100 && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 text-center">
                Congratulations! All today's feeds are completed!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Feed Details
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Project
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Schedule
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Developer
                </th>
                <th className="text-right px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {currentFeeds.length > 0 ? (
                currentFeeds.map((feed, idx) => {
                  const isTodayFeed = isFeedForToday(feed);
                  const completion = getTodayCompletionDetails(feed);
                  const isCompleted = completion.isCompleted;
                  const developerNames = getDeveloperNames(feed.assignedDevelopers || []);
                  const isExpanded = expandedDeveloperFeedId === feed._id;
                  const displayDevelopers = isExpanded ? developerNames : developerNames.slice(0, 2);
                  const hasMoreDevelopers = developerNames.length > 2;
                  
                  return (
                    <tr
                      key={feed._id}
                      className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-200 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      } ${isTodayFeed && !isCompleted ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* FEED NAME */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                            isTodayFeed && !isCompleted 
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' 
                              : isCompleted
                              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                              : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white'
                          }`}>
                            {isCompleted ? <CheckCircle size={16} /> : <Hash size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">
                                {feed.name}
                              </p>
                              {isTodayFeed && !isCompleted && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Today
                                </span>
                              )}
                              {isCompleted && (
                                <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Completed
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              Feed Stream
                            </p>
                          </div>
                        </div>
                        </td>

                      {/* PROJECT ID */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          <Briefcase size={10} />
                          {feed.projectCustomId}
                        </span>
                        </td>

                      {/* FEED TYPE */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getFeedTypeColor(feed.feedType)}`}>
                          {getFeedTypeIcon(feed.feedType)}
                          {feed.feedType}
                        </span>
                        </td>

                      {/* WEEKDAY / SCHEDULE */}
                      <td className="px-6 py-4">
                        {feed.feedType === 'Weekly' ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
                            <Calendar size={10} />
                            {feed.weekDay}
                          </span>
                        ) : feed.feedType === 'Daily' ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                            <Clock size={10} />
                            Every Day
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">
                            —
                          </span>
                        )}
                        </td>

                      {/* DEVELOPERS LIST */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {displayDevelopers.map((devName, devIdx) => (
                              <span
                                key={devIdx}
                                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[9px] font-bold border border-blue-100"
                              >
                                <Users size={8} />
                                {devName}
                              </span>
                            ))}
                          </div>
                          {hasMoreDevelopers && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDeveloperFeedId(isExpanded ? null : feed._id);
                              }}
                              className="flex items-center gap-1 text-[9px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={10} />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={10} />
                                  +{developerNames.length - 2} more
                                </>
                              )}
                            </button>
                          )}
                          {developerNames.length === 0 && (
                            <span className="text-[9px] font-bold text-slate-400 italic">
                              No developers assigned
                            </span>
                          )}
                        </div>
                        </td>

                      {/* ACTION BUTTONS */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isCompleted && (
                            <button
                              onClick={() => openCommentModal(feed)}
                              className="group w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-200"
                              title="View Completion Comment"
                            >
                              <MessageSquare size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(feed)}
                            className="group w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200"
                            title="Edit Feed"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFeed(feed);
                              setShowPushModal(true);
                            }}
                            className="group w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
                            title="Push Task"
                          >
                            <Send size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Activity size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                        No feeds found
                      </p>
                      <p className="text-xs text-slate-300 mt-1">
                        Try adjusting your filters
                      </p>
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
        <div className="mt-8 flex justify-center items-center gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
                if (i === 6) pageNum = totalPages;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
                if (i === 0) pageNum = 1;
                if (i === 6) pageNum = totalPages;
              }
              
              if (pageNum === 1 && i > 0 && currentPage > 4 && totalPages > 7) {
                return <span key="ellipsis1" className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>;
              }
              
              if (pageNum === totalPages && i < 6 && currentPage < totalPages - 3 && totalPages > 7) {
                return <span key="ellipsis2" className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all duration-200 ${
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200'
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
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex justify-center items-center z-[120] p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  Edit Feed
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Update feed configuration
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateFeed} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  Feed Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter feed name"
                  value={feedForm.name}
                  onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-slate-700 focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  Feed Type
                </label>
                <select
                  value={feedForm.feedType}
                  onChange={(e) =>
                    setFeedForm({
                      ...feedForm,
                      feedType: e.target.value,
                      weekDay: e.target.value !== 'Weekly' ? '' : feedForm.weekDay
                    })
                  }
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Once off">Once off</option>
                </select>
              </div>

              {feedForm.feedType === 'Weekly' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                    Select Day
                  </label>
                  <select
                    required
                    value={feedForm.weekDay}
                    onChange={(e) => setFeedForm({ ...feedForm, weekDay: e.target.value })}
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                  >
                    <option value="">Choose a day</option>
                    {weekDays.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 block flex items-center gap-2">
                  <UserCheck size={12} />
                  Assign Developers
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                  {developers.map(dev => (
                    <label
                      key={dev._id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
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
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {dev.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-black rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 uppercase text-xs tracking-wider shadow-lg"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PUSH TASK MODAL */}
      {showPushModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">
                    Push Task to Developers
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Feed: <span className="font-bold text-blue-600">{selectedFeed?.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPushModal(false);
                    setTaskForm({ details: '', targetUsers: [] });
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  Task Details
                </label>
                <textarea
                  placeholder="Enter detailed task description..."
                  value={taskForm.details}
                  onChange={(e) => setTaskForm({ ...taskForm, details: e.target.value })}
                  rows={4}
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium text-slate-700 focus:border-blue-400 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 block flex items-center gap-2">
                  <UserCheck size={12} />
                  Select Developers
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                  {developers.map(dev => (
                    <label
                      key={dev._id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        taskForm.targetUsers.includes(dev._id)
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={taskForm.targetUsers.includes(dev._id)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...taskForm.targetUsers, dev._id]
                            : taskForm.targetUsers.filter(id => id !== dev._id);
                          setTaskForm({ ...taskForm, targetUsers: updated });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {dev.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPushModal(false);
                  setTaskForm({ details: '', targetUsers: [] });
                }}
                className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-black uppercase text-xs tracking-wider hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePushTask}
                disabled={isPushing}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black uppercase text-xs tracking-wider hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? 'Pushing...' : 'Push Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT VIEW MODAL */}
      {showCommentModal && selectedCommentFeed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-600" />
                <h3 className="text-lg font-black text-slate-800">Completion Comment</h3>
              </div>
              <button
                onClick={() => setShowCommentModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Feed</p>
                <p className="text-sm font-bold text-slate-800">{selectedCommentFeed.name}</p>
                <p className="text-xs text-slate-500">{selectedCommentFeed.projectCustomId}</p>
              </div>
              <div className="mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Comment</p>
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    "{selectedCommentFeed.description}"
                  </p>
                </div>
              </div>
              {selectedCommentFeed.completedAt && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Completed At</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(selectedCommentFeed.completedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100">
              <button
                onClick={() => setShowCommentModal(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black uppercase text-xs tracking-wider hover:from-emerald-600 hover:to-emerald-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFeeds;