import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Layout, Database, Calendar, Clock, Target,
  CheckCircle, AlertCircle, TrendingUp, Briefcase, Lightbulb, 
  X, Send, Monitor, Smartphone, Globe as GlobeIcon, Hash, 
  ChevronLeft, ChevronRight, ExternalLink, Users
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';
import developerTips from '../data/developerTips';
import io from 'socket.io-client';

const DeveloperDashboard = () => {
  const { isCollapsed } = useSidebar();
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayFeeds, setTodayFeeds] = useState([]);
  const [randomTip, setRandomTip] = useState('');
  const [socket, setSocket] = useState(null);
  
  // Server time state
  const [serverTime, setServerTime] = useState(null);
  const [serverDate, setServerDate] = useState('');
  const [serverDayName, setServerDayName] = useState('');
  const [serverDayOfMonth, setServerDayOfMonth] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0);

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

  // Get day name from date object
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Fetch server time
  const fetchServerTime = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/dev/system-time-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.serverTime) {
        const serverDateObj = new Date(response.data.serverTime);
        const clientNow = Date.now();
        const serverTimestamp = new Date(response.data.serverTime).getTime();
        const offset = serverTimestamp - clientNow;
        
        setTimeOffset(offset);
        setServerTime(serverDateObj);
        setServerDate(serverDateObj.toISOString().split('T')[0]);
        setServerDayName(getDayName(serverDateObj));
        setServerDayOfMonth(serverDateObj.getDate());
        
        // console.log('🕐 Server time fetched:', serverDateObj.toLocaleString());
        // console.log('📅 Server date:', serverDateObj.toISOString().split('T')[0]);
        // console.log('⏱️ Time offset:', offset, 'ms');
      }
    } catch (err) {
      console.error('Failed to fetch server time:', err);
      // Fallback to client time if server time fetch fails
      const fallbackDate = new Date();
      setServerTime(fallbackDate);
      setServerDate(fallbackDate.toISOString().split('T')[0]);
      setServerDayName(getDayName(fallbackDate));
      setServerDayOfMonth(fallbackDate.getDate());
      setTimeOffset(0);
    }
  };

  // Get server-corrected "today" date string
  const getServerToday = () => {
    if (serverDate) return serverDate;
    return new Date().toISOString().split('T')[0];
  };

  // Get server-corrected day name
  const getServerDayName = () => {
    if (serverDayName) return serverDayName;
    return getDayName(new Date());
  };

  // Get server-corrected day of month
  const getServerDayOfMonth = () => {
    if (serverDayOfMonth) return serverDayOfMonth;
    return new Date().getDate();
  };

  // Check if feed is scheduled for today using SERVER date
  const isFeedForToday = (feed) => {
    const today = getServerToday();
    const currentDayOfMonth = getServerDayOfMonth();
    const currentDayName = getServerDayName();
    
    const isCompletedToday = feed.completionHistory && 
      Array.isArray(feed.completionHistory) && 
      feed.completionHistory.some(h => h && h.date === today);
    
    if (isCompletedToday) return false;
    
    if (feed.feedType === 'Daily') return true;
    if (feed.feedType === 'Weekly') {
      return feed.weekDay === currentDayName;
    }
    if (feed.feedType === 'Monthly') {
      return feed.monthDay === currentDayOfMonth;
    }
    return false;
  };

  // Get platform icon and text
  const getPlatformInfo = (feed) => {
    const platform = feed.feedPlatform;
    if (!platform) return null;
    
    switch(platform) {
      case 'Web':
        return { icon: <GlobeIcon size={10} />, text: 'Web', color: 'bg-blue-100 text-blue-700' };
      case 'App':
        return { icon: <Smartphone size={10} />, text: 'App', color: 'bg-purple-100 text-purple-700' };
      case 'Both':
        return { icon: <Monitor size={10} />, text: 'Web + App', color: 'bg-indigo-100 text-indigo-700' };
      default:
        return null;
    }
  };

  // Load developer data
  const loadDevData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // First fetch server time
      await fetchServerTime();
      
      const [projRes, feedRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/dev/my-projects`, { headers }),
        axios.get(`${API_BASE_URL}/api/dev/my-feeds`, { headers })
      ]);
      setProjects(projRes.data);
      setFeeds(feedRes.data);
      
      // After feeds are loaded, filter based on server date
      const today = feedRes.data.filter(feed => isFeedForToday(feed));
      setTodayFeeds(today);
      
    } catch (err) { 
      console.error("Fetch Error:", err);
      toast.error('Failed to load dashboard data');
    } finally { 
      setLoading(false);
    }
  };

  // Setup socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) return;
    
    const newSocket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token }
    });
    
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('🔌 Socket connected');
      newSocket.emit('join-user-room', userId);
    });
    
    newSocket.on('connect_error', (error) => {
      console.log('⚠️ Socket connection error:', error.message);
    });
    
    // Listen for feed assignments
    newSocket.on('feed_assigned', (data) => {
      console.log('📢 New feed assigned:', data);
      
      // Show toast notification
      toast.success(data.message, {
        duration: 5000,
        icon: '📋'
      });
      
      // Show desktop notification
      if (Notification.permission === 'granted') {
        const notificationBody = data.githubInviteSent 
          ? `${data.message}\nGitHub invitation has been sent to your email!`
          : `${data.message}\nCheck with your PM for GitHub access.`;
        
        new Notification('New Feed Assignment', {
          body: notificationBody,
          icon: '/images/tab_logo.png',
          tag: `feed-${data.feed._id}`
        });
      }
      
      // Show GitHub invite status
      if (data.githubInviteSent) {
        toast.success('GitHub invitation has been sent to your email! Check your inbox (including spam).', {
          duration: 8000,
          icon: '🐙'
        });
      }
      
      // Refresh feeds list
      loadDevData();
    });
    
    // Listen for task assignments
    newSocket.on('new_task', (task) => {
      toast.info(`New task assigned: ${task.name || 'Development Task'}`, {
        duration: 5000,
        icon: '📝'
      });
      
      if (Notification.permission === 'granted') {
        new Notification('New Task Assigned', {
          body: task.details?.substring(0, 100) || 'You have a new task in your bucket',
          icon: '/images/tab_logo.png'
        });
      }
    });
    
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);
  
  // Initial data load
  useEffect(() => {
    loadDevData();
    
    // Refresh server time every 5 minutes
    const interval = setInterval(() => {
      fetchServerTime();
    }, 300000); // 5 minutes
    
    return () => clearInterval(interval);
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
                { date: getServerToday(), description: completionDescription }
              ]
            }
          : feed
      ));
      
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

  // Get feed type styling
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

  const getFeedTypeLabel = (feed) => {
    if (feed.feedType === 'Monthly') {
      const suffix = feed.monthDay ? ` (Day ${feed.monthDay})` : '';
      return `Monthly${suffix}`;
    }
    if (feed.feedType === 'Weekly' && feed.weekDay) {
      return `Weekly (${feed.weekDay})`;
    }
    return feed.feedType;
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
              Today's Schedule & Quick Actions
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
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">
                Server Date
              </p>
              <p className="text-sm font-black text-white">
                {serverTime ? serverTime.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Loading...'}
              </p>
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
              {getServerDayName()}
            </span>
            <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              Server Time
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
            <p className="text-[10px] text-slate-400 mt-1">
              Based on server date: {serverDate || 'Loading...'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayFeeds.map(feed => {
              const platformInfo = getPlatformInfo(feed);
              return (
                <div key={feed._id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${
                        feed.feedType === 'Daily' ? 'bg-emerald-100' : 
                        feed.feedType === 'Weekly' ? 'bg-amber-100' : 
                        feed.feedType === 'Monthly' ? 'bg-purple-100' : 'bg-slate-100'
                      }`}>
                        {feed.feedType === 'Daily' ? <Clock size={14} className="text-emerald-600" /> : 
                         feed.feedType === 'Weekly' ? <Calendar size={14} className="text-amber-600" /> : 
                         feed.feedType === 'Monthly' ? <Calendar size={14} className="text-purple-600" /> :
                         <Target size={14} className="text-slate-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{feed.name}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(feed.feedType)}`}>
                            {getFeedTypeIcon(feed.feedType)}
                            {getFeedTypeLabel(feed)}
                          </span>
                          {platformInfo && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${platformInfo.color}`}>
                              {platformInfo.icon}
                              {platformInfo.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {feed.webDomain && (feed.feedPlatform === 'Web' || feed.feedPlatform === 'Both') && (
                    <div className="mb-2 text-[8px] text-blue-600 truncate">
                      <GlobeIcon size={8} className="inline mr-1" />
                      {feed.webDomain}
                    </div>
                  )}
                  
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
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK LINKS */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => window.location.href = '/developer/projects'}
          className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-md transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Layout size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-800">View All Projects</h3>
          <p className="text-[9px] text-slate-400 mt-1">Browse your assigned projects</p>
        </button>
        
        <button
          onClick={() => window.location.href = '/developer/feeds'}
          className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-md transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Database size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-800">View All Feeds</h3>
          <p className="text-[9px] text-slate-400 mt-1">Browse all your assigned feeds</p>
        </button>
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
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${getFeedTypeStyle(selectedFeed.feedType)}`}>
                    {getFeedTypeIcon(selectedFeed.feedType)}
                    {getFeedTypeLabel(selectedFeed)}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    Project: {selectedFeed.projectId?.projectCustomId || 'Unknown'}
                  </span>
                  <span className="text-[8px] font-bold text-blue-500">
                    Date: {serverDate || 'Loading...'}
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
                  This description will be saved with the server date ({serverDate || 'Loading...'})
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