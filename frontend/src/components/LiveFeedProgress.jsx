// "Today's Progress" for the PM and Developer dashboards, live from the Feed Status data.
// `live` is the result of useLiveFeedProgress(); `linkBase` is the Feed Status page prefix
// (/pm/projects or /developer/projects).
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, RefreshCw, User, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import PreviousRuns from './PreviousRuns';
import { NO_RUN, runStatus, countedStatus, countRuns, dueTodayFeeds } from '../utils/useLiveFeedProgress';

const STATUS_STYLE = {
  Completed: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', card: 'bg-emerald-50 text-emerald-700 hover:border-emerald-300' },
  'In Progress': { badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', card: 'bg-blue-50 text-blue-700 hover:border-blue-300' },
  Pending: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', card: 'bg-amber-50 text-amber-700 hover:border-amber-300' },
  Stalled: { badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  Failed: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', card: 'bg-red-50 text-red-700 hover:border-red-300' },
  [NO_RUN]: { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300' },
};
const STATUS_ORDER = ['Failed', 'Stalled', 'In Progress', 'Pending', NO_RUN, 'Completed'];
const COUNTED = ['Completed', 'In Progress', 'Pending', 'Failed'];

const GROUPS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly', periodLabel: 'This week' },
  { key: 'monthly', label: 'Monthly', periodLabel: 'This month' },
  { key: 'adhoc', label: 'Ad hoc' },
];

// 'YYYY-MM-DD' shown as that same day, whatever the browser's timezone
const formatDay = (date, options = { day: '2-digit', month: 'short' }) =>
  new Date(date).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });

const formatTime = (value) =>
  new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const typeLabel = (feed) => {
  if (feed.group === 'weekly' && feed.weekDay) return `Weekly (${feed.weekDay})`;
  if (feed.group === 'monthly' && feed.monthDay) {
    return `Monthly (Day ${feed.monthDay}${feed.dueDay !== feed.monthDay ? `, due ${feed.dueDay} this month` : ''})`;
  }
  return feed.feedType;
};

const byStatus = (a, b) =>
  STATUS_ORDER.indexOf(runStatus(a.run)) - STATUS_ORDER.indexOf(runStatus(b.run)) || a.feed.name.localeCompare(b.feed.name);

const FeedRow = ({ feed, run, linkBase, showRunDate }) => {
  const [showError, setShowError] = useState(false);
  const status = runStatus(run);
  const style = STATUS_STYLE[status];
  const progress = Math.min(100, Math.max(0, run?.progress || 0));
  const error = status === 'Failed' ? run.error_message || 'No error message was sent' : '';

  return (
    <li className="p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`${linkBase}/${feed.project._id}/feeds`}
            title="Open the Feed Status page"
            className="text-sm font-semibold text-slate-800 hover:text-blue-600 break-words inline-flex items-center"
          >
            {feed.name}
          </Link>
          <p className="text-xs text-slate-500 break-words">{feed.project.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="badge bg-slate-100 text-slate-600">{typeLabel(feed)}</span>
            {/^on hold/i.test(feed.feedStatus || '') && <span className="badge bg-orange-100 text-orange-700">{feed.feedStatus}</span>}
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 min-w-0">
              <User size={12} className="shrink-0" />
              {feed.developers.length ? feed.developers.map((d) => d.name).join(', ') : 'No developer assigned'}
            </span>
          </div>
        </div>

        <div className="w-full lg:w-64 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`badge ${style.badge}`} title={error || undefined}>{status}</span>
            <span className="text-xs font-semibold text-slate-600">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
            {run?.isPreviousRun && !showRunDate && (
              <span className="badge bg-violet-100 text-violet-700">Previous run · {formatDay(run.date)}</span>
            )}
            {run && showRunDate && <span>Run: {formatDay(run.date)}</span>}
            {run?.isPreviousRun && run.deliveredAt
              ? <span>Last delivered {formatTime(run.deliveredAt)}</span>
              : run?.updated_at && <span>Updated {formatTime(run.updated_at)}</span>}
            {run && run.record_count !== null && <span>{Number(run.record_count).toLocaleString()} records</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowError((v) => !v)}
            aria-expanded={showError}
            title={error}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
          >
            <AlertCircle size={12} /> {showError ? 'Hide error' : 'Show error'}
            {showError ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showError && (
            <p className="mt-1 p-2 rounded-lg bg-red-50 text-xs text-red-700 whitespace-pre-wrap break-words">{error}</p>
          )}
        </div>
      )}

      {run && <PreviousRuns key={run.date} projectId={feed.project._id} feedName={feed.name} before={run.date} />}
    </li>
  );
};

const FeedList = ({ items, linkBase, showRunDate, emptyText }) => (
  items.length === 0
    ? <p className="p-4 text-sm text-slate-500 text-center bg-slate-50 rounded-lg border border-slate-100">{emptyText}</p>
    : (
      <ul className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
        {[...items].sort(byStatus).map(({ feed, run }) => (
          <FeedRow key={feed._id} feed={feed} run={run} linkBase={linkBase} showRunDate={showRunDate} />
        ))}
      </ul>
    )
);

const LiveFeedProgress = ({ live, linkBase, title = "Today's Progress" }) => {
  const { data, refreshing, error, updatedAt, refresh } = live;
  const [group, setGroup] = useState('daily');
  const [periodView, setPeriodView] = useState({ weekly: false, monthly: false });
  const [expanded, setExpanded] = useState(null); // summary card: 'Total' or a status

  // feed.latest is today's run, or the previous one when there is none today
  const due = dueTodayFeeds(data).map((feed) => ({ feed, run: feed.latest }));
  const previousRuns = due.filter((i) => i.run?.isPreviousRun).length;
  const totals = countRuns(due.map((i) => i.run));
  const percentage = totals.total ? Math.round((totals.Completed / totals.total) * 100) : 0;

  const itemsOf = (key) => {
    const feeds = (data?.feeds || []).filter((f) => f.group === key);
    if (key === 'adhoc' || periodView[key]) return feeds.map((feed) => ({ feed, run: feed.period }));
    return feeds.filter((f) => f.dueToday).map((feed) => ({ feed, run: feed.latest }));
  };

  const inCard = (card) => (card === 'Total' ? due : due.filter(({ run }) => countedStatus(runStatus(run)) === card));

  const active = GROUPS.find((g) => g.key === group);
  const activeItems = itemsOf(group);
  const isPeriod = !!periodView[group];
  const emptyText = group === 'adhoc'
    ? 'No ad hoc feed has a run today'
    : isPeriod
      ? `No ${active.label.toLowerCase()} feeds`
      : `No ${active.label.toLowerCase()} feeds are due today`;

  return (
    <section className="card mb-4 sm:mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="section-title">{title}</h3>
            {data && (
              <p className="text-xs text-slate-500">
                {data.dayName}, {formatDay(data.date, { day: '2-digit', month: 'short', year: 'numeric' })} (server date)
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-GB')}` : 'Loading...'}
          </span>
          <button type="button" onClick={refresh} disabled={refreshing} className="btn btn-sm btn-secondary">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 p-2 rounded-lg bg-red-50 text-xs text-red-700">
          {error}{data ? '. Showing the last data received.' : ''}
        </p>
      )}

      {data && (
        <>
          {/* Completion rate of the feeds due today */}
          <div className="mb-4">
            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>
                Completion rate (due today)
                {previousRuns > 0 && <span className="font-normal"> · counts {previousRuns} previous run{previousRuns > 1 ? 's' : ''}</span>}
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
            </div>
          </div>

          {/* Summary cards: click for the matching feeds */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {['Total', ...COUNTED].map((card) => {
              const count = card === 'Total' ? totals.total : totals[card];
              const colors = card === 'Total' ? 'bg-purple-50 text-purple-700 hover:border-purple-300' : STATUS_STYLE[card].card;
              return (
                <button
                  key={card}
                  type="button"
                  disabled={count === 0}
                  aria-expanded={expanded === card}
                  onClick={() => setExpanded(expanded === card ? null : card)}
                  className={`rounded-lg p-3 text-center border-2 transition-colors ${
                    count === 0 ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-default' : `${colors} ${expanded === card ? 'border-current' : 'border-transparent'}`
                  }`}
                >
                  <span className="block text-xs font-semibold uppercase">{card === 'Total' ? 'Today' : card}</span>
                  <span className="block text-lg font-bold">{count}</span>
                </button>
              );
            })}
          </div>

          {expanded && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-slate-600">
                  {expanded === 'Total' ? 'All feeds due today' : `${expanded} today`} ({inCard(expanded).length})
                </p>
                <button type="button" onClick={() => setExpanded(null)} aria-label="Close" className="btn-icon text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <FeedList items={inCard(expanded)} linkBase={linkBase} emptyText="No feeds here any more" />
            </div>
          )}

          {/* Groups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-3" role="tablist">
            {GROUPS.map((g) => {
              const counts = countRuns(itemsOf(g.key).map((i) => i.run));
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={group === g.key}
                  onClick={() => setGroup(g.key)}
                  className={`text-left rounded-lg border p-2.5 transition-colors ${
                    group === g.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800">
                    {g.label} ({counts.total}){periodView[g.key] ? <span className="text-xs font-medium text-slate-500"> {g.periodLabel.toLowerCase()}</span> : null}
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span className="text-emerald-700">Completed {counts.Completed}</span>
                    <span className="text-blue-700">In Progress {counts['In Progress']}</span>
                    <span className="text-amber-700">Pending {counts.Pending}</span>
                    <span className="text-red-700">Failed {counts.Failed}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {active.periodLabel && (
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden mb-3">
              {[[false, 'Due today'], [true, active.periodLabel]].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={isPeriod === value}
                  onClick={() => setPeriodView((v) => ({ ...v, [group]: value }))}
                  className={`px-3 h-9 text-xs font-semibold ${isPeriod === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <FeedList items={activeItems} linkBase={linkBase} showRunDate={isPeriod || group === 'adhoc'} emptyText={emptyText} />
        </>
      )}
    </section>
  );
};

export default LiveFeedProgress;
