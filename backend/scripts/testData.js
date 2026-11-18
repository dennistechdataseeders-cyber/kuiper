// backend/scripts/testData.js
//
// Dummy projects, feeds, tickets, feasibility leads, CRM leads and announcements for
// the @kuiper.test accounts. Used by seedTestUsers.js.
//
// Everything is written straight through the models, so no route runs: no emails,
// no notifications, no GitHub repo / invite calls.
// Every record is owned by (or hangs off) a test user, which is how removeTestData()
// finds it again. Real data is never matched.

const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const LeadGen = require('../models/LeadGen');
const Lead = require('../models/Lead');
const Announcement = require('../models/Announcement');
const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const LeaveApplication = require('../models/LeaveApplication');
const EmployeePunchLog = require('../models/EmployeePunchLog');

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const istStamp = (d) => d.toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
});
const comment = (user, text, when) => ({ text, userId: user._id, userName: user.name, createdAt: when, updatedAt: when });

// ---------- cleanup ----------

async function removeTestData(testUserIds) {
  if (!testUserIds.length) return {};
  const ids = { $in: testUserIds };
  const projects = await Project.find({ $or: [{ adminId: ids }, { projectManager: ids }] }).select('_id').lean();
  const projectIds = projects.map((p) => p._id);
  const counts = {
    feeds: (await Feed.deleteMany({ projectId: { $in: projectIds } })).deletedCount,
    projects: (await Project.deleteMany({ _id: { $in: projectIds } })).deletedCount,
    tickets: (await Ticket.deleteMany({ createdBy: ids })).deletedCount,
    feasibilityLeads: (await LeadGen.deleteMany({ salesRepId: ids })).deletedCount,
    crmLeads: (await Lead.deleteMany({ createdBy: ids })).deletedCount,
    announcements: (await Announcement.deleteMany({ createdBy: ids })).deletedCount,
    // written by scripts/seedBulkData.js
    worklogs: (await WorkLog.deleteMany({ developerId: ids })).deletedCount,
    ticketWorklogs: (await TicketWorkLog.deleteMany({ developerId: ids })).deletedCount,
    leaves: (await LeaveApplication.deleteMany({ employeeId: ids })).deletedCount,
    punchLogs: (await EmployeePunchLog.deleteMany({ employeeId: ids })).deletedCount,
  };
  return counts;
}

// ---------- seeding ----------

async function seedTestData(u, org) {
  // u = { 'Project Manager': userDoc, ... } keyed by role
  const admin = u.Admin;
  const pm = u['Project Manager'];
  const pc = u['Project Coordinator'];
  const tl = u['Team Lead'];
  const pc2 = u['Project Coordinator 2'] || pc;
  const tl2 = u['Team Lead 2'] || tl;
  const dev = u.Developer;
  const client = u.Client;
  const sales = u.Sales;
  const sm = u['Sales Manager'];
  const hr = u.HR;
  const fin = u.Finance;

  // ---- Projects ----
  const projectSpecs = [
    { serial: 9001, industry: 'ECOM', cc: 'IN', country: 'India', title: 'Test Ecommerce Price Monitoring', manager: pm, coordinators: [pc, pc2], teamLeads: [tl, tl2], status: 'BAU Initiated', daysOld: 40,
      description: 'Daily competitor price and stock tracking across major marketplaces.' },
    { serial: 9002, industry: 'REAL', cc: 'AE', country: 'United Arab Emirates', title: 'Test Real Estate Listings', manager: pc, coordinators: [pc2], teamLeads: [tl2], status: 'New', daysOld: 12,
      description: 'Weekly property listing extraction with agent and pricing details.' },
    { serial: 9003, industry: 'JOBS', cc: 'US', country: 'United States', title: 'Test Job Board Aggregation', manager: pm, coordinators: [], teamLeads: [tl], status: 'ON hold[Client]', daysOld: 25,
      description: 'Job postings aggregated from public boards; paused pending client sign-off.' },
    { serial: 9004, industry: 'TRAV', cc: 'GB', country: 'United Kingdom', title: 'Test Travel Fares', manager: pc, coordinators: [], teamLeads: [tl, tl2], status: 'Closed', daysOld: 90,
      description: 'One-off airline fare snapshot, delivered and closed.' },
  ];

  const projects = [];
  for (const s of projectSpecs) {
    const name = `TDS${s.serial}-${s.industry} | ${s.cc} | ${s.title}`;
    const created = daysAgo(s.daysOld);
    projects.push(await Project.create({
      name, projectCustomId: name, description: s.description,
      country: s.country, industry: s.industry,
      clients: [client._id], organizations: org ? [org._id] : [],
      adminId: admin._id, projectManager: s.manager._id,
      projectCoordinators: [...new Set(s.coordinators.filter((c) => c !== s.manager).map((c) => c._id))],
      teamLeads: [...new Set(s.teamLeads.map((t) => t._id))], teamLead: s.teamLeads[0]._id,
      projectStatus: s.status, createdAt: created,
      comments: [
        comment(s.manager, 'Kick-off done. Sample output shared with the client.', new Date(created.getTime() + DAY)),
        comment(client, 'Thanks - sample looks good. Please add the currency column.', new Date(created.getTime() + 2 * DAY)),
      ],
    }));
  }
  const [pEcom, pReal, pJobs, pTravel] = projects;

  // ---- Feeds ----
  const feedSpecs = [
    { project: pEcom, name: 'Amazon Product Prices', feedType: 'Daily', feedStatus: 'BAU Initiated', platform: 'Web', domain: 'amazon.example', devs: [dev] },
    { project: pEcom, name: 'Flipkart Stock Levels', feedType: 'Daily', feedStatus: 'In process', platform: 'Both', domain: 'flipkart.example', devs: [dev, tl] },
    { project: pEcom, name: 'Marketplace Seller Ratings', feedType: 'Weekly', weekDay: 'Monday', feedStatus: 'Awaiting Client Approval', platform: 'Web', domain: 'sellers.example', devs: [dev] },
    { project: pReal, name: 'Property Listings - Dubai', feedType: 'Weekly', weekDay: 'Friday', feedStatus: 'New', platform: 'Web', domain: 'propertyfinder.example', devs: [dev] },
    { project: pReal, name: 'Agent Directory', feedType: 'Monthly', monthDay: 1, feedStatus: 'New', platform: 'App', domain: 'agents.example', devs: [] },
    { project: pJobs, name: 'Job Postings - Tech', feedType: 'Daily', feedStatus: 'ON hold[Client]', platform: 'Web', domain: 'jobs.example', devs: [dev] },
    { project: pTravel, name: 'Airline Fares Snapshot', feedType: 'Once off', feedStatus: 'Once off[Delivered]', platform: 'Web', domain: 'fares.example', devs: [dev], completed: true },
  ];

  const feeds = [];
  for (const s of feedSpecs) {
    const created = new Date(s.project.createdAt.getTime() + DAY);
    const feed = await Feed.create({
      name: s.name, projectId: s.project._id, feedType: s.feedType, weekDay: s.weekDay || '', monthDay: s.monthDay || null,
      feedPlatform: s.platform, webDomain: s.domain, assignedDevelopers: s.devs.map((d) => d._id),
      feedStatus: s.feedStatus, createdAt: created,
      completed: !!s.completed, completedAt: s.completed ? daysAgo(60) : null, completedBy: s.completed ? dev._id : null,
      completionDescription: s.completed ? 'Delivered final CSV to client.' : '',
      comments: s.devs.length ? [comment(s.devs[0], 'Scraper running; first sample uploaded to the shared drive.', new Date(created.getTime() + DAY))] : [],
    });
    feeds.push(feed);
  }
  for (const p of projects) {
    await Project.updateOne({ _id: p._id }, { $set: { feeds: feeds.filter((f) => String(f.projectId) === String(p._id)).map((f) => f._id) } });
  }
  const feedBy = (name) => feeds.find((f) => f.name === name);

  // ---- Tickets (explicit numbers; insertMany skips the counter hook so numbers cannot clash) ----
  const hist = (by, ...steps) => steps.map(([from, status, d]) => ({ from, status, at: daysAgo(d), by: by._id, byName: by.name }));
  const ticketSpecs = [
    { n: 'TKT-TEST-01', title: 'Missing prices for 120 SKUs', description: 'Yesterday\'s file has blank price for 120 SKUs in Electronics.',
      category: 'Production', subcategory: 'Data Quality', priority: 'High', status: 'In Progress', isInternal: false,
      createdBy: client, assignedTo: dev, project: pEcom, feed: feedBy('Amazon Product Prices'), watchers: [pm], days: 3,
      comments: [[client, 'Affects the daily dashboard - please prioritise.'], [dev, 'Found a selector change on the product page, fixing now.']],
      history: hist(dev, ['Open', 'In Progress', 2]) },
    { n: 'TKT-TEST-02', title: 'Add Abu Dhabi listings', description: 'Please extend the listing feed to cover Abu Dhabi as well as Dubai.',
      category: 'Production', subcategory: 'Delivery', priority: 'Medium', status: 'Open', isInternal: false,
      createdBy: client, project: pReal, feed: feedBy('Property Listings - Dubai'), days: 1 },
    { n: 'INT-TEST-01', title: 'Proxy pool rotation failing', description: 'Requests are getting 429s; rotate proxy pool and add back-off.',
      category: 'Production', subcategory: 'Maintenance', priority: 'Urgent', status: 'Resolved', isInternal: true,
      createdBy: pm, assignedTo: dev, project: pEcom, feed: feedBy('Flipkart Stock Levels'), days: 8, resolvedDaysAgo: 6,
      comments: [[dev, 'Rotation fixed and retry with back-off added.']],
      history: hist(dev, ['Open', 'In Progress', 7], ['In Progress', 'Resolved', 6]) },
    { n: 'INT-TEST-02', title: 'Set up agent directory scraper', description: 'Build the first version of the agent directory scraper for the app.',
      category: 'Production', subcategory: 'Data Extraction', priority: 'Medium', status: 'Open', isInternal: true,
      createdBy: pc, assignedTo: tl, project: pReal, feed: feedBy('Agent Directory'), watchers: [pc], days: 2 },
    { n: 'INT-TEST-03', title: 'Feasibility: hotel reviews site', description: 'Client wants hotel reviews from a JS-heavy site. Please check feasibility.',
      category: 'Development', subcategory: 'Feasibility', priority: 'Medium', status: 'Open', isInternal: true,
      createdBy: sales, assignedTo: pm, assignedPM: pm, days: 2 },
    { n: 'INT-TEST-04', title: 'Feasibility: car listings with VIN', description: 'Prospect needs car listings including VIN numbers - is this possible?',
      category: 'Development', subcategory: 'Feasibility', priority: 'High', status: 'In Progress', isInternal: true,
      createdBy: sm, assignedTo: pc, assignedPM: pc, days: 4,
      comments: [[pc, 'VIN is shown on detail pages only - doable, about 2x request volume.']],
      history: hist(pc, ['Open', 'In Progress', 3]) },
    { n: 'INT-TEST-05', title: 'Leave balance not updated', description: 'My approved leave last week is not reflected in my balance.',
      category: 'HR', subcategory: 'Attendance & Leave', priority: 'Low', status: 'Open', isInternal: true,
      createdBy: dev, assignedTo: hr, days: 1 },
    { n: 'INT-TEST-06', title: 'Reimbursement for cloud credits', description: 'Claim for test-environment cloud credits bought on my card.',
      category: 'Finance', subcategory: 'Reimbursement', priority: 'Medium', status: 'Closed', isInternal: true,
      createdBy: tl, assignedTo: fin, days: 15, resolvedDaysAgo: 12, closedDaysAgo: 10,
      comments: [[fin, 'Approved and paid in this month\'s cycle.']],
      history: hist(fin, ['Open', 'In Progress', 14], ['In Progress', 'Resolved', 12], ['Resolved', 'Closed', 10]) },
    { n: 'INT-TEST-07', title: 'CRM access for new sales hire', description: 'Please create CRM access for a new sales team member.',
      category: 'IT', subcategory: 'Access Management', priority: 'Medium', status: 'Open', isInternal: true,
      createdBy: sales, assignedTo: admin, days: 0 },
  ];

  const tickets = await Ticket.insertMany(ticketSpecs.map((s) => {
    const created = daysAgo(s.days);
    return {
      ticketNumber: s.n, title: s.title, description: s.description,
      category: s.category, subcategory: s.subcategory, ticketType: s.subcategory,
      priority: s.priority, status: s.status, isInternal: s.isInternal,
      createdBy: s.createdBy._id, assignedTo: s.assignedTo?._id || null, assignedPM: s.assignedPM?._id || null,
      watchers: (s.watchers || []).map((w) => w._id),
      projectId: s.project?._id || null, feedId: s.feed?._id || null,
      comments: (s.comments || []).map(([user, text], i) => ({ text, userId: user._id, userName: user.name, createdAt: new Date(created.getTime() + (i + 1) * 3600e3) })),
      statusHistory: s.history || [],
      startedAt: s.status !== 'Open' ? new Date(created.getTime() + 3600e3) : undefined,
      resolvedAt: s.resolvedDaysAgo !== undefined ? daysAgo(s.resolvedDaysAgo) : undefined,
      closedAt: s.closedDaysAgo !== undefined ? daysAgo(s.closedDaysAgo) : undefined,
      createdAt: created, updatedAt: created,
    };
  }), { timestamps: false });

  // ---- Feasibility / lead-gen leads ----
  const salesNote = (d, text) => `\n\n**[Sales Comment - ${istStamp(d)}]**\n${text}`;
  const pmNote = (d, text) => `\n\n**[PM Comment - ${istStamp(d)}]**\n${text}`;
  const leadGenSpecs = [
    { pocName: 'Test Lead Ananya Rao', leadType: 'Inbound', status: 'New', rep: sales, days: 1,
      desc: 'Inbound form: wants daily grocery prices for 3 cities.' },
    { pocName: 'Test Lead Omar Haddad', leadType: 'LinkedIn', status: 'Follow-up Scheduled', rep: sales, days: 5, followUp: -2, followUpType: 'call',
      desc: 'Intro call done; follow-up call booked to discuss volumes.' },
    { pocName: 'Test Lead Priya Shah', leadType: 'Reference', referredBy: 'Test Client', status: 'Feasibility', rep: sales, days: 6, pmUser: pm,
      task: 'Hotel reviews from a JS-heavy travel site, daily, ~50k reviews.',
      desc: 'Sent to feasibility.', notes: (d) => salesNote(d, 'Client needs answer by Friday.') },
    { pocName: 'Test Lead James Carter', leadType: 'Outbound', status: 'Feasibility', rep: sm, days: 4, pmUser: pc,
      task: 'Used-car listings with VIN for UK dealers, weekly.',
      desc: 'Sent to feasibility.', notes: (d) => salesNote(d, 'High-value prospect.') + pmNote(new Date(d.getTime() + DAY), 'VIN only on detail pages - feasible, needs more requests.') },
    { pocName: 'Test Lead Mei Lin', leadType: 'Email Marketing', status: 'Feasibility Completed', rep: sales, days: 10, pmUser: pm, completed: 3,
      task: 'Electronics prices from 5 marketplaces.',
      desc: 'Feasibility completed - feasible.', notes: (d) => pmNote(new Date(d.getTime() + 2 * DAY), 'Feasible. Estimated 3 days to set up.') },
    { pocName: 'Test Lead Carlos Mendes', leadType: 'Cold Call', status: 'Production Ready', rep: sm, days: 20, pmUser: pc, completed: 14,
      task: 'Property listings for Lisbon and Porto.',
      desc: 'Ready for production.', notes: (d) => pmNote(new Date(d.getTime() + 3 * DAY), 'Feasible - handing over to production.') },
  ];
  const leadGens = [];
  for (const s of leadGenSpecs) {
    const created = daysAgo(s.days);
    const lead = await LeadGen.create({
      leadType: s.leadType, referredBy: s.referredBy, organizationId: org?._id,
      pocName: s.pocName, pocEmail: `${s.pocName.toLowerCase().replace(/^test lead /, '').replace(/\s+/g, '.')}@kuiper.test`,
      pocPhone: '+91 90000 0000' + leadGens.length,
      salesRepId: s.rep._id, status: s.status, lastActionDate: created,
      followUpDate: s.followUp !== undefined ? daysAgo(s.followUp) : undefined, followUpType: s.followUpType,
      lastInteractionDesc: s.desc + (s.notes ? s.notes(created) : ''),
      taskDetails: s.task, projectManagerId: s.pmUser?._id || null,
      feasibilityDate: s.pmUser ? created : undefined,
      feasibilityCompletedAt: s.completed !== undefined ? daysAgo(s.completed) : null,
    });
    if (s.pmUser) {
      lead.feasibilityId = `FSL${String(lead.leadNumber).padStart(4, '0')}`;
      await LeadGen.updateOne({ _id: lead._id }, { $set: { feasibilityId: lead.feasibilityId } });
    }
    leadGens.push(lead);
  }

  // ---- CRM leads (Sales module) ----
  const crmSpecs = [
    { company: 'Test Bright Retail', first: 'Neha', last: 'Kapoor', owner: sales, status: 'Not Contacted', source: 'Web Research', industry: 'Retail' },
    { company: 'Test Nimbus Logistics', first: 'Daniel', last: 'Brooks', owner: sales, status: 'Contacted', source: 'LinkedIn', industry: 'Logistics' },
    { company: 'Test Orbit Travel', first: 'Sara', last: 'Lopez', owner: sm, status: 'Pre-Qualified', source: 'Referral', industry: 'Travel' },
    { company: 'Test Harbor Foods', first: 'Kenji', last: 'Sato', owner: sm, status: 'Contact in Future', source: 'Trade Show', industry: 'Food & Beverage' },
  ];
  const crmLeads = [];
  for (const s of crmSpecs) {
    crmLeads.push(await Lead.create({
      companyName: s.company, industry: s.industry, website: `https://${s.company.toLowerCase().replace(/^test /, '').replace(/\s+/g, '')}.example`,
      leadOwner: s.owner._id, leadSource: s.source, leadStatus: s.status,
      description: 'Dummy lead for testing.',
      contacts: [{ firstName: s.first, lastName: s.last, email: `${s.first}.${s.last}@kuiper.test`.toLowerCase(), title: 'Head of Data', isPrimary: true }],
      createdBy: s.owner._id, updatedBy: s.owner._id,
    }));
  }

  // ---- Announcements ----
  const annSpecs = [
    { by: hr, title: 'Welcome to the KUIPER test workspace', description: 'This workspace is filled with dummy data so every role has something to look at.', days: 2,
      comments: [[dev, 'Thanks!']], likes: [dev, pm, sales] },
    { by: admin, title: 'Scheduled maintenance this Saturday', description: 'The platform will be read-only from 10:00 to 12:00 IST on Saturday.', days: 1, likes: [tl] },
    { by: pm, title: 'New project kicked off: Real Estate Listings', description: 'Project Coordinator is leading the new real-estate listings project.', days: 0,
      comments: [[pc, 'Looking forward to it.']] },
  ];
  const announcements = [];
  for (const s of annSpecs) {
    const created = daysAgo(s.days);
    announcements.push(await Announcement.create({
      title: s.title, description: s.description,
      createdBy: s.by._id, createdByName: s.by.name, createdByRole: s.by.role,
      likes: (s.likes || []).map((x) => x._id), viewedBy: [s.by._id],
      comments: (s.comments || []).map(([user, text]) => ({ text, userId: user._id, userName: user.name, userRole: user.role, createdAt: created, updatedAt: created })),
      createdAt: created,
    }));
  }

  return {
    projects: projects.length, feeds: feeds.length, tickets: tickets.length,
    feasibilityLeads: leadGens.length, crmLeads: crmLeads.length, announcements: announcements.length,
  };
}

module.exports = { seedTestData, removeTestData };
