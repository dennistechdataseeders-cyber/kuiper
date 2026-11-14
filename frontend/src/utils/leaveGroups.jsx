// frontend/src/utils/leaveGroups.jsx
//
// A one-shot leave request is stored as several pieces (e.g. 1 day paid +
// ½ paid + ½ unpaid) that share a requestGroupId. These helpers show such a
// request as ONE row to HR and approve / reject all its pieces together.
import React from 'react';

const isGroupId = (id) => typeof id === 'string' && id.startsWith('group:');

export function groupLeaves(list = []) {
  const out = [];
  const groups = new Map();
  list.forEach((l) => {
    if (!l.requestGroupId) { out.push(l); return; }
    let g = groups.get(l.requestGroupId);
    if (!g) {
      g = { ...l, _id: `group:${l.requestGroupId}`, isGroup: true, groupId: l.requestGroupId, pieces: [] };
      groups.set(l.requestGroupId, g);
      out.push(g);
    }
    g.pieces.push(l);
  });

  groups.forEach((g) => {
    g.pieces.sort((a, b) => new Date(a.startDate) - new Date(b.startDate) || String(a.halfDayType).localeCompare(String(b.halfDayType)));
    const s = g.groupSummary || {};
    const paid = s.paidDays ?? 0;
    const unpaid = s.unpaidDays ?? 0;
    const statuses = [...new Set(g.pieces.map((p) => p.status))];
    g.status = statuses.length === 1 ? statuses[0] : statuses.includes('pending') ? 'pending' : 'approved';
    g.startDate = s.fromDate || g.pieces[0].startDate;
    g.endDate = s.toDate || g.pieces[g.pieces.length - 1].endDate;
    g.totalDays = s.totalDays ?? g.pieces.reduce((t, p) => t + (p.isHalfDay ? 0.5 : 1), 0);
    g.leaveType = paid && unpaid ? `Paid ${paid} + Unpaid ${unpaid}` : paid ? 'Paid Leave' : 'Unpaid Leave';
    g.isHalfDay = false;
    g.halfDayType = null;
  });
  return out;
}

// PATCH url for approve / reject — whole request for groups, single leave otherwise
export const leaveActionUrl = (apiBase, id, action) =>
  isGroupId(id)
    ? `${apiBase}/api/leave-bucket/group/${id.slice(6)}/${action}`
    : `${apiBase}/api/leave-bucket/${id}/${action}`;

// days for a row (groups already know their total; weekends/holidays excluded)
export const leaveDays = (leave) => {
  if (leave.totalDays != null) return leave.totalDays;
  if (leave.isHalfDay) return 0.5;
  if (!leave.startDate || !leave.endDate) return 0;
  return Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) + 1;
};

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// day-by-day breakdown chips (only for grouped requests)
export function LeaveBreakdown({ leave, className = '' }) {
  if (!leave?.isGroup) return null;
  return (
    <div className={className}>
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Breakdown ({leave.totalDays} day{leave.totalDays === 1 ? '' : 's'})</p>
      <div className="flex flex-wrap gap-1.5">
        {leave.pieces.map((p) => (
          <span
            key={p._id}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              p.leaveType === 'Paid Leave' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
            }`}
          >
            {fmt(p.startDate)}
            {!p.isHalfDay && new Date(p.endDate).getTime() !== new Date(p.startDate).getTime() ? ` – ${fmt(p.endDate)}` : ''}
            {p.isHalfDay ? (p.halfDayType === 'first' ? ' · ½ (1st half)' : ' · ½ (2nd half)') : ''}
            {' · '}{p.leaveType === 'Paid Leave' ? 'Paid' : 'Unpaid'}
          </span>
        ))}
      </div>
    </div>
  );
}
