# KUIPER cleanup report: strip to current functionality

Branch: `cleanup/current-only` (created from a clean `main` at `897b54e`). **Nothing has been deleted yet.** This is the Phase 2 checkpoint, waiting for approval.

How this was worked out:
- **Frontend:** started from `main.jsx` → `App.jsx` → `Sidebar.jsx` per role, followed every `navigate()`, `<Link>`, `window.location`, role-based path builder (`getProjectFeedPath`, `getBackPath`, `MODULE_ROUTE`, `goTo`) and backend notification `link` values. Then I computed the full import closure with a script (it resolves `import`/`require`/dynamic `import()`).
- **Backend:** built the require graph from `server.js` (including the `path.join(__dirname,'cron',…)` requires), pulled out all 327 mounted endpoints (mount prefix + router path, multi-line definitions included), and matched each one against every `/api/...` string in live frontend code and live backend code. Every endpoint with no match was then checked by hand for dynamic URLs (`${ADMIN_BASE}/…`, `${apiBase}/users/${id}/access`, `leaveActionUrl(..., action)`, `endpoint = '/api/…'` role switches). 15 endpoints that the script missed turned out to be live and are **not** listed below.
- **Models:** checked `require`, `ref: 'X'`, `.model('X')`, `populate`, `db.collection('x')`.

---

## Phase 0: Baseline (before any change)

| Check | Result |
|---|---|
| `frontend: npm install` | OK (npm audit notes only) |
| `frontend: npm run build` | **OK**, built in 25.6s. One warning: *"Some chunks are larger than 1600 kB after minification"* |
| `frontend: npx eslint src` | **297 problems (230 errors, 67 warnings)**: 162 no-unused-vars, 67 react-hooks/exhaustive-deps, 53 react-refresh/only-export-components, 7 react-hooks/purity, 3 set-state-in-effect, 2 immutability, 1 static-components, 1 refs, **1 no-undef** |
| `backend: npm install` | OK |
| `node --check` on every backend `.js` (outside node_modules) | **All pass** |
| Backend boot (`node server.js`, your `.env`) | Port 5000 was already in use (your own server is running), so I booted again with `PORT=5099`. **Clean boot:** MongoDB and the Feed Status DB connected, all 9 crons plus the sales notifier scheduled, **0 `MODULE_NOT_FOUND`**. Warnings: Mongoose duplicate index on `ShiftHistory.userId` and `Holiday.date`. |

Baseline lists (frontend routes, sidebar per role, all 327 API routes, crons) are in the **Appendix** at the end. They are what Phase 4 will be compared against.

---

## 1. Live map

### Entry points
- `/login` → `Login`. After login: `AppContent.landingPath` per role (Super Admin/Admin `/admin`, Sales Manager `/sales-manager`, Sales `/sales`, Project Manager `/admin/projects`, Developer `/developer`, Client `/client`, Team Lead `/teamlead`, HR `/hr`, Finance `/tickets`).
- Global on every page: `Sidebar`, `SalesNotifier`, `NotificationBell` (→ `/announcements`, `/tickets`, `/tickets/:id`, `/sales/activities/*` from notification links), the user menu (→ `/profile`, `/notifications`), and `ErrorBoundary`. Unknown paths (`*`) redirect to the landing page.

### Live pages per role (Super Admin can open every route)

| Role | Reached from the sidebar | Reached from inside pages |
|---|---|---|
| **Super Admin** | `/admin`, `/view_analytics`, `/sales/leads`, `/sales/contacts`, `/sales/accounts`, `/sales/deals`, `/sales-manager`, `/sales/activities/{tasks,meetings,calls}`, `/admin/projects`, `/admin/project-clients`, `/pm/feeds`, `/pm/feed-status`, `/pm/resource-analytics`, `/pm/work-report`, `/feasibility`, `/pm/feasibility`, `/hr`, `/hr/holidays`, `/hr/leaves`, `/hr/attendance-sync`, `/hr/employee-attendance`, `/hr/employee-attendance-report`, `/tickets`, `/announcements`, `/knowledge`, `/admin/ticket-rules`, `/admin/ticket-categories`, `/developer`, `/developer/worklog`, `/developer/projects`, `/developer/feeds`, `/developer/git-feeds`, `/pm/dashboard`, `/pm/git-manager`, `/admin/customize`, `/employee` | everything below |
| **Admin** | `/admin`, `/view_analytics`, Sales group, Activities group, `/admin/projects`, `/admin/users`, `/admin/project-clients`, `/pm/feeds`, `/pm/resource-analytics`, `/pm/work-report`, General (`/tickets`, `/announcements`, `/knowledge`), `/hr`, `/hr/holidays`, `/hr/attendance-sync`, `/admin/ticket-rules`, `/admin/ticket-categories`, `/admin/customize`, `/employee` | as below |
| **Sales Manager** | `/sales-manager`, Sales group, Activities group, `/admin/users` (Team), General, `/admin/customize`, `/employee` | dashboard KPIs → `/sales/lead_generation`, `/sales/deals`, `/sales/activities/*` |
| **Sales** | `/sales`, Sales group, Activities group, `/feasibility`, General, `/admin/customize`, `/employee` | |
| **Project Manager** | `/pm/dashboard`, `/admin/projects`, `/pm/feeds`, `/pm/feed-status`, `/pm/work-report`, `/pm/resource-analytics`, `/pm/feasibility`, `/pm/git-manager`, General, `/employee` | |
| **Team Lead** | `/teamlead`, `/teamlead/projects`, `/teamlead/feeds`, `/teamlead/feed-status`, `/teamlead/developers`, General, `/employee` | |
| **Developer** | `/developer`, `/developer/worklog`, `/developer/projects`, `/developer/feeds`, `/developer/git-feeds`, `/developer/feed-status`, General, `/employee` | |
| **Client** | `/client` (FeedDeliveryDashboard), `/tickets` | |
| **HR** | `/hr`, `/admin/users`, `/hr/holidays`, `/hr/leaves`, `/hr/employee-attendance`, `/hr/employee-attendance-report`, `/hr/attendance-sync`, General | |
| **Finance** | General (`/tickets`, `/announcements`, `/knowledge`), `/employee` | |

Navigation paths inside pages (all live):
- Sales: `Accounts` → `/sales/accounts/new` (CreateAccount), `/sales/accounts/:id` (AccountDetail) → `/sales/contacts/:accountId/:pocId` (ContactDetail), `/sales/deals/:id` (DealDetail). `Contacts` → ContactDetail. `Deals` → DealDetail. `LeadDetail` → `/sales/deals`. `ActivitiesTasks` / `ActivityListView` → `/sales/activity/:id` (ActivityDetail) → `/sales/leads?open=`.
- `FeasibilityDashboard` and `SalesManagerDashboard` → `/sales/lead_generation` (**LeadGeneration**: live only through these buttons, not in the sidebar). The lead email template also links here.
- Feed status: `FeedDeliveryDashboard` (`/client`, `/pm/feed-status`, `/developer/feed-status`, `/teamlead/feed-status`) → `/{client,pm,developer,teamlead}/projects/:projectId/feeds` (**ProjectFeedStatus**).
- Tickets: `TicketDashboard` / `TeamLeadDashboard` → `/tickets/create`, `/tickets/:id`. `ProjectFeeds` → `/tickets`.
- `PmDashboard` / `ProjectManagement` → `/pm/feeds`. `TeamLeadDashboard` → `/teamlead/projects`, `/teamlead/feeds`, `/teamlead/developers`. `HrDashboard` → `/hr/employee-attendance`. `DeveloperDashboard` → `/developer/projects`, `/developer/feeds`.
- Feature components used by live pages: `EmployeeDashboard` (`/employee`) uses `AttendanceCombined`, `AttendanceTimeline`, `EmployeeLeave`, `ApplyLeaveModal`. `HrDashboard` / `HrLeaveDashboard` use `LeaveBalanceEditor` and `utils/leaveGroups`.

### Live background jobs (all started by `server.js`; none is env-gated)
| Job | File | Schedule (cron expression) |
|---|---|---|
| Drip campaign worker | `cron/dripCampaignWorker.js` | see file (see **Unsure U1**) |
| Leave balance updater | `cron/leaveBalanceUpdater.js` | `0 0 * * *` |
| Daily productivity report | `cron/dailyProductivityReport.js` | `00 12 * * *` |
| Biometric sync (HTTP device API) | `cron/biometricSync.js` | every 15 min |
| Announcement automation | `cron/announcementAutomation.js` | `0 9 * * *` |
| Holiday reminder | `cron/holidayReminder.js` | `45 18 * * *` |
| Leave bucket accrual | `cron/leaveBucketAccrual.js` | `0 0 1 * *` |
| Auto-stop worklogs | `cron/autoStopWorklogs.js` | `55 23 * * *` |
| Feed Git sync | `cron/feedGitSync.js` | `0 2 * * *` |
| Sales notifications | `services/salesNotificationService.js` (started after listen) | `* * * * *` reminders, `30 10 * * *` daily email |

There is **no** env flag that switches any cron on or off. There is **no MSSQL background job.** MSSQL is only used by four HR endpoints that nothing calls (see U3).

---

## 2. Pages to delete

| Page | Route in `App.jsx` | Why it is not live |
|---|---|---|
| `pages/Organizations.jsx` | `/sales/add_org` | Route exists, but no sidebar link and nothing navigates to it. Replaced by Accounts/CreateAccount. |
| `pages/Prospects.jsx` | `/sales/prospects` | Route exists, but nothing navigates to it (see U5) |
| `pages/EmailTrigger.jsx` | `/sales/email-trigger` | Route exists, but nothing navigates to it |
| `pages/PMTaskProgress.jsx` | `/pm/task-progress` | Route exists, but nothing navigates to it |
| `pages/ProjectDetailView.jsx` | `/developer/project/:id` | Route exists, but nothing navigates to it (developers use `/developer/projects`) |
| `components/DeveloperBucket.jsx` (used as a page) | `/developer/bucket` | Route exists, but nothing navigates to it |
| `pages/ClientFeedDetails.jsx` | `/client/feeds/:feedId` | Route exists, but nothing navigates to it (`ProjectFeedStatus` never links to a feed detail) |
| `pages/ClientDashboard.jsx` | none | Imported in `App.jsx` but never rendered. The Client landing page is `FeedDeliveryDashboard`. |
| `pages/EmployeeLeaveDashboard.jsx` | none | Not imported anywhere. The old leave screen, replaced by `EmployeeDashboard` → `EmployeeLeave` / leave-bucket. |

Duplicate screens I checked and **kept** (all reachable): `FeasibilityDashboard` (`/feasibility`) and `PmFeasibilityDashboard` (`/pm/feasibility`); `ViewAnalytics` and `ResourceAnalytics`; `Attendance*`: `AttendanceCombined` and `AttendanceTimeline` are live, but `components/Attendance.jsx` is dead (below); `HrLeaveDashboard` (live) vs `EmployeeLeaveDashboard` (dead).

---

## 3. Frontend files to delete

**Pages:** the 9 files in section 2.

**Orphaned components and data** (not imported by any live file; most only import each other):
- `components/AccountDetailPanel.jsx`, `components/ContactDetailPanel.jsx` (replaced by the AccountDetail and ContactDetail pages)
- `components/AlphabetFilter.jsx` (`Leads.jsx` has its own inline alphabet filter)
- `components/Attendance.jsx` and `components/SyncStatus.jsx` (SyncStatus is only imported by Attendance; calls `/api/hr/biometric/sync-status`, which doesn't exist)
- `components/ColumnFilterMenu.jsx`, `components/LeadFilterBar.jsx`, `components/ZohoFilterBar.jsx`
- `components/UpdateProfileModal.jsx`
- `data/salesTips.jsx`

**Stray files and assets** (no reference in `src/`, `index.html`, the Vite/Tailwind/PostCSS config, or backend email templates):
- `frontend/src/App.css` (never imported)
- `frontend/src/assets/react.svg`, `vite.svg`, `hero.png`, `Company_Logo_mp4_2.mp4` (`Company_Logo_mp4.mp4` is used, so it stays)
- `frontend/public/favicon.svg`, `frontend/public/icons.svg`, `frontend/public/images/Flag.png`, `frontend/public/images/flag_icon.png` (`login_img.png` and `tab_logo.png` are used, so they stay)
- `frontend/src/pages/login.txt`, `frontend/README.md` (default Vite template), root `diff-output.txt`

Total: 19 source files, about 8,500 lines, plus 13 stray files and assets. No hooks or context files are dead (`SidebarContext` and all `utils/*` are used).

---

## 4. Backend to delete

### 4a. Whole routers (every endpoint dead) and their `server.js` lines
| Router | Mount | Used by | `server.js` lines to remove |
|---|---|---|---|
| `routes/prospects.js` | `/api/prospects` (10 endpoints) | only dead `Prospects.jsx` | 144, 419 |
| `routes/pmRoutes.js` | `/api/pm` (6 endpoints) | nothing (the PM UI uses `/api/admin/*`) | 146, 421 |
| `routes/emailCampaignRoutes.js` | `/api/email-campaign` (`POST /upload`) | only dead `EmailTrigger.jsx` | 149, 424 |

### 4b. Dead endpoints inside live routers
"Caller" means the only code that calls it; "none" means nothing in the repo calls it. Line ranges cover the whole `router.x(...)` call.

| Endpoint | Handler (file:lines) | Caller |
|---|---|---|
| POST `/api/auth/register` (registered **twice**) | `authRoutes.js:5`, `:7` | none |
| POST `/api/auth/forgot-password` | `authRoutes.js:9` | none |
| POST `/api/auth/reset-password` | `authRoutes.js:10` | none |
| POST `/api/admin/fix-probation` | `adminRoutes.js:593-648` | none |
| GET `/api/admin/client-projects` | `adminRoutes.js:849-918` | none |
| DELETE `/api/admin/projects/:id` | `adminRoutes.js:1163-1177` | none (no delete button in ProjectManagement) |
| POST `/api/admin/projects/:id/bulk-invite` | `adminRoutes.js:1226-1287` | none |
| DELETE `/api/admin/projects/:id/remove-collaborator` | `adminRoutes.js:1344-1370` | none |
| POST `/api/admin/feeds/push-task` | `adminRoutes.js:1651-1680` | none |
| GET `/api/admin/pm/task-progress` | `adminRoutes.js:1682-1710` | dead `PMTaskProgress.jsx` |
| GET `/api/admin/users/clients` | `adminRoutes.js:1716-1723` | none |
| GET `/api/admin/projects/:projectId/feeds` | `adminRoutes.js:1807-1853` | none |
| GET `/api/admin/teamleads` | `adminRoutes.js:1901-1911` | none (the UI uses `/users/teamleads`) |
| GET `/api/admin/projects/teamlead/:teamLeadId` | `adminRoutes.js:1914-1927` | none |
| GET `/api/admin/projects/teamlead` | `adminRoutes.js:1941-1963` | none |
| GET `/api/admin/projects/:id/repo-folder-last-updated` | `adminRoutes.js:2083-2139` | none (replaced by the feedGitSync cron) |
| PATCH `/api/admin/users/:userId/leave-balance` | `adminRoutes.js:2253-2384` | none |
| GET `/api/admin/users/:userId/leave-history` | `adminRoutes.js:2389-2425` | none |
| POST `/api/admin/projects/:id/sync-git-dates` | `adminRoutes.js:2426-2432` | none |
| GET `/api/orgs/client/me` | `organizationRoutes.js:115-133` | dead `ClientDashboard.jsx` |
| GET `/api/orgs/check-existing` | `organizationRoutes.js:153-187` | dead `Organizations.jsx` |
| POST `/api/orgs/check-duplicate` | `organizationRoutes.js:428-448` | dead `Prospects.jsx` |
| PUT `/api/orgs/:id/poc/:pocIndex` | `organizationRoutes.js:512-565` | none (replaced by `PATCH /:id/pocs/:pocId`) |
| DELETE `/api/orgs/:id/poc/:pocIndex` | `organizationRoutes.js:568-618` | none |
| GET `/api/orgs/:id/pocs` | `organizationRoutes.js:621-640` | none |
| GET `/api/orgs/stats/summary` | `organizationRoutes.js:643-664` | none |
| GET `/api/lead-generation/download/:leadId` | `leadGenRoutes.js:667-707` | none |
| GET `/api/lead-generation/pm/feasibility` | `leadGenRoutes.js:712-730` | none |
| GET `/api/dev/dashboard/overview` | `developer.js:144-316` | none |
| PATCH `/api/dev/feeds/:id/status` | `developer.js:656-691` | dead `ProjectDetailView.jsx` |
| PATCH `/api/dev/tasks/:taskId` | `developer.js:698-735` | dead `DeveloperBucket.jsx` |
| GET `/api/dev/my-bucket` | `developer.js:742-757` | dead `DeveloperBucket.jsx` |
| GET `/api/dev/worklog/today-descriptions` | `developer.js:1024-1039` | none |
| GET `/api/dev/worklog/today` | `workDescriptionRoutes.js:27-30` (+ `getTodayDescriptions` in `workDescriptionController.js:166-`) | none |
| POST `/api/tickets/upload-files` | `ticketRoutes.js:319-390` | none (the UI uses singular `/upload-file`) |
| DELETE `/api/tickets/delete-file` | `ticketRoutes.js:393-408` | none |
| POST `/api/tickets/upload-image` | `ticketRoutes.js:411-440` | none |
| DELETE `/api/tickets/delete-image` | `ticketRoutes.js:443-458` | none |
| GET `/api/tickets/department-users/:role` | `ticketRoutes.js:522-533` | none |
| GET `/api/tickets/projects/list` | `ticketRoutes.js:566` (+ `ticketController.getProjects` 1877-1923) | none |
| GET `/api/teamlead/projects/:id` | `teamLeadRoutes.js:47-74` | none |
| GET `/api/teamlead/projects/:projectId/feeds` | `teamLeadRoutes.js:171-190` | none (ProjectFeedStatus always uses `/api/client/...`) |
| POST `/api/teamlead/tickets` | `teamLeadRoutes.js:236-309` | none |
| PATCH `/api/teamlead/tickets/:id/status` | `teamLeadRoutes.js:314-363` | none |
| POST `/api/teamlead/tickets/:id/comments` | `teamLeadRoutes.js:368-420` | none |
| GET `/api/notifications/unread-count` | `notificationRoutes.js:388-429` | none |
| GET `/api/client/feeds/:feedId` | `clientRoutes.js:436-507` | dead `ClientFeedDetails.jsx` |
| GET `/api/client/debug/feedstatus` | `clientRoutes.js:651-672` | none (debug) |
| GET `/api/knowledge/folders/list` | `knowledgeBaseRoutes.js:53` (+ `getFolders`) | none |
| DELETE `/api/knowledge/:entryId/file/:fileIndex` | `knowledgeBaseRoutes.js:89-94` (+ `deleteFile`) | none |
| GET `/api/hr/leave/pending` | `hrRoutes.js:436-447` | none (old leave system) |
| PATCH `/api/hr/leave/:id/approve` | `hrRoutes.js:475-584` | none |
| PATCH `/api/hr/leave/:id/reject` | `hrRoutes.js:587-633` | none |
| POST `/api/hr/attendance/manual-punch` | `hrRoutes.js:764-810` | none |
| POST `/api/hr/attendance/sync-progress` | `hrRoutes.js:851-872` | none |
| GET `/api/hr/attendance/employee/:employeeCode` | `hrRoutes.js:875-1052` | none (UI uses `employee-timeline` / `employee-report`) |
| GET `/api/hr/attendance/device-codes` | `hrRoutes.js:1106-1128` | none |
| GET/POST/PUT/DELETE `/api/hr/leave-types[/:id]` | `hrRoutes.js:1253-1342` | none (see U4) |
| PATCH/GET `/api/hr/employee/:id/leave-balance` | `hrRoutes.js:1348-1409` | none |
| POST `/api/hr/biometric/manual-sync` | `hrRoutes.js:1412-1421` | none |
| GET `/api/employee/attendance/debug` | `employeeRoutes.js:563-610` | none (debug) |
| POST `/api/employee/leave/apply` | `employeeRoutes.js:615-700` | none (old leave system) |
| GET `/api/employee/leave/history` | `employeeRoutes.js:705-738` | none |
| GET `/api/employee/leave/balance` | `employeeRoutes.js:743-787` | none |
| POST `/api/employee/timesheet/missed-punch` | `employeeRoutes.js:792-841` | none |
| GET `/api/holidays/upcoming` | `holidayRoutes.js:20` (+ `holidayController.getUpcomingHolidays`) | none |
| GET `/api/holidays/check` | `holidayRoutes.js:23` (+ `holidayController.checkHoliday`) | none |
| POST `/api/leads/fields/seed` | `leadRoutes.js:241-248` | none |
| GET `/api/leaves/balance` | `leaveRoutes.js:15` (+ `leaveController.getLeaveBalances`) | dead `EmployeeLeaveDashboard.jsx` |
| POST `/api/leaves/apply` | `leaveRoutes.js:21` (+ `leaveController.applyLeave`) | dead `EmployeeLeaveDashboard.jsx` |
| PATCH `/api/leaves/:id/approve` | `leaveRoutes.js:35` (+ `approveLeave`) | none (HR uses leave-bucket approve) |
| PATCH `/api/leaves/:id/reject` | `leaveRoutes.js:38` (+ `rejectLeave`) | none |
| GET `/api/leave-bucket/history` | `leaveBucketRoutes.js:17` (+ `getLeaveHistory`) | none |
| POST `/api/leave-bucket/apply` | `leaveBucketRoutes.js:20` (+ `applyLeave`) | none (UI uses `/request`) |
| GET `/api/leave-bucket/all` | `leaveBucketRoutes.js:35` (+ `getAllLeaves`) | none |
| POST `/api/leave-bucket/force-accrue` | `leaveBucketRoutes.js:57` (+ `forceAccrue`) | none (the monthly cron does accrual) |

Endpoints I am **not** removing even though nothing in the UI calls them are listed under **Unsure** (U2, U3).

### 4c. Controllers, services, templates
| File | Why it is dead |
|---|---|
| `controllers/adminController.js` | Never required (only mentioned in a comment in `authController.js`) |
| `controllers/prospectController.js` | Never required |
| `controllers/projectController.js` | Only required by `pmRoutes.js` (dead) |
| `controllers/emailCampaignController.js` | Only required by `emailCampaignRoutes.js` (dead) |
| `services/biometricAttendanceService.js` | Never required (the live sync is `cron/biometricSync.js` + `attendanceSyncService.js`) |
| `services/mssqlBiometricService.js` | Only used by the 4 MSSQL endpoints, so it depends on **U3** |

No template file is dead: `emailTemplates.js` is also used by `salesNotificationService`, and `welcomeEmail.js` by `adminRoutes`.

### 4d. Models (deleting a model file never touches the DB; no migration is written)
| Model | Evidence |
|---|---|
| `models/FeedSeparate.js` | No require and no string use. It also registers a second `'Feed'` model on the feed DB connection, which is confusing. |
| `models/POC.js` | No require, no `ref: 'POC'`, no populate. (The `'POC'` strings in `User.role` and `ticketController` are role names, not this model.) |
| `models/NoResponse.js` | Only required by `routes/prospects.js` (dead) |
| `models/shiftService.js` | A stale copy of `services/shiftService.js`. No file requires `models/shiftService`, while 4 live files require `services/shiftService`. |

Look-alikes resolved (all **kept**):
- `Feed` is the main project feed. `FeedStatus` is the live client feed-status DB. `FeedDynamic` is used by `feedStatusService`, which depends on U2. `FeedSeparate` is dead (above).
- `Lead` (Zoho-style Leads), `LeadGen` (Lead Generation and Feasibility) and `Prospect` are all live. `Prospect` is still read by admin, leadGen, organizations, salesManager and the productivity report.
- `customFieldSchema` is an embedded sub-schema used by `Deal`, `LeadActivity` and `Organization`. `LeadFieldSchema` is used by the live `/api/leads/fields*`. `ModuleField` is used by `/api/module-fields` and leadRoutes. All live.

### 4e. Crons
None is dead by the rules (all started, none disabled). `dripCampaignWorker` is effectively orphaned; see U1.

### 4f. Scripts (none are run by `server.js` or a `package.json` script)
- **Debug and one-off:** `check-biometric-employee-codes.js`, `check-dennis-attendance.js`, `check-github-token.js`, `check-repos.js`, `test.js`, `test_mssql.js`, `test-connection.js`, `test-leave-email.js`, `send-test-invite.js`, `hash.js`, `username_getter.js`, `manual-import-dennis.js`, `sync-dennis-fixed.js`, `force-accrue.js`, `create-github-repos-for-existing-projects.js`, `set-probation-for-existing.js`
- **Migrations and backfills that already ran:** `migrate-feasibility-status.js`, `migrate-feed-status.js`, `migrateLeaveBucket.js`, `initLeaveBuckets.js` (its header says "Run this once"), `scripts/Migrate_fix_rls.js`, `scripts/backfill-stoppedBySystem.js`, `scripts/backfillShiftsAndLate.js`, `scripts/fix-stoppedBySystem.mongo.js`. This empties `scripts/`.
- **Seeds to delete:** `seedcompletedtask.js`. It is not a seed: it is a one-off that **resets completion on every Feed** (`Feed.updateMany({}, {completed:false,…})`).
- **Seeds to keep:** `seedAdmin.js` (fresh install), `seedTicketRules.js` (default ticket routing), `seed/ticketCategoryDefaults.js` (loaded at runtime by `ticketCategoryRoutes`). `seedLeaveTypes.js` depends on U4.

---

## 5. Code to remove inside kept files

### Frontend
| File | Lines | What |
|---|---|---|
| `src/App.jsx` | 10, 14, 16, 17, 20, 23, 27, 42 | imports of Organizations, Prospects, ProjectDetailView, DeveloperBucket, PMTaskProgress, EmailTrigger, ClientDashboard, ClientFeedDetails |
| `src/App.jsx` | 453, 455, 464-468, 512, 549, 550, 597-601 | `<Route>`s for `/sales/add_org`, `/sales/prospects`, `/sales/email-trigger`, `/pm/task-progress`, `/developer/project/:id`, `/developer/bucket`, `/client/feeds/:feedId` |
| `src/components/Sidebar.jsx` | none | No sidebar entry points at a dead page. (`/hr/employees` points at a route that does not exist; that is a bug, left alone. See section 8.) |

**Optional (5b), your call:** ESLint reports **139 `no-unused-vars`** in files that are kept: unused imports, state and helpers left over from older versions, for example `App.jsx:173 socketConnected` and 19 in `ProjectFeedStatus.jsx`. Removing unused **imports and unused local declarations** does not change behaviour. I would leave unused `catch (err)` bindings and function parameters alone. Strike this if you'd rather keep step 5 to the App.jsx lines above.

### Backend
| File | What |
|---|---|
| `server.js` | `require` + `app.use` for prospects / pm / emailCampaign (lines 144, 146, 149, 419, 421, 424) |
| `routes/authRoutes.js` | `register` (both lines), `forgot-password`, `reset-password` routes and the matching names in the destructured import |
| `controllers/authController.js` | `register`, `forgotPassword`, `resetPassword` functions, plus the `nodemailer` import and `transporter` (only used by those). Export becomes `{ login }`. |
| `routes/adminRoutes.js` | line 22: unused `require('../controllers/authController')`, plus the handlers in 4b |
| `controllers/leaveController.js` | `getLeaveBalances`, `applyLeave`, `approveLeave`, `rejectLeave`, `adjustEmployeeBalance` (the last was never routed) |
| `controllers/leaveBucketController.js` | `getLeaveHistory`, `applyLeave`, `getAllLeaves`, `forceAccrue` |
| `controllers/holidayController.js` | `getUpcomingHolidays`, `checkHoliday` |
| `controllers/knowledgeBaseController.js` | `getFolders`, `deleteFile` |
| `controllers/ticketController.js` | `getProjects` (only used by the dead `/projects/list`) |
| `controllers/workDescriptionController.js` | `getTodayDescriptions` and its import in `workDescriptionRoutes.js` |
| `routes/hrRoutes.js` | handlers in 4b; `mssqlService` require (if U3 is approved); `LeaveType` require (if U4 is approved) |
| `routes/employeeRoutes.js` | handlers in 4b; `LeaveType` require (if U4 is approved). `MissedPunchRequest` stays because hrRoutes reads it. |
| other route files | the handler ranges listed in 4b |
| imports in kept files | any `require` left unused after the removals above (for example `multer` uploaders only used by removed ticket upload routes). I'll check each with a grep after removal. |

---

## 6. Dependencies to remove (after the deletions; via `npm uninstall`)

**Frontend:** `jspdf`, `jspdf-autotable`, `react-calendar`, `react-select-country-list`, `node-cron`, `nodemailer`. None of these is imported anywhere in `src/`, and the last two are server libraries.
- Keep, even though depcheck flags them: `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `autoprefixer` (used by `postcss.config.js` and `@import "tailwindcss"`) and `@types/react`, `@types/react-dom` (editor typings from the Vite template).
- `xlsx` stays: `ProjectManagement` and `TeamLeadProjects` use it.

**Backend:** `googleapis` (never required), `socket.io-client` (never required; the server uses `socket.io`), `xlsx` (only used by the dead `emailCampaignController`), `mssql` (only if U3 is approved).
- `nodemon` (devDependency) is not used by any script. I'll keep it unless you say otherwise, since you may run it by hand.

---

## 7. Unsure: needs your decision

| # | Item | Recommendation |
|---|---|---|
| **U1** | `cron/dripCampaignWorker.js` + `models/EmailCampaign.js`. The cron is started by `server.js`, so it is "live" by the rules. But the only way to create campaigns was the dead `EmailTrigger` page (`POST /api/email-campaign/upload`). After the page goes, the worker only sends old pending campaign steps, if any exist. | **Remove** the worker and model together with the EmailTrigger feature (and the `server.js` lines 17-23 that load it). Keep them if campaigns are still running in prod. |
| **U2** | `clientRoutes`: `POST /feeds/update`, `POST /feeds/status/notify`, `POST /feeds/:feedId/status`, `GET /feeds/status/:feedName`. No UI caller, but they take `feed_name`, `stage`, `record_count`, `output_path`, `error_message`, which looks like they are called by your scraper or feed pipeline to report progress (they write `FeedStatus` through `feedStatusService` and `FeedDynamic`). | **Keep** (external integration). |
| **U3** | MSSQL attendance: `POST /api/hr/biometric/mssql/sync`, `GET .../mssql/logs`, `.../mssql/employees`, `.../mssql/test` + `services/mssqlBiometricService.js` + `mssql` dependency. Your brief lists "MSSQL attendance" as a running service, but **nothing schedules it and no UI calls it**. The live biometric sync uses the HTTP device API (`biometricSync.js`, `attendanceSyncService.js`). | **Remove**, unless an outside tool calls these endpoints. |
| **U4** | Old leave system: `models/LeaveType.js`, `seedLeaveTypes.js`, `/api/hr/leave-types*`. `LeaveType` is only read by endpoints that are dead in 4b (old `/api/employee/leave/*`). The current leave system is `LeaveBucket`. Your brief named "leave types" as a seed to keep, so I'm asking. | **Remove** if leave-bucket fully replaced leave types; otherwise keep the model and seed. |
| **U5** | `pages/Prospects.jsx` (`/sales/prospects`). Not linked anywhere, but `SalesManagerDashboard` still shows "*N prospects waiting in the shared bucket*", and that bucket can only be worked from this page. It may be bookmarked. | **Delete** per the rules, or add it back to the sidebar if the prospect bucket is still in use. |
| **U6** | `POST /api/hr/attendance/sync-logs` (hrRoutes 114-309). No UI caller, but the code logs "*Received N logs from external script*" and has a comment saying Developer role must be allowed. | **Keep** (external script). |
| **U7** | URL-only pages that might be bookmarked: `/sales/add_org`, `/sales/email-trigger`, `/pm/task-progress`, `/developer/bucket`, `/developer/project/:id`, `/client/feeds/:feedId`. After removal they redirect to the user's landing page (`*` route), so they don't break. | **Delete.** |

---

## 8. Bugs and oddities noticed (not fixed)

1. **Sidebar `/hr/employees`** ("Employees" for Super Admin, Admin and HR) has **no route** in `App.jsx`, so clicking it redirects to the landing page.
2. **`DeveloperProjects.jsx:630`** calls `setItemsPerPage`, which is **not defined** (ESLint `no-undef`). It will throw a ReferenceError when that code runs.
3. Email links to frontend paths that don't exist: `holidayEmailTemplates.js` → `${frontendUrl}/holidays` (should probably be `/hr/holidays` or `/announcements`), and `leaveBalanceEmailTemplates.js:136` → `/employee/leave` (the route is `/employee`).
4. `Login.jsx` sends **HR** and **Finance** users to `/login` after login. It only works because `App` then redirects `/login` to the landing page when a token is present.
5. `/notifications` is opened from the user menu for every role, but its `allowedRoles` leaves out **Sales**, so Sales users get bounced to `/sales`.
6. `authRoutes.js` registers `POST /register` twice (lines 5 and 7). `forgotPassword` never sends the email (the `sendMail` call is commented out).
7. Cron log text disagrees with the schedule: autoStopWorklogs runs at `55 23` but logs "4:01 PM IST" and server.js says "11:55 PM". holidayReminder runs at `45 18` but logs "6:25 PM" and server.js says "6:00 PM".
8. The server logs "*running in production mode*" even when `NODE_ENV` is development.
9. Mongoose duplicate index warnings on `ShiftHistory.userId` and `Holiday.date`.
10. `ProjectFeedStatus.fetchFeeds` says "Determine which endpoint to use based on role" but always calls `/api/client/projects/:id/feeds`, so the `admin/` and `teamlead/` project-feeds endpoints became dead.
11. `KuiperLogo.jsx` imports `three`, which is not in `frontend/package.json`. It only works because it comes in as a dependency of `@react-three/*`.
12. `SalesDashboard.jsx:526` has a stale comment claiming `/api/dashboard-config` "is not mounted in server.js" (it is mounted at line 446).
13. Several routers (`/api/resource-analytics`, `/api/tickets`, `/api/hr`, `/api/employee`, `/api/leads`, `/api/ticket-categories`, …) are mounted without `protect` in `server.js` and apply auth inside the router instead. This is inconsistent; I did not audit every route for a missing guard.
14. The frontend production bundle is a single chunk of more than 1.6 MB (build warning).

---

## Phase 3 plan (after approval)
One commit per step; after each step I rerun the build, ESLint, `node --check` and a boot on a spare port, and revert the step if anything regresses.
1. Stray files, debug scripts, finished migrations and backfills, `seedcompletedtask.js` (`git rm`)
2. Unused frontend assets
3. Dead pages + their `App.jsx` imports and routes
4. Orphaned components and data
5. Leftover code in kept frontend files (+ 5b if approved)
6. Dead backend routes (+ `server.js` mounts), controllers, services, dead handlers
7. Dead models (+ U1, U3, U4 per your answers)
8. Leftover code in kept backend files
9. `npm uninstall` of unused dependencies

---

## Appendix A: Baseline frontend routes (`App.jsx`)

`/login` is public. `/*` is the authenticated layout (Sidebar + nested routes). "(any logged-in)" means there is no `allowedRoles`.

| Path | Component | Allowed roles |
|---|---|---|
| `/` | (redirect to landing) | (any logged-in) |
| `/admin` | AdminDashboard | Super Admin, Admin |
| `/admin/ticket-rules` | TicketAssignmentRules | Super Admin, Admin |
| `/admin/ticket-categories` | TicketCategoriesManager | Super Admin, Admin |
| `/admin/project-clients` | AdminProjectClients | Super Admin, Admin |
| `/admin/customize` | CustomizeModules | Super Admin, Admin, Sales, Sales Manager |
| `/sales-manager` | SalesManagerDashboard | Super Admin, Sales Manager |
| `/sales` | SalesDashboard | Super Admin, Sales, Admin, Sales Manager |
| `/sales/leads` | Leads | (any logged-in) |
| `/sales/add_org` | Organizations | Super Admin, Sales, Admin, Sales Manager |
| `/sales/lead_generation` | LeadGeneration | Super Admin, Sales, Admin, Sales Manager |
| `/sales/prospects` | Prospects | Super Admin, Sales, Admin, Sales Manager |
| `/sales/accounts` | Accounts | (any logged-in) |
| `/sales/deals` | Deals | (any logged-in) |
| `/sales/accounts/new` | CreateAccount | (any logged-in) |
| `/sales/contacts` | Contacts | (any logged-in) |
| `/sales/accounts/:id` | AccountDetail | Super Admin, Sales, Admin, Sales Manager |
| `/sales/contacts/:accountId/:pocId` | ContactDetail | Super Admin, Sales, Admin, Sales Manager |
| `/sales/deals/:id` | DealDetail | Super Admin, Sales, Admin, Sales Manager |
| `/sales/email-trigger` | EmailTrigger | Super Admin, Sales, Admin, Sales Manager |
| `/sales/activities/tasks` | ActivitiesTasks | Super Admin, Sales, Admin, Sales Manager |
| `/sales/activities/meetings` | ActivitiesMeetings | Super Admin, Sales, Admin, Sales Manager |
| `/sales/activity/:id` | ActivityDetail | Super Admin, Sales, Admin, Sales Manager |
| `/sales/activities/calls` | ActivitiesCalls | Super Admin, Sales, Admin, Sales Manager |
| `/pm/dashboard` | PmDashboard | Super Admin, Admin, Project Manager |
| `/admin/projects` | ProjectManagement | Super Admin, Admin, Project Manager |
| `/admin/users` | UserManagement | Super Admin, Admin, Project Manager, Sales Manager, HR |
| `/pm/feeds` | ProjectFeeds | Super Admin, Admin, Project Manager |
| `/pm/task-progress` | PMTaskProgress | Super Admin, Admin, Project Manager |
| `/pm/resource-analytics` | ResourceAnalytics | Super Admin, Admin, Project Manager |
| `/pm/git-manager` | GitManager | Super Admin, Admin, Project Manager |
| `/pm/feed-status` | FeedDeliveryDashboard | Super Admin, Admin, Project Manager |
| `/pm/projects/:projectId/feeds` | ProjectFeedStatus | Super Admin, Admin, Project Manager |
| `/pm/work-report` | WorkReport | Super Admin, Admin, Project Manager |
| `/pm/feasibility` | PmFeasibilityDashboard | Super Admin, Project Manager |
| `/developer` | DeveloperDashboard | Super Admin, Admin, Developer |
| `/developer/project/:id` | ProjectDetailView | Super Admin, Admin, Developer |
| `/developer/bucket` | DeveloperBucket | Super Admin, Admin, Developer |
| `/developer/worklog` | Worklog | Super Admin, Developer, Admin |
| `/developer/git-feeds` | DeveloperGitFeeds | Super Admin, Admin, Developer |
| `/developer/projects` | DeveloperProjects | Super Admin, Admin, Developer |
| `/developer/feeds` | DeveloperFeeds | Super Admin, Admin, Developer |
| `/developer/feed-status` | FeedDeliveryDashboard | Super Admin, Admin, Developer |
| `/developer/projects/:projectId/feeds` | ProjectFeedStatus | Super Admin, Admin, Developer |
| `/teamlead` | TeamLeadDashboard | Super Admin, Team Lead |
| `/teamlead/projects` | TeamLeadProjects | Super Admin, Team Lead |
| `/teamlead/developers` | TeamLeadDevelopers | Super Admin, Team Lead |
| `/teamlead/feeds` | TeamLeadFeeds | Super Admin, Team Lead |
| `/teamlead/feed-status` | FeedDeliveryDashboard | Super Admin, Team Lead |
| `/teamlead/projects/:projectId/feeds` | ProjectFeedStatus | Super Admin, Team Lead |
| `/client` | FeedDeliveryDashboard | Super Admin, Admin, Client |
| `/client/projects/:projectId/feeds` | ProjectFeedStatus | Super Admin, Admin, Client |
| `/client/feeds/:feedId` | ClientFeedDetails | Super Admin, Admin, Client |
| `/tickets` | TicketDashboard | Super Admin, Admin, Project Manager, Developer, Team Lead, Client, HR, Finance, Sales, Sales Manager |
| `/tickets/create` | CreateTicket | Super Admin, Client, Admin, Project Manager, Developer, Team Lead, HR, Finance, Sales, Sales Manager |
| `/tickets/:id` | TicketDetails | Super Admin, Admin, Project Manager, Developer, Team Lead, Client, HR, Finance, Sales, Sales Manager |
| `/hr` | HrDashboard | Super Admin, Admin, HR |
| `/hr/leaves` | HrLeaveDashboard | Super Admin, Admin, HR |
| `/employee` | EmployeeDashboard | Super Admin, Admin, Developer, Team Lead, Sales,Sales Manager, Project Manager, Client, Finance |
| `/view_analytics` | ViewAnalytics | Super Admin, Admin, Sales, Project Manager, Sales Manager, Team Lead |
| `/profile` | Profile | (any logged-in) |
| `/notifications` | NotificationSettings | Super Admin, Admin, Project Manager, Developer, Client, HR, Finance,Sales Manager,Team Lead |
| `/knowledge` | KnowledgeBase | Super Admin, Admin, Project Manager, Developer, Team Lead, HR, Finance,Sales,Sales Manager |
| `/hr/attendance-sync` | AttendanceSync | Super Admin, Admin, HR |
| `/feasibility` | FeasibilityDashboard | Super Admin, Admin, Project Manager, Sales |
| `/hr/employee-attendance` | EmployeeAttendanceDetail | Super Admin, Admin, HR |
| `/hr/employee-attendance-report` | EmployeeAttendanceReport | Super Admin, Admin, HR |
| `/announcements` | Announcements | Super Admin, Admin, Project Manager, Developer, Team Lead, Sales, Sales Manager, HR, Finance |
| `/hr/holidays` | HolidayList | Super Admin, Admin, HR |
| `*` | (redirect) | (any logged-in) |

## Appendix B: Baseline sidebar links per role (`Sidebar.jsx` `buildMenuGroups`)

- **Super Admin:** `/admin`, `/view_analytics` · Sales: `/sales/leads`, `/sales/contacts`, `/sales/accounts`, `/sales/deals`, `/sales-manager` · Activities: `/sales/activities/tasks`, `/sales/activities/meetings`, `/sales/activities/calls` · Projects & Feeds: `/admin/projects`, `/admin/project-clients`, `/pm/feeds`, `/pm/feed-status`, `/pm/resource-analytics`, `/pm/work-report` · Feasibility: `/feasibility`, `/pm/feasibility` · HR: `/hr`, `/hr/employees`*, `/hr/holidays`, `/hr/leaves`, `/hr/attendance-sync`, `/hr/employee-attendance`, `/hr/employee-attendance-report` · General: `/tickets`, `/announcements`, `/knowledge`, `/admin/ticket-rules`, `/admin/ticket-categories` · Developer: `/developer`, `/developer/worklog`, `/developer/projects`, `/developer/feeds`, `/developer/git-feeds` · Project Manager: `/pm/dashboard`, `/pm/git-manager` · Setup: `/admin/customize` · Attendence: `/employee`
- **Admin:** `/admin`, `/view_analytics` · Sales (4) · Activities (3) · Projects: `/admin/projects`, `/admin/users`, `/admin/project-clients`, `/pm/feeds`, `/pm/resource-analytics`, `/pm/work-report` · General: `/tickets`, `/announcements`, `/knowledge` · HR: `/hr`, `/hr/employees`*, `/hr/holidays`, `/hr/attendance-sync`, `/admin/ticket-rules`, `/admin/ticket-categories` · Setup: `/admin/customize` · `/employee`
- **Sales Manager:** `/sales-manager` · Sales (4) · Activities (3) · Team: `/admin/users` · General (3) · Setup: `/admin/customize` · `/employee`
- **Sales:** `/sales` · Sales (4) · Activities (3) · `/feasibility` · General (3) · Setup: `/admin/customize` · `/employee`
- **Project Manager:** `/pm/dashboard` · `/admin/projects`, `/pm/feeds`, `/pm/feed-status`, `/pm/work-report`, `/pm/resource-analytics`, `/pm/feasibility`, `/pm/git-manager` · Activities: `/tickets`, `/announcements`, `/knowledge` · `/employee`
- **Team Lead:** `/teamlead` · `/teamlead/projects`, `/teamlead/feeds`, `/teamlead/feed-status`, `/teamlead/developers` · `/tickets`, `/announcements`, `/knowledge` · `/employee`
- **Developer:** `/developer` · `/developer/worklog`, `/developer/projects`, `/developer/feeds`, `/developer/git-feeds`, `/developer/feed-status` · `/tickets`, `/announcements`, `/knowledge` · `/employee`
- **Client:** `/client`, `/tickets`
- **HR:** `/hr` · `/hr/employees`*, `/admin/users`, `/hr/holidays`, `/hr/leaves`, `/hr/employee-attendance`, `/hr/employee-attendance-report`, `/hr/attendance-sync` · `/tickets`, `/announcements`, `/knowledge`
- **Finance:** `/tickets`, `/announcements`, `/knowledge` · `/employee`
- **User menu (all roles):** `/profile`, `/notifications`, logout

\* No matching route (bug 1).

## Appendix C: Baseline background jobs
See the table in section 1 (9 crons loaded at the top of `server.js` + `SalesNotificationService` started after `listen`).

## Appendix D: Baseline mounted API routes (327, method + full path, file:line)

<details><summary>Show all 327</summary>

- `POST /api/auth/register` — authRoutes:5
- `POST /api/auth/register` — authRoutes:7
- `POST /api/auth/login` — authRoutes:8
- `POST /api/auth/forgot-password` — authRoutes:9
- `POST /api/auth/reset-password` — authRoutes:10
- `GET /api/admin/users` — adminRoutes:66
- `GET /api/admin/users/by-role/:role` — adminRoutes:106
- `POST /api/admin/change-password` — adminRoutes:135
- `POST /api/admin/users` — adminRoutes:161
- `PUT /api/admin/users/:id` — adminRoutes:358
- `PATCH /api/admin/users/:id/access` — adminRoutes:471
- `DELETE /api/admin/users/:id` — adminRoutes:548
- `POST /api/admin/fix-probation` — adminRoutes:593
- `POST /api/admin/users/:userId/link-github` — adminRoutes:654
- `GET /api/admin/analytics` — adminRoutes:809
- `GET /api/admin/client-projects` — adminRoutes:849
- `GET /api/admin/projects` — adminRoutes:921
- `POST /api/admin/projects` — adminRoutes:1003
- `PATCH /api/admin/projects/:id/status` — adminRoutes:1110
- `PUT /api/admin/projects/:id` — adminRoutes:1153
- `DELETE /api/admin/projects/:id` — adminRoutes:1163
- `GET /api/admin/organizations` — adminRoutes:1180
- `GET /api/admin/projects/:id/invite-link` — adminRoutes:1197
- `POST /api/admin/projects/:id/bulk-invite` — adminRoutes:1226
- `POST /api/admin/projects/:id/add-collaborator` — adminRoutes:1289
- `GET /api/admin/projects/:id/collaborators` — adminRoutes:1323
- `DELETE /api/admin/projects/:id/remove-collaborator` — adminRoutes:1344
- `GET /api/admin/projects/:id/repo-contents` — adminRoutes:1372
- `POST /api/admin/feeds` — adminRoutes:1392
- `PUT /api/admin/feeds/:id` — adminRoutes:1565
- `DELETE /api/admin/feeds/:id` — adminRoutes:1598
- `PATCH /api/admin/feeds/:id/status` — adminRoutes:1612
- `POST /api/admin/tasks/create` — adminRoutes:1635
- `POST /api/admin/feeds/push-task` — adminRoutes:1651
- `GET /api/admin/pm/task-progress` — adminRoutes:1682
- `GET /api/admin/users/clients` — adminRoutes:1716
- `GET /api/admin/users/developers` — adminRoutes:1725
- `GET /api/admin/users/project-managers` — adminRoutes:1735
- `GET /api/admin/project-status-options` — adminRoutes:1746
- `GET /api/admin/feed-status-options` — adminRoutes:1754
- `GET /api/admin/client/projects` — adminRoutes:1764
- `GET /api/admin/projects/:projectId/feeds` — adminRoutes:1807
- `POST /api/admin/projects/:projectId/assign-teamlead` — adminRoutes:1860
- `GET /api/admin/teamleads` — adminRoutes:1901
- `GET /api/admin/projects/teamlead/:teamLeadId` — adminRoutes:1914
- `GET /api/admin/users/teamleads` — adminRoutes:1930
- `GET /api/admin/projects/teamlead` — adminRoutes:1941
- `POST /api/admin/upload-profile-image` — adminRoutes:2002
- `DELETE /api/admin/remove-profile-image` — adminRoutes:2056
- `GET /api/admin/projects/:id/repo-folder-last-updated` — adminRoutes:2083
- `POST /api/admin/feeds/bulk` — adminRoutes:2144
- `PATCH /api/admin/users/:userId/leave-balance` — adminRoutes:2253
- `GET /api/admin/users/:userId/leave-history` — adminRoutes:2389
- `POST /api/admin/projects/:id/sync-git-dates` — adminRoutes:2426
- `POST /api/orgs` — organizationRoutes:9
- `GET /api/orgs/client/me` — organizationRoutes:115
- `GET /api/orgs` — organizationRoutes:136
- `GET /api/orgs/check-existing` — organizationRoutes:153
- `GET /api/orgs/:id/detail` — organizationRoutes:205
- `PATCH /api/orgs/:id` — organizationRoutes:219
- `PATCH /api/orgs/:id/pocs/:pocId` — organizationRoutes:269
- `GET /api/orgs/:id` — organizationRoutes:320
- `PUT /api/orgs/:id` — organizationRoutes:344
- `DELETE /api/orgs/:id` — organizationRoutes:395
- `POST /api/orgs/check-duplicate` — organizationRoutes:428
- `POST /api/orgs/:id/add-poc` — organizationRoutes:451
- `PUT /api/orgs/:id/poc/:pocIndex` — organizationRoutes:512
- `DELETE /api/orgs/:id/poc/:pocIndex` — organizationRoutes:568
- `GET /api/orgs/:id/pocs` — organizationRoutes:621
- `GET /api/orgs/stats/summary` — organizationRoutes:643
- `GET /api/lead-generation` — leadGenRoutes:112
- `POST /api/lead-generation` — leadGenRoutes:227
- `PATCH /api/lead-generation/:id/action` — leadGenRoutes:419
- `GET /api/lead-generation/download/:leadId` — leadGenRoutes:667
- `GET /api/lead-generation/pm/feasibility` — leadGenRoutes:712
- `GET /api/lead-generation/feasibility/:leadId` — leadGenRoutes:735
- `PATCH /api/lead-generation/:id/comment` — leadGenRoutes:810
- `POST /api/prospects/fetch-bucket` — prospects:16
- `GET /api/prospects/bucket-count` — prospects:51
- `PUT /api/prospects/:id` — prospects:68
- `PUT /api/prospects/approach/:id` — prospects:96
- `POST /api/prospects/close/:id` — prospects:186
- `POST /api/prospects/bulk-import` — prospects:227
- `GET /api/prospects` — prospects:320
- `POST /api/prospects` — prospects:351
- `DELETE /api/prospects/:id` — prospects:384
- `DELETE /api/prospects/clear/all` — prospects:409
- `GET /api/dev/system-time-check` — developer:30
- `GET /api/dev/my-projects` — developer:53
- `GET /api/dev/my-feeds` — developer:79
- `GET /api/dev/dashboard/overview` — developer:144
- `GET /api/dev/feeds/:feedId/generate-script` — developer:326
- `POST /api/dev/complete-feed` — developer:583
- `PATCH /api/dev/feeds/:id/status` — developer:656
- `PATCH /api/dev/tasks/:taskId` — developer:698
- `GET /api/dev/my-bucket` — developer:742
- `GET /api/dev/worklog` — developer:768
- `POST /api/dev/worklog/start/:feedId` — developer:826
- `POST /api/dev/worklog/pause/:feedId` — developer:871
- `POST /api/dev/worklog/stop/:feedId` — developer:919
- `POST /api/dev/worklog/log-description` — developer:970
- `GET /api/dev/worklog/today-descriptions` — developer:1024
- `GET /api/dev/ticket-worklog` — developer:1110
- `POST /api/dev/ticket-worklog/start/:ticketId` — developer:1234
- `POST /api/dev/ticket-worklog/pause/:ticketId` — developer:1318
- `POST /api/dev/ticket-worklog/stop/:ticketId` — developer:1376
- `POST /api/dev/ticket-worklog/description` — developer:1433
- `GET /api/dev/worklog/history` — developer:1495
- `GET /api/pm/projects` — pmRoutes:20
- `POST /api/pm/projects` — pmRoutes:21
- `POST /api/pm/users` — pmRoutes:24
- `POST /api/pm/users/:userId/link-github` — pmRoutes:127
- `POST /api/pm/projects/:projectId/assign-teamlead` — pmRoutes:168
- `GET /api/pm/teamleads` — pmRoutes:201
- `POST /api/dev/worklog/log-description` — workDescriptionRoutes:16
- `GET /api/dev/worklog/today` — workDescriptionRoutes:27
- `GET /api/resource-analytics` — resourceAnalyticsRoutes:18
- `POST /api/email-campaign/upload` — emailCampaignRoutes:21
- `POST /api/tickets/upload-file` — ticketRoutes:205
- `POST /api/tickets/upload-files` — ticketRoutes:319
- `DELETE /api/tickets/delete-file` — ticketRoutes:393
- `POST /api/tickets/upload-image` — ticketRoutes:411
- `DELETE /api/tickets/delete-image` — ticketRoutes:443
- `GET /api/tickets/download/:filename` — ticketRoutes:463
- `GET /api/tickets/department-users/:role` — ticketRoutes:522
- `POST /api/tickets` — ticketRoutes:540
- `GET /api/tickets` — ticketRoutes:543
- `GET /api/tickets/:id` — ticketRoutes:546
- `PATCH /api/tickets/:id/status` — ticketRoutes:553
- `PATCH /api/tickets/:id/assign` — ticketRoutes:556
- `POST /api/tickets/:id/comments` — ticketRoutes:559
- `GET /api/tickets/projects/list` — ticketRoutes:566
- `GET /api/tickets/feeds/:projectId` — ticketRoutes:568
- `GET /api/tickets/developers/list` — ticketRoutes:588
- `GET /api/tickets/users/watchers` — ticketRoutes:595
- `GET /api/tickets/:id/watchers` — ticketRoutes:598
- `POST /api/tickets/:id/watchers` — ticketRoutes:601
- `DELETE /api/tickets/:id/watchers/:userId` — ticketRoutes:604
- `GET /api/ticket-categories` — ticketCategoryRoutes:62
- `POST /api/ticket-categories` — ticketCategoryRoutes:84
- `PUT /api/ticket-categories/:id` — ticketCategoryRoutes:101
- `DELETE /api/ticket-categories/:id` — ticketCategoryRoutes:118
- `POST /api/ticket-categories/restore-defaults` — ticketCategoryRoutes:130
- `GET /api/comments/projects/:projectId/comments` — commentRoutes:17
- `POST /api/comments/projects/:projectId/comments` — commentRoutes:44
- `DELETE /api/comments/projects/:projectId/comments/:commentId` — commentRoutes:102
- `GET /api/comments/feeds/:feedId/comments` — commentRoutes:141
- `POST /api/comments/feeds/:feedId/comments` — commentRoutes:166
- `DELETE /api/comments/feeds/:feedId/comments/:commentId` — commentRoutes:224
- `GET /api/teamlead/my-projects` — teamLeadRoutes:21
- `GET /api/teamlead/projects/:id` — teamLeadRoutes:47
- `PATCH /api/teamlead/feeds/:feedId/assign-developers` — teamLeadRoutes:79
- `GET /api/teamlead/projects/:projectId/feeds` — teamLeadRoutes:171
- `GET /api/teamlead/developers` — teamLeadRoutes:195
- `GET /api/teamlead/my-tickets` — teamLeadRoutes:209
- `POST /api/teamlead/tickets` — teamLeadRoutes:236
- `PATCH /api/teamlead/tickets/:id/status` — teamLeadRoutes:314
- `POST /api/teamlead/tickets/:id/comments` — teamLeadRoutes:368
- `GET /api/teamlead/stats` — teamLeadRoutes:425
- `GET /api/admin/ticket-rules` — ticketAssignmentRoutes:9
- `POST /api/admin/ticket-rules` — ticketAssignmentRoutes:19
- `PUT /api/admin/ticket-rules/:id` — ticketAssignmentRoutes:49
- `DELETE /api/admin/ticket-rules/:id` — ticketAssignmentRoutes:86
- `GET /api/notifications/count` — notificationRoutes:15
- `GET /api/notifications` — notificationRoutes:79
- `PATCH /api/notifications/:notificationId/read` — notificationRoutes:245
- `PATCH /api/notifications/mark-all-read` — notificationRoutes:323
- `GET /api/notifications/unread-count` — notificationRoutes:388
- `POST /api/notifications/test-reminder` — notificationRoutes:436
- `GET /api/client/projects` — clientRoutes:15
- `GET /api/client/projects/:projectId/feeds` — clientRoutes:80
- `GET /api/client/feeds/status/:feedName` — clientRoutes:223
- `POST /api/client/feeds/update` — clientRoutes:275
- `GET /api/client/feeds/:feedId` — clientRoutes:436
- `POST /api/client/feeds/:feedId/status` — clientRoutes:512
- `POST /api/client/feeds/status/notify` — clientRoutes:578
- `GET /api/client/debug/feedstatus` — clientRoutes:651
- `GET /api/knowledge` — knowledgeBaseRoutes:47
- `GET /api/knowledge/:id` — knowledgeBaseRoutes:50
- `GET /api/knowledge/folders/list` — knowledgeBaseRoutes:53
- `GET /api/knowledge/:entryId/download/:fileIndex` — knowledgeBaseRoutes:56
- `POST /api/knowledge` — knowledgeBaseRoutes:63
- `PUT /api/knowledge/:id` — knowledgeBaseRoutes:72
- `DELETE /api/knowledge/:id` — knowledgeBaseRoutes:81
- `DELETE /api/knowledge/:entryId/file/:fileIndex` — knowledgeBaseRoutes:89
- `POST /api/hr/attendance/sync-logs` — hrRoutes:114
- `GET /api/hr/attendance/today-status` — hrRoutes:316
- `GET /api/hr/leave/pending` — hrRoutes:436
- `GET /api/hr/leave/all` — hrRoutes:450
- `PATCH /api/hr/leave/:id/approve` — hrRoutes:475
- `PATCH /api/hr/leave/:id/reject` — hrRoutes:587
- `GET /api/hr/attendance/corrections` — hrRoutes:640
- `PATCH /api/hr/attendance/correction/:id` — hrRoutes:654
- `POST /api/hr/attendance/manual-punch` — hrRoutes:764
- `POST /api/hr/attendance/sync` — hrRoutes:817
- `POST /api/hr/attendance/sync-progress` — hrRoutes:851
- `GET /api/hr/attendance/employee/:employeeCode` — hrRoutes:875
- `GET /api/hr/attendance/employee-codes` — hrRoutes:1055
- `POST /api/hr/attendance/test-connection` — hrRoutes:1081
- `GET /api/hr/attendance/device-codes` — hrRoutes:1106
- `GET /api/hr/dashboard/stats` — hrRoutes:1134
- `GET /api/hr/leave-types` — hrRoutes:1253
- `POST /api/hr/leave-types` — hrRoutes:1263
- `PUT /api/hr/leave-types/:id` — hrRoutes:1293
- `DELETE /api/hr/leave-types/:id` — hrRoutes:1327
- `PATCH /api/hr/employee/:id/leave-balance` — hrRoutes:1348
- `GET /api/hr/employee/:id/leave-balance` — hrRoutes:1379
- `POST /api/hr/biometric/manual-sync` — hrRoutes:1412
- `GET /api/hr/attendance/employee-timeline/:userId` — hrRoutes:1427
- `GET /api/hr/attendance/employee-report` — hrRoutes:1588
- `GET /api/hr/employees` — hrRoutes:1865
- `POST /api/hr/biometric/mssql/sync` — hrRoutes:1884
- `GET /api/hr/biometric/mssql/logs` — hrRoutes:1901
- `GET /api/hr/biometric/mssql/employees` — hrRoutes:1923
- `GET /api/hr/biometric/mssql/test` — hrRoutes:1940
- `GET /api/hr/employees/probation` — hrRoutes:1954
- `PATCH /api/hr/employees/:id/probation` — hrRoutes:1976
- `POST /api/hr/employees/:id/complete-probation` — hrRoutes:2024
- `GET /api/employee/attendance/today` — employeeRoutes:97
- `GET /api/employee/attendance/monthly-stats` — employeeRoutes:178
- `GET /api/employee/attendance/timeline` — employeeRoutes:347
- `GET /api/employee/attendance/debug` — employeeRoutes:563
- `POST /api/employee/leave/apply` — employeeRoutes:615
- `GET /api/employee/leave/history` — employeeRoutes:705
- `GET /api/employee/leave/balance` — employeeRoutes:743
- `POST /api/employee/timesheet/missed-punch` — employeeRoutes:792
- `GET /api/employee/profile` — employeeRoutes:846
- `PUT /api/employee/profile` — employeeRoutes:888
- `GET /api/employee/team-culture` — employeeRoutes:985
- `POST /api/announcements/upload-image` — announcementRoutes:80
- `GET /api/announcements/unviewed/count` — announcementRoutes:106
- `POST /api/announcements/:id/viewed` — announcementRoutes:124
- `GET /api/announcements` — announcementRoutes:180
- `GET /api/announcements/:id` — announcementRoutes:183
- `POST /api/announcements` — announcementRoutes:186
- `POST /api/announcements/:id/like` — announcementRoutes:189
- `POST /api/announcements/:id/comments` — announcementRoutes:192
- `DELETE /api/announcements/:announcementId/comments/:commentId` — announcementRoutes:195
- `DELETE /api/announcements/:id` — announcementRoutes:198
- `GET /api/holidays` — holidayRoutes:14
- `GET /api/holidays/:id` — holidayRoutes:17
- `GET /api/holidays/upcoming` — holidayRoutes:20
- `GET /api/holidays/check` — holidayRoutes:23
- `POST /api/holidays` — holidayRoutes:28
- `PUT /api/holidays/:id` — holidayRoutes:29
- `DELETE /api/holidays/:id` — holidayRoutes:30
- `GET /api/work-report/developers` — workReportRoutes:437
- `GET /api/work-report` — workReportRoutes:478
- `GET /api/leads/fields` — leadRoutes:187
- `POST /api/leads/fields` — leadRoutes:197
- `DELETE /api/leads/fields/:fieldKey` — leadRoutes:227
- `POST /api/leads/fields/seed` — leadRoutes:241
- `POST /api/leads/fields/:fieldKey/options` — leadRoutes:255
- `PATCH /api/leads/fields/:fieldKey/options` — leadRoutes:280
- `DELETE /api/leads/fields/:fieldKey/options/:value` — leadRoutes:320
- `GET /api/leads/filters` — leadRoutes:374
- `GET /api/leads` — leadRoutes:478
- `GET /api/leads/:id` — leadRoutes:507
- `POST /api/leads` — leadRoutes:521
- `PUT /api/leads/:id` — leadRoutes:608
- `DELETE /api/leads/:id` — leadRoutes:690
- `GET /api/lead-activities` — leadActivityRoutes:63
- `GET /api/lead-activities/:id` — leadActivityRoutes:104
- `POST /api/lead-activities` — leadActivityRoutes:136
- `PATCH /api/lead-activities/:id` — leadActivityRoutes:235
- `POST /api/lead-activities/:id/remind` — leadActivityRoutes:326
- `DELETE /api/lead-activities/:id` — leadActivityRoutes:344
- `GET /api/sales-manager/overview` — salesManagerRoutes:46
- `GET /api/deals` — dealRoutes:53
- `GET /api/deals/:id` — dealRoutes:79
- `POST /api/deals/convert/:leadId` — dealRoutes:97
- `PUT /api/deals/:id` — dealRoutes:252
- `DELETE /api/deals/:id` — dealRoutes:278
- `GET /api/leads/fields` — leadRoutes:187
- `POST /api/leads/fields` — leadRoutes:197
- `DELETE /api/leads/fields/:fieldKey` — leadRoutes:227
- `POST /api/leads/fields/seed` — leadRoutes:241
- `POST /api/leads/fields/:fieldKey/options` — leadRoutes:255
- `PATCH /api/leads/fields/:fieldKey/options` — leadRoutes:280
- `DELETE /api/leads/fields/:fieldKey/options/:value` — leadRoutes:320
- `GET /api/leads/filters` — leadRoutes:374
- `GET /api/leads` — leadRoutes:478
- `GET /api/leads/:id` — leadRoutes:507
- `POST /api/leads` — leadRoutes:521
- `PUT /api/leads/:id` — leadRoutes:608
- `DELETE /api/leads/:id` — leadRoutes:690
- `GET /api/tags` — tagRoutes:60
- `POST /api/tags` — tagRoutes:77
- `POST /api/tags/assign` — tagRoutes:92
- `PATCH /api/tags/:id` — tagRoutes:154
- `DELETE /api/tags/:id` — tagRoutes:182
- `GET /api/task-stages` — taskStageRoutes:46
- `POST /api/task-stages` — taskStageRoutes:66
- `PATCH /api/task-stages/:id` — taskStageRoutes:88
- `DELETE /api/task-stages/:id` — taskStageRoutes:121
- `GET /api/deal-stages` — dealStageRoutes:60
- `POST /api/deal-stages` — dealStageRoutes:82
- `PATCH /api/deal-stages/:id` — dealStageRoutes:107
- `DELETE /api/deal-stages/:id` — dealStageRoutes:147
- `GET /api/module-fields/:moduleName` — moduleFieldRoutes:16
- `POST /api/module-fields/:moduleName` — moduleFieldRoutes:27
- `DELETE /api/module-fields/:id` — moduleFieldRoutes:57
- `GET /api/dashboard-config/:dashboard` — dashboardConfigRoutes:30
- `PUT /api/dashboard-config/:dashboard` — dashboardConfigRoutes:42
- `DELETE /api/dashboard-config/:dashboard` — dashboardConfigRoutes:69
- `GET /api/leaves/balance` — leaveRoutes:15
- `GET /api/leaves/history` — leaveRoutes:18
- `POST /api/leaves/apply` — leaveRoutes:21
- `GET /api/leaves/pending` — leaveRoutes:29
- `GET /api/leaves/all` — leaveRoutes:32
- `PATCH /api/leaves/:id/approve` — leaveRoutes:35
- `PATCH /api/leaves/:id/reject` — leaveRoutes:38
- `GET /api/leave-bucket/bucket/summary` — leaveBucketRoutes:14
- `GET /api/leave-bucket/history` — leaveBucketRoutes:17
- `POST /api/leave-bucket/apply` — leaveBucketRoutes:20
- `POST /api/leave-bucket/request/preview` — leaveBucketRoutes:23
- `POST /api/leave-bucket/request` — leaveBucketRoutes:24
- `GET /api/leave-bucket/pending` — leaveBucketRoutes:32
- `GET /api/leave-bucket/all` — leaveBucketRoutes:35
- `GET /api/leave-bucket/employee/:userId/summary` — leaveBucketRoutes:38
- `GET /api/leave-bucket/employees/buckets` — leaveBucketRoutes:41
- `PATCH /api/leave-bucket/employee/:userId/adjust` — leaveBucketRoutes:44
- `PATCH /api/leave-bucket/group/:groupId/approve` — leaveBucketRoutes:47
- `PATCH /api/leave-bucket/group/:groupId/reject` — leaveBucketRoutes:48
- `PATCH /api/leave-bucket/:id/approve` — leaveBucketRoutes:51
- `PATCH /api/leave-bucket/:id/reject` — leaveBucketRoutes:54
- `POST /api/leave-bucket/force-accrue` — leaveBucketRoutes:57

</details>

---

# Results (Phase 3 + 4)

Approved "as recommended": U1 remove, U2 keep, U3 remove, U4 remove, U5 delete, U6 keep, U7 delete, and 5b included.

## Commits on `cleanup/current-only` (not merged, not pushed)
| Commit | Step |
|---|---|
| `9695063` | 1: stray files, debug scripts, finished migrations, `seedcompletedtask.js` (+ this report) |
| `af18083` | 2: unused frontend assets |
| `6decb86` | 3: 9 unreachable pages + their 7 `App.jsx` routes and 8 imports |
| `7ec94ec` | 4: 10 orphaned components and data files |
| `79a061f` | 5 + 5b: leftover dead code in kept frontend files |
| `94c4cc7` | 6: dead routers, ~80 dead endpoints, dead controllers and services (incl. MSSQL, U3) |
| `f2de565` | 7: dead models + drip-campaign cron (U1) + LeaveType/seed (U4) |
| `9f0bfa3` | 8: leftover dead controller functions, helpers, requires in kept backend files |
| `02d287d` | 8b: service export keys whose only consumers were removed |
| `68cb822` | 9: `npm uninstall` of unused dependencies (lockfiles regenerated by npm) |
| `440db4b` | 5-fix: restore `motion` import in `Login.jsx` / `Profile.jsx` (regression found in the click-through) |

Each step was checked (build, ESLint, `node --check` on every backend file, boot on port 5099) before committing. No step needed to be reverted.

## Size
`git diff --stat main...cleanup/current-only` (excluding this report): **131 files changed, 18 insertions(+), 21,086 deletions(-)**. The 18 insertions are lines edited in place: import lists trimmed, `module.exports` lists, and `package.json`. 73 files deleted.

## Dependencies removed
- **backend:** `googleapis`, `mssql`, `nodemailer`, `socket.io-client`, `xlsx`. `nodemailer` and `xlsx` only became unused after the removals: the mail transporters belonged to the removed register/forgot-password and PM user-invite code, and `xlsx` was only used by the email-campaign upload.
- **frontend:** `jspdf`, `jspdf-autotable`, `react-calendar`, `react-select-country-list`, `node-cron`, `nodemailer`
- Kept: `nodemon` (dev), the Tailwind/PostCSS toolchain, `@types/*`

## How step 5/5b was done
An AST-based script (espree, already installed) removed only: unused imports, unused `const`/function declarations with no side effects, and `useState` pairs whose value and setter were both unused. It ran repeatedly until nothing new turned up. It then removed the uppercase constants and icon imports that only the removed code used (your ESLint config ignores `^[A-Z_]` names), plus the one-line comments and empty section headers left behind. Catch parameters, function parameters, hook calls other than `useState`, and assignments with side effects were left alone.

One case was caught and reverted: `let hasError` in `TicketDetails.jsx` is assigned later but never read. Removing it would have made `hasError = true` throw at runtime. ESLint `no-undef` caught it.

## Check results vs baseline
| Check | Baseline (main) | Now |
|---|---|---|
| `npm run build` | OK, 1 warning (main chunk 1,678 kB > 1,600 kB limit) | **OK, 0 warnings** (main chunk 1,585 kB) |
| `npx eslint src` | 297 problems (230 errors, 67 warnings) | **186 problems (127 errors, 59 warnings)**. `no-undef` is the pre-existing `DeveloperProjects.jsx` `setItemsPerPage` only. |
| `node --check` (all backend files) | all pass | **all pass** |
| Backend boot | clean | **clean**, 0 `MODULE_NOT_FOUND`, 0 "not loaded" |
| Boot log lines gone | n/a | only `⏰ Drip Campaign Worker initialized successfully` and `✅ Drip Campaign Worker` (approved U1). No new lines. |
| Frontend routes | 70 | baseline **minus exactly** `/sales/add_org`, `/sales/prospects`, `/sales/email-trigger`, `/pm/task-progress`, `/developer/project/:id`, `/developer/bucket`, `/client/feeds/:feedId` |
| Sidebar links | Appendix B | **unchanged** (`Sidebar.jsx` path entries identical to main) |
| Mounted API routes | 312 unique method+path (Appendix D lists 327 rows incl. duplicates and one comment false-positive) | **211 unique**. The 101 removed are **exactly** the approved set (scripted set comparison: 0 unexpected removals, 0 approved-but-still-present). |
| Frontend → API | — | All 305 `/api/…` strings in `frontend/src` resolve to a mounted route. The 6 script "misses" are base constants (`` `${API_BASE_URL}/api/admin` ``) and text inside comments. |
| Background jobs | 9 crons + sales notifier | 8 crons + sales notifier (drip campaign removed, U1) |
| References to deleted files | — | **0.** Path-based grep for every deleted file found no `require`/`import`. Name-only matches are role strings like `'POC'`, the kept `services/shiftService`, and route paths like `/attendance/test-connection`. |
| Removed symbols | — | 0 references (`register`/`forgotPassword`/`resetPassword`, old leave functions, `forceAccrue`, `getUpcomingHolidays`, `mssqlService`, `EmailCampaign`, `NoResponse`, `FeedSeparate`, `LeaveType`, …) |

## Logged-in click-through (after Phase 3)
Run on the branch itself: backend on port 5099 and Vite on port 5174 (pointed at 5099), both against your local DB. Your own server on 5000 was not touched. An in-page recorder captured uncaught errors, `console.error`, and the status of every `/api/` call while each route was opened by client-side navigation. Pages were only viewed: nothing was created, edited or deleted.

**Regression found and fixed:** the login page crashed on this branch (`ReferenceError: motion is not defined`). Step 5 had removed `motion` from the `framer-motion` imports in `Login.jsx` and `Profile.jsx` because ESLint reported it unused, but it is used as `<motion.div>`. This ESLint config doesn't count JSX member expressions as usage, so `no-undef` didn't catch the removal either, and the Vite build doesn't check for undefined names. Both imports are restored exactly as on `main` (commit `440db4b`). A scripted check then confirmed no other name removed in step 5 is still referenced. (ESLint now reports 188 problems, up from 186, because it again flags the two `motion` imports as "unused", same as on `main`.)

| Account | Pages opened | Result |
|---|---|---|
| **Project Manager** | `/pm/dashboard`, `/admin/projects`, `/pm/feeds`, `/pm/feed-status`, `/pm/work-report`, `/pm/resource-analytics`, `/pm/feasibility`, `/pm/git-manager`, `/tickets`, `/tickets/create`, `/announcements`, `/knowledge`, `/employee`, `/profile`, `/notifications`, `/pm/projects/:id/feeds`, `/tickets/:id` | All 17 render on their own route (no redirect, no error boundary). **88 API calls, 0 failed, 0 console errors.** |
| **Developer** | `/developer`, `/developer/worklog`, `/developer/projects`, `/developer/feeds`, `/developer/git-feeds`, `/developer/feed-status`, `/tickets`, `/tickets/create`, `/announcements`, `/knowledge`, `/employee`, `/profile`, `/notifications`, `/developer/projects/:id/feeds` | All 14 render. 57 API calls. The only failures are 4× **403** on `GET /api/admin/projects` from the project-feeds page. That is **pre-existing** (same call on `main`, and the route's role list was not changed); see bug 18. |

During the Developer run the machine's network changed (`ERR_NETWORK_CHANGED`) and one page load came up blank. After a reload everything rendered; that blank load was environmental, not code.

## What I could not verify
- **Super Admin, Admin, Team Lead, HR, Finance and Client screens were not clicked through** (no logins for those roles). Sales and Sales Manager were clicked through later; see "Bug fixes" below. They rely on the static checks above: routes, the endpoint set diff, and every frontend API URL resolving to a mounted route.
- I ran a GET-only probe against the branch server (port 5099) with no token. It shows none of the 92 kept GET paths falls through to the "route does not exist" 404. It cannot tell kept from removed routes under protected prefixes, though, because auth answers 401 before route matching. The static endpoint diff above is the real evidence.
- Not checked against prod data: U2 (feed-status pipeline endpoints) and U6 (`sync-logs`) were **kept** on the assumption that outside scripts call them.

## Left as-is on purpose
- Exports with no importer **on `main` either**, mostly used inside their own file: frontend `RecordTags` `TAG_COLORS`/`TagsModal`, `dashboardUtils` `PALETTE`/`monthKey`, etc.; backend `utils/workTime` helpers, `accessBlock.blockedUserIds`, `serverTime.getServerNowMs`. They are not tied to a discarded feature, so they were not part of this task.
- `App.jsx` `socketConnected` state: unread, but its setter runs on every socket event, so removing it would change render behaviour.

## More bugs found during Phase 3 (not fixed)
15. `controllers/holidayController.js` calls `getHolidayUpdatedTemplate` and `getHolidayDeletedTemplate`, which are **not defined or imported**, so updating or deleting a holiday throws when it reaches the email step. (Pre-existing; shows up as backend `no-undef`.)
16. `controllers/workDescriptionController.js` uses `Feed` and `Worklog` without requiring them (`no-undef`), so any code path that reaches them throws.
17. On `main`, `leaveController.applyLeave` referenced `leaveBucketService` without importing it. Moot now, since that function was dead and has been removed.
18. A Developer opening a project's feed status (`/developer/projects/:id/feeds`) gets 4× **403** from `GET /api/admin/projects`. `ProjectFeedStatus.fetchProjectFeedsFromMainTable` calls it for every role, but `adminRoutes.js` (`router.get('/projects', ...)`) only allows Super Admin, Admin, Project Manager, Client, Team Lead and HR. The page still shows feeds from `/api/client/...`. (Pre-existing.)
19. `/admin/users` (UserManagement) logs a React dev warning: *Each child in a list should have a unique "key" prop*. It's a development-only warning with no visible effect. `UserManagement.jsx` is byte-identical to `main`, so it's pre-existing. (Not fixed.)

---

# Bug fixes (branch `fix/known-bugs`, on top of `cleanup/current-only`)

Requested after the cleanup: fix the breaking bugs without changing current functionality or visual style.

| Bug | Fix | Commit |
|---|---|---|
| 16: `workDescriptionController.getDeveloperWorklogs` uses undefined `Feed`/`Worklog` | The function is **not routed anywhere** (on `main` either), so it is dead code. Removed it, together with an orphaned comment banner left over from step 8. This commit sits on `cleanup/current-only`. | `da81492` |
| 2: `DeveloperProjects.jsx` page-size select calls undefined `setItemsPerPage` (crash on change) | `const itemsPerPage = 10` → `const [itemsPerPage, setItemsPerPage] = useState(10)`. Same default, same markup; the select now works. | `7b2758e` |
| 15: holiday update/delete emails throw (templates not imported) | Import `getHolidayUpdatedTemplate` and `getHolidayDeletedTemplate` from `holidayEmailTemplates.js`, where they already exist and their arguments match the call sites. **Behaviour note:** saving a holiday edit or delete already worked (the email step's error was caught and logged). Now the notification emails are **actually sent** to all active non-admin users, as the code and its "…and notifications sent" response intend. | `7b2758e` |
| 18: Developer gets 403 from `GET /api/admin/projects` on project feed status | Added `Developer` to the route's roles with a Developer branch scoped to projects containing a feed assigned to them (same rule as `/api/dev/my-projects`). Other roles' queries are untouched. The only Developer caller is `ProjectFeedStatus`; `CreateTicket` returns `[]` for Developers without calling it. | `7b2758e` |

**Bug 1, sidebar "Employees" link (`/hr/employees`, no route; clicking it bounced to the landing page): removed, as you decided.** The entry is gone from the Super Admin, Admin and HR menus, along with its now-unused `ITEM_ICONS` mapping and the `BookUser` icon import. Icons are looked up per path, so no other item's icon changes. HR menus afterwards: Super Admin `/hr`, `/hr/holidays`, `/hr/leaves`, `/hr/attendance-sync`, `/hr/employee-attendance`, `/hr/employee-attendance-report`; Admin `/admin/users`, `/hr`, `/hr/holidays`, `/hr/attendance-sync`; HR `/hr`, `/admin/users`, `/hr/holidays`, `/hr/leaves`, `/hr/employee-attendance`, `/hr/employee-attendance-report`, `/hr/attendance-sync`. Build OK, ESLint unchanged (187, 0 `no-undef`). It hasn't been checked in the browser, because none of the provided logins has these menus.

## Verification
- Build OK, 0 warnings. ESLint 187 problems (was 188; the `setItemsPerPage` `no-undef` is gone, and the frontend now has **0 `no-undef`**). `node --check` passes on every backend file. Boot is clean (0 missing modules, 0 runtime errors).
- Holiday templates rendered with sample data (updated 6,966 chars, deleted 4,520 chars). I didn't edit or delete a real holiday, because that would now email real users in your local DB.
- **Browser, Developer:** "Show 5 per page" now gives "Showing 1 to 5 of 6 projects" with pagination, no error, same styling. `/developer/projects/:id/feeds`: the 4× 403 are now **200**, with 0 console errors. Scoping check: `GET /api/admin/projects` as this developer returns exactly the same 6 projects as `/api/dev/my-projects`.
- **Browser, Sales:** 22 pages, including account, contact, deal and activity detail, lead generation and new account: all render, **123 API calls, 0 failed, 0 console errors**. `/notifications` redirects Sales to `/sales`, which is pre-existing bug 5.
- **Browser, Sales Manager:** 21 pages, including Team (`/admin/users`) and account/contact/deal detail: all render, **0 failed API calls**. The only console entry is the pre-existing React key warning (bug 19).
- Twice the browser pane's network dropped (`ERR_NETWORK_CHANGED`, `ERR_NETWORK_IO_SUSPENDED` while the pane was hidden), and the affected pages were re-run after a reload. These were environmental, not code.
