// backend/scripts/seedBulkData.js
//
// Production-sized dummy data for performance measurements (LOCAL databases only).
// Run AFTER `npm run seed:testusers`. Everything is owned by @kuiper.test users, so
// `npm run seed:testusers:reset` removes it again.
//
//   node scripts/seedBulkData.js            -> dry run (prints target)
//   node scripts/seedBulkData.js --confirm  -> inserts the data
//
// Volumes are roughly what a busy year of KUIPER looks like (see VOLUME below).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const LeadGen = require('../models/LeadGen');
const Announcement = require('../models/Announcement');
const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');

const VOLUME = {
  developers: 30, teamLeads: 6, pms: 4, coordinators: 4, sales: 8,
  projects: 150, feedsPerProject: 5, tickets: 6000, leadGens: 1500,
  worklogDays: 120, ticketWorklogs: 5000, leaves: 1500, punchDays: 90, announcements: 150,
};

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i;
const rnd = (n) => crypto.randomInt(n);
const pick = (a) => a[rnd(a.length)];
const DAY = 86400e3;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const ymd = (d) => d.toISOString().slice(0, 10);

async function main() {
  const uri = process.env.MONGO_URI || '';
  const hosts = (/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri) || [])[1] || '';
  console.log(`Target: ${hosts} / ${(/\/([^/?]+)(\?|$)/.exec(uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/, '')) || [])[1] || '?'}`);
  if (!hosts.split(',').every((h) => LOCAL.test(h))) { console.error('Refusing: bulk data is for a local database only.'); process.exit(2); }
  if (!process.argv.includes('--confirm')) { console.log('Dry run. Re-run with --confirm.'); return; }

  await mongoose.connect(uri);
  const test = await User.find({ email: /@kuiper\.test$/i }).lean();
  const role = (r) => test.filter((u) => u.role === r);
  if (!test.length) throw new Error('Run npm run seed:testusers first.');
  if (await Ticket.exists({ ticketNumber: /^TKT-BULK-/ })) throw new Error('Bulk data already present. Run npm run seed:testusers:reset first.');
  const org = await Organization.findOne({ companyName: 'Test Organization', website: 'https://kuiper.test' });
  const t0 = Date.now();

  // ---- bulk people (cannot log in: random password) ----
  const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const mk = (r, n, dept) => Array.from({ length: n }, (_, i) => ({
    name: `Bulk ${r} ${String(i + 1).padStart(2, '0')}`, email: `bulk.${r.toLowerCase().replace(/\s+/g, '-')}.${i + 1}@kuiper.test`,
    password: hash, role: r, department: dept, isActive: true, dateOfJoining: daysAgo(30 + rnd(900)),
  }));
  const bulk = await User.insertMany([
    ...mk('Developer', VOLUME.developers, 'Developer'), ...mk('Team Lead', VOLUME.teamLeads, 'Developer'),
    ...mk('Project Manager', VOLUME.pms, 'Other'), ...mk('Project Coordinator', VOLUME.coordinators, 'Other'),
    ...mk('Sales', VOLUME.sales, 'Sales'),
  ]);
  const all = [...test, ...bulk.map((b) => b.toObject())];
  const devs = all.filter((u) => u.role === 'Developer');
  const tls = all.filter((u) => u.role === 'Team Lead');
  const pms = all.filter((u) => ['Project Manager', 'Project Coordinator'].includes(u.role));
  const salesReps = all.filter((u) => ['Sales', 'Sales Manager'].includes(u.role));
  const client = role('Client')[0];
  const admin = role('Admin')[0];
  const employees = all.filter((u) => !['Client', 'POC', 'Super Admin'].includes(u.role));

  // ---- projects + feeds ----
  const statuses = ['New', 'Once off', 'Automation', 'Ad hoc', 'BAU Initiated', 'BAU Not Initiated', 'ON hold[Client]', 'Closed'];
  const industries = ['ECOM', 'REAL', 'JOBS', 'TRAV', 'FINC', 'AUTO', 'HLTH'];
  const projects = await Project.insertMany(Array.from({ length: VOLUME.projects }, (_, i) => {
    const pm = pick(pms); const ind = pick(industries);
    const name = `TDS${7000 + i}-${ind} | IN | Bulk Project ${i + 1}`;
    const created = daysAgo(rnd(365));
    return {
      name, projectCustomId: name, country: 'India', industry: ind, description: 'Bulk test project.',
      clients: client ? [client._id] : [], organizations: org ? [org._id] : [], adminId: admin._id,
      projectManager: pm._id, projectCoordinators: rnd(3) === 0 ? [pick(pms)._id].filter((x) => String(x) !== String(pm._id)) : [],
      teamLead: null, teamLeads: [], projectStatus: pick(statuses), createdAt: created,
      comments: Array.from({ length: rnd(4) }, () => ({ text: 'Status update on extraction and delivery.', userId: pm._id, userName: pm.name, createdAt: created })),
    };
  }));
  for (const p of projects) { const t = pick(tls); p.teamLead = t._id; p.teamLeads = [t._id]; }
  await Project.bulkWrite(projects.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { teamLead: p.teamLead, teamLeads: p.teamLeads } } } })));

  const feedStatuses = ['New', 'In process', 'Awaiting Client Approval', 'BAU Initiated', 'Once off[Delivered]', 'ON hold[Client]', 'Closed'];
  const feeds = await Feed.insertMany(projects.flatMap((p, pi) => Array.from({ length: VOLUME.feedsPerProject }, (_, j) => ({
    name: `Bulk Feed ${pi + 1}.${j + 1}`, projectId: p._id, feedType: pick(['Daily', 'Weekly', 'Monthly', 'Once off']),
    feedPlatform: 'Web', webDomain: `site${pi}-${j}.example`, assignedDevelopers: [pick(devs)._id, ...(rnd(2) ? [pick(devs)._id] : [])],
    feedStatus: pick(feedStatuses), createdAt: p.createdAt,
    comments: Array.from({ length: rnd(3) }, () => { const d = pick(devs); return { text: 'Scraper updated, sample attached.', userId: d._id, userName: d.name }; }),
  }))));
  await Project.bulkWrite(projects.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { feeds: feeds.filter((f) => String(f.projectId) === String(p._id)).map((f) => f._id) } } } })));

  // ---- tickets ----
  const cats = [['Production', 'Data Quality'], ['Production', 'Delivery'], ['Production', 'Maintenance'], ['Development', 'Feasibility'], ['HR', 'Attendance & Leave'], ['Finance', 'Reimbursement'], ['IT', 'Access Management']];
  const tStatus = ['Open', 'Open', 'In Progress', 'In Progress', 'Resolved', 'Closed', 'Closed'];
  const ticketDocs = Array.from({ length: VOLUME.tickets }, (_, i) => {
    const feed = pick(feeds); const project = projects.find((p) => String(p._id) === String(feed.projectId));
    const [category, subcategory] = pick(cats); const prod = category === 'Production';
    const creator = prod && rnd(2) && client ? client : pick(employees);
    const assignee = prod ? pick(devs) : pick(employees);
    const created = daysAgo(rnd(240) + rnd(24) / 24);
    const status = pick(tStatus);
    return {
      ticketNumber: `TKT-BULK-${String(i + 1).padStart(5, '0')}`, title: `Bulk ticket ${i + 1}: ${subcategory} issue`,
      description: 'Records missing or malformed in the latest delivery. Please investigate and fix.'.repeat(1 + rnd(3)),
      category, subcategory, ticketType: subcategory, priority: pick(['Low', 'Medium', 'High', 'Urgent']), status,
      isInternal: creator.role !== 'Client', createdBy: creator._id, assignedTo: assignee._id,
      assignedPM: category === 'Development' ? project.projectManager : null,
      watchers: Array.from({ length: rnd(4) }, () => pick(employees)._id),
      projectId: prod || category === 'Development' ? project._id : null, feedId: prod ? feed._id : null,
      comments: Array.from({ length: rnd(6) }, (_, k) => { const u = pick([creator, assignee]); return { text: `Update ${k + 1}: checked the source, re-running the job.`, userId: u._id, userName: u.name, createdAt: new Date(created.getTime() + (k + 1) * 3600e3) }; }),
      statusHistory: status === 'Open' ? [] : [{ from: 'Open', status: 'In Progress', at: new Date(created.getTime() + 7200e3), by: assignee._id, byName: assignee.name }],
      startedAt: status === 'Open' ? undefined : new Date(created.getTime() + 7200e3),
      resolvedAt: ['Resolved', 'Closed'].includes(status) ? new Date(created.getTime() + 2 * DAY) : undefined,
      closedAt: status === 'Closed' ? new Date(created.getTime() + 3 * DAY) : undefined,
      createdAt: created, updatedAt: created,
    };
  });
  for (let i = 0; i < ticketDocs.length; i += 1000) await Ticket.insertMany(ticketDocs.slice(i, i + 1000), { timestamps: false, ordered: false });

  // ---- feasibility / lead-gen ----
  const lastLead = await LeadGen.findOne().sort({ leadNumber: -1 }).lean();
  let leadNo = lastLead?.leadNumber || 0;
  const lgStatus = ['New', 'Follow-up Scheduled', 'Feasibility', 'Feasibility Completed', 'Closed', 'Production Ready'];
  await LeadGen.insertMany(Array.from({ length: VOLUME.leadGens }, (_, i) => {
    const st = pick(lgStatus); const withPm = ['Feasibility', 'Feasibility Completed', 'Production Ready'].includes(st);
    leadNo += 1;
    return {
      leadNumber: leadNo, leadType: pick(['Inbound', 'Outbound', 'LinkedIn', 'Reference', 'Cold Call', 'Email Marketing']),
      pocName: `Bulk Lead ${i + 1}`, pocEmail: `bulk.lead.${i + 1}@kuiper.test`, salesRepId: pick(salesReps)._id, status: st,
      lastActionDate: daysAgo(rnd(200)), lastInteractionDesc: 'Discussed scope and volumes.\n\n**[Sales Comment - 01 Nov 2026, 10:00 am]**\nFollow up next week.',
      taskDetails: withPm ? 'Daily product data from 3 marketplaces.' : undefined,
      projectManagerId: withPm ? pick(pms)._id : null, feasibilityId: withPm ? `FSL${String(leadNo).padStart(4, '0')}` : undefined,
      organizationId: org?._id, createdAt: daysAgo(rnd(300)),
    };
  }), { ordered: false });

  // ---- worklogs (feed + ticket) ----
  const wl = [];
  for (const d of devs) for (let day = 0; day < VOLUME.worklogDays; day++) {
    if (rnd(7) < 2) continue; // weekends / days off
    const f = pick(feeds);
    wl.push({ developerId: d._id, feedId: f._id, projectId: f.projectId, date: ymd(daysAgo(day)), totalTime: 3600 + rnd(5 * 3600), isRunning: false });
  }
  for (let i = 0; i < wl.length; i += 5000) await WorkLog.insertMany(wl.slice(i, i + 5000), { ordered: false });
  const twlSeen = new Set(); const twl = [];
  const tickets = await Ticket.find({ ticketNumber: /^TKT-BULK-/ }).select('_id projectId assignedTo').lean();
  while (twl.length < VOLUME.ticketWorklogs) {
    const t = pick(tickets); const date = ymd(daysAgo(rnd(120))); const k = `${t.assignedTo}|${t._id}|${date}`;
    if (twlSeen.has(k)) continue; twlSeen.add(k);
    twl.push({ developerId: t.assignedTo, ticketId: t._id, projectId: t.projectId, date, totalTime: 600 + rnd(3 * 3600), isRunning: false, description: 'Investigated and fixed.' });
  }
  await TicketWorkLog.insertMany(twl, { ordered: false });

  // ---- leave + attendance ----
  const hrUser = role('HR')[0];
  await LeaveApplication.insertMany(Array.from({ length: VOLUME.leaves }, () => {
    const emp = pick(employees); const start = daysAgo(rnd(300) - 30); const len = rnd(3);
    const st = pick(['pending', 'approved', 'approved', 'rejected']);
    return { employeeId: emp._id, leaveType: pick(['Paid Leave', 'Unpaid Leave']), startDate: start, endDate: new Date(start.getTime() + len * DAY), reason: 'Personal work', status: st, appliedAt: new Date(start.getTime() - 5 * DAY), approvedBy: st === 'pending' ? undefined : hrUser?._id, approvedAt: st === 'pending' ? undefined : start };
  }), { ordered: false });
  const punches = [];
  for (const emp of employees) for (let day = 1; day <= VOLUME.punchDays; day++) {
    const d = daysAgo(day); if ([0, 6].includes(d.getDay())) continue;
    const date = new Date(`${ymd(d)}T00:00:00+05:30`);
    const inT = new Date(date.getTime() + (9 * 60 + rnd(60)) * 60e3); const outT = new Date(inT.getTime() + (8 * 60 + rnd(120)) * 60e3);
    const late = (inT - date) / 60e3 - 9 * 60;
    punches.push({ employeeId: emp._id, date, punchIn: inT, punchOut: outT, sessions: [{ punchIn: inT, punchOut: outT }], isLate: late > 15, lateMinutes: Math.max(0, Math.round(late)) });
  }
  for (let i = 0; i < punches.length; i += 5000) await EmployeePunchLog.insertMany(punches.slice(i, i + 5000), { ordered: false });

  // ---- announcements ----
  await Announcement.insertMany(Array.from({ length: VOLUME.announcements }, (_, i) => {
    const by = pick(employees); const created = daysAgo(rnd(365));
    return { title: `Bulk announcement ${i + 1}`, description: 'Company update for all teams.', createdBy: by._id, createdByName: by.name, createdByRole: by.role,
      likes: Array.from({ length: rnd(10) }, () => pick(employees)._id), comments: Array.from({ length: rnd(4) }, () => { const u = pick(employees); return { text: 'Thanks!', userId: u._id, userName: u.name, userRole: u.role }; }),
      viewedBy: Array.from({ length: rnd(30) }, () => pick(employees)._id), createdAt: created };
  }), { ordered: false });

  console.log(`Bulk data in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${bulk.length} users, ${projects.length} projects, ${feeds.length} feeds, ${ticketDocs.length} tickets, ${VOLUME.leadGens} leads, ${wl.length} worklogs, ${twl.length} ticket worklogs, ${VOLUME.leaves} leaves, ${punches.length} punch logs, ${VOLUME.announcements} announcements`);
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error('Bulk seed failed:', e.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
