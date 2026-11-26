// Search, filters and page number of the feeds tables (/pm/feeds and /teamlead/feeds).
// The filters are kept in the URL query string, so a refresh or a shared link keeps them.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const ALL = 'ALL';
export const UNASSIGNED = 'unassigned';
export const FEED_TYPES = ['Daily', 'Weekly', 'Monthly', 'Ad hoc', 'Once off'];
export const FEED_PLATFORMS = ['Web', 'App', 'Both'];

// The Feed model stores 'Add hoc' (typo): shown and filtered as 'Ad hoc'
export const feedTypeLabel = (type) => (type === 'Add hoc' ? 'Ad hoc' : type);

const devId = (d) => String(d?._id || d);
const assignedOf = (feed) => (feed.assignedDevelopers || []).filter(Boolean);

// { [developerId]: how many of these feeds are assigned to them }
export const countFeedsByDeveloper = (feeds) => {
  const counts = {};
  feeds.forEach((feed) => assignedOf(feed).forEach((d) => { counts[devId(d)] = (counts[devId(d)] || 0) + 1; }));
  return counts;
};

// Everyone assigned to these feeds, for the names of people who are no longer in the developer list
export const assignedPeople = (feeds) => {
  const people = new Map();
  feeds.forEach((feed) => assignedOf(feed).forEach((d) => { if (d.name) people.set(devId(d), d); }));
  return [...people.values()];
};

export const filterFeeds = (feeds, filters) => {
  const q = filters.q.trim().toLowerCase();
  return feeds.filter((feed) => {
    const assigned = assignedOf(feed);
    if (filters.project !== ALL && feed.projectId !== filters.project) return false;
    if (filters.type !== ALL && feedTypeLabel(feed.feedType) !== filters.type) return false;
    if (filters.status !== ALL && (feed.feedStatus || 'New') !== filters.status) return false;
    if (filters.platform !== ALL && feed.feedPlatform !== filters.platform) return false;
    // any of the picked developers (or "Unassigned feeds")
    if (filters.devs.length > 0 && !filters.devs.some((id) =>
      (id === UNASSIGNED ? assigned.length === 0 : assigned.some((d) => devId(d) === id)))) return false;
    if (!q) return true;
    return [feed.name, feed.projectName, feed.projectCustomId, feed.webDomain, ...assigned.map((d) => d.name)]
      .some((text) => text?.toLowerCase().includes(q));
  });
};

// Query string <-> filters
const SELECTS = ['project', 'type', 'status', 'platform'];

const readUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const filters = { q: params.get('q') || '', devs: (params.get('dev') || '').split(',').filter(Boolean) };
  SELECTS.forEach((key) => { filters[key] = params.get(key) || ALL; });
  return filters;
};

const toUrl = (filters) => {
  const params = new URLSearchParams(window.location.search);
  const set = (key, value) => (value ? params.set(key, value) : params.delete(key));
  set('q', filters.q.trim());
  SELECTS.forEach((key) => set(key, filters[key] === ALL ? '' : filters[key]));
  set('dev', filters.devs.join(','));
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
};

const initialFilters = (stateProject) => {
  const filters = readUrl();
  return stateProject ? { ...filters, project: stateProject } : filters;
};

// stateProject: project id passed by another page with navigate(path, { state })
const useFeedFilters = (feeds, projects, stateProject) => {
  const location = useLocation();
  const [filters, setFilters] = useState(() => initialFilters(stateProject));
  const [page, setPage] = useState(1);

  // Navigated to this page again (e.g. its sidebar link): start from the new address
  const [seenKey, setSeenKey] = useState(location.key);
  if (seenKey !== location.key) {
    setSeenKey(location.key);
    setFilters(initialFilters(stateProject));
    setPage(1);
  }

  // Keep the address in step. replaceState instead of the router, so typing in the search box does
  // not re-render the app or add history entries. usr (the navigate() state) is cleared: its project
  // is in the address now, and would otherwise come back on refresh after clearing the filters.
  useEffect(() => {
    const path = location.pathname;
    const timer = setTimeout(() => {
      if (window.location.pathname !== path) return; // already leaving this page
      window.history.replaceState({ ...window.history.state, usr: null }, '', toUrl(filters));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, location.pathname, location.key]);

  // A project from a link that this user cannot see counts as "All projects"
  const active = useMemo(() => (
    filters.project !== ALL && projects.length > 0 && !projects.some((p) => p._id === filters.project)
      ? { ...filters, project: ALL }
      : filters
  ), [filters, projects]);

  const filteredFeeds = useMemo(() => filterFeeds(feeds, active), [feeds, active]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ q: '', project: ALL, type: ALL, status: ALL, platform: ALL, devs: [] });
    setPage(1);
  };
  const isFiltered = active.q.trim() !== '' || active.devs.length > 0 || SELECTS.some((key) => active[key] !== ALL);

  return { filters: active, setFilter, clearFilters, isFiltered, filteredFeeds, page, setPage };
};

export default useFeedFilters;
