# KUIPER performance – before vs after

Same machine, same local MongoDB with production-sized test data (`npm run seed:testusers` +
`npm run seed:bulk`: 66 users, 154 projects, 757 feeds, ~6,000 tickets, 1,506 leads, 5,000 ticket
worklogs, 1,500 leaves). Baseline: `perf/BASELINE.md`. Raw numbers: `perf/bundle-{before,after}.json`,
`perf/api-{before,after}.json`.

## First visit (production build)

| | Before | After |
|---|---:|---:|
| JS + CSS requests for the first page | 24 | **6** |
| Initial JS (raw) | 3,503 KB | **569 KB** |
| Initial JS (gzip / brotli) | 906 / 706 KB | **182 / 158 KB** |
| three.js, xlsx, chart.js in the first load | yes / yes / yes | no / no / no |
| Sidebar company video, every page | 896 KB mp4 | 4 KB poster (video only on hover) |
| Favicon | 1,183 KB PNG | 1–3 KB PNGs |
| Logo image (login + sidebar) | 1,301 KB PNG | 6 KB WebP |
| Asset compression on the server | gzip on the fly (if enabled) | precompressed `.br` / `.gz` served as-is |

Moving between pages: each page is its own chunk (typically 5–30 KB gzip), cached for a year by
the new nginx config; the user's dashboard chunk is prefetched while the login animation plays.
The sidebar's 3D particles (three.js, 234 KB gzip) still load, but after the page is idle and
not at all with reduced motion.

## API (median, localhost, so network savings come on top)

| Page (user) | Before: time / body | After: time / body | Wire size after (gzip) |
|---|---:|---:|---:|
| Ticket list (Admin, 6,009 tickets) | 1,838 ms / 11,024 KB | **60 ms / 17 KB** (25 per page + counts) | 2 KB |
| Ticket list (Developer) | 184 ms / 932 KB | **29 ms / 18 KB** | 2.5 KB |
| Single ticket (4 calls) | 28 ms / 15 KB | 44 ms / 14 KB | 2.2 KB |
| Admin dashboard | 322 ms / 968 KB | **11 ms / 1.5 KB** | 0.5 KB |
| PM dashboard | 279 ms / 1,204 KB | **46 ms / 93 KB** | 6 KB |
| HR dashboard (7 calls) | 375 ms / 1,528 KB | ~unchanged / 1,528 KB | **66 KB** (was 1,528 KB) |
| Worklog (Developer) | 91 ms / 116 KB | ~unchanged | 9 KB |
| Lead generation (Sales Manager) | 194 ms / 1,151 KB | **109 ms** / 1,151 KB | **52 KB** |
| Sidebar + bell polls, every 30 s, every page (Admin) | 1,976 ms / 11,024 KB | **48 ms / 0.4 KB** | 0.3 KB |

"After" times are from the run right after step 2. A final re-run on a busier machine was ~1.8x
slower across the board, including endpoints that were not changed at all (`system-time-check`
3 → 7 ms), so only same-run comparisons are meaningful; the payload sizes are exact.

Before, Express sent no compressed responses at all, so every "Before" body size was also the size
on the wire. Polls also pause now while the tab is hidden.

## Database

New indexes (Ticket, Feed, Project, WorkLog, LeaveApplication, LeadGen, Lead – see
`backend/scripts/ensureIndexes.js`). `explain()` on the ticket list queries: IXSCAN, 25 documents
examined for 25 returned (before: collection scan of all tickets, then sort in memory).

The heaviest cron job (12:00 productivity report) builds in ~330 ms with a worst-case event-loop
pause of 80 ms; the other jobs are short async I/O.

## Verification

- `npm run build` passes; backend starts (nodemon restarts after every change, API answering).
- Ticket list vs stats, all 14 test accounts: total, Open, In Progress, Resolved, Closed, Watching,
  Internal, External and "assigned to me" counts from the paginated list equal the dashboard
  counts; search by ticket number and by assignee name finds the ticket; page 2 works.
- PM dashboard ticket counts recomputed the old way (all visible tickets filtered to the PM's
  projects): identical (343 / 93 / 104 / 48).
- `/api/admin/users`: same users, same fields, same prospect/lead counts as the old per-user code.
- Browser click-through (dev server) as Super Admin, Admin, Project Manager, Project Coordinator,
  Team Lead, Developer, Sales Manager, Sales, HR, Finance, Client: every main page renders, no
  error screen, no failed API call, no console errors from the changes. Ticket list: status
  filters, Watching, Internal/External, Clear All, search (name, number, no match), Next/Previous.
- Production build served with `vite preview`: first load = the 6 core files + the dashboard chunk;
  charts load only on Resource Analytics; the excel chunk never loads unless a sheet is imported.

Not exercised (would send real e-mails through Resend from this machine): submitting a new ticket
and posting a ticket comment. The create form, details page and comment box render.

Existing issues seen during the click-through (not caused by these changes):
- Client → Create Ticket: `GET /api/admin/users` (watcher list) returns 403 for Clients.
- POC accounts have no dashboard (blank page after login).
- Sales Manager is not allowed on `/feasibility` (route only lists Sales).

## Not changed (possible follow-ups)

- `/api/hr/leave/all` returns all leave applications (1,500 here); paginating it needs a small HR
  page change.
- `/api/leave-bucket/employees/buckets` runs one summary query per employee.
- Worklog re-renders every second while visible (needed for its live clock/"synced Xs ago" text;
  isolating those into small components would remove it).
- Zero-downtime deploys need the cron jobs moved out of the API process first (see
  `ecosystem.config.js`).

Deploy steps: `deploy/README.md`.
