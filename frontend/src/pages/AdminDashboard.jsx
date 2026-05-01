import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Layout, Users, Zap } from 'lucide-react';
import API_BASE_URL from '../config';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ 
    projects: 0, 
    users: 0, 
    recentLogs: [], 
    totalLogsCount: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { headers: { Authorization: `Bearer ${token}` } };

        // Fetch projects, users, and logs in parallel
        // limit=5 is passed to the API so the backend handles the slicing
        const [projRes, userRes, logRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/admin/projects`, headers),
          axios.get(`${API_BASE_URL}/api/admin/users`, headers),
          axios.get(`${API_BASE_URL}/api/admin/analytics?limit=5`, headers)
        ]);

        setStats({
          projects: projRes.data.length,
          users: userRes.data.length,
          // FIX: Access .logs inside the object instead of calling .slice on the object
          recentLogs: logRes.data.logs || [], 
          totalLogsCount: logRes.data.totalLogs || 0
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return (
    <div className="lg:ml-64 p-10 flex items-center justify-center min-h-screen text-slate-400 font-bold">
      Syncing System Data...
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-100">
      {/* LAYOUT FIX: 
         lg:ml-64 matches your Sidebar width. 
         lg:w-[calc(100%-16rem)] ensures the dashboard doesn't overflow horizontally.
      */}
      <div className="lg:ml-64 w-full lg:w-[calc(100%-16rem)] p-6 md:p-10 transition-all duration-300">
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
            System Overview
          </h1>
          <p className="text-slate-500 font-medium">
            Real-time status of your MERN stack infrastructure.
          </p>
        </header>
        
        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
            <StatCard 
            title="Active Projects" 
            value={stats.projects} 
            color="bg-blue-600" 
            icon={<Layout size={24} />} 
            size="sm"

          />
          <StatCard 
            title="Total Users" 
            value={stats.users} 
            color="bg-slate-900" 
            icon={<Users size={24} />} 
            size="sm"

          />
          <StatCard 
            title="System Logs" 
            value={stats.totalLogsCount} 
            color="bg-indigo-600" 
            icon={<Zap size={24} />} 
            size="sm"

          />
        </div>

        {/* RECENT ACTIVITY CARD */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <Activity className="text-blue-600" /> Recent System Activity
              </h2>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase tracking-widest">
                  Live Feed
              </span>
          </div>

          <div className="space-y-4">
              {stats.recentLogs.map((log) => (
                  <div key={log._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group gap-4">
                      <div className="flex gap-4 items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          <div>
                              <p className="text-slate-800 font-bold leading-tight">{log.details}</p>
                              <p className="text-xs text-slate-400 font-medium mt-1">
                                  Performed by {log.performerId?.name || 'System'} • {new Date(log.timestamp).toLocaleTimeString()}
                              </p>
                          </div>
                      </div>
                      <span className="w-fit text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-md uppercase group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {log.actionType}
                      </span>
                  </div>
              ))}

              {stats.recentLogs.length === 0 && (
                  <p className="text-slate-400 font-medium text-center py-10">No recent activity found.</p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, icon, size = "md" }) => {
  const isSmall = size === "sm";

  return (
    <div
      className={`${color} 
      ${isSmall ? "p-4 rounded-2xl" : "p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem]"} 
      text-white shadow-lg transition-all hover:scale-[1.02] 
      relative overflow-hidden group`}
    >
      
      {/* Icon */}
      <div
        className={`absolute opacity-20 transition-transform duration-500 
        ${isSmall ? "right-3 top-3 scale-75" : "right-6 top-6 group-hover:scale-125 group-hover:rotate-12"}`}
      >
        {icon}
      </div>

      {/* Title */}
      <p
        className={`${isSmall ? "text-[9px] tracking-wider" : "text-[10px] tracking-[0.2em]"} 
        font-black uppercase opacity-70 mb-1`}
      >
        {title}
      </p>

      {/* Value */}
      <h3
        className={`${isSmall ? "text-2xl" : "text-5xl md:text-6xl"} 
        font-black tracking-tight leading-none`}
      >
        {value}
      </h3>
    </div>
  );
};

export default AdminDashboard;