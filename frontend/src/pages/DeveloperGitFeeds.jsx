// frontend/src/pages/DeveloperGitFeeds.jsx - Simplified version

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  FolderGit2, 
  ExternalLink, 
  RefreshCw, 
  ChevronLeft,
  ChevronRight,
  GitFork,
  Copy,
  CheckCircle,
  AlertCircle,
  Search,
  X,
  Terminal
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const DeveloperGitFeeds = () => {
  const { isCollapsed } = useSidebar();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [generatingScript, setGeneratingScript] = useState({});
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [currentScript, setCurrentScript] = useState(null);
  const [currentFeedInfo, setCurrentFeedInfo] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchDeveloperFeeds();
  }, []);

  const fetchDeveloperFeeds = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/dev/my-feeds`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeeds(res.data);
    } catch (error) {
      console.error('Error fetching developer feeds:', error);
      toast.error('Failed to load feed data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployScript = async (feed) => {
    setGeneratingScript(prev => ({ ...prev, [feed._id]: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/dev/feeds/${feed._id}/generate-script`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setCurrentFeedInfo(feed);
        setCurrentScript(res.data.script);
        setShowScriptModal(true);
      }
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error(error.response?.data?.error || 'Failed to generate deployment script');
    } finally {
      setGeneratingScript(prev => ({ ...prev, [feed._id]: false }));
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(type);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const filteredFeeds = feeds.filter(feed => {
    const matchesSearch = 
      feed.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.projectCustomId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const paginatedFeeds = filteredFeeds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const totalPages = Math.ceil(filteredFeeds.length / itemsPerPage);

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading feed repository paths...</p>
        </div>
      </div>
    );
  }

  const feedsWithGit = feeds.filter(f => f.hasGitRepo && f.gitPath);
  const feedsWithoutGit = feeds.filter(f => !f.hasGitRepo);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gray-900 rounded-xl">
                <GitFork size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Git Feeds</h1>
                <p className="text-gray-500 mt-1">Repository paths for your assigned feeds</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={fetchDeveloperFeeds}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderGit2 size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">Total Assigned Feeds</p>
              <p className="text-2xl font-black text-slate-800">{feeds.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase">With Git Repository</p>
              <p className="text-2xl font-black text-green-600">{feedsWithGit.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
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
      </div>

      {/* Feeds Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Feed Name
                </th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Project
                </th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Git Path
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedFeeds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <FolderGit2 size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">No feeds assigned yet</p>
                      <p className="text-xs text-slate-400 mt-1">Feeds will appear here once assigned by your Project Manager</p>
                    </div>
                   </td>
                 </tr>
              ) : (
                paginatedFeeds.map((feed) => {
                  const hasGit = feed.hasGitRepo && feed.gitPath;
                  
                  return (
                    <tr key={feed._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${hasGit ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            <FolderGit2 size={16} />
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
                        <span className={`inline-flex px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          feed.feedType === 'Daily' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          feed.feedType === 'Weekly' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-purple-100 text-purple-700 border-purple-200'
                        }`}>
                          {feed.feedType}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4">
                        {hasGit ? (
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                              {feed.gitPath.feedPath}/src
                            </code>
                            <button
                              onClick={() => {
                                const fullPath = `${feed.gitPath.rootPath}/src`;
                                copyToClipboard(fullPath, `path-${feed._id}`);
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                              title="Copy full path"
                            >
                              {copiedPath === `path-${feed._id}` ? (
                                <CheckCircle size={14} className="text-green-600" />
                              ) : (
                                <Copy size={14} className="text-slate-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="text-yellow-500" />
                            <span className="text-xs text-slate-400 italic">No Git repository linked</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasGit && (
                            <>
                              <button
                                onClick={() => fetchDeployScript(feed)}
                                disabled={generatingScript[feed._id]}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all text-xs font-medium disabled:opacity-50"
                              >
                                {generatingScript[feed._id] ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Terminal size={14} />
                                )}
                                Get Script
                              </button>
                              <a
                                href={`${feed.gitPath.rootPath}/src`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-all text-xs font-medium"
                              >
                                <ExternalLink size={14} />
                                Open on GitHub
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400">
              Showing {paginatedFeeds.length} of {filteredFeeds.length} feeds
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-black text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Script Modal - Simplified */}
      {showScriptModal && currentScript && currentFeedInfo && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Terminal size={20} />
                  Deployment Script
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Feed: <span className="text-blue-400 font-semibold">{currentFeedInfo.name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Simplified Instructions */}
              <div className="mb-6 bg-blue-900/30 border border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <CheckCircle size={16} />
                  How to use:
                </h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>1. Save this file as <code className="bg-slate-800 px-2 py-1 rounded text-xs">deploy.py</code> in your project folder</p>
                  <p>2. Run: <code className="bg-slate-800 px-2 py-1 rounded text-xs">python deploy.py</code></p>
                  <p className="text-green-400 text-xs mt-2">✓ The script will upload your entire folder to <code className="bg-slate-800 px-1 rounded">{currentFeedInfo.name}/src</code></p>
                </div>
              </div>
              
              {/* Script Content */}
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <button
                    onClick={() => copyToClipboard(currentScript, 'full-script')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-all flex items-center gap-2"
                  >
                    {copiedPath === 'full-script' ? (
                      <><CheckCircle size={14} className="text-green-500" /> Copied!</>
                    ) : (
                      <><Copy size={14} /> Copy Script</>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                  <code className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                    {currentScript}
                  </code>
                </pre>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
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

export default DeveloperGitFeeds;