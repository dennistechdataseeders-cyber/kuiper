import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Layout, Database, Hash, ExternalLink, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp, User, Globe, Calendar, Clock, Target,
  CheckCircle, AlertCircle, TrendingUp, Briefcase, Lightbulb, Users,
  X, Send
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import developerTips from '../data/developerTips';

const DeveloperDashboard = () => {
  const { isCollapsed } = useSidebar();
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayFeeds, setTodayFeeds] = useState([]);
  const [randomTip, setRandomTip] = useState('');
  
  // Track expanded items
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [expandedFeedId, setExpandedFeedId] = useState(null);

  // Pagination State
  const [projectPage, setProjectPage] = useState(1);
  const [feedPage, setFeedPage] = useState(1);
  const itemsPerPage = 4;

  // Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [completionDescription, setCompletionDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get random tip on component mount
  useEffect(() => {
    const getRandomTip = () => {
      const randomIndex = Math.floor(Math.random() * developerTips.length);
      setRandomTip(developerTips[randomIndex]);
    };
    getRandomTip();
  }, []);

  // Get today's day name
  const getTodayDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Check if feed is scheduled for today AND not completed today
  const isFeedForToday = (feed) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already completed for today
    const isCompletedToday = feed.completionHistory && 
      Array.isArray(feed.completionHistory) && 
      feed.completionHistory.some(h => h && h.date === today);
    
    // If completed today, don't show
    if (isCompletedToday) return false;
    
    // Check if scheduled for today
    if (feed.feedType === 'Daily') return true;
    if (feed.feedType === 'Weekly') {
      return feed.weekDay === getTodayDayName();
    }
    return false;
  };

  // Check if feed is completed for today (for UI display)
  const isFeedCompletedToday = (feed) => {
    const today = new Date().toISOString().split('T')[0];
    if (feed.completionHistory && Array.isArray(feed.completionHistory)) {
      return feed.completionHistory.some(h => h && h.date === today);
    }
    return false;
  };

  useEffect(() => {
    const loadDevData = async () => {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [projRes, feedRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/dev/my-projects`, { headers }),
          axios.get(`${API_BASE_URL}/api/dev/my-feeds`, { headers })
        ]);
        setProjects(projRes.data);
        setFeeds(feedRes.data);
        
        // Filter feeds for today (not completed today)
        const today = feedRes.data.filter(feed => isFeedForToday(feed));
        setTodayFeeds(today);
        
      } catch (err) { 
        console.error("Fetch Error:", err);
        toast.error('Failed to load dashboard data');
      } finally { 
        setLoading(false);
      }
    };
    loadDevData();
  }, []);

  // Handle feed completion
  const handleCompleteFeed = async () => {
    if (!completionDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    
    try {
      await axios.post(
        `${API_BASE_URL}/api/dev/complete-feed`,
        {
          feedId: selectedFeed._id,
          description: completionDescription,
          completedAt: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Feed "${selectedFeed.name}" marked as completed!`);
      
      // Update today's feeds list (remove completed feed)
      setTodayFeeds(prev => prev.filter(feed => feed._id !== selectedFeed._id));
      
      // Also update the main feeds list to reflect completion
      setFeeds(prev => prev.map(feed => 
        feed._id === selectedFeed._id 
          ? { 
              ...feed, 
              completed: true,
              completionHistory: [
                ...(feed.completionHistory || []),
                { date: new Date().toISOString().split('T')[0], description: completionDescription }
              ]
            }
          : feed
      ));
      
      // Close modal and reset
      setShowCompleteModal(false);
      setSelectedFeed(null);
      setCompletionDescription('');
      
    } catch (err) {
      console.error("Complete feed error:", err);
      toast.error(err.response?.data?.message || 'Failed to complete feed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (feed) => {
    setSelectedFeed(feed);
    setShowCompleteModal(true);
    setCompletionDescription('');
  };

  // Pagination Logic
  const currentProjects = projects.slice((projectPage - 1) * itemsPerPage, projectPage * itemsPerPage);
  const currentFeeds = feeds.slice((feedPage - 1) * itemsPerPage, feedPage * itemsPerPage);
  const totalProjectPages = Math.ceil(projects.length / itemsPerPage);
  const totalFeedPages = Math.ceil(feeds.length / itemsPerPage);

  // Get feed type styling
  const getFeedTypeStyle = (type) => {
    switch(type) {
      case 'Daily': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Weekly': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getFeedTypeIcon = (type) => {
    switch(type) {
      case 'Daily': return <Clock size={10} />;
      case 'Weekly': return <Calendar size={10} />;
      default: return <Target size={10} />;
    }
  };

  if (loading) return (
    <div className={`p-8 flex items-center justify-center min-h-screen transition-all duration-300 bg-gradient-to-br from-slate-50 to-slate-100 ${
      isCollapsed ? 'ml-20' : 'ml-64'
    }`}>
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading workspace...</p>
      </div>
    </div>
  );

  return (
    <div className={`p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen transition-all duration-300 ${
      isCollapsed ? 'ml-20' : 'ml-64'
    }`}>
      
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Developer Workspace
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-2">
              Project & Feed Management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Projects</p>
              <p className="text-2xl font-black text-white">{projects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Layout size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Feeds</p>
              <p className="text-2xl font-black text-white">{feeds.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Database size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Today's Feeds</p>
              <p className="text-2xl font-black text-white">{todayFeeds.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Calendar size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Day</p>
              <p className="text-sm font-black text-white">{getTodayDayName()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* DEVELOPER TIP OF THE DAY */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
              <Lightbulb size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[9px] font-black text-amber-700 uppercase tracking-wider">Developer Wisdom</h3>
                <span className="text-[8px] font-black text-slate-400">Tip of the day</span>
              </div>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                "{randomTip}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S FEEDS SECTION */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
              Today's Schedule
            </h2>
            <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {getTodayDayName()}
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400">{todayFeeds.length} pending</span>
        </div>

        {todayFeeds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Calendar size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">No feeds scheduled for today</p>
            <p className="text-[10px] text-slate-400 mt-1">All caught up! Great job!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayFeeds.map(feed => (
              <div key={feed._id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${feed.feedType === 'Daily' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {feed.feedType === 'Daily' ? <Clock size={14} className="text-emerald-600" /> : <Calendar size={14} className="text-amber-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{feed.name}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                        {getFeedTypeIcon(feed.feedType)}
                        {feed.feedType}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash size={10} className="text-slate-400" />
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        {feed.projectId?.projectCustomId || 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => openCompleteModal(feed)}
                      className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm hover:shadow-md"
                    >
                      <CheckCircle size={10} />
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PROJECTS SECTION */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Assigned Projects</h2>
              <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{projects.length}</span>
            </div>
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => setProjectPage(p => Math.max(1, p - 1))} 
                disabled={projectPage === 1} 
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[9px] font-black text-slate-500 px-2">{projectPage}/{totalProjectPages}</span>
              <button 
                onClick={() => setProjectPage(p => Math.min(totalProjectPages, p + 1))} 
                disabled={projectPage === totalProjectPages} 
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {currentProjects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <Briefcase size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">No projects assigned</p>
              </div>
            ) : (
              currentProjects.map(proj => {
                const isExpanded = expandedProjectId === proj._id;
                return (
                  <div 
                    key={proj._id} 
                    className={`bg-white rounded-2xl border transition-all duration-300 ${
                      isExpanded ? 'border-blue-300 shadow-lg shadow-blue-100/50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div 
                      onClick={() => setExpandedProjectId(isExpanded ? null : proj._id)}
                      className="p-4 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 truncate flex-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                          <Globe size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{proj.projectCustomId}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {proj.feeds?.length || 0} Feeds
                          </p>
                        </div>
                      </div>
                      {isExpanded ? 
                        <ChevronUp size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" /> : 
                        <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      }
                    </div>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between">
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <ExternalLink size={10} />
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* FEEDS SECTION */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">All Feeds</h2>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{feeds.length}</span>
            </div>
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => setFeedPage(p => Math.max(1, p - 1))} 
                disabled={feedPage === 1} 
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[9px] font-black text-slate-500 px-2">{feedPage}/{totalFeedPages}</span>
              <button 
                onClick={() => setFeedPage(p => Math.min(totalFeedPages, p + 1))} 
                disabled={feedPage === totalFeedPages} 
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {currentFeeds.length === 0 ? (
              <div className="p-12 text-center">
                <Database size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">No feeds assigned</p>
              </div>
            ) : (
              currentFeeds.map((feed, idx) => {
                const isExpanded = expandedFeedId === feed._id;
                const isToday = isFeedForToday(feed);
                const isCompletedToday = isFeedCompletedToday(feed);
                
                return (
                  <div 
                    key={feed._id} 
                    className={`border-slate-100 transition-all duration-200 ${
                      idx !== currentFeeds.length - 1 ? 'border-b' : ''
                    } ${isToday ? 'bg-amber-50/30' : ''} ${isCompletedToday ? 'bg-emerald-50/20' : ''}`}
                  >
                    <div 
                      onClick={() => setExpandedFeedId(isExpanded ? null : feed._id)}
                      className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all ${
                        isExpanded ? 'bg-blue-50/50' : ''
                      } ${isToday ? 'hover:bg-amber-50/50' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {isToday && !isCompletedToday && (
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {isCompletedToday && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          feed.feedType === 'Daily' ? 'bg-emerald-100' : 
                          feed.feedType === 'Weekly' ? 'bg-amber-100' : 'bg-slate-100'
                        }`}>
                          {feed.feedType === 'Daily' ? <Clock size={14} className="text-emerald-600" /> : 
                           feed.feedType === 'Weekly' ? <Calendar size={14} className="text-amber-600" /> : 
                           <Target size={14} className="text-slate-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-800">{feed.name}</p>
                            {isToday && !isCompletedToday && (
                              <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Today
                              </span>
                            )}
                            {isCompletedToday && (
                              <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Completed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Hash size={9} className="text-slate-400" />
                            <p className="text-[9px] font-bold text-slate-500">
                              {feed.projectId?.projectCustomId || 'Global'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                          {getFeedTypeIcon(feed.feedType)}
                          {feed.feedType}
                        </span>
                        {isExpanded ? 
                          <ChevronUp size={14} className="text-slate-400" /> : 
                          <ChevronDown size={14} className="text-slate-400" />
                        }
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100">
                          <div className="space-y-2">
                            {feed.feedType === 'Weekly' && (
                              <div className="flex items-center gap-2">
                                <Calendar size={10} className="text-amber-500" />
                                <span className="text-[9px] font-bold text-amber-700 uppercase">
                                  Every {feed.weekDay}
                                </span>
                              </div>
                            )}
                            {feed.feedType === 'Daily' && (
                              <div className="flex items-center gap-2">
                                <Clock size={10} className="text-emerald-500" />
                                <span className="text-[9px] font-bold text-emerald-700 uppercase">
                                  Daily Schedule
                                </span>
                              </div>
                            )}
                            {feed.feedType === 'Once off' && (
                              <div className="flex items-center gap-2">
                                <Target size={10} className="text-emerald-500" />
                                <span className="text-[9px] font-bold text-emerald-700 uppercase">
                                  Once-off
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>

      {/* COMPLETION MODAL */}
      {showCompleteModal && selectedFeed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Complete Feed</h2>
                    <p className="text-xs text-slate-500">Mark this feed as completed</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setSelectedFeed(null);
                    setCompletionDescription('');
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Hash size={12} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Feed Details</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{selectedFeed.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(selectedFeed.feedType)}`}>
                    {getFeedTypeIcon(selectedFeed.feedType)}
                    {selectedFeed.feedType}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    Project: {selectedFeed.projectId?.projectCustomId || 'Unknown'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  Completion Description
                </label>
                <textarea
                  placeholder="Describe what was completed, any notes, issues, or next steps..."
                  value={completionDescription}
                  onChange={(e) => setCompletionDescription(e.target.value)}
                  rows={4}
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium text-slate-700 focus:border-emerald-400 transition-colors resize-none"
                  autoFocus
                />
                <p className="text-[8px] text-slate-400 mt-2">
                  This description will be saved as part of the feed completion record.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedFeed(null);
                  setCompletionDescription('');
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black uppercase text-xs tracking-wider hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteFeed}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black uppercase text-xs tracking-wider hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    Mark Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;