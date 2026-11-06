// frontend/src/components/dashboard/dashboardUtils.js
// Shared helpers + the analytics engine behind the editable Sales dashboard.
import { useCallback, useState } from 'react';

// ============================================
// constants
// ============================================
export const PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#14b8a6',
  '#f59e0b', '#f97316', '#ec4899', '#22c55e', '#64748b',
];

export const MODULE_LIST = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Meetings', 'Calls'];

export const MODULE_ROUTE = {
  Leads: '/sales/leads',
  Contacts: '/sales/contacts',
  Accounts: '/sales/accounts',
  Deals: '/sales/deals',
  Tasks: '/sales/activities/tasks',
  Meetings: '/sales/activities/meetings',
  Calls: '/sales/activities/calls',
};

// ============================================
// date + number helpers
// ============================================
const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a Date / ISO string. Date-only strings are used as-is (no timezone shift).
export const dayKey = (v) => {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthKey = (v) => dayKey(v).slice(0, 7);
export const yearKey = (v) => dayKey(v).slice(0, 4);

const asDate = (v) => {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
};

export const fmtAmount = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const fmtNumber = (n) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fmtDate = (d) =>
  d ? asDate(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

// ============================================
// PERIOD FILTER (one instance per widget)
// ============================================
export const usePeriod = (defaultMode = 'month') => {
  const [mode, setMode] = useState(defaultMode); // 'day' | 'month' | 'year' | 'all'
  const [day, setDay] = useState(dayKey(new Date()));
  const [month, setMonth] = useState(monthKey(new Date()));
  const [year, setYear] = useState(yearKey(new Date()));

  const contains = useCallback(
    (date) => {
      if (mode === 'all') return true;
      const k = dayKey(date);
      if (!k) return false;
      if (mode === 'day') return k === day;
      if (mode === 'month') return k.slice(0, 7) === month;
      return k.slice(0, 4) === year;
    },
    [mode, day, month, year]
  );

  // true when the selected period contains today (so overdue items can be surfaced)
  const includesToday = useCallback(() => {
    const t = dayKey(new Date());
    if (mode === 'day') return day === t;
    if (mode === 'month') return month === t.slice(0, 7);
    if (mode === 'year') return year === t.slice(0, 4);
    return false;
  }, [mode, day, month, year]);

  const shift = (dir) => {
    if (mode === 'day') {
      const d = new Date(`${day}T00:00:00`);
      d.setDate(d.getDate() + dir);
      setDay(dayKey(d));
    } else if (mode === 'month') {
      const [y, m] = month.split('-').map(Number);
      setMonth(monthKey(new Date(y, m - 1 + dir, 1)));
    } else if (mode === 'year') {
      setYear(String(Number(year) + dir));
    }
  };

  const reset = () => {
    const now = new Date();
    setDay(dayKey(now));
    setMonth(monthKey(now));
    setYear(yearKey(now));
  };

  const label =
    mode === 'day'
      ? new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
      : mode === 'month' ? fmtMonth(month)
      : mode === 'year' ? year
      : 'All time';

  const nowK = dayKey(new Date());
  const phrase =
    mode === 'day' ? (day === nowK ? 'Today' : `on ${fmtDate(day)}`)
    : mode === 'month' ? (month === nowK.slice(0, 7) ? 'This Month' : `in ${fmtMonth(month)}`)
    : mode === 'year' ? (year === nowK.slice(0, 4) ? 'This Year' : `in ${year}`)
    : '(All Time)';

  return { mode, setMode, day, setDay, month, setMonth, year, setYear, shift, reset, contains, includesToday, label, phrase };
};

export const ALL_PERIOD = { mode: 'all', contains: () => true };

// ============================================
// FIELD CATALOG  (built-in fields + fields from Customize Modules)
//   kind: 'cat' (group / filter by) | 'checkbox' (Yes/No) | 'num' (sum / average) | 'date'
// ============================================
const B = (key, label, kind, extra = {}) => ({ key, label, kind, ...extra });

export const BUILTIN_FIELDS = {
  Leads: [
    B('status', 'Lead Status', 'cat'), B('source', 'Lead Source', 'cat'), B('industry', 'Industry', 'cat'),
    B('owner', 'Lead Owner', 'cat'), B('converted', 'Converted', 'cat'),
    B('employees', 'No. of Employees', 'num'),
    B('createdAt', 'Created Date', 'date'), B('convertedAt', 'Converted Date', 'date'),
  ],
  Contacts: [
    B('department', 'Department', 'cat'), B('account', 'Account', 'cat'), B('primary', 'Primary Contact', 'cat'),
    B('title', 'Job Title', 'cat'), B('hasLinkedin', 'Has LinkedIn Profile', 'cat'),
    B('addedAt', 'Added Date', 'date'),
  ],
  Accounts: [
    B('status', 'Status', 'cat'), B('industry', 'Industry', 'cat'), B('rep', 'Sales Rep', 'cat'),
    B('employees', 'No. of Employees', 'num'),
    B('createdAt', 'Created Date', 'date'),
  ],
  Deals: [
    B('stage', 'Stage', 'cat'), B('contactRole', 'Contact Role', 'cat'), B('account', 'Account', 'cat'),
    B('owner', 'Deal Owner', 'cat'), B('amount', 'Amount', 'num', { money: true }),
    B('createdAt', 'Created Date', 'date'), B('closingDate', 'Closing Date', 'date'),
  ],
  Tasks: [
    B('status', 'Status', 'cat'), B('priority', 'Priority', 'cat'), B('lead', 'Lead / Company', 'cat'),
    B('createdAt', 'Created Date', 'date'), B('dueAt', 'Due Date', 'date'),
  ],
  Meetings: [
    B('status', 'Status', 'cat'), B('lead', 'Lead / Company', 'cat'), B('duration', 'Duration (min)', 'num'),
    B('createdAt', 'Created Date', 'date'), B('scheduledAt', 'Meeting Date', 'date'),
  ],
  Calls: [
    B('status', 'Status', 'cat'), B('outcome', 'Call Outcome', 'cat'), B('direction', 'Direction', 'cat'),
    B('lead', 'Lead / Company', 'cat'), B('duration', 'Duration (min)', 'num'),
    B('createdAt', 'Created Date', 'date'), B('scheduledAt', 'Call Date', 'date'),
  ],
};

const CUSTOM_CAT_TYPES = ['Pick List', 'Multi-Select', 'Single Line'];
const CUSTOM_NUM_TYPES = ['Number', 'Decimal', 'Currency', 'Percent', 'Long Integer'];
const CUSTOM_DATE_TYPES = ['Date', 'Date/Time'];

// defs = rows from GET /api/module-fields/:module
export const buildCatalog = (moduleName, defs = []) => {
  const cats = [];
  const nums = [];
  const dates = [];
  (BUILTIN_FIELDS[moduleName] || []).forEach((f) => {
    (f.kind === 'cat' ? cats : f.kind === 'num' ? nums : dates).push(f);
  });
  defs.forEach((d) => {
    const key = `cf:${d.fieldKey}`;
    const base = { key, label: d.label, custom: true };
    if (d.type === 'Checkbox') cats.push({ ...base, kind: 'checkbox' });
    else if (CUSTOM_CAT_TYPES.includes(d.type)) {
      cats.push({ ...base, kind: 'cat', options: (d.options || []).map((o) => o.label).filter(Boolean) });
    } else if (CUSTOM_NUM_TYPES.includes(d.type)) nums.push({ ...base, kind: 'num', money: d.type === 'Currency' });
    else if (CUSTOM_DATE_TYPES.includes(d.type)) dates.push({ ...base, kind: 'date' });
  });
  return { cats, nums, dates };
};

// ============================================
// RECORD NORMALISERS  → { id, ownerId, v: { fieldKey: value } }
// Custom-field values are stored under  v['cf:<fieldKey>']
// ============================================
const idOf = (x) => String(x?._id || x || '');
const cfValues = (arr) =>
  Object.fromEntries((arr || []).filter((x) => x && x.fieldKey).map((x) => [`cf:${x.fieldKey}`, x.value]));
const yesNo = (b) => (b ? 'Yes' : 'No');

const realOrgs = (orgs) => orgs.filter((o) => (o.companyName || '').toLowerCase() !== 'feasibility');

export const buildAllRecords = ({ leads = [], orgs = [], deals = [], activities = [] }) => {
  const act = (type, map) =>
    activities.filter((a) => a.type === type).map((a) => ({
      id: a._id,
      ownerId: idOf(a.createdBy),
      v: {
        status: a.status,
        lead: a.leadId?.companyName,
        createdAt: a.createdAt,
        ...map(a),
        ...cfValues(a.customFields),
      },
    }));

  return {
    Leads: leads.map((l) => ({
      id: l._id,
      ownerId: idOf(l.leadOwner) || idOf(l.createdBy),
      v: {
        status: l.leadStatus, source: l.leadSource, industry: l.industry,
        owner: l.leadOwner?.name, converted: yesNo(l.isConverted), employees: l.noOfEmployees,
        createdAt: l.createdAt, convertedAt: l.convertedAt,
        ...cfValues(l.dynamicFields),
      },
    })),

    Contacts: realOrgs(orgs).flatMap((o) =>
      (o.pointsOfContact || []).map((c, i) => ({
        id: `${o._id}-${c._id || i}`,
        ownerId: idOf(o.salesRepId),
        v: {
          department: c.department, account: o.companyName, primary: yesNo(c.isPrimary), title: c.title,
          hasLinkedin: yesNo(!!c.linkedin), addedAt: c.addedAt || o.createdAt,
          ...cfValues(c.customFields),
        },
      }))
    ),

    Accounts: realOrgs(orgs).map((o) => ({
      id: o._id,
      ownerId: idOf(o.salesRepId),
      v: {
        status: o.status, industry: o.industry, rep: o.salesRepId?.name, employees: o.noOfEmployees,
        createdAt: o.createdAt,
        ...cfValues(o.customFields),
      },
    })),

    Deals: deals.map((d) => ({
      id: d._id,
      ownerId: idOf(d.owner),
      v: {
        stage: d.stage, contactRole: d.contactRole,
        account: d.organizationId?.companyName || d.leadId?.companyName,
        owner: d.owner?.name, amount: d.amount, createdAt: d.createdAt, closingDate: d.closingDate,
        ...cfValues(d.customFields),
      },
    })),

    Tasks: act('task', (a) => ({ priority: a.priority, dueAt: a.dueAt })),
    Meetings: act('meeting', (a) => ({ duration: a.durationMinutes, scheduledAt: a.scheduledAt })),
    Calls: act('call', (a) => ({
      outcome: a.callOutcome, direction: a.callDirection, duration: a.durationMinutes, scheduledAt: a.scheduledAt,
    })),
  };
};

// ============================================
// ANALYTICS ENGINE
//
// widget config:
//   { module, measure:{ type:'count'|'sum'|'avg', field? }, where:{ field, value }|null,
//     groupBy: null | { type:'field', field } | { type:'date', unit:'day'|'month'|'year' },
//     dateField:{ key, label }, mineOnly }
// ============================================
const BLANK = '(blank)';

// values of a record for a category field (Multi-Select fans out into several values)
export const catValues = (rec, field) => {
  const raw = rec.v[field.key];
  if (field.kind === 'checkbox') {
    return [raw === true || raw === 'true' || raw === 'Yes' ? 'Yes' : 'No'];
  }
  if (Array.isArray(raw)) return raw.length ? raw.map(String) : [BLANK];
  if (raw === undefined || raw === null || raw === '') return [BLANK];
  return [String(raw)];
};

export const distinctValues = (records, field, limit = 30) => {
  const set = new Set();
  records.forEach((r) => catValues(r, field).forEach((v) => v !== BLANK && set.add(v)));
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, limit);
};

const matchWhere = (rec, where) =>
  catValues(rec, where.field).some((v) => v.toLowerCase() === String(where.value).toLowerCase());

export const runAnalytics = (cfg, records, period, userId) => {
  let list = records;
  if (cfg.mineOnly) list = list.filter((r) => r.ownerId && r.ownerId === String(userId));
  if (cfg.where?.field && cfg.where.value !== '' && cfg.where.value !== undefined) {
    list = list.filter((r) => matchWhere(r, cfg.where));
  }
  if (cfg.dateField && period.mode !== 'all') {
    list = list.filter((r) => period.contains(r.v[cfg.dateField.key]));
  }

  const m = cfg.measure || { type: 'count' };
  const key = m.field?.key;
  const type = key ? m.type : 'count';
  const num = (r) => Number(r.v[key]) || 0;
  const present = (r) => r.v[key] !== undefined && r.v[key] !== null && r.v[key] !== '';
  const agg = (l) => {
    if (type === 'sum') return l.reduce((s, r) => s + num(r), 0);
    if (type === 'avg') {
      const w = l.filter(present);
      return w.length ? w.reduce((s, r) => s + num(r), 0) / w.length : 0;
    }
    return l.length;
  };

  let rows = [];
  const g = cfg.groupBy;
  if (g?.type === 'field') {
    const map = new Map();
    list.forEach((r) =>
      catValues(r, g.field).forEach((v) => {
        if (!map.has(v)) map.set(v, []);
        map.get(v).push(r);
      })
    );
    rows = [...map].map(([label, l]) => ({ label, value: agg(l), count: l.length, _l: l }))
      .sort((a, b) => b.value - a.value);
    if (rows.length > 10) {
      const rest = rows.slice(9);
      const other = rest.flatMap((x) => x._l);
      rows = [...rows.slice(0, 9), { label: 'Other', value: agg(other), count: other.length, _l: other }];
    }
  } else if (g?.type === 'date' && cfg.dateField) {
    const len = g.unit === 'day' ? 10 : g.unit === 'month' ? 7 : 4;
    const map = new Map();
    list.forEach((r) => {
      const k = dayKey(r.v[cfg.dateField.key]).slice(0, len);
      if (!k) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    rows = [...map]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-24) // latest 24 buckets
      .map(([k, l]) => ({
        label: g.unit === 'day' ? fmtDate(k) : g.unit === 'month' ? fmtMonth(k) : k,
        value: agg(l),
        count: l.length,
      }));
  }

  return {
    total: agg(list),
    count: list.length,
    rows: rows.map(({ _l, ...r }) => r),
    money: !!m.field?.money,
  };
};

// readable default title for a custom analytic
export const autoTitle = (c) => {
  const m = c.measure;
  const what = m?.field ? `${m.type === 'sum' ? 'Total' : 'Average'} ${m.field.label} · ` : '';
  const where = c.where ? ` (${c.where.field.label}: ${c.where.value})` : '';
  const by = c.groupBy
    ? c.groupBy.type === 'field' ? ` by ${c.groupBy.field.label}` : ` per ${c.groupBy.unit}`
    : '';
  return `${what}${c.module}${where}${by}`;
};

// ============================================
// DEFAULT LAYOUT  (span = columns out of 6 on large screens: 2 = ⅓, 3 = ½, 6 = full)
// ============================================
export const DEFAULT_WIDGETS = [
  { id: 'closing',   kind: 'builtin', visible: true, view: 'list',   span: 2, periodMode: 'month' },
  { id: 'tasks',     kind: 'builtin', visible: true, view: 'list',   span: 2, periodMode: 'month' },
  { id: 'meetings',  kind: 'builtin', visible: true, view: 'list',   span: 2, periodMode: 'month' },
  { id: 'funnel',    kind: 'builtin', visible: true, view: 'funnel', span: 3, periodMode: 'all' },
  { id: 'pipeline',  kind: 'builtin', visible: true, view: 'bar',    span: 3, periodMode: 'all' },
  { id: 'leads',     kind: 'builtin', visible: true, view: 'list',   span: 3, periodMode: 'day' },
  { id: 'followups', kind: 'builtin', visible: true, view: 'list',   span: 3, periodMode: 'day' },
];