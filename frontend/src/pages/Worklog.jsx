import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback
} from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Play,
  Pause,
  Square,
  Clock3,
  Search, 
  X,
  FileText,
  Pencil,
  Hash,
  Briefcase,
  Activity,
  Timer,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Lock,
  RefreshCw,
  Globe,
  Wifi,
  WifiOff,
  ShieldCheck,
  Coffee
} from 'lucide-react';

import API_BASE_URL from '../config';
import notificationManager from '../utils/notifications';

const Worklog = () => {

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();
  
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [workDescription, setWorkDescription] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [isEditingLog, setIsEditingLog] = useState(false);

  // Track if notification has been sent for each running feed
  const notificationSentRef = useRef({});
  // Track last notification time for each feed (to avoid spam)
  const lastNotificationTimeRef = useRef({});

  // System Time Mismatch State
  const [timeMismatch, setTimeMismatch] = useState({ 
    isMismatch: false, 
    message: '', 
    serverTime: null, 
    localTime: null,
    serverDate: null,
    localDate: null,
    timeDiffMinutes: 0
  });
  const [isChecking, setIsChecking] = useState(false);

  /*
  ========================================
  SERVER TIME SYNC STATE
  ========================================
  */

  // serverTimeOffset: milliseconds to ADD to Date.now() to get server time
  // e.g. if server is 5000ms ahead of client, offset = +5000
  const serverTimeOffsetRef = useRef(0);
  const [serverSyncStatus, setServerSyncStatus] = useState({
    synced: false,
    lastSyncAt: null,
    lastSyncDisplay: null,
    offsetMs: 0,
    isSyncing: false,
    isStale: false,
  });

  // Ticker to re-render every second (for live timers)
  const [tick, setTick] = useState(0);

  /*
  ========================================
  GET SERVER-CORRECTED "NOW"
  ========================================
  */

  const getServerNow = useCallback(() => {
    return Date.now() + serverTimeOffsetRef.current;
  }, []);

  /*
  ========================================
  FORMAT TIME (WITH SECONDS FULL DISPLAY)
  ========================================
  */

  const formatTimeWithSeconds = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatSyncAge = (lastSyncAt) => {
    if (!lastSyncAt) return 'Never';
    const ageSeconds = Math.floor((Date.now() - lastSyncAt) / 1000);
    if (ageSeconds < 5) return 'Just now';
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    return `${Math.floor(ageSeconds / 60)}m ago`;
  };

  /*
  ========================================
  SYNC SERVER TIME (offset calculation)
  ========================================
  */

  const syncServerTime = useCallback(async (silent = false) => {
    if (!silent) {
      setServerSyncStatus(prev => ({ ...prev, isSyncing: true }));
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const t0 = Date.now();
      const response = await axios.get(`${API_BASE_URL}/api/dev/system-time-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const t1 = Date.now();

      const serverTime = new Date(response.data.serverTime).getTime();
      const networkLatencyMs = (t1 - t0) / 2;
      const estimatedServerNow = serverTime + networkLatencyMs;
      const newOffset = estimatedServerNow - t1;
      
      serverTimeOffsetRef.current = newOffset;

      const now = Date.now();
      const displayTime = new Date(estimatedServerNow).toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });

      setServerSyncStatus({
        synced: true,
        lastSyncAt: now,
        lastSyncDisplay: displayTime,
        offsetMs: Math.round(newOffset),
        isSyncing: false,
        isStale: false,
      });

      const serverDate = new Date(estimatedServerNow).toISOString().split('T')[0];
      const localDate = new Date(t1).toISOString().split('T')[0];
      const timeDiffMinutes = Math.abs(newOffset) / (1000 * 60);
      const isDateMismatch = serverDate !== localDate;
      const isTimeMismatch = timeDiffMinutes > 5;

      if (isDateMismatch || isTimeMismatch) {
        let message = '';
        if (isDateMismatch) {
          message = `Your system date (${localDate}) does NOT match the server date (${serverDate}). `;
        }
        if (isTimeMismatch) {
          message += `Your system time is ${Math.round(timeDiffMinutes)} minutes ${newOffset > 0 ? 'behind' : 'ahead'} of server time.`;
        }
        setTimeMismatch({
          isMismatch: true,
          message: message.trim(),
          serverTime: new Date(estimatedServerNow).toLocaleTimeString(),
          localTime: new Date(t1).toLocaleTimeString(),
          serverDate,
          localDate,
          timeDiffMinutes: Math.round(timeDiffMinutes)
        });
      } else {
        setTimeMismatch({ 
          isMismatch: false, 
          message: '', 
          serverTime: new Date(estimatedServerNow).toLocaleTimeString(),
          localTime: new Date(t1).toLocaleTimeString(),
          serverDate,
          localDate,
          timeDiffMinutes: 0
        });
      }

      console.log(`[TimeSync] Offset: ${Math.round(newOffset)}ms | Latency: ${Math.round(networkLatencyMs)}ms | ServerNow: ${displayTime}`);

    } catch (err) {
      console.error('[TimeSync] Sync failed:', err);
      setServerSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        synced: prev.synced,
      }));
    }
  }, []);

  /*
  ========================================
  CHECK SYSTEM TIME AGAINST SERVER TIME
  ========================================
  */

  const checkSystemTimeMismatch = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    await syncServerTime(false);
    setIsChecking(false);
  }, [isChecking, syncServerTime]);

  /*
  ========================================
  FETCH WORKLOGS
  ========================================
  */

  const fetchLogs = async () => {
    if (timeMismatch.isMismatch) {
      console.log('Skipping fetch - time mismatch exists');
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      
      const res = await axios.get(`${API_BASE_URL}/api/dev/worklog`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /*
  ========================================
  CHECK FOR LONG RUNNING TIMERS (2 HOUR WARNING)
  ========================================
  */

  const checkLongRunningTimers = useCallback(() => {
    logs.forEach(item => {
      const worklog = item.worklog;
      const feedName = item.feed?.name;
      
      if (worklog.isRunning && worklog.startedAt) {
        const serverNow = getServerNow();
        const startedAtTime = new Date(worklog.startedAt).getTime();
        const elapsedSeconds = Math.floor((serverNow - startedAtTime) / 1000);
        const elapsedHours = elapsedSeconds / 3600;
        
        // Check if elapsed time >= 2 hours (7200 seconds)
        if (elapsedSeconds >= 7200) {
          const notificationKey = `${item.feed._id}_2hr`;
          const lastNotifTime = lastNotificationTimeRef.current[notificationKey] || 0;
          const timeSinceLastNotif = serverNow - lastNotifTime;
          
          // Send notification every 30 minutes after the 2-hour mark
          if (!notificationSentRef.current[notificationKey] || timeSinceLastNotif >= 30 * 60 * 1000) {
            notificationSentRef.current[notificationKey] = true;
            lastNotificationTimeRef.current[notificationKey] = serverNow;
            
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            
            notificationManager.show({
              title: '⏰ Long Work Session Alert',
              body: `You've been working on "${feedName}" for ${hours}h ${minutes}m. Consider taking a break!`,
              icon: '/images/login_img.png',
              tag: `long-work-${item.feed._id}`,
              priority: 'default',
              data: { feedId: item.feed._id, type: 'worklog' }
            });
            
            // Also show a toast notification
            toast.warning(`Working on "${feedName}" for ${hours}h ${minutes}m. Time for a break?`, {
              duration: 5000,
              icon: '☕'
            });
          }
        } else if (elapsedSeconds < 7200) {
          // Reset notification flag if timer stops before 2 hours
          const notificationKey = `${item.feed._id}_2hr`;
          notificationSentRef.current[notificationKey] = false;
        }
      }
    });
  }, [logs, tick, getServerNow]);

  // Run the check every minute
  useEffect(() => {
    if (!timeMismatch.isMismatch) {
      const interval = setInterval(() => {
        checkLongRunningTimers();
      }, 60000); // Check every minute
      
      return () => clearInterval(interval);
    }
  }, [checkLongRunningTimers, timeMismatch.isMismatch]);

  /*
  ========================================
  EFFECTS
  ========================================
  */

  useEffect(() => {
    const timer = setTimeout(() => {
      syncServerTime(false);
    }, 500);

    const syncInterval = setInterval(() => {
      syncServerTime(true);
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(syncInterval);
    };
  }, [syncServerTime]);

  useEffect(() => {
    const staleCheck = setInterval(() => {
      setServerSyncStatus(prev => {
        if (!prev.lastSyncAt) return prev;
        const isStale = (Date.now() - prev.lastSyncAt) > 35000;
        if (isStale !== prev.isStale) return { ...prev, isStale };
        return prev;
      });
    }, 5000);
    return () => clearInterval(staleCheck);
  }, []);

  useEffect(() => {
    if (!timeMismatch.isMismatch) {
      fetchLogs();
    } else {
      setLogs([]);
    }
  }, [timeMismatch.isMismatch]);

  useEffect(() => {
    let lastToken = localStorage.getItem('token');
    const tokenCheck = setInterval(() => {
      const current = localStorage.getItem('token');
      if (current !== lastToken) {
        lastToken = current;
        if (current) {
          setTimeout(() => syncServerTime(false), 500);
        } else {
          setTimeMismatch({ isMismatch: false, message: '', serverTime: null, localTime: null, serverDate: null, localDate: null, timeDiffMinutes: 0 });
          setLogs([]);
        }
      }
    }, 1000);
    return () => clearInterval(tokenCheck);
  }, [syncServerTime]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && localStorage.getItem('token')) {
        syncServerTime(false);
      }
    };
    const onFocus = () => {
      if (localStorage.getItem('token')) syncServerTime(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncServerTime]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  /*
  ========================================
  START/PAUSE/STOP TIMER
  ========================================
  */

  const startTimer = async (feedId) => {
    await syncServerTime(false);
    
    if (timeMismatch.isMismatch) {
      alert('Warning: Your system time/date does not match the server time. Please sync your system clock before starting the timer.');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/start/${feedId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.serverTimestamp) {
        const receivedAt = Date.now();
        const newOffset = res.data.serverTimestamp - receivedAt;
        serverTimeOffsetRef.current = newOffset;
        setServerSyncStatus(prev => ({ 
          ...prev, 
          lastSyncAt: receivedAt, 
          offsetMs: Math.round(newOffset),
          isStale: false,
          synced: true
        }));
      }

      // Reset notification flag for this feed when starting
      const notificationKey = `${feedId}_2hr`;
      notificationSentRef.current[notificationKey] = false;
      lastNotificationTimeRef.current[notificationKey] = 0;

      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to start timer');
    }
  };

  const pauseTimer = async (feedId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/pause/${feedId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.serverTimestamp) {
        const receivedAt = Date.now();
        serverTimeOffsetRef.current = res.data.serverTimestamp - receivedAt;
        setServerSyncStatus(prev => ({ 
          ...prev, 
          lastSyncAt: receivedAt, 
          offsetMs: Math.round(res.data.serverTimestamp - receivedAt),
          isStale: false,
          synced: true
        }));
      }

      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to pause timer');
    }
  };

  const stopTimer = async (feedId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/stop/${feedId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.serverTimestamp) {
        const receivedAt = Date.now();
        serverTimeOffsetRef.current = res.data.serverTimestamp - receivedAt;
        setServerSyncStatus(prev => ({ 
          ...prev, 
          lastSyncAt: receivedAt, 
          offsetMs: Math.round(res.data.serverTimestamp - receivedAt),
          isStale: false,
          synced: true
        }));
      }

      // Reset notification flag when stopping
      const notificationKey = `${feedId}_2hr`;
      notificationSentRef.current[notificationKey] = false;
      lastNotificationTimeRef.current[notificationKey] = 0;

      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to stop timer');
    }
  };

  /*
  ========================================
  MODAL FUNCTIONS
  ========================================
  */

  const openLogModal = (feed, editing = false) => {
    setSelectedFeed(feed);
    setWorkDescription('');
    setIsEditingLog(editing);
    setShowLogModal(true);
  };

  const closeModal = () => {
    setShowLogModal(false);
    setSelectedFeed(null);
    setWorkDescription('');
    setIsEditingLog(false);
  };

  const saveWorkDescription = async () => {
    if (!workDescription.trim()) return alert('Please enter work description');

    try {
      setSubmittingLog(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/log-description`, {
        feedId: selectedFeed._id,
        description: workDescription
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLogs(prev => prev.map(item =>
        item.feed._id === selectedFeed._id ? { ...item, todayDescription: res.data } : item
      ));

      alert(isEditingLog ? 'Work log updated' : 'Work log saved');
      closeModal();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save log');
    } finally {
      setSubmittingLog(false);
    }
  };

  /*
  ========================================
  GET FEED TIME — uses server-corrected clock
  ========================================
  */

  const getFeedTime = useCallback((worklog) => {
    let total = worklog.totalTime || 0;
    if (worklog.isRunning && worklog.startedAt) {
      const serverNow = getServerNow();
      const elapsed = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
      total += Math.max(0, elapsed);
    }
    return total;
  }, [tick, getServerNow]);

  /*
  ========================================
  OVERLAP DETECTION — uses server-corrected clock
  ========================================
  */

  const getAllTimeIntervals = useCallback(() => {
    const intervals = [];
    const serverNow = getServerNow();

    logs.forEach(item => {
      const worklog = item.worklog;
      
      if (worklog.timeBlocks?.length > 0) {
        worklog.timeBlocks.forEach(block => {
          if (block.startTime && block.endTime) {
            intervals.push({
              start: new Date(block.startTime).getTime(),
              end: new Date(block.endTime).getTime()
            });
          } else if (block.startTime && !block.endTime && !worklog.isRunning) {
            intervals.push({
              start: new Date(block.startTime).getTime(),
              end: serverNow
            });
          }
        });
      }
      
      if (worklog.isRunning && worklog.startedAt) {
        intervals.push({
          start: new Date(worklog.startedAt).getTime(),
          end: serverNow
        });
      }
    });

    return intervals;
  }, [logs, tick, getServerNow]);

  const mergeIntervals = (intervals) => {
    if (intervals.length === 0) return [];
    intervals.sort((a, b) => a.start - b.start);
    const merged = [{ ...intervals[0] }];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const last = merged[merged.length - 1];
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ ...current });
      }
    }
    return merged;
  };

  const calculateActualWorkingTime = useCallback(() => {
    const intervals = getAllTimeIntervals();
    
    if (intervals.length === 0) {
      return logs.reduce((total, item) => total + (item.worklog.totalTime || 0), 0);
    }
    
    const merged = mergeIntervals(intervals);
    const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
    return Math.floor(totalMs / 1000);
  }, [logs, getAllTimeIntervals]);

  /*
  ========================================
  FILTERING
  ========================================
  */

  const projects = useMemo(() => {
    const map = new Map();
    logs.forEach(item => {
      const project = item.feed?.projectId;
      if (project?._id) map.set(project._id, project);
    });
    return Array.from(map.values());
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const feed = item.feed;
      const worklog = item.worklog;
      const matchesProject = selectedProject === 'all' || feed.projectId?._id === selectedProject;
      const matchesSearch = feed.name.toLowerCase().includes(searchTerm.toLowerCase());
      let currentStatus = 'stopped';
      if (worklog.isRunning) currentStatus = 'running';
      else if (worklog.totalTime > 0) currentStatus = 'paused';
      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      return matchesProject && matchesSearch && matchesStatus;
    });
  }, [logs, selectedProject, searchTerm, statusFilter]);

  /*
  ========================================
  CALCULATIONS
  ========================================
  */

  const totalIndividualTime = useMemo(() => {
    return filteredLogs.reduce((total, item) => total + getFeedTime(item.worklog), 0);
  }, [filteredLogs, tick]);

  const actualWorkingTime = useMemo(() => calculateActualWorkingTime(), [logs, tick]);

  const overlapTime = useMemo(() => Math.max(0, totalIndividualTime - actualWorkingTime), [totalIndividualTime, actualWorkingTime]);

  const activeRunningCount = useMemo(() => filteredLogs.filter(item => item.worklog.isRunning).length, [filteredLogs]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'running': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Play size={10} className="text-emerald-600" />, label: 'Running' };
      case 'paused': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Pause size={10} className="text-amber-600" />, label: 'Paused' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: <Square size={10} className="text-slate-500" />, label: 'Stopped' };
    }
  };

  const handleManualRefresh = () => {
    syncServerTime(false);
  };

  const getCurrentISTTime = () => {
    return new Date(getServerNow()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  /*
  ========================================
  SYNC INDICATOR COMPONENT
  ========================================
  */

  const SyncIndicator = () => {
    const { synced, isSyncing, isStale, lastSyncAt, offsetMs } = serverSyncStatus;
    const ageLabel = formatSyncAge(lastSyncAt);

    if (isSyncing) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
          <RefreshCw size={10} className="text-blue-500 animate-spin" />
          <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider">Syncing...</span>
        </div>
      );
    }

    if (!synced) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
          <WifiOff size={10} className="text-slate-400" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Not synced</span>
        </div>
      );
    }

    if (isStale) {
      return (
        <button
          onClick={handleManualRefresh}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all"
          title="Sync is stale — click to refresh"
        >
          <AlertTriangle size={10} className="text-amber-500" />
          <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">Stale · {ageLabel}</span>
        </button>
      );
    }

    const offsetDisplay = Math.abs(offsetMs) < 1000
      ? `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`
      : `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(1)}s`;

    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 cursor-default"
        title={`Server offset: ${offsetDisplay} | Last sync: ${ageLabel}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <ShieldCheck size={10} className="text-emerald-600" />
        <span className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">
          Synced with server
        </span>
        <span className="text-[7px] text-emerald-500 font-bold">· {ageLabel}</span>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Worklog
            </h1>
            <p className="text-[10px] uppercase tracking-[0.35em] font-black text-blue-600 mt-1">
              Developer Time Tracking (Overlap-Aware)
            </p>
          </div>
          
          {/* Time Display + Sync Indicator */}
          <div className="flex flex-col items-end gap-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200 shadow-sm text-right">
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-blue-500" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">IST (Server-Corrected)</span>
              </div>
              <p className="text-sm font-mono font-bold text-slate-700">{getCurrentISTTime()}</p>
            </div>
            <SyncIndicator />
          </div>
        </div>
      </div>

      {/* REST OF YOUR EXISTING COMPONENT CODE... */}
      {/* The rest of your Worklog component remains the same from here */}
      
      {serverSyncStatus.synced && Math.abs(serverSyncStatus.offsetMs) > 1000 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[9px] font-black text-blue-700 uppercase tracking-wider">
                Clock offset detected — server time tracking active
              </p>
              <p className="text-[8px] text-blue-600 mt-0.5">
                Your system clock is {Math.abs(serverSyncStatus.offsetMs) >= 1000
                  ? `${(Math.abs(serverSyncStatus.offsetMs) / 1000).toFixed(1)}s`
                  : `${Math.abs(serverSyncStatus.offsetMs)}ms`}{' '}
                {serverSyncStatus.offsetMs > 0 ? 'behind' : 'ahead'} of the server. 
                All timer durations are calculated using the server clock to prevent manipulation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM TIME MISMATCH WARNING */}
      {timeMismatch.isMismatch && (
        <div className="mb-6 p-6 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-xl shadow-lg">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <Lock size={32} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black text-red-800 uppercase tracking-wider mb-2">
                Time Synchronization Required
              </h3>
              <p className="text-sm font-medium text-red-700">
                ⚠️ {timeMismatch.message}
              </p>
              
              <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-green-700 uppercase tracking-wider flex items-center justify-center gap-1">
                      <Globe size={10} />
                      Server Time (IST)
                    </p>
                    <p className="text-sm font-mono font-bold text-green-700 mt-1">{timeMismatch.serverTime}</p>
                    <p className="text-[10px] font-bold text-green-700">{timeMismatch.serverDate}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-red-700 uppercase tracking-wider flex items-center justify-center gap-1">
                      <Clock3 size={10} />
                      Your System Time
                    </p>
                    <p className="text-sm font-mono font-bold text-red-700 mt-1">{timeMismatch.localTime}</p>
                    <p className="text-[10px] font-bold text-red-700">{timeMismatch.localDate}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-amber-600">
                    Difference: {timeMismatch.timeDiffMinutes} minutes
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-red-100 rounded-lg">
                <p className="text-[10px] text-red-700 font-medium">
                  ⚠️ To access worklogs and timer features, please synchronize your system date and time with the server.
                </p>
              </div>
              <button
                onClick={handleManualRefresh}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={14} />
                Check Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS BAR */}
      {!timeMismatch.isMismatch && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Timer size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Actual Time</p>
                <p className="text-sm font-black text-blue-700 font-mono">{formatTimeWithSeconds(actualWorkingTime)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle size={14} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Overlap</p>
                <p className="text-sm font-black text-amber-700 font-mono">{formatTimeWithSeconds(overlapTime)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Activity size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Active Timers</p>
                <p className="text-sm font-black text-emerald-600">{activeRunningCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Hash size={14} className="text-purple-600" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Total Feeds</p>
                <p className="text-sm font-black text-purple-600">{filteredLogs.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INFO NOTE — multiple timers */}
      {!timeMismatch.isMismatch && activeRunningCount > 1 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-[9px] font-black text-blue-700">Multiple timers running simultaneously</p>
              <p className="text-[8px] text-blue-600 mt-0.5">
                Time is counted only once in "Actual Time" (overlapping periods are merged using server timestamps)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FILTERS & TABLE */}
      {!timeMismatch.isMismatch ? (
        <>
          {/* FILTERS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm outline-none focus:border-blue-500 bg-slate-50 cursor-pointer"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project._id} value={project._id}>{project.name}</option>
                ))}
              </select>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search feed..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-4 font-medium text-sm outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm outline-none focus:border-blue-500 bg-slate-50 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="stopped">Stopped</option>
              </select>

              <button
                onClick={() => { setSelectedProject('all'); setSearchTerm(''); setStatusFilter('all'); handleManualRefresh(); }}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <X size={12} />
                Reset Filters
              </button>
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="flex justify-center py-20 text-slate-400 font-black">LOADING WORKLOGS...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 font-bold">
              No feeds found.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Feed</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Project</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Individual Time</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((item) => {
                      const feed = item.feed;
                      const worklog = item.worklog;
                      const feedTime = getFeedTime(worklog);
                      const hasTodayLog = item.canEditToday;
                      const statusType = worklog.isRunning ? 'running' : (worklog.totalTime > 0 ? 'paused' : 'stopped');
                      const statusData = getStatusBadge(statusType);
                      
                      // Calculate if this specific running feed has exceeded 2 hours for badge display
                      let isLongRunning = false;
                      let longRunningHours = 0;
                      let longRunningMinutes = 0;
                      if (worklog.isRunning && worklog.startedAt) {
                        const serverNow = getServerNow();
                        const elapsedSeconds = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
                        if (elapsedSeconds >= 7200) {
                          isLongRunning = true;
                          longRunningHours = Math.floor(elapsedSeconds / 3600);
                          longRunningMinutes = Math.floor((elapsedSeconds % 3600) / 60);
                        }
                      }

                      return (
                        <tr key={feed._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all duration-200 group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${worklog.isRunning ? 'bg-emerald-100 animate-pulse' : 'bg-slate-100'}`}>
                                <Hash size={12} className={worklog.isRunning ? 'text-emerald-600' : 'text-slate-400'} />
                              </div>
                              <span className="text-sm font-bold text-slate-800">{feed.name}</span>
                              {hasTodayLog && (
                                <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <CheckCircle size={8} />
                                  Logged
                                </span>
                              )}
                              {isLongRunning && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 animate-pulse">
                                  <Coffee size={8} />
                                  {longRunningHours}h {longRunningMinutes}m
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Briefcase size={10} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-600">{feed.projectId?.name || 'Unknown'}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Clock3 size={12} className="text-blue-500" />
                              <span className="text-sm font-black text-blue-700 font-mono">
                                {formatTimeWithSeconds(feedTime)}
                              </span>
                              {worklog.isRunning && (
                                <span className="text-[7px] font-black bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded uppercase">
                                  server
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusData.bg} ${statusData.text} ${statusData.border}`}>
                              {statusData.icon}
                              {statusData.label}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startTimer(feed._id)}
                                disabled={worklog.isRunning}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${worklog.isRunning ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-md'}`}
                                title="Start Timer"
                              >
                                <Play size={12} />
                              </button>

                              <button
                                onClick={() => pauseTimer(feed._id)}
                                disabled={!worklog.isRunning}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${!worklog.isRunning ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white hover:shadow-md'}`}
                                title="Pause Timer"
                              >
                                <Pause size={12} />
                              </button>

                              <button
                                onClick={() => stopTimer(feed._id)}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all duration-200 hover:shadow-md"
                                title="Stop Timer"
                              >
                                <Square size={12} />
                              </button>

                              <div className="w-px h-5 bg-slate-200 mx-1" />

                              {!hasTodayLog ? (
                                <button
                                  onClick={() => openLogModal(feed, false)}
                                  className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-200 hover:shadow-md"
                                  title="Log Today's Work"
                                >
                                  <FileText size={12} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => openLogModal(feed, true)}
                                  className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all duration-200 hover:shadow-md"
                                  title="Edit Today's Log"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Lock size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Access Restricted</h3>
            <p className="text-sm text-slate-500 max-w-md">
              Worklog access is temporarily disabled due to system time/date mismatch.
              Please synchronize your system clock with the server time to continue.
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Check Again
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.35em] font-black text-blue-600 mb-1">Daily Work Entry</p>
                <h2 className="text-xl font-black text-slate-900">
                  {isEditingLog ? "Edit Today's Work" : "Log Today's Work"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">{selectedFeed?.name}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all">
                <X size={14} />
              </button>
            </div>

            <div className="p-6">
              {isEditingLog && selectedFeed?.todayDescription?.description && (
                <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={12} className="text-amber-600" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Existing Log</p>
                  </div>
                  <div className="text-xs whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto bg-white p-3 rounded-lg">
                    {selectedFeed?.todayDescription?.description}
                  </div>
                </div>
              )}

              <label className="text-[9px] uppercase tracking-[0.25em] font-black text-slate-500 block mb-2">
                {isEditingLog ? 'Append New Update' : 'What did you work on today?'}
              </label>

              <textarea
                rows={6}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe frontend work, backend APIs, fixes, testing, deployment, meetings, integrations, etc..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 outline-none resize-none text-sm font-medium focus:border-blue-500 focus:bg-white transition-all"
              />

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={closeModal} className="px-5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all">
                  Cancel
                </button>
                <button
                  onClick={saveWorkDescription}
                  disabled={submittingLog}
                  className="px-5 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {submittingLog ? (
                    <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : (
                    isEditingLog ? 'Update Log' : 'Save Log'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Worklog;