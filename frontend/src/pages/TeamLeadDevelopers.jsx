import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { Users, Search, GitFork, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TeamLeadDevelopers = () => {
  const { isCollapsed } = useSidebar();
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDevelopers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/teamlead/developers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDevelopers(res.data.developers || []);
      } catch (err) {
        console.error('Error fetching developers:', err);
        toast.error('Failed to load developers');
      } finally {
        setLoading(false);
      }
    };
    fetchDevelopers();
  }, []);

  const filtered = developers.filter(d =>
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <Loader2 size={40} className="text-blue-600 animate-spin" />
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
          <Users size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Team</h1>
          <p className="text-slate-500 mt-1">Developers available for assignment</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users size={40} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No developers found</p>
          </div>
        ) : (
          filtered.map(dev => (
            <div key={dev._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-black text-sm">
                  {dev.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-slate-800 text-sm">{dev.name}</p>
                  <p className="text-xs text-slate-500">{dev.email}</p>
                </div>
              </div>
              {dev.githubLinked && dev.githubUsername && (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">
                  <GitFork size={10} />
                  {dev.githubUsername}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamLeadDevelopers;