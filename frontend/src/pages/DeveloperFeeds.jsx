import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  Database, Hash, Clock, Calendar, Target, Globe, Smartphone, Monitor,
  ChevronLeft, ChevronRight, Search, X, ExternalLink,
  Briefcase, CheckCircle, AlertCircle
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DeveloperFeeds = () => {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/dev/my-feeds`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeeds(res.data);
    } catch (err) {
      console.error('Error fetching feeds:', err);
      toast.error('Failed to load feeds');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformInfo = (feed) => {
    const platform = feed.feedPlatform;
    if (!platform) return null;
    
    switch(platform) {
      case 'Web':
        return { icon: <Globe size={12} />, text: 'Web', color: 'bg-blue-100 text-blue-700' };
      case 'App':
        return { icon: <Smartphone size={12} />, text: 'App', color: 'bg-purple-100 text-purple-700' };
      case 'Both':
        return { icon: <Monitor size={12} />, text: 'Web + App', color: 'bg-indigo-100 text-indigo-700' };
      default:
        return null;
    }
  };

  const getFeedTypeStyle = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Monthly': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={10} />;
      case 'Weekly': return <Calendar size={10} />;
      case 'Monthly': return <Calendar size={10} />;
      default: return <Target size={10} />;
    }
  };

  const filteredFeeds = feeds.filter(feed => {
    const matchesSearch = 
      feed.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.projectName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'ALL' || feed.feedType === selectedType;
    
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);
  const currentFeeds = filteredFeeds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const feedTypes = ['ALL', 'Daily', 'Weekly', 'Monthly', 'Once off'];

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl">
                <Database size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">My Feeds</h1>
                <p className="text-slate-500 mt-1">View all feeds assigned to you</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={fetchFeeds}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Total Feeds</p>
              <p className="text-2xl font-black text-slate-800">{feeds.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Clock size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Daily Feeds</p>
              <p className="text-2xl font-black text-slate-800">{feeds.filter(f => f.feedType === 'Daily').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Weekly/Monthly</p>
              <p className="text-2xl font-black text-slate-800">{feeds.filter(f => f.feedType === 'Weekly' || f.feedType === 'Monthly').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search feeds by name or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            {feedTypes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedType === type
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feeds Table */}
      {currentFeeds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Database size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-500">No feeds found</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Feed Name</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Project</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Type</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFeeds.map((feed) => {
                    const platformInfo = getPlatformInfo(feed);
                    const hasGit = feed.hasGitRepo && feed.gitPath;
                    
                    return (
                      <tr key={feed._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                              hasGit ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Database size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{feed.name}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{feed.projectCustomId || 'N/A'}</p>
                            <p className="text-[9px] text-slate-400">{feed.projectName}</p>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {feed.feedType}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4">
                          {platformInfo ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[7px] font-black uppercase ${platformInfo.color}`}>
                              {platformInfo.icon}
                              {platformInfo.text}
                            </span>
                          ) : (
                            <span className="text-[8px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
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
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
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
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeveloperFeeds;