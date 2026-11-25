// frontend/src/pages/PmDashboard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Ticket,
  Clock,
  CheckCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { isProjectManagerOf } from '../utils/projectAccess';
import useLiveFeedProgress from '../utils/useLiveFeedProgress';
import LiveFeedProgress from '../components/LiveFeedProgress';

const PmDashboard = () => {
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

  // Today's feed progress, live from the Feed Status data (refreshed on its own every 60 s)
  const live = useLiveFeedProgress('pm');

  const [projects, setProjects] = useState([]);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch projects for this PM
      const projectsRes = await axios.get(`${API_BASE_URL}/api/admin/projects`, authHeader);
      const pmProjects = projectsRes.data.filter(
        p => isProjectManagerOf(p, currentUserId)
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

      // Fetch tickets for PM's projects
      // (counted on the server: tickets on projects this user manages)
      const { data: ticketStats } = await axios.get(`${API_BASE_URL}/api/tickets/stats`, { ...authHeader, params: { scope: 'myProjects' } });
      const openTickets = ticketStats.open;
      const inProgressTickets = ticketStats.inProgress;
      const resolvedTickets = ticketStats.resolved;

      setStats({
        totalProjects: pmProjects.length,
        totalFeeds: allFeeds.length,
        openTickets: openTickets,
        inProgressTickets: inProgressTickets,
        resolvedTickets: resolvedTickets,
        totalTickets: ticketStats.total
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

  if (loading) {
    return (
      <div className="page bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page bg-slate-50">
      
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <LayoutDashboard size={24} className="text-white" />
              </div>
              <div>
                <h1 className="page-title">
                  PM Dashboard
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Overview of your projects, feeds, and tickets
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { fetchDashboardData(); live.refresh(); }}
            className="btn btn-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards - ALL STATS AT TOP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Projects</p>
              <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <FolderKanban size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Total Feeds</p>
              <p className="text-2xl font-bold text-white">{stats.totalFeeds}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Activity size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Open Tickets</p>
              <p className="text-2xl font-bold text-white">{stats.openTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">In Progress</p>
              <p className="text-2xl font-bold text-white">{stats.inProgressTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Resolved</p>
              <p className="text-2xl font-bold text-white">{stats.resolvedTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Total Tickets</p>
              <p className="text-2xl font-bold text-white">{stats.totalTickets}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Ticket size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Progress Section - live feed status */}
      <LiveFeedProgress live={live} linkBase="/pm/projects" />

      {/* Quick Stats Footer - Only Total Tickets count is shown here */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Ticket size={16} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Tickets</p>
              <p className="text-xl font-bold text-slate-800">{stats.totalTickets}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase">Resolved</p>
              <p className="text-xl font-bold text-slate-800">{stats.resolvedTickets}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase">Active Projects</p>
              <p className="text-xl font-bold text-slate-800">
                {projects.filter(p => p.projectStatus !== 'Closed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase">Resolution Rate</p>
              <p className="text-xl font-bold text-slate-800">
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