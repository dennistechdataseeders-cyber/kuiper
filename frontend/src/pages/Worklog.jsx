import React, {
  useEffect,
  useState,
  useMemo,
  useRef
} from 'react';

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
  RefreshCw
} from 'lucide-react';

import API_BASE_URL from '../config';

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

  // System Time Mismatch State
  const [timeMismatch, setTimeMismatch] = useState({ isMismatch: false, message: '', serverTime: null, localTime: null });
  const [isChecking, setIsChecking] = useState(false);
  
  // Auto-hide timer reference
  const autoHideTimerRef = useRef(null);

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

  // Clear auto-hide timer
  const clearAutoHideTimer = () => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  };

  /*
  ========================================
  CHECK SYSTEM TIME AGAINST SERVER TIME
  ========================================
  */

  const checkSystemTimeMismatch = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsChecking(false);
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/dev/system-time-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const serverTime = new Date(response.data.serverTime);
      const localTime = new Date();
      
      const timeDiffMinutes = Math.abs(serverTime - localTime) / (1000 * 60);
      
      const serverDate = serverTime.toISOString().split('T')[0];
      const localDate = localTime.toISOString().split('T')[0];
      const isDateMismatch = serverDate !== localDate;
      const isTimeMismatch = timeDiffMinutes > 5;
      
      if (isDateMismatch || isTimeMismatch) {
        let message = '';
        if (isDateMismatch) {
          message = `⚠️ Your system date (${localDate}) does not match the server date (${serverDate}). `;
        }
        if (isTimeMismatch) {
          message += `Your system time is ${Math.round(timeDiffMinutes)} minutes ${serverTime > localTime ? 'behind' : 'ahead'} of server time.`;
        }
        
        clearAutoHideTimer();
        
        setTimeMismatch({
          isMismatch: true,
          message: message.trim(),
          serverTime: serverTime.toLocaleString(),
          localTime: localTime.toLocaleString()
        });
        
        autoHideTimerRef.current = setTimeout(() => {
          setTimeMismatch(prev => ({ ...prev, isMismatch: false }));
        }, 10000);
        
      } else {
        setTimeMismatch({ isMismatch: false, message: '', serverTime: null, localTime: null });
        clearAutoHideTimer();
      }
    } catch (err) {
      console.error('Time check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  /*
  ========================================
  FETCH WORKLOGS
  ========================================
  */

  const fetchLogs = async () => {
    if (timeMismatch.isMismatch) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }
      
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

  // Run on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      checkSystemTimeMismatch();
      fetchLogs();
    }, 500);
    
    const interval = setInterval(() => {
      checkSystemTimeMismatch();
    }, 30000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      clearAutoHideTimer();
    };
  }, []);

  // Listen for localStorage changes (token changes on login/logout)
  useEffect(() => {
    let lastToken = localStorage.getItem('token');
    const tokenCheckInterval = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken !== lastToken) {
        lastToken = currentToken;
        if (currentToken) {
          setTimeout(() => {
            checkSystemTimeMismatch();
            fetchLogs();
          }, 500);
        } else {
          setTimeMismatch({ isMismatch: false, message: '', serverTime: null, localTime: null });
          setLogs([]);
        }
      }
    }, 1000);
    
    return () => clearInterval(tokenCheckInterval);
  }, []);

  // Listen for page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const token = localStorage.getItem('token');
        if (token) {
          checkSystemTimeMismatch();
          fetchLogs();
        }
      }
    };
    
    const handleFocus = () => {
      const token = localStorage.getItem('token');
      if (token) {
        checkSystemTimeMismatch();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /*
  ========================================
  START/PAUSE/STOP TIMER
  ========================================
  */

  const startTimer = async (feedId) => {
    await checkSystemTimeMismatch();
    if (timeMismatch.isMismatch) {
      alert('Warning: Your system time/date does not match the server time. Please sync your system clock before starting the timer.');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/dev/worklog/start/${feedId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data } : item
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
      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data } : item
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
      setLogs(prev => prev.map(item =>
        item.feed._id === feedId ? { ...item, worklog: res.data } : item
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
    if (!workDescription.trim()) {
      return alert('Please enter work description');
    }

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
  GET FEED'S OWN TIME (individual)
  ========================================
  */

  const getFeedTime = (worklog) => {
    let total = worklog.totalTime || 0;
    if (worklog.isRunning && worklog.startedAt) {
      total += Math.floor((Date.now() - new Date(worklog.startedAt)) / 1000);
    }
    return total;
  };

  /*
  ========================================
  OVERLAP DETECTION LOGIC
  ========================================
  */

  const getAllTimeIntervals = () => {
    const intervals = [];
    const now = Date.now();

    logs.forEach(item => {
      const worklog = item.worklog;
      
      if (worklog.timeBlocks && worklog.timeBlocks.length > 0) {
        worklog.timeBlocks.forEach(block => {
          if (block.startTime && block.endTime) {
            intervals.push({
              start: new Date(block.startTime).getTime(),
              end: new Date(block.endTime).getTime()
            });
          } else if (block.startTime && !block.endTime && !worklog.isRunning) {
            intervals.push({
              start: new Date(block.startTime).getTime(),
              end: now
            });
          }
        });
      }
      
      if (worklog.isRunning && worklog.startedAt) {
        intervals.push({
          start: new Date(worklog.startedAt).getTime(),
          end: now
        });
      }
    });

    return intervals;
  };

  const mergeIntervals = (intervals) => {
    if (intervals.length === 0) return [];
    
    intervals.sort((a, b) => a.start - b.start);
    
    const merged = [intervals[0]];
    
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const last = merged[merged.length - 1];
      
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  };

  const calculateActualWorkingTime = () => {
    const intervals = getAllTimeIntervals();
    
    if (intervals.length === 0) {
      return logs.reduce((total, item) => {
        return total + (item.worklog.totalTime || 0);
      }, 0);
    }
    
    const mergedIntervals = mergeIntervals(intervals);
    
    let totalMs = 0;
    mergedIntervals.forEach(interval => {
      totalMs += (interval.end - interval.start);
    });
    
    return Math.floor(totalMs / 1000);
  };

  /*
  ========================================
  FILTERING
  ========================================
  */

  const projects = useMemo(() => {
    const map = new Map();
    logs.forEach(item => {
      const project = item.feed?.projectId;
      if (project?._id) {
        map.set(project._id, project);
      }
    });
    return Array.from(map.values());
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const feed = item.feed;
      const worklog = item.worklog;

      const matchesProject = selectedProject === 'all' ? true : feed.projectId?._id === selectedProject;
      const matchesSearch = feed.name.toLowerCase().includes(searchTerm.toLowerCase());

      let currentStatus = 'stopped';
      if (worklog.isRunning) {
        currentStatus = 'running';
      } else if (worklog.totalTime > 0) {
        currentStatus = 'paused';
      }
      const matchesStatus = statusFilter === 'all' ? true : currentStatus === statusFilter;

      return matchesProject && matchesSearch && matchesStatus;
    });
  }, [logs, selectedProject, searchTerm, statusFilter]);

  /*
  ========================================
  CALCULATIONS
  ========================================
  */

  const totalIndividualTime = useMemo(() => {
    return filteredLogs.reduce((total, item) => {
      return total + getFeedTime(item.worklog);
    }, 0);
  }, [filteredLogs]);

  const actualWorkingTime = useMemo(() => {
    return calculateActualWorkingTime();
  }, [logs]);

  const overlapTime = useMemo(() => {
    return Math.max(0, totalIndividualTime - actualWorkingTime);
  }, [totalIndividualTime, actualWorkingTime]);

  const activeRunningCount = useMemo(() => {
    return filteredLogs.filter(item => item.worklog.isRunning).length;
  }, [filteredLogs]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'running':
        return { 
          bg: 'bg-emerald-50', 
          text: 'text-emerald-700', 
          border: 'border-emerald-200',
          icon: <Play size={10} className="text-emerald-600" />,
          label: 'Running' 
        };
      case 'paused':
        return { 
          bg: 'bg-amber-50', 
          text: 'text-amber-700', 
          border: 'border-amber-200',
          icon: <Pause size={10} className="text-amber-600" />,
          label: 'Paused' 
        };
      default:
        return { 
          bg: 'bg-slate-100', 
          text: 'text-slate-500', 
          border: 'border-slate-200',
          icon: <Square size={10} className="text-slate-500" />,
          label: 'Stopped' 
        };
    }
  };

  const handleManualRefresh = () => {
    checkSystemTimeMismatch();
    if (!timeMismatch.isMismatch) {
      fetchLogs();
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Worklog
        </h1>
      </div>

      {/* SYSTEM TIME MISMATCH WARNING */}
      {timeMismatch.isMismatch && (
        <div className="mb-6 p-6 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <Lock size={32} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black text-red-800 uppercase tracking-wider mb-2">
                Time Synchronization Required
              </h3>
              <p className="text-sm font-medium text-red-700">
                {timeMismatch.message}
              </p>
              <div className="mt-3 p-3 bg-white/50 rounded-lg inline-block">
                <div className="text-[11px] text-red-600 space-y-1">
                  <p>📍 Server Time (IST): <span className="font-mono font-bold">{timeMismatch.serverTime}</span></p>
                  <p>💻 Your System Time: <span className="font-mono font-bold">{timeMismatch.localTime}</span></p>
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

      {/* INFO NOTE */}
      {!timeMismatch.isMismatch && activeRunningCount > 1 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-[9px] font-black text-blue-700">
                Multiple timers running simultaneously
              </p>
              <p className="text-[8px] text-blue-600 mt-0.5">
                Time is counted only once in "Actual Time" (overlapping periods are merged)
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
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
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
                onClick={() => {
                  setSelectedProject('all');
                  setSearchTerm('');
                  setStatusFilter('all');
                  handleManualRefresh();
                }}
                className="h-10 rounded-lg border border-slate-200 px-4 font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <X size={12} />
                Reset Filters
              </button>
            </div>
          </div>

          {/* TABLE VIEW */}
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

                      return (
                        <tr key={feed._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all duration-200 group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                worklog.isRunning ? 'bg-emerald-100 animate-pulse' : 'bg-slate-100'
                              }`}>
                                <Hash size={12} className={worklog.isRunning ? 'text-emerald-600' : 'text-slate-400'} />
                              </div>
                              <span className="text-sm font-bold text-slate-800">{feed.name}</span>
                              {hasTodayLog && (
                                <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <CheckCircle size={8} />
                                  Logged
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Briefcase size={10} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-600">
                                {feed.projectId?.name || 'Unknown'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Clock3 size={12} className="text-blue-500" />
                              <span className="text-sm font-black text-blue-700 font-mono">
                                {formatTimeWithSeconds(feedTime)}
                              </span>
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
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  worklog.isRunning
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-md'
                                }`}
                                title="Start Timer"
                              >
                                <Play size={12} />
                              </button>

                              <button
                                onClick={() => pauseTimer(feed._id)}
                                disabled={!worklog.isRunning}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  !worklog.isRunning
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white hover:shadow-md'
                                }`}
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
                <p className="text-[9px] uppercase tracking-[0.35em] font-black text-blue-600 mb-1">
                  Daily Work Entry
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {isEditingLog ? "Edit Today's Work" : "Log Today's Work"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {selectedFeed?.name}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6">
              {isEditingLog && selectedFeed?.todayDescription?.description && (
                <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={12} className="text-amber-600" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">
                      Existing Log
                    </p>
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
                <button
                  onClick={closeModal}
                  className="px-5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveWorkDescription}
                  disabled={submittingLog}
                  className="px-5 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {submittingLog ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
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