import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Layout, Database, Calendar, Clock, Lightbulb
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import developerTips from '../data/developerTips';
import io from 'socket.io-client';
import useLiveFeedProgress, { dueTodayFeeds } from '../utils/useLiveFeedProgress';
import LiveFeedProgress from '../components/LiveFeedProgress';

const DeveloperDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [randomTip, setRandomTip] = useState('');
  const [socket, setSocket] = useState(null);
  
  // Server time state
  const [serverTime, setServerTime] = useState(null);
  const [timeOffset, setTimeOffset] = useState(0);

  // Feed progress, live from the Feed Status data (refreshed on its own every 60 s)
  const live = useLiveFeedProgress('developer');
  const refreshLive = live.refresh;

  // Get random tip on component mount
  useEffect(() => {
    const getRandomTip = () => {
      const randomIndex = Math.floor(Math.random() * developerTips.length);
      setRandomTip(developerTips[randomIndex]);
    };
    getRandomTip();
  }, []);

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
      }
    } catch (err) {
      console.error('Failed to fetch server time:', err);
      // Fallback to client time if server time fetch fails
      const fallbackDate = new Date();
      setServerTime(fallbackDate);
      setTimeOffset(0);
    }
  };

  // ✅ Check if feed is CLOSED
  const isFeedClosed = (feed) => {
    return feed.feedStatus === 'Closed';
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
      
      // ✅ Filter out closed feeds from the main feeds list
      const activeFeeds = feedRes.data.filter(feed => !isFeedClosed(feed));
      setFeeds(activeFeeds);
      
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
          icon: '/images/tab_logo_192.png',
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
      refreshLive();
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
          icon: '/images/tab_logo_192.png'
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

  if (loading) return (
    <div className="page flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Loading workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="page bg-gradient-to-br from-slate-50 to-slate-100">
      
      {/* HEADER */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">
              Developer Workspace
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Today's Schedule & Quick Actions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATS CARDS - Updated with active feeds count */}
      <div className="grid grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Projects</p>
              <p className="text-2xl font-bold text-white">{projects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Layout size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Active Feeds</p>
              <p className="text-2xl font-bold text-white">{feeds.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Database size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Today's Feeds</p>
              <p className="text-2xl font-bold text-white">{dueTodayFeeds(live.data).length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                Server Date
              </p>
              <p className="text-sm font-semibold text-white">
                {serverTime ? serverTime.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Loading...'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* DEVELOPER TIP OF THE DAY */}
      <div className="mb-4 sm:mb-6">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
              <Lightbulb size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="label text-amber-700 uppercase">Developer Wisdom</h3>
                <span className="text-xs font-semibold text-slate-400">Tip of the day</span>
              </div>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                "{randomTip}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S FEEDS SECTION - live feed status (closed feeds are excluded by the server) */}
      <LiveFeedProgress live={live} linkBase="/developer/projects" title="Today's Feeds" />

      {/* QUICK LINKS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          onClick={() => window.location.href = '/developer/projects'}
          className="bg-white rounded-xl border border-slate-200 p-6 text-center hover:shadow-md transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shrink-0">
            <Layout size={24} />
          </div>
          <h3 className="section-title">View All Projects</h3>
          <p className="text-xs text-slate-400 mt-1">Browse your assigned projects</p>
        </button>
        
        <button
          onClick={() => window.location.href = '/developer/feeds'}
          className="bg-white rounded-xl border border-slate-200 p-6 text-center hover:shadow-md transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shrink-0">
            <Database size={24} />
          </div>
          <h3 className="section-title">View All Feeds</h3>
          <p className="text-xs text-slate-400 mt-1">Browse all your assigned feeds</p>
        </button>
      </div>
    </div>
  );
};

export default DeveloperDashboard;