// "Show previous run" button for one feed: loads the run before the one on screen, only when clicked.
// "Show earlier run" goes one run further back each time.
// Give it a key that contains `before`, so it starts over when a newer run is shown.
import { useState } from 'react';
import axios from 'axios';
import { History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';

const STATUS_BADGE = {
  Completed: 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Stalled: 'bg-amber-100 text-amber-800',
  Failed: 'bg-red-100 text-red-700',
  Pending: 'bg-gray-100 text-gray-700',
};

// 'YYYY-MM-DD' -> '24 Nov 2026' (plain text, no date conversion)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatRunDate = (date) => {
  const [y, m, d] = String(date || '').split('-');
  return MONTHS[m - 1] ? `${d} ${MONTHS[m - 1]} ${y}` : date;
};

// same display timezone as the Feed Status page
const formatRunTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const PreviousRuns = ({ projectId, feedName, before }) => {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [error, setError] = useState('');

  const loadNext = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/client/projects/${projectId}/feeds/previous-run`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { feed: feedName, before: runs.length ? runs[runs.length - 1].runDate : before },
      });
      if (res.data.run) setRuns((prev) => [...prev, res.data.run]);
      else setNoMore(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the previous run');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open && runs.length === 0 && !noMore) loadNext();
    setOpen((v) => !v);
  };

  return (
    // clicks stay here: the rows around it open and close on click
    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
      >
        <History size={12} /> {open ? 'Hide previous runs' : 'Show previous run'}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-1 space-y-1.5">
          {runs.map((run) => (
            <div key={run.runDate} className="p-2 rounded-lg border border-violet-100 bg-violet-50/60 text-xs text-slate-600 break-words">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-800">{formatRunDate(run.runDate)}</span>
                <span className={`badge ${STATUS_BADGE[run.displayStatus] || STATUS_BADGE.Pending}`}>{run.displayStatus}</span>
                <span>{run.progress}% · {run.stagesDone}/{run.stagesTotal} stages</span>
              </div>
              <div className="flex flex-wrap gap-x-3 mt-0.5">
                {run.deliveredAt && <span>Delivered {formatRunTime(run.deliveredAt)}</span>}
                {!run.deliveredAt && run.lastUpdatedAt && <span>Last update {formatRunTime(run.lastUpdatedAt)}</span>}
                {run.currentStageLabel && <span>Stopped at: {run.currentStageLabel}</span>}
                {run.record_count !== null && <span>{Number(run.record_count).toLocaleString('en-IN')} records</span>}
              </div>
              {run.displayStatus === 'Failed' && (
                <p className="mt-0.5 text-red-700">{run.error_message || 'No error message was sent'}</p>
              )}
            </div>
          ))}
          {error && <p className="text-xs text-red-700">{error}</p>}
          {loading && <Loader2 size={14} className="animate-spin text-violet-700" />}
          {!loading && noMore && (
            <p className="text-xs text-slate-500">{runs.length ? 'No earlier runs' : 'No previous run for this feed'}</p>
          )}
          {!loading && !noMore && (runs.length > 0 || error) && (
            <button type="button" onClick={loadNext} className="text-xs font-semibold text-violet-700 hover:text-violet-900">
              {error ? 'Try again' : 'Show earlier run'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PreviousRuns;
