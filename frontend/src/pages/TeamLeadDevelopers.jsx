import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Search, GitFork, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TeamLeadDevelopers = () => {
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
    <div className="page bg-slate-50 flex items-center justify-center">
      <Loader2 size={40} className="text-blue-600 animate-spin" />
    </div>
  );

  return (
    <div className="page bg-slate-50">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
          <Users size={24} className="text-white" />
        </div>
        <div>
          <h1 className="page-title">My Team</h1>
          <p className="text-sm text-slate-500 mt-1">Developers available for assignment</p>
        </div>
      </div>

      <div className="card mb-4 sm:mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users size={40} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No developers found</p>
          </div>
        ) : (
          filtered.map(dev => (
            <div key={dev._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {dev.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm break-words">{dev.name}</p>
                  <p className="meta break-all">{dev.email}</p>
                </div>
              </div>
              {dev.githubLinked && dev.githubUsername && (
                <span className="badge bg-green-50 text-green-600">
                  <GitFork size={12} />
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