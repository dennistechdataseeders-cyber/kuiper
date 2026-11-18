# KUIPER performance – baseline (before any optimization)

Measured 2026-11-18 on the dev machine against a local MongoDB loaded with
`npm run seed:testusers` + `npm run seed:bulk`:
66 users, 154 projects, 757 feeds, 6,009 tickets (0–5 comments and 0–3 watchers each),
1,506 feasibility leads, ~2,700 feed worklogs, 5,000 ticket worklogs, 1,500 leave
applications, ~4,000 punch logs, 153 announcements.

Tools (re-run for the AFTER numbers):

```bash
cd frontend && ANALYZE=1 npm run build && node scripts/bundleReport.mjs
cd backend && node scripts/benchApi.js
```

Raw data: `perf/bundle-before.json`, `perf/api-before.json`.

## Frontend – first page load (production build)

| | Value |
|---|---|
| Initial JS | **3,503 KB raw / 906 KB gzip / 706 KB brotli** |
| Initial requests (JS + CSS) | **24** (23 JS + 1 CSS) |
| Initial CSS | 162 KB raw / 22 KB gzip |
| All JS chunks | 26 files, 4,416 KB raw |
| Sidebar video (every page) | `Company_Logo_mp4.mp4` **896 KB** |
| Favicon `tab_logo.png` (every first visit) | **1,183 KB** |
| Login image `login_img.png` | **1,301 KB** |

Top 10 chunks:

| Chunk | raw KB | gzip KB | In first load |
|---|---:|---:|---|
| index (all 66 pages + components) | 1,554 | 317 | yes |
| exceljs | 908 | 248 | no |
| @react-three (three.js, fiber, drei) | 887 | 234 | **yes** |
| xlsx | 324 | 109 | **yes** |
| react-dom | 174 | 54 | yes |
| chart.js | 159 | 53 | **yes** |
| framer-motion | 122 | 39 | yes |
| react-select | 58 | 20 | yes |
| lucide-react | 43 | 13 | yes |
| react-router | 41 | 15 | yes |

## API – median of 5 runs, localhost (no network), uncompressed body

| Page (user) | Calls | Time | Body | gzip |
|---|---:|---:|---:|---:|
| Ticket list (Admin) – `/api/tickets` | 1 | **1,838 ms** | **11,024 KB** (6,009 tickets) | 754 KB |
| Ticket list (Developer) | 1 | 184 ms | 932 KB (501) | 65 KB |
| Single ticket (+ watchers, developer list, watcher list) | 4 | 28 ms | 15 KB | 2 KB |
| Admin dashboard | 3 | 322 ms | 968 KB (`/admin/projects` 892 KB) | 48 KB |
| PM dashboard | 2 | 279 ms | 1,204 KB (tickets 1,111 KB) | 83 KB |
| HR dashboard | 7 | 375 ms | 1,528 KB (`/hr/leave/all` 1,181 KB) | 66 KB |
| Worklog (Developer) | 4 | 91 ms | 116 KB | 9 KB |
| Lead generation (Sales Manager) | 3 | 194 ms | 1,151 KB (1,506 leads) | 52 KB |
| **Sidebar + bell polls (Admin, every 30 s, every page)** | 3 | **1,976 ms** | **11,024 KB** | 754 KB |

## Top problems, ranked by impact

| # | Problem | Evidence | Impact |
|---|---|---|---|
| 1 | Sidebar polls the **full ticket list** every 30 s on every page just to count open tickets | `Sidebar.jsx` `fetchTicketCount` → `GET /api/tickets`, then `.filter(status !== 'Closed').length` | Admin: 11 MB + ~1.9 s of server work every 30 s per open tab, forever |
| 2 | Ticket list returns **every ticket with every comment** – no pagination, no projection, 6 populates (incl. watchers), Admin gets all | `getTickets`: `Ticket.find(filter).populate(×6).sort()`, no `.lean()`/`.select()`/limit | 1.8 s / 11 MB for 6k tickets; grows linearly |
| 3 | **No HTTP compression** anywhere in Express (and likely not for proxied JSON in Nginx – `gzip_proxied` is off by default) | no `compression` dependency | JSON goes over the wire ~10–15× larger than needed |
| 4 | **Whole app in the first download**: 66 pages statically imported, three.js, xlsx and chart.js in the initial graph | bundle report: 3.5 MB raw / 906 KB gzip, 24 requests | Slow first visit on every page, especially mobile |
| 5 | **Heavy media on every page**: 896 KB sidebar mp4, 1.18 MB favicon PNG, 1.3 MB login PNG | `Sidebar.jsx` imports the mp4; `index.html` favicon | ~2–3.4 MB extra before the app feels loaded |
| 6 | Other "fetch everything" lists: `/hr/leave/all` (1.2 MB), `/lead-generation` (1.1 MB), `/admin/projects` (0.9 MB, populates every feed + developer), `/leave-bucket/pending` (0.3 MB) | API table | 190–200 ms and ~1 MB each, growing with data |
| 7 | **Missing indexes** for the hot filters | `tickets`: only `ticketNumber`, `assignedPM`; `feeds`: none (but `assignedDevelopers` is queried by every developer request); `worklogs`: none; `projects`: none on `projectManager`/`teamLead`; `leadgens`: none on `salesRepId`/`status`; `users`: none on `role` | Collection scans; small now, painful as data grows |
| 8 | Polling: 3 requests / 30 s on every page (tickets, announcements count twice – sidebar **and** bell – plus notifications count) even in hidden tabs, although socket.io already pushes `notification_count_update` | `NotificationBell.jsx`, `Sidebar.jsx`; only `Worklog.jsx` checks `document.hidden` | Constant background load per tab |
| 9 | Crons and socket.io live in the API process | 10 `cron.schedule` jobs (incl. `biometricSync` every 15 min, `salesNotificationService` every minute) + in-memory socket rooms | Rules out PM2 cluster mode (jobs would run N times; sockets need sticky sessions + shared adapter) |
