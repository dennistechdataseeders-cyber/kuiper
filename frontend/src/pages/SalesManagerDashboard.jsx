import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, Target, Award, Mail, Layers
} from 'lucide-react';
import API_BASE_URL from '../config';

const SalesManagerDashboard = () => {
  const [salesTeam, setSalesTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamPerformance = async () => {
      try {
        const token = localStorage.getItem('token');
        // This relies on the backend returning prospectCount and leadCount per user
        const res = await axios.get(`${API_BASE_URL}/api/admin/users?role=Sales`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSalesTeam(res.data);
      } catch (err) {
        console.error("Error fetching sales team", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeamPerformance();
  }, []);

  // Helper to calculate total team metrics for Stat Cards
  const totalLeads = salesTeam.reduce((acc, curr) => acc + (curr.leadCount || 0), 0);
  const totalProspects = salesTeam.reduce((acc, curr) => acc + (curr.prospectCount || 0), 0);
  
  const teamConversion = totalProspects > 0 
    ? ((totalLeads / totalProspects) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="p-4 lg:p-8 lg:ml-64 bg-blue-100 min-h-screen transition-all">
      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Sales Command</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time performance tracking for your sales force.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-600 uppercase">Live Metrics</span>
           </div>
        </div>
      </div>
      
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          icon={<Users size={22}/>} 
          label="Total Reps" 
          value={salesTeam.length} 
          color="blue" 
        />
        <StatCard 
          icon={<Layers size={22}/>} 
          label="Active Bucket" 
          value={totalProspects} 
          color="amber" 
        />
        <StatCard 
          icon={<Target size={22}/>} 
          label="Total Leads" 
          value={totalLeads} 
          color="purple" 
        />
        <StatCard 
          icon={<Award size={22}/>} 
          label="Avg Conversion" 
          value={`${teamConversion}%`} 
          color="emerald" 
        />
      </div>

      {/* TEAM TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.15em]">Team Performance Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Sales Representative</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Prospects (In Bucket)</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Leads Generated</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="4" className="p-20 text-center"><Loader /></td></tr>
              ) : salesTeam.map((rep) => {
                // Calculate individual conversion inside the map
                const conversion = rep.prospectCount > 0 
                  ? ((rep.leadCount / rep.prospectCount) * 100).toFixed(1) 
                  : "0.0";

                return (
                  <tr key={rep._id} className="hover:bg-blue-50/30 transition-all group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
                          {rep.name ? rep.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">{rep.name}</p>
                          <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Mail size={10}/> {rep.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-6 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-amber-50 text-amber-700 font-black text-sm border border-amber-100">
                        {rep.prospectCount || 0}
                      </span>
                    </td>

                    <td className="p-6 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-blue-50 text-blue-700 font-black text-sm border border-blue-100">
                        {rep.leadCount || 0}
                      </span>
                    </td>

                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-black text-slate-800">
                          {conversion}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${Math.min(parseFloat(conversion), 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Reusable Stat Card Component
const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-md transition-shadow">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{label}</p>
        <h2 className="text-2xl font-black text-slate-800">{value}</h2>
      </div>
    </div>
  );
};

const Loader = () => (
    <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Analyzing Team Data...</span>
    </div>
);

export default SalesManagerDashboard;