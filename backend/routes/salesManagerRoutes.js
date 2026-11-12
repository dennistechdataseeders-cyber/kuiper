// backend/routes/salesManagerRoutes.js
//
// Everything the Sales Manager dashboard needs in ONE call.
//
//   GET /api/sales-manager/overview
//
// Returns, for the whole sales team:
//   reps[]          per-rep numbers (lead-gen, prospects, CRM leads, deals, tasks, meetings, calls)
//   totals          team totals
//   assignedTasks   every task a manager assigned to a rep (newest first)
//   schedule        today's meetings & calls across the team
//   recent          the latest activity logged by anyone on the team
//
// Mount in server.js:
//   app.use('/api/sales-manager', protect, require('./routes/salesManagerRoutes'));

const router = require('express').Router();
const User = require('../models/User');
const LeadGen = require('../models/LeadGen');
const Prospect = require('../models/Prospect');
const Lead = require('../models/Lead');
const Deal = require('../models/Deal');
const LeadActivity = require('../models/LeadActivity');
const { authorize } = require('../middleware/roleCheck');

router.use(authorize('Sales Manager', 'Admin'));

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of "today" in IST, as a UTC Date. */
function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

const sumIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const isConverted = {
  $or: [
    { $eq: ['$status', 'Production Ready'] },
    { $ne: [{ $ifNull: ['$projectId', null] }, null] },
  ],
};

router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = istDayStart(now);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS);
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [
      reps,
      leadGenAgg,
      prospectAgg,
      crmLeadAgg,
      dealAgg,
      activityAgg,
      unassignedProspects,
      assignedTasks,
      schedule,
      recent,
    ] = await Promise.all([
      User.find({ role: 'Sales', isActive: { $ne: false } })
        .select('name email profileImage lastActive')
        .sort({ name: 1 })
        .lean(),

      // Lead generation pipeline (per rep)
      LeadGen.aggregate([
        {
          $group: {
            _id: '$salesRepId',
            total: { $sum: 1 },
            converted: sumIf(isConverted),
            createdToday: sumIf({ $gte: ['$createdAt', todayStart] }),
            followUpsToday: sumIf({
              $and: [
                { $eq: ['$status', 'Follow-up Scheduled'] },
                { $gte: ['$followUpDate', todayStart] },
                { $lt: ['$followUpDate', todayEnd] },
              ],
            }),
          },
        },
      ]),

      // Prospects (per rep)
      Prospect.aggregate([
        { $match: { salesRepId: { $ne: null } } },
        {
          $group: {
            _id: '$salesRepId',
            total: { $sum: 1 },
            approached: sumIf({ $eq: ['$status', 'Approached'] }),
            converted: sumIf(isConverted),
          },
        },
      ]),

      // CRM leads (per owner)
      Lead.aggregate([
        {
          $group: {
            _id: '$leadOwner',
            total: { $sum: 1 },
            open: sumIf({ $ne: ['$isConverted', true] }),
            createdToday: sumIf({ $gte: ['$createdAt', todayStart] }),
          },
        },
      ]),

      // Deals (per owner)
      Deal.aggregate([
        {
          $group: {
            _id: '$owner',
            total: { $sum: 1 },
            won: sumIf({ $eq: ['$stage', 'Closed Won'] }),
            lost: sumIf({ $regexMatch: { input: { $ifNull: ['$stage', ''] }, regex: '^Closed Lost' } }),
            wonValue: {
              $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, { $ifNull: ['$amount', 0] }, 0] },
            },
            openValue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$stage', 'Closed Won'] },
                      { $regexMatch: { input: { $ifNull: ['$stage', ''] }, regex: '^Closed Lost' } },
                    ],
                  },
                  0,
                  { $ifNull: ['$amount', 0] },
                ],
              },
            },
          },
        },
      ]),

      // Tasks / meetings / calls (per person who has to DO them)
      LeadActivity.aggregate([
        { $match: { type: { $in: ['task', 'meeting', 'call'] } } },
        {
          $addFields: {
            owner: { $ifNull: ['$assignedTo', '$createdBy'] },
            done: { $in: ['$status', ['Completed', 'Cancelled']] },
          },
        },
        {
          $group: {
            _id: '$owner',
            tasksOpen: sumIf({ $and: [{ $eq: ['$type', 'task'] }, { $eq: ['$done', false] }] }),
            tasksOverdue: sumIf({
              $and: [
                { $eq: ['$type', 'task'] },
                { $eq: ['$done', false] },
                { $ne: [{ $ifNull: ['$dueAt', null] }, null] },
                { $lt: ['$dueAt', todayStart] },
              ],
            }),
            tasksCompleted: sumIf({ $and: [{ $eq: ['$type', 'task'] }, { $eq: ['$status', 'Completed'] }] }),
            tasksCompleted7d: sumIf({
              $and: [
                { $eq: ['$type', 'task'] },
                { $eq: ['$status', 'Completed'] },
                { $gte: ['$updatedAt', weekAgo] },
              ],
            }),
            meetingsToday: sumIf({
              $and: [
                { $eq: ['$type', 'meeting'] },
                { $ne: ['$status', 'Cancelled'] },
                { $gte: ['$scheduledAt', todayStart] },
                { $lt: ['$scheduledAt', todayEnd] },
              ],
            }),
            callsToday: sumIf({
              $and: [
                { $eq: ['$type', 'call'] },
                { $ne: ['$status', 'Cancelled'] },
                { $gte: ['$scheduledAt', todayStart] },
                { $lt: ['$scheduledAt', todayEnd] },
              ],
            }),
          },
        },
      ]),

      Prospect.countDocuments({ $or: [{ salesRepId: null }, { salesRepId: { $exists: false } }] }),

      // Every task a manager has handed out
      LeadActivity.find({ type: 'task', assignedTo: { $ne: null } })
        .populate('leadId', 'companyName contacts')
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(300),

      // Today's meetings + calls, whole team
      LeadActivity.find({
        type: { $in: ['meeting', 'call'] },
        status: { $ne: 'Cancelled' },
        scheduledAt: { $gte: todayStart, $lt: todayEnd },
      })
        .populate('leadId', 'companyName contacts')
        .populate('createdBy', 'name')
        .populate('assignedTo', 'name')
        .sort({ scheduledAt: 1 })
        .limit(100),

      // Latest things the team logged
      LeadActivity.find({})
        .populate('leadId', 'companyName')
        .populate('createdBy', 'name')
        .populate('assignedTo', 'name')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const byId = (rows) => new Map(rows.map((r) => [String(r._id), r]));
    const lg = byId(leadGenAgg);
    const pr = byId(prospectAgg);
    const cl = byId(crmLeadAgg);
    const dl = byId(dealAgg);
    const ac = byId(activityAgg);

    const repRows = reps.map((r) => {
      const id = String(r._id);
      const g = lg.get(id) || {};
      const p = pr.get(id) || {};
      const c = cl.get(id) || {};
      const d = dl.get(id) || {};
      const a = ac.get(id) || {};

      const pipelineTotal = (g.total || 0) + (p.total || 0);
      const converted = (g.converted || 0) + (p.converted || 0);

      return {
        _id: r._id,
        name: r.name,
        email: r.email,
        profileImage: r.profileImage || null,
        lastActive: r.lastActive || null,
        leadGen: {
          total: g.total || 0,
          converted: g.converted || 0,
          createdToday: g.createdToday || 0,
          followUpsToday: g.followUpsToday || 0,
        },
        prospects: { total: p.total || 0, approached: p.approached || 0, converted: p.converted || 0 },
        crmLeads: { total: c.total || 0, open: c.open || 0, createdToday: c.createdToday || 0 },
        deals: {
          total: d.total || 0,
          won: d.won || 0,
          lost: d.lost || 0,
          wonValue: d.wonValue || 0,
          openValue: d.openValue || 0,
          open: (d.total || 0) - (d.won || 0) - (d.lost || 0),
        },
        tasks: {
          open: a.tasksOpen || 0,
          overdue: a.tasksOverdue || 0,
          completed: a.tasksCompleted || 0,
          completed7d: a.tasksCompleted7d || 0,
        },
        meetingsToday: a.meetingsToday || 0,
        callsToday: a.callsToday || 0,
        conversionRate: pipelineTotal ? Number(((converted / pipelineTotal) * 100).toFixed(1)) : 0,
      };
    });

    const sum = (fn) => repRows.reduce((s, r) => s + fn(r), 0);
    const pipelineTotal = sum((r) => r.leadGen.total + r.prospects.total);
    const converted = sum((r) => r.leadGen.converted + r.prospects.converted);

    const totals = {
      reps: repRows.length,
      pipelineTotal,
      converted,
      conversionRate: pipelineTotal ? Number(((converted / pipelineTotal) * 100).toFixed(1)) : 0,
      leadsCreatedToday: sum((r) => r.leadGen.createdToday + r.crmLeads.createdToday),
      followUpsToday: sum((r) => r.leadGen.followUpsToday),
      openDeals: sum((r) => r.deals.open),
      openPipelineValue: sum((r) => r.deals.openValue),
      wonValue: sum((r) => r.deals.wonValue),
      tasksOpen: sum((r) => r.tasks.open),
      tasksOverdue: sum((r) => r.tasks.overdue),
      tasksCompleted7d: sum((r) => r.tasks.completed7d),
      meetingsToday: sum((r) => r.meetingsToday),
      callsToday: sum((r) => r.callsToday),
      unassignedProspects,
    };

    res.json({
      success: true,
      generatedAt: now,
      totals,
      reps: repRows,
      assignedTasks,
      schedule,
      recent,
    });
  } catch (err) {
    console.error('Sales manager overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;