import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  Layout,
  Users,
  Zap,
  TrendingUp,
  Clock3,
} from 'lucide-react';

import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    projects: 0,
    users: 0,
    recentLogs: [],
    totalLogsCount: 0,
  });

  const [loading, setLoading] = useState(true);

  const { isCollapsed } = useSidebar();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');

        const headers = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const [projRes, userRes, logRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/admin/projects`, headers),
          axios.get(`${API_BASE_URL}/api/admin/users`, headers),
          axios.get(
            `${API_BASE_URL}/api/admin/analytics?limit=5`,
            headers
          ),
        ]);

        setStats({
          projects: projRes.data.length,
          users: userRes.data.length,
          recentLogs: logRes.data.logs || [],
          totalLogsCount: logRes.data.totalLogs || 0,
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="flex items-center gap-3 text-slate-500 font-bold text-lg">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Syncing System Data...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-50 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      <div className="p-6 md:p-8 lg:p-10 max-w-[1800px] mx-auto">
        {/* HEADER */}
        <header className="mb-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1B2559]">
              System Overview
            </h1>

            <p className="text-slate-500 font-medium mt-2">
              Real-time monitoring and platform analytics
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-2xl px-5 py-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                System Status
              </p>

              <p className="text-sm font-bold text-emerald-600 mt-1">
                All Services Operational
              </p>
            </div>
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Active Projects"
            value={stats.projects}
            color="from-blue-600 to-blue-500"
            icon={<Layout size={26} />}
          />

          <StatCard
            title="Total Users"
            value={stats.users}
            color="from-slate-900 to-slate-800"
            icon={<Users size={26} />}
          />

          <StatCard
            title="System Logs"
            value={stats.totalLogsCount}
            color="from-indigo-600 to-violet-600"
            icon={<Zap size={26} />}
          />

          <StatCard
            title="Live Activity"
            value={stats.recentLogs.length}
            color="from-emerald-600 to-teal-500"
            icon={<Activity size={26} />}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 2xl:grid-cols-[1.5fr_0.7fr] gap-6">
          {/* RECENT ACTIVITY */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {/* CARD HEADER */}
            <div className="px-7 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Activity size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-[#1B2559]">
                    Recent System Activity
                  </h2>

                  <p className="text-sm text-slate-400 font-medium mt-1">
                    Latest platform actions and events
                  </p>
                </div>
              </div>

              <span className="w-fit bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100">
                Live Feed
              </span>
            </div>

            {/* ACTIVITY LIST */}
            <div className="p-5">
              {stats.recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentLogs.map((log) => (
                    <div
                      key={log._id}
                      className="group flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 p-5 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/40 transition-all duration-200"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] flex-shrink-0" />

                        <div className="min-w-0">
                          <p className="text-sm md:text-[15px] font-bold text-slate-800 break-words leading-relaxed">
                            {log.details}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400 font-medium">
                            <span>
                              Performed by{' '}
                              <span className="text-slate-600 font-bold">
                                {log.performerId?.name || 'System'}
                              </span>
                            </span>

                            <span>•</span>

                            <span className="flex items-center gap-1">
                              <Clock3 size={12} />
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] group-hover:bg-blue-100 group-hover:text-blue-700 transition-all">
                          {log.actionType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
                    <Activity className="text-slate-400" size={28} />
                  </div>

                  <h3 className="text-lg font-black text-slate-700">
                    No Recent Activity
                  </h3>

                  <p className="text-slate-400 font-medium mt-2">
                    System logs will appear here once actions are performed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* QUICK OVERVIEW */}
          <div className="space-y-6">
            {/* QUICK STATS */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>

                <div>
                  <h3 className="text-lg font-black text-[#1B2559]">
                    Quick Overview
                  </h3>

                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Platform metrics snapshot
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <MiniStat
                  label="Projects"
                  value={stats.projects}
                  color="bg-blue-500"
                />

                <MiniStat
                  label="Users"
                  value={stats.users}
                  color="bg-slate-800"
                />

                <MiniStat
                  label="Logs"
                  value={stats.totalLogsCount}
                  color="bg-indigo-500"
                />
              </div>
            </div>

            {/* SYSTEM HEALTH */}
            <div className="bg-gradient-to-br from-[#111C44] to-blue-700 rounded-[2rem] p-6 text-white shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />

              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-200 mb-3">
                  Infrastructure
                </p>

                <h3 className="text-2xl font-black mb-2">
                  System Stable
                </h3>

                <p className="text-blue-100 text-sm leading-relaxed">
                  All core services are running smoothly and responding
                  normally.
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />

                  <span className="text-sm font-bold text-emerald-200">
                    Operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, icon }) => {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${color} p-6 text-white shadow-lg hover:scale-[1.02] transition-all duration-300`}
    >
      {/* BACKGROUND GLOW */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />

      {/* ICON */}
      <div className="absolute right-5 top-5 opacity-20">
        {icon}
      </div>

      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-80 mb-3">
          {title}
        </p>

        <h3 className="text-4xl md:text-5xl font-black tracking-tight">
          {value}
        </h3>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, color }) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />

        <span className="text-sm font-bold text-slate-600">
          {label}
        </span>
      </div>

      <span className="text-lg font-black text-[#1B2559]">
        {value}
      </span>
    </div>
  );
};

export default AdminDashboard;