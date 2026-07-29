// frontend/src/pages/PmDashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Ticket,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Briefcase,
  GitFork,
  RefreshCw,
  ChevronRight,
  Hash,
  Globe,
  Smartphone,
  Monitor,
  UserCheck,
  MessageSquare,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const PmDashboard = () => {
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalFeeds: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    totalTickets: 0
  });

  // Today's Feed Stats
  const [todayFeedStats, setTodayFeedStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    percentage: 0,
    completedFeedsDetails: [],
    pendingFeeds: []
  });

  // Expanded states for today's progress cards
  const [expandedSection, setExpandedSection] = useState(null);

  const [projects, setProjects] = useState([]);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
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

  // Get completion details for today
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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch projects for this PM
      const projectsRes = await axios.get(`${API_BASE_URL}/api/admin/projects`, authHeader);
      const pmProjects = projectsRes.data.filter(
        p => p.projectManager?._id === currentUserId || p.projectManager === currentUserId
      );
      setProjects(pmProjects);

      // Extract all feeds from PM projects - EXCLUDE CLOSED FEEDS
      const allFeeds = pmProjects.flatMap(project =>
        (project.feeds || [])
          .filter(feed => feed.feedStatus !== 'Closed') // Exclude closed feeds
          .map(feed => ({
            ...feed,
            projectId: project._id,
            projectName: project.name,
            projectCustomId: project.projectCustomId,
            gitRepoUrl: project.gitRepoUrl,
            gitRepoName: project.gitRepoName
          }))
      );

      // Calculate today's feed stats - only for non-closed feeds
      const todayFeeds = allFeeds.filter(feed => isFeedForToday(feed));
      const completedFeedsDetails = [];
      const pendingFeeds = [];
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
            completedAt: completion.completedAt,
            feedType: feed.feedType,
            feedPlatform: feed.feedPlatform,
            webDomain: feed.webDomain,
            assignedDevelopers: feed.assignedDevelopers
          });
        } else {
          pendingFeeds.push({
            feedId: feed._id,
            feedName: feed.name,
            projectName: feed.projectName,
            projectCustomId: feed.projectCustomId,
            feedType: feed.feedType,
            feedPlatform: feed.feedPlatform,
            webDomain: feed.webDomain,
            weekDay: feed.weekDay,
            monthDay: feed.monthDay,
            assignedDevelopers: feed.assignedDevelopers
          });
        }
      });

      const total = todayFeeds.length;
      const completed = completedCount;
      const pending = total - completed;
      const percentage = total > 0 ? (completed / total) * 100 : 0;

      setTodayFeedStats({
        total,
        completed,
        pending,
        percentage,
        completedFeedsDetails,
        pendingFeeds
      });

      // Fetch tickets for PM's projects
      const projectIds = pmProjects.map(p => p._id);
      const ticketsRes = await axios.get(`${API_BASE_URL}/api/tickets`, authHeader);
      const pmTickets = ticketsRes.data.filter(ticket =>
        ticket.projectId && projectIds.includes(ticket.projectId._id || ticket.projectId)
      );

      // Calculate ticket stats
      const openTickets = pmTickets.filter(t => t.status === 'Open').length;
      const inProgressTickets = pmTickets.filter(t => t.status === 'In Progress').length;
      const resolvedTickets = pmTickets.filter(t => t.status === 'Resolved').length;

      setStats({
        totalProjects: pmProjects.length,
        totalFeeds: allFeeds.length,
        openTickets: openTickets,
        inProgressTickets: inProgressTickets,
        resolvedTickets: resolvedTickets,
        totalTickets: pmTickets.length
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getFeedTypeColor = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Monthly': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Once off': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={10} />;
      case 'Weekly': return <Calendar size={10} />;
      case 'Monthly': return <Calendar size={10} />;
      default: return <Clock size={10} />;
    }
  };

  const getPlatformIcon = (platform) => {
    switch(platform) {
      case 'Web': return <Globe size={10} />;
      case 'App': return <Smartphone size={10} />;
      case 'Both': return <Monitor size={10} />;
      default: return null;
    }
  };

  const getPlatformColor = (platform) => {
    switch(platform) {
      case 'Web': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'App': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Both': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return 'from-emerald-500 to-emerald-600';
    if (percentage >= 50) return 'from-blue-500 to-blue-600';
    if (percentage >= 25) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-4 sm:p-6 transition-all duration-300 ${isCollapsed ? 'ml-10 sm:ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <LayoutDashboard size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  PM Dashboard
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Overview of your projects, feeds, and tickets
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards - ALL STATS AT TOP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Projects</p>
              <p className="text-2xl font-black text-white">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FolderKanban size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Feeds</p>
              <p className="text-2xl font-black text-white">{stats.totalFeeds}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Open Tickets</p>
              <p className="text-2xl font-black text-white">{stats.openTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-black text-white">{stats.inProgressTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Clock size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Resolved</p>
              <p className="text-2xl font-black text-white">{stats.resolvedTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <CheckCircle size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Tickets</p>
              <p className="text-2xl font-black text-white">{stats.totalTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Progress Section - With Clickable Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 sm:mb-8 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                <Calendar size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Today's Progress</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                  {getTodayDayName()}, {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Briefcase size={10} />
                </div>
                <div>
                  <p className="text-[6px] font-black text-slate-400 uppercase">Projects</p>
                  <p className="text-xs font-black text-slate-800">{stats.totalProjects}</p>
                </div>
              </div>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Activity size={10} />
                </div>
                <div>
                  <p className="text-[6px] font-black text-slate-400 uppercase">Today's Feeds</p>
                  <p className="text-xs font-black text-slate-800">{todayFeedStats.total}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-1">
              <span>Completion Rate</span>
              <span>{todayFeedStats.percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getProgressColor(todayFeedStats.percentage)} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${todayFeedStats.percentage}%` }}
              />
            </div>
          </div>

          {/* Clickable Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Today Card - Shows all today's feeds */}
            <div 
              onClick={() => toggleSection('today')}
              className="bg-purple-50 rounded-lg p-3 text-center cursor-pointer hover:bg-purple-100 transition-all duration-200 border-2 border-transparent hover:border-purple-300"
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Calendar size={12} className="text-purple-600" />
                <p className="text-[7px] font-black text-purple-600 uppercase">Today</p>
              </div>
              <p className="text-lg font-black text-purple-700">{todayFeedStats.total}</p>
              {todayFeedStats.total > 0 && (
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {expandedSection === 'today' ? (
                    <ChevronUp size={10} className="text-purple-400" />
                  ) : (
                    <ChevronDown size={10} className="text-purple-400" />
                  )}
                  <span className="text-[6px] text-purple-500">details</span>
                </div>
              )}
            </div>
            
            {/* Done Card - Shows completed feeds */}
            <div 
              onClick={() => toggleSection('done')}
              className={`rounded-lg p-3 text-center cursor-pointer transition-all duration-200 border-2 ${
                todayFeedStats.completed > 0 
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-transparent hover:border-emerald-300' 
                  : 'bg-slate-50 border-slate-200 cursor-default'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle size={12} className={todayFeedStats.completed > 0 ? 'text-emerald-600' : 'text-slate-400'} />
                <p className={`text-[7px] font-black uppercase ${todayFeedStats.completed > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  Done
                </p>
              </div>
              <p className={`text-lg font-black ${todayFeedStats.completed > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                {todayFeedStats.completed}
              </p>
              {todayFeedStats.completed > 0 && (
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {expandedSection === 'done' ? (
                    <ChevronUp size={10} className="text-emerald-400" />
                  ) : (
                    <ChevronDown size={10} className="text-emerald-400" />
                  )}
                  <span className="text-[6px] text-emerald-500">details</span>
                </div>
              )}
            </div>
            
            {/* Pending Card - Shows pending feeds */}
            <div 
              onClick={() => todayFeedStats.pending > 0 && toggleSection('pending')}
              className={`rounded-lg p-3 text-center cursor-pointer transition-all duration-200 border-2 ${
                todayFeedStats.pending > 0 
                  ? 'bg-amber-50 hover:bg-amber-100 border-transparent hover:border-amber-300' 
                  : 'bg-slate-50 border-slate-200 cursor-default'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <AlertCircle size={12} className={todayFeedStats.pending > 0 ? 'text-amber-600' : 'text-slate-400'} />
                <p className={`text-[7px] font-black uppercase ${todayFeedStats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  Pending
                </p>
              </div>
              <p className={`text-lg font-black ${todayFeedStats.pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {todayFeedStats.pending}
              </p>
              {todayFeedStats.pending > 0 && (
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {expandedSection === 'pending' ? (
                    <ChevronUp size={10} className="text-amber-400" />
                  ) : (
                    <ChevronDown size={10} className="text-amber-400" />
                  )}
                  <span className="text-[6px] text-amber-500">details</span>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Content - Today Section */}
          {expandedSection === 'today' && todayFeedStats.total > 0 && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">
                  All Today's Feeds ({todayFeedStats.total})
                </p>
                <button
                  onClick={() => setExpandedSection(null)}
                  className="text-purple-400 hover:text-purple-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {[...todayFeedStats.pendingFeeds, ...todayFeedStats.completedFeedsDetails].map((feed) => (
                  <div key={feed.feedId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2">
                      {feed.isCompleted !== undefined ? (
                        <CheckCircle size={12} className="text-emerald-500" />
                      ) : (
                        <Clock size={12} className="text-amber-500" />
                      )}
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[6px] font-black uppercase border ${getFeedTypeColor(feed.feedType)}`}>
                        {getFeedTypeIcon(feed.feedType)}
                        {feed.feedType}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{feed.feedName}</span>
                      <span className="text-[8px] text-slate-500">{feed.projectCustomId}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/pm/feeds`, { state: { selectedProjectId: feed.projectId } })}
                      className="text-[8px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded Content - Done Section */}
          {expandedSection === 'done' && todayFeedStats.completed > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                  Completed Feeds ({todayFeedStats.completed})
                </p>
                <button
                  onClick={() => setExpandedSection(null)}
                  className="text-emerald-400 hover:text-emerald-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {todayFeedStats.completedFeedsDetails.map((feed) => (
                  <div key={feed.feedId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-emerald-500" />
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[6px] font-black uppercase border ${getFeedTypeColor(feed.feedType)}`}>
                        {getFeedTypeIcon(feed.feedType)}
                        {feed.feedType}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{feed.feedName}</span>
                      <span className="text-[8px] text-slate-500">{feed.projectCustomId}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/pm/feeds`, { state: { selectedProjectId: feed.projectId } })}
                      className="text-[8px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded Content - Pending Section */}
          {expandedSection === 'pending' && todayFeedStats.pending > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">
                  Pending Feeds ({todayFeedStats.pending})
                </p>
                <button
                  onClick={() => setExpandedSection(null)}
                  className="text-amber-400 hover:text-amber-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {todayFeedStats.pendingFeeds.map((feed) => (
                  <div key={feed.feedId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-amber-500" />
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[6px] font-black uppercase border ${getFeedTypeColor(feed.feedType)}`}>
                        {getFeedTypeIcon(feed.feedType)}
                        {feed.feedType}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{feed.feedName}</span>
                      <span className="text-[8px] text-slate-500">{feed.projectCustomId}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/pm/feeds`, { state: { selectedProjectId: feed.projectId } })}
                      className="text-[8px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayFeedStats.total === 0 && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[9px] font-bold text-slate-500 text-center">
                No feeds scheduled for today
              </p>
            </div>
          )}

          {todayFeedStats.total > 0 && todayFeedStats.percentage === 100 && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 text-center">
                All feeds completed for today! 🎉
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Footer - Only Total Tickets count is shown here */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Ticket size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Total Tickets</p>
              <p className="text-xl font-black text-slate-800">{stats.totalTickets}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Resolved</p>
              <p className="text-xl font-black text-slate-800">{stats.resolvedTickets}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Active Projects</p>
              <p className="text-xl font-black text-slate-800">
                {projects.filter(p => p.projectStatus !== 'Closed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Resolution Rate</p>
              <p className="text-xl font-black text-slate-800">
                {stats.totalTickets > 0 
                  ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmDashboard;