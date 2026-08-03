// frontend/src/components/SyncStatus.jsx
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../config';

const SyncStatus = () => {
  const [lastSync, setLastSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/hr/biometric/sync-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLastSync(res.data.lastSync);
      setStatus(res.data.status);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const getStatusColor = () => {
    switch(status) {
      case 'syncing': return 'text-amber-500';
      case 'success': return 'text-emerald-500';
      case 'error': return 'text-red-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) return <RefreshCw size={14} className="animate-spin" />;
    if (status === 'success') return <Wifi size={14} className="text-emerald-500" />;
    return <WifiOff size={14} className="text-slate-400" />;
  };

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      {getStatusIcon()}
      <span className={getStatusColor()}>
        {status === 'syncing' ? 'Syncing...' : 
         status === 'success' ? 'Synced' : 
         status === 'error' ? 'Sync failed' : 'Waiting'}
      </span>
      {lastSync && (
        <span className="text-[8px] text-slate-400">
          {new Date(lastSync).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default SyncStatus;