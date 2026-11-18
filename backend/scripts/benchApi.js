// backend/scripts/benchApi.js
//
// Times the API calls each main page makes, as the matching test user.
// Needs a running backend and the logins in scripts/output/test-accounts.csv
// (npm run seed:testusers, ideally followed by npm run seed:bulk).
//
//   node scripts/benchApi.js                 -> table
//   node scripts/benchApi.js --json out.json -> also save results
//
// Each call runs RUNS times; the median time is reported. "KB" is the uncompressed JSON
// body; "gzip KB" is what it would be over the wire with compression.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const API = process.env.BENCH_API || 'http://localhost:5000';
const RUNS = Number(process.env.BENCH_RUNS || 5);
const CSV = path.join(__dirname, 'output', 'test-accounts.csv');

const rows = fs.readFileSync(CSV, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).slice(1)
  .map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
const cred = Object.fromEntries(rows.map((r) => [r[0], { email: r[2], password: r[3] }]));

// page -> [role, [paths]]; ':ticket' is replaced by a ticket with many comments.
// These are the calls the pages make AFTER the step-2 changes; perf/api-before.json holds the
// numbers for the calls they made before (whole ticket list for the list, PM dashboard and sidebar).
const PAGES = [
  ['Ticket list (Admin)', 'Admin', ['/api/tickets?page=1&limit=25&status=all&type=all', '/api/tickets/stats']],
  ['Ticket list (Developer)', 'Developer', ['/api/tickets?page=1&limit=25&status=all&type=all', '/api/tickets/stats']],
  ['Single ticket', 'Admin', ['/api/tickets/:ticket', '/api/tickets/:ticket/watchers', '/api/tickets/developers/list', '/api/tickets/users/watchers']],
  ['Admin dashboard', 'Admin', ['/api/admin/projects', '/api/admin/users', '/api/admin/analytics']],
  ['PM dashboard', 'Project Manager', ['/api/admin/projects', '/api/tickets/stats?scope=myProjects']],
  ['HR dashboard', 'HR', ['/api/hr/dashboard/stats', '/api/leave-bucket/pending', '/api/hr/attendance/corrections', '/api/hr/employees', '/api/hr/leave/all', '/api/hr/employees/probation', '/api/leave-bucket/employees/buckets']],
  ['Worklog (Developer)', 'Developer', ['/api/dev/worklog', `/api/dev/worklog/history?date=${new Date(Date.now() - 86400e3).toISOString().slice(0, 10)}`, '/api/dev/ticket-worklog', '/api/dev/system-time-check']],
  ['Lead generation (Sales Manager)', 'Sales Manager', ['/api/lead-generation', '/api/admin/users', '/api/orgs']],
  ['Sidebar + bell polls (Admin, every 30s)', 'Admin', ['/api/tickets/stats', '/api/announcements/unviewed/count', '/api/notifications/count']],
];

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function login(role) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cred[role]) });
  const b = await r.json();
  if (!b.token) throw new Error(`login failed for ${role}`);
  return b.token;
}

async function timeCall(token, p) {
  const times = []; let bytes = 0; let gz = 0; let status = 0; let items = null;
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    const r = await fetch(API + p, { headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity' } });
    const buf = Buffer.from(await r.arrayBuffer());
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    status = r.status; bytes = buf.length; gz = zlib.gzipSync(buf).length;
    if (i === 0) { try { const j = JSON.parse(buf); items = Array.isArray(j) ? j.length : Array.isArray(j.items) ? `${j.items.length}/${j.total}` : Array.isArray(j.data) ? j.data.length : null; } catch { /* not json */ } }
  }
  return { status, ms: median(times), kb: bytes / 1024, gzipKb: gz / 1024, items };
}

(async () => {
  const tokens = {};
  const results = [];
  // a ticket with plenty of comments
  tokens.Admin = await login('Admin');
  const list = await (await fetch(`${API}/api/tickets?limit=200`, { headers: { Authorization: `Bearer ${tokens.Admin}` } })).json();
  const arr = Array.isArray(list) ? list : list.items;
  const ticketId = arr.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0))[0]?._id || arr[0]._id;

  for (const [page, role, paths] of PAGES) {
    tokens[role] = tokens[role] || await login(role);
    let total = 0; let kb = 0; let gz = 0;
    for (const raw of paths) {
      const p = raw.replace(':ticket', ticketId);
      const r = await timeCall(tokens[role], p);
      results.push({ page, call: raw, status: r.status, ms: +r.ms.toFixed(1), kb: +r.kb.toFixed(1), gzipKb: +r.gzipKb.toFixed(1), items: r.items });
      total += r.ms; kb += r.kb; gz += r.gzipKb;
    }
    results.push({ page, call: `TOTAL (${paths.length} calls)`, status: '', ms: +total.toFixed(1), kb: +kb.toFixed(1), gzipKb: +gz.toFixed(1), items: '' });
  }
  console.table(results.map((r) => ({ page: r.page, call: r.call, status: r.status, 'ms (median)': r.ms, KB: r.kb, 'gzip KB': r.gzipKb, items: r.items ?? '' })));
  const out = process.argv[process.argv.indexOf('--json') + 1];
  if (process.argv.includes('--json') && out) fs.writeFileSync(out, JSON.stringify(results, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
