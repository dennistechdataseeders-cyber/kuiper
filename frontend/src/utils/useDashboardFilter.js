// frontend/src/utils/useDashboardFilter.js
//
// Reads the filter that the Sales Command dashboard puts in the URL when a KPI card is clicked, e.g.
//   /sales/activities/tasks?rep=<repId>&repName=Sales_1&focus=overdue&team=1
//
//   rep      – a sales person's user _id (omitted = whole team)
//   repName  – only used to label the banner
//   focus    – open | overdue | won | converted | today   (meaning depends on the page)
//   team     – "1" → managers load the whole team's activities instead of just their own
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const idOf = (x) => String(x?._id || x || '');
export const ownerOf = (a) => a?.assignedTo || a?.createdBy;

export default function useDashboardFilter() {
  const [params, setParams] = useSearchParams();
  const rep = params.get('rep') || '';
  const repName = params.get('repName') || '';
  const focus = params.get('focus') || '';
  const team = params.get('team') === '1';

  return useMemo(
    () => ({
      rep,
      repName,
      focus,
      team,
      active: Boolean(rep || focus),
      clear: () => setParams({}, { replace: true }),
    }),
    [rep, repName, focus, team, setParams]
  );
}

// ---- helpers shared by the Meetings / Calls pages ----
export const isTodayLocal = (d) => {
  if (!d) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const t = new Date(d);
  return t >= start && t < end;
};

// Same rules as the dashboard counters: owner = assignedTo || createdBy, "today" ignores cancelled items.
export const filterActivities = (items, dash) =>
  items.filter((a) => {
    if (dash.rep && idOf(ownerOf(a)) !== dash.rep) return false;
    if (dash.focus === 'today' && (a.status === 'Cancelled' || !isTodayLocal(a.scheduledAt))) return false;
    return true;
  });