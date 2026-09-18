// frontend/src/pages/Worklog.jsx - FULL UPDATED WITH INTEGRATED TIME TRACKING

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
  Coffee,
  StopCircle,
  Ticket
} from 'lucide-react';

import API_BASE_URL from '../config';
import notificationManager from '../utils/notifications';

const Worklog = () => {

  // ========================================
  // TAB STATE
  // ========================================
  const [selectedTab, setSelectedTab] = useState('feeds');

  // ========================================
  // FEED WORKLOG STATE
  // ========================================
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();
  
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedFeedDescription, setSelectedFeedDescription] = useState(null);
  const [workDescription, setWorkDescription] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [isEditingLog, setIsEditingLog] = useState(false);

  // ========================================
  // TICKET WORKLOG STATE
  // ========================================
  const [ticketLogs, setTicketLogs] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');

  const [showTicketLogModal, setShowTicketLogModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDescription, setTicketDescription] = useState('');
  const [submittingTicketLog, setSubmittingTicketLog] = useState(false);
  const [isEditingTicketLog, setIsEditingTicketLog] = useState(false);

  // Track if notification has been sent for each running feed
  const notificationSentRef = useRef({});
  const lastNotificationTimeRef = useRef({});

  // Track ticket long running notifications
  const ticketNotificationSentRef = useRef({});
  const ticketLastNotificationTimeRef = useRef({});

  // Break state
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);

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

  const serverTimeOffsetRef = useRef(0);
  const [serverSyncStatus, setServerSyncStatus] = useState({
    synced: false,
    lastSyncAt: null,
    lastSyncDisplay: null,
    offsetMs: 0,
    isSyncing: false,
    isStale: false,
  });

  const [tick, setTick] = useState(0);

  const getServerNow = useCallback(() => {
    return Date.now() + serverTimeOffsetRef.current;
  }, []);

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

      if (serverDate !== localDate || timeDiffMinutes > 5) {
        setTimeMismatch({
          isMismatch: true,
          message: serverDate !== localDate 
            ? `Date mismatch: Server ${serverDate} vs Local ${localDate}` 
            : `Time offset: ${Math.round(timeDiffMinutes)} minutes`,
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

    } catch (err) {
      console.error('[TimeSync] Sync failed:', err);
      setServerSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        synced: prev.synced,
      }));
    }
  }, []);

  const fetchLogs = async () => {
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

  const fetchTicketWorklogs = async () => {
    setTicketLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { setTicketLoading(false); return; }
      
      const res = await axios.get(`${API_BASE_URL}/api/dev/ticket-worklog`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTicketLogs(res.data);
    } catch (err) {
      console.error('Error fetching ticket worklogs:', err);
      setTicketLogs([]);
    } finally {
      setTicketLoading(false);
    }
  };

  const handleBreak = async () => {
    if (isStoppingAll) return;
    
    const hasRunningFeeds = logs.some(item => item.worklog.isRunning);
    const hasRunningTickets = ticketLogs.some(item => item.worklog?.isRunning);
    
    if (!hasRunningFeeds && !hasRunningTickets) {
      toast.info('No running timers to stop');
      return;
    }

    setIsStoppingAll(true);
    try {
      const runningFeeds = logs.filter(item => item.worklog.isRunning);
      for (const item of runningFeeds) {
        await stopTimer(item.feed._id, true);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const runningTickets = ticketLogs.filter(item => item.worklog?.isRunning);
      for (const item of runningTickets) {
        await stopTicketTimer(item.ticket._id, true);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const totalStopped = runningFeeds.length + runningTickets.length;
      
      setIsBreakMode(true);
      toast.success(`🛑 Break started! ${totalStopped} timer(s) stopped`, {
        duration: 3000,
        icon: '☕'
      });
      
      setTimeout(() => {
        setIsBreakMode(false);
      }, 5000);
      
    } catch (err) {
      console.error('Break error:', err);
      toast.error('Failed to stop all timers');
    } finally {
      setIsStoppingAll(false);
    }
  };

  const checkLongRunningTimers = useCallback(() => {
    const serverNow = getServerNow();
    
    logs.forEach(item => {
      const worklog = item.worklog;
      const feedName = item.feed?.name;
      
      if (worklog.isRunning && worklog.startedAt) {
        const elapsedSeconds = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
        if (elapsedSeconds >= 7200) {
          const notificationKey = `${item.feed._id}_2hr`;
          const lastNotifTime = lastNotificationTimeRef.current[notificationKey] || 0;
          if (!notificationSentRef.current[notificationKey] || (serverNow - lastNotifTime) >= 30 * 60 * 1000) {
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
            
            toast.warning(`Working on "${feedName}" for ${hours}h ${minutes}m. Time for a break?`, {
              duration: 5000,
              icon: '☕'
            });
          }
        } else if (elapsedSeconds < 7200) {
          const notificationKey = `${item.feed._id}_2hr`;
          notificationSentRef.current[notificationKey] = false;
        }
      }
    });
    
    ticketLogs.forEach(item => {
      const worklog = item.worklog;
      const ticketTitle = item.ticket?.title;
      
      if (worklog?.isRunning && worklog.startedAt) {
        const elapsedSeconds = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
        if (elapsedSeconds >= 7200) {
          const notificationKey = `ticket_${item.ticket._id}_2hr`;
          const lastNotifTime = ticketLastNotificationTimeRef.current[notificationKey] || 0;
          if (!ticketNotificationSentRef.current[notificationKey] || (serverNow - lastNotifTime) >= 30 * 60 * 1000) {
            ticketNotificationSentRef.current[notificationKey] = true;
            ticketLastNotificationTimeRef.current[notificationKey] = serverNow;
            
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            
            notificationManager.show({
              title: '⏰ Long Ticket Work Session Alert',
              body: `You've been working on ticket "${ticketTitle}" for ${hours}h ${minutes}m. Consider taking a break!`,
              icon: '/images/login_img.png',
              tag: `long-ticket-${item.ticket._id}`,
              priority: 'default',
              data: { ticketId: item.ticket._id, type: 'ticket' }
            });
            
            toast.warning(`Working on ticket "${ticketTitle}" for ${hours}h ${minutes}m. Time for a break?`, {
              duration: 5000,
              icon: '☕'
            });
          }
        } else if (elapsedSeconds < 7200) {
          const notificationKey = `ticket_${item.ticket._id}_2hr`;
          ticketNotificationSentRef.current[notificationKey] = false;
        }
      }
    });
  }, [logs, ticketLogs, tick, getServerNow]);

  useEffect(() => {
    const interval = setInterval(checkLongRunningTimers, 60000);
    return () => clearInterval(interval);
  }, [checkLongRunningTimers]);

  useEffect(() => {
    const timer = setTimeout(() => syncServerTime(false), 500);
    const syncInterval = setInterval(() => syncServerTime(true), 30000);
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
    fetchLogs();
    fetchTicketWorklogs();
  }, []);

  useEffect(() => {
    let lastToken = localStorage.getItem('token');
    const tokenCheck = setInterval(() => {
      const current = localStorage.getItem('token');
      if (current !== lastToken) {
        lastToken = current;
        if (current) {
          setTimeout(() => syncServerTime(false), 500);
        } else {
          setLogs([]);
          setTicketLogs([]);
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
  FEED TIMER FUNCTIONS
  ========================================
  */

  const startTimer = async (feedId) => {
    await syncServerTime(false);
    
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

      const notificationKey = `${feedId}_2hr`;
      notificationSentRef.current[notificationKey] = false;
      lastNotificationTimeRef.current[notificationKey] = 0;

      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to start timer');
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
      toast.error(err.response?.data?.error || 'Failed to pause timer');
    }
  };

  const stopTimer = async (feedId, silent = false) => {
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

      const notificationKey = `${feedId}_2hr`;
      notificationSentRef.current[notificationKey] = false;
      lastNotificationTimeRef.current[notificationKey] = 0;

      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
      
      if (!silent) {
        toast.success('Timer stopped successfully');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to stop timer');
      }
    }
  };

  /*
  ========================================
  TICKET TIMER FUNCTIONS
  ========================================
  */

  const startTicketTimer = async (ticketId) => {
    await syncServerTime(false);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/ticket-worklog/start/${ticketId}`, {}, {
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

      const notificationKey = `ticket_${ticketId}_2hr`;
      ticketNotificationSentRef.current[notificationKey] = false;
      ticketLastNotificationTimeRef.current[notificationKey] = 0;

      setTicketLogs(prev => prev.map(item =>
        item.ticket._id === ticketId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to start ticket timer');
    }
  };

  const pauseTicketTimer = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/ticket-worklog/pause/${ticketId}`, {}, {
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

      setTicketLogs(prev => prev.map(item =>
        item.ticket._id === ticketId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to pause ticket timer');
    }
  };

  const stopTicketTimer = async (ticketId, silent = false) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/ticket-worklog/stop/${ticketId}`, {}, {
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

      const notificationKey = `ticket_${ticketId}_2hr`;
      ticketNotificationSentRef.current[notificationKey] = false;
      ticketLastNotificationTimeRef.current[notificationKey] = 0;

      setTicketLogs(prev => prev.map(item =>
        item.ticket._id === ticketId ? { ...item, worklog: res.data.worklog ?? res.data } : item
      ));
      
      if (!silent) {
        toast.success('Ticket timer stopped successfully');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to stop ticket timer');
      }
    }
  };

  /*
  ========================================
  MODAL FUNCTIONS - FEED (FIXED)
  ========================================
  
  ✅ FIX: The `todayDescription` is a sibling of `feed` in the API response,
  NOT a property of `feed`. We now pass it explicitly.
  */

  const openLogModal = (feed, todayDescription, editing = false) => {
    setSelectedFeed(feed);
    setSelectedFeedDescription(todayDescription || null);
    
    if (editing && todayDescription?.description) {
      setWorkDescription(todayDescription.description);
      setIsEditingLog(true);
    } else {
      setWorkDescription('');
      setIsEditingLog(false);
    }
    
    setShowLogModal(true);
  };

  const closeModal = () => {
    setShowLogModal(false);
    setSelectedFeed(null);
    setSelectedFeedDescription(null);
    setWorkDescription('');
    setIsEditingLog(false);
  };

  const saveWorkDescription = async () => {
    if (!workDescription.trim()) {
      toast.error('Please enter work description');
      return;
    }

    try {
      setSubmittingLog(true);
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/log-description`, {
        feedId: selectedFeed._id,
        description: workDescription.trim(),
        isEdit: isEditingLog
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update the logs state with the new todayDescription
      setLogs(prev => prev.map(item =>
        item.feed._id === selectedFeed._id ? { ...item, todayDescription: res.data } : item
      ));

      toast.success(isEditingLog ? 'Work log updated' : 'Work log saved');
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save log');
    } finally {
      setSubmittingLog(false);
    }
  };

  /*
  ========================================
  MODAL FUNCTIONS - TICKET
  ========================================
  */

  const openTicketLogModal = (ticket, worklog, editing = false) => {
    setSelectedTicket({ ...ticket, worklog });
    setTicketDescription(worklog?.description || '');
    setIsEditingTicketLog(editing);
    setShowTicketLogModal(true);
  };

  const closeTicketModal = () => {
    setShowTicketLogModal(false);
    setSelectedTicket(null);
    setTicketDescription('');
    setIsEditingTicketLog(false);
  };

  const saveTicketDescription = async () => {
    if (!ticketDescription.trim()) {
      toast.error('Please enter work description');
      return;
    }

    try {
      setSubmittingTicketLog(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/ticket-worklog/description`, {
        ticketId: selectedTicket._id,
        description: ticketDescription
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTicketLogs(prev => prev.map(item =>
        item.ticket._id === selectedTicket._id ? { ...item, worklog: res.data.worklog } : item
      ));

      toast.success(isEditingTicketLog ? 'Ticket work log updated' : 'Ticket work log saved');
      closeTicketModal();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save ticket log');
    } finally {
      setSubmittingTicketLog(false);
    }
  };

  /*
  ========================================
  GET TIME FUNCTIONS
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

  const getTicketTime = useCallback((worklog) => {
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
  OVERLAP DETECTION
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

    ticketLogs.forEach(item => {
      const worklog = item.worklog;
      if (!worklog) return;
      
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
  }, [logs, ticketLogs, tick, getServerNow]);

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
      const feedTotal = logs.reduce((total, item) => total + (item.worklog.totalTime || 0), 0);
      const ticketTotal = ticketLogs.reduce((total, item) => total + (item.worklog?.totalTime || 0), 0);
      return feedTotal + ticketTotal;
    }
    
    const merged = mergeIntervals(intervals);
    const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
    return Math.floor(totalMs / 1000);
  }, [logs, ticketLogs, getAllTimeIntervals]);

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

  const filteredTicketLogs = useMemo(() => {
    return ticketLogs.filter(item => {
      const ticket = item.ticket;
      const worklog = item.worklog || {};
      
      const matchesSearch = ticket.title?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
                           ticket.ticketNumber?.toLowerCase().includes(ticketSearchTerm.toLowerCase());
      
      let currentStatus = 'stopped';
      if (worklog.isRunning) currentStatus = 'running';
      else if (worklog.totalTime > 0) currentStatus = 'paused';
      
      const matchesStatus = ticketStatusFilter === 'all' || currentStatus === ticketStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [ticketLogs, ticketSearchTerm, ticketStatusFilter]);

  /*
  ========================================
  CALCULATIONS
  ========================================
  */

  const totalIndividualTime = useMemo(() => {
    const feedTotal = filteredLogs.reduce((total, item) => total + getFeedTime(item.worklog), 0);
    const ticketTotal = filteredTicketLogs.reduce((total, item) => total + getTicketTime(item.worklog), 0);
    return feedTotal + ticketTotal;
  }, [filteredLogs, filteredTicketLogs, tick]);

  const actualWorkingTime = useMemo(() => calculateActualWorkingTime(), [logs, ticketLogs, tick]);

  const overlapTime = useMemo(() => Math.max(0, totalIndividualTime - actualWorkingTime), [totalIndividualTime, actualWorkingTime]);

  const activeRunningCount = useMemo(() => 
    filteredLogs.filter(item => item.worklog.isRunning).length + 
    filteredTicketLogs.filter(item => item.worklog?.isRunning).length,
    [filteredLogs, filteredTicketLogs]
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'running': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Play size={10} className="text-emerald-600" />, label: 'Running' };
      case 'paused': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Pause size={10} className="text-amber-600" />, label: 'Paused' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: <Square size={10} className="text-slate-500" />, label: 'Stopped' };
    }
  };

  const getTicketStatusBadge = (status) => {
    switch(status) {
      case 'running': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <Play size={10} className="text-purple-600" />, label: 'Running' };
      case 'paused': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Pause size={10} className="text-amber-600" />, label: 'Paused' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: <Square size={10} className="text-slate-500" />, label: 'Stopped' };
    }
  };

  const handleManualRefresh = () => {
    syncServerTime(false);
    fetchLogs();
    fetchTicketWorklogs();
  };

  const getCurrentISTTime = () => {
    return new Date(getServerNow()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

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
              Time Tracking (Overlap-Aware)
            </p>
          </div>
          
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

      {serverSyncStatus.synced && Math.abs(serverSyncStatus.offsetMs) > 1000 && (
        <div className="mb-4 p-2 bg-blue-50/50 border border-blue-200/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Info size={12} className="text-blue-500" />
            <p className="text-[8px] text-blue-600">
              Server time offset detected: {Math.abs(serverSyncStatus.offsetMs) >= 1000
                ? `${(Math.abs(serverSyncStatus.offsetMs) / 1000).toFixed(1)}s`
                : `${Math.abs(serverSyncStatus.offsetMs)}ms`}
            </p>
          </div>
        </div>
      )}

      {/* BREAK BUTTON */}
      <div className="mb-4">
        <button
          onClick={handleBreak}
          disabled={isStoppingAll || activeRunningCount === 0}
          className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md ${
            isBreakMode 
              ? 'bg-green-500 text-white shadow-green-200' 
              : isStoppingAll || activeRunningCount === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200 hover:shadow-lg active:scale-95'
          }`}
        >
          {isBreakMode ? (
            <>
              <Coffee size={18} className="animate-bounce" />
              Break Taken! ☕
            </>
          ) : isStoppingAll ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Stopping...
            </>
          ) : (
            <>
              <Coffee size={18} />
              Break ({activeRunningCount} running)
            </>
          )}
        </button>
        <span className="text-[8px] text-slate-400 ml-3">
          {activeRunningCount === 0 ? 'No timers running' : `Stops ${activeRunningCount} running timer(s)`}
        </span>
      </div>

      {/* STATS BAR */}
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
              <Ticket size={14} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Ticket Timers</p>
              <p className="text-sm font-black text-purple-600">
                {ticketLogs.filter(item => item.worklog?.isRunning).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* INFO NOTE */}
      {activeRunningCount > 1 && (
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

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${
            selectedTab === 'feeds' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setSelectedTab('feeds')}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Feeds
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          </div>
        </button>
        <button
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${
            selectedTab === 'tickets' 
              ? 'border-purple-600 text-purple-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setSelectedTab('tickets')}
        >
          <div className="flex items-center gap-2">
            <Ticket size={16} />
            Tickets
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
              {ticketLogs.length}
            </span>
          </div>
        </button>
      </div>

      {/* ========================================
          FEED SECTION
          ======================================== */}
      {selectedTab === 'feeds' && (
        <>
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
                      const todayDescription = item.todayDescription;
                      const feedTime = getFeedTime(worklog);
                      const hasTodayLog = !!todayDescription?.description;
                      const statusType = worklog.isRunning ? 'running' : (worklog.totalTime > 0 ? 'paused' : 'stopped');
                      const statusData = getStatusBadge(statusType);
                      
                      let isLongRunning = false;
                      if (worklog.isRunning && worklog.startedAt) {
                        const serverNow = getServerNow();
                        const elapsedSeconds = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
                        if (elapsedSeconds >= 7200) {
                          isLongRunning = true;
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
                                  Long Run
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
                                  live
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

                              {/* ✅ FIX: Pass todayDescription explicitly */}
                              {!hasTodayLog ? (
                                <button
                                  onClick={() => openLogModal(feed, todayDescription, false)}
                                  className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-200 hover:shadow-md"
                                  title="Log Today's Work"
                                >
                                  <FileText size={12} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => openLogModal(feed, todayDescription, true)}
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
      )}

      {/* ========================================
          TICKET SECTION
          ======================================== */}
      {selectedTab === 'tickets' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tickets by title or number..."
                  value={ticketSearchTerm}
                  onChange={(e) => setTicketSearchTerm(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-4 font-medium text-sm outline-none focus:border-purple-500 bg-slate-50"
                />
              </div>

              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm outline-none focus:border-purple-500 bg-slate-50 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="stopped">Stopped</option>
              </select>

              <button
                onClick={() => { setTicketSearchTerm(''); setTicketStatusFilter('all'); handleManualRefresh(); }}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <X size={12} />
                Reset Filters
              </button>
            </div>
          </div>

          {ticketLoading ? (
            <div className="flex justify-center py-20 text-slate-400 font-black">LOADING TICKETS...</div>
          ) : filteredTicketLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 font-bold">
              {ticketLogs.length === 0 
                ? 'No active tickets assigned to you.' 
                : 'No tickets match your filters.'}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Ticket</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Time</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTicketLogs.map((item) => {
                      const ticket = item.ticket;
                      const worklog = item.worklog || {};
                      const ticketTime = getTicketTime(worklog);
                      const statusType = worklog.isRunning ? 'running' : (worklog.totalTime > 0 ? 'paused' : 'stopped');
                      const statusData = getTicketStatusBadge(statusType);
                      const hasDescription = worklog.description && worklog.description.trim().length > 0;

                      let isLongRunning = false;
                      if (worklog.isRunning && worklog.startedAt) {
                        const serverNow = getServerNow();
                        const elapsedSeconds = Math.floor((serverNow - new Date(worklog.startedAt).getTime()) / 1000);
                        if (elapsedSeconds >= 7200) {
                          isLongRunning = true;
                        }
                      }

                      return (
                        <tr key={ticket._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all duration-200 group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${worklog.isRunning ? 'bg-purple-100 animate-pulse' : 'bg-slate-100'}`}>
                                <Ticket size={12} className={worklog.isRunning ? 'text-purple-600' : 'text-slate-400'} />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-800">
                                  #{ticket.ticketNumber} - {ticket.title}
                                </span>
                                {hasDescription && (
                                  <p className="text-[8px] text-slate-500 truncate max-w-[150px]">
                                    {worklog.description}
                                  </p>
                                )}
                                {isLongRunning && (
                                  <span className="ml-1 text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase animate-pulse">
                                    <Coffee size={8} />
                                    Long Run
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Clock3 size={12} className="text-purple-500" />
                              <span className="text-sm font-black text-purple-700 font-mono">
                                {formatTimeWithSeconds(ticketTime)}
                              </span>
                              {worklog.isRunning && (
                                <span className="text-[7px] font-black bg-purple-100 text-purple-600 px-1 py-0.5 rounded uppercase">
                                  live
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
                                onClick={() => startTicketTimer(ticket._id)}
                                disabled={worklog.isRunning}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${worklog.isRunning ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white hover:shadow-md'}`}
                                title="Start Timer"
                              >
                                <Play size={12} />
                              </button>

                              <button
                                onClick={() => pauseTicketTimer(ticket._id)}
                                disabled={!worklog.isRunning}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${!worklog.isRunning ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white hover:shadow-md'}`}
                                title="Pause Timer"
                              >
                                <Pause size={12} />
                              </button>

                              <button
                                onClick={() => stopTicketTimer(ticket._id)}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all duration-200 hover:shadow-md"
                                title="Stop Timer"
                              >
                                <Square size={12} />
                              </button>

                              <div className="w-px h-5 bg-slate-200 mx-1" />

                              <button
                                onClick={() => openTicketLogModal(ticket, worklog, hasDescription)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:shadow-md ${
                                  hasDescription 
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white' 
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                }`}
                                title={hasDescription ? "Edit Description" : "Add Description"}
                              >
                                {hasDescription ? <Pencil size={12} /> : <FileText size={12} />}
                              </button>
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
      )}

      {/* ========================================
          FEED DESCRIPTION MODAL (UPDATED)
          ======================================== */}
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
              {/* ✅ FIX: Use selectedFeedDescription instead of selectedFeed.todayDescription */}
              {isEditingLog && selectedFeedDescription?.description && (
                <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={12} className="text-amber-600" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Current Description</p>
                  </div>
                  <div className="text-xs whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto bg-white p-3 rounded-lg">
                    {selectedFeedDescription.description}
                  </div>
                  <p className="text-[8px] text-amber-600 mt-2 italic">
                    This will be replaced with your new description below
                  </p>
                </div>
              )}

              <label className="text-[9px] uppercase tracking-[0.25em] font-black text-slate-500 block mb-2">
                {isEditingLog ? 'New Description' : 'What did you work on today?'}
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

      {/* ========================================
          TICKET DESCRIPTION MODAL
          ======================================== */}
      {showTicketLogModal && selectedTicket && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.35em] font-black text-purple-600 mb-1">Ticket Work Entry</p>
                <h2 className="text-xl font-black text-slate-900">
                  {isEditingTicketLog ? "Edit Ticket Description" : "Add Ticket Description"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  #{selectedTicket.ticketNumber} - {selectedTicket.title}
                </p>
              </div>
              <button onClick={closeTicketModal} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all">
                <X size={14} />
              </button>
            </div>

            <div className="p-6">
              {isEditingTicketLog && selectedTicket.worklog?.description && (
                <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={12} className="text-amber-600" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Current Description</p>
                  </div>
                  <div className="text-xs whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto bg-white p-3 rounded-lg">
                    {selectedTicket.worklog.description}
                  </div>
                </div>
              )}

              <label className="text-[9px] uppercase tracking-[0.25em] font-black text-slate-500 block mb-2">
                {isEditingTicketLog ? 'Update Description' : 'What work did you do on this ticket?'}
              </label>

              <textarea
                rows={6}
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Describe the work done on this ticket..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 outline-none resize-none text-sm font-medium focus:border-purple-500 focus:bg-white transition-all"
              />

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={closeTicketModal} className="px-5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all">
                  Cancel
                </button>
                <button
                  onClick={saveTicketDescription}
                  disabled={submittingTicketLog}
                  className="px-5 h-9 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {submittingTicketLog ? (
                    <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : (
                    isEditingTicketLog ? 'Update Description' : 'Save Description'
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