// Live feed progress (GET /api/feeds/live-progress), refreshed every 60 s while the tab is visible.
// Only this call is polled, never the rest of the dashboard.
import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import usePolling from './usePolling';

const REFRESH_MS = 60000;

export default function useLiveFeedProgress(scope) {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const latest = useRef(0); // ignore an older response that arrives late

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/feeds/live-progress`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { scope },
      });
      if (request !== latest.current) return;
      setData(res.data);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      if (request !== latest.current) return;
      console.error('Live feed progress error:', err);
      setError(err.response?.data?.error || 'Could not refresh feed progress');
    } finally {
      if (request === latest.current) setRefreshing(false);
    }
  }, [scope]);

  usePolling(refresh, REFRESH_MS);

  return { data, refreshing, error, updatedAt, refresh };
}

export const NO_RUN = 'No run yet';
export const runStatus = (run) => run?.status || NO_RUN;

// Feeds with no run yet are still to be done, so they count as Pending; a stalled run is still open,
// so it counts as In Progress
export const countedStatus = (status) =>
  status === NO_RUN ? 'Pending' : status === 'Stalled' ? 'In Progress' : status;

export function countRuns(runs) {
  const counts = { total: runs.length, Completed: 0, 'In Progress': 0, Pending: 0, Failed: 0 };
  runs.forEach((run) => {
    counts[countedStatus(runStatus(run))] += 1;
  });
  return counts;
}

// Scheduled feeds due today (ad hoc feeds have no schedule, so they are not part of it)
export const dueTodayFeeds = (data) => (data?.feeds || []).filter((f) => f.dueToday);
