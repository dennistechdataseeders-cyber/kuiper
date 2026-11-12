// backend/routes/leadActivityRoutes.js
const router = require('express').Router();
const mongoose = require('mongoose');
const LeadActivity = require('../models/LeadActivity');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const {
  notifyAssigned,
  notifyCompleted,
  notifyReminder,
} = require('../services/taskAssignmentNotifier');

router.use(protect);

// Roles that may hand tasks to other people and see the whole team's activity.
const MANAGER_ROLES = ['Sales Manager', 'Admin', 'Super Admin'];
const isManager = (user) => MANAGER_ROLES.includes(user.role);
// Roles that can receive a task.
const ASSIGNABLE_ROLES = ['Sales', 'Sales Manager'];

const POPULATE_LEAD = { path: 'leadId', select: 'companyName contacts' };
const populateAll = (q) =>
  q
    .populate(POPULATE_LEAD)
    .populate('createdBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('assignedBy', 'name email');

/** Validate an assignee id. Returns the User doc, or throws an Error with .status. */
async function resolveAssignee(id) {
  if (!mongoose.isValidObjectId(id)) {
    const e = new Error('Invalid assignee');
    e.status = 400;
    throw e;
  }
  const u = await User.findById(id).select('name email role isActive');
  if (!u || u.isActive === false) {
    const e = new Error('Assignee not found or inactive');
    e.status = 400;
    throw e;
  }
  if (!ASSIGNABLE_ROLES.includes(u.role)) {
    const e = new Error('Tasks can only be assigned to Sales team members');
    e.status = 400;
    throw e;
  }
  return u;
}

// ============================================
// GET /api/lead-activities
//   ?leadId=xxx                    → all activities for one lead
//   ?type=task|meeting|call|note   → filter by type
//   ?status=Open|Completed         → optional
//   ?scope=mine                    → activities I have to DO
//                                    (assigned to me, or created by me and not assigned away)
//   ?scope=assigned                → tasks assigned to me by someone else
//   ?scope=team                    → (managers) everything, incl. tasks assigned to reps
//   ?assignedTo=<userId>           → (managers) one rep's workload
// ============================================
router.get('/', async (req, res) => {
  try {
    const { leadId, type, status, scope, assignedTo } = req.query;
    const filter = {};

    if (leadId) filter.leadId = leadId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const me = req.user._id;

    if (scope === 'mine') {
      filter.$or = [{ assignedTo: me }, { assignedTo: null, createdBy: me }];
    } else if (scope === 'assigned') {
      filter.assignedTo = me;
      filter.assignedBy = { $nin: [null, me] }; // assigned by somebody else
    } else if (scope === 'team') {
      if (!isManager(req.user)) {
        return res.status(403).json({ error: 'Only managers can view team activity' });
      }
    }

    if (assignedTo) {
      if (!isManager(req.user) && String(assignedTo) !== String(me)) {
        return res.status(403).json({ error: 'Not allowed to view another rep’s tasks' });
      }
      filter.assignedTo = assignedTo;
    }

    const activities = await populateAll(LeadActivity.find(filter)).sort({ createdAt: -1 });
    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('GET lead activities error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/lead-activities
//   Body: { leadId, type, title, content, scheduledAt, dueAt, ..., assignedTo }
//   assignedTo (tasks only, managers only): hand the task to a sales rep.
//   A task that is assigned does not need a leadId.
// ============================================
router.post(
  '/',
  authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'),
  async (req, res) => {
    try {
      const {
        leadId, type, title, content,
        scheduledAt, dueAt, durationMinutes,
        location, attendees,
        callOutcome, callDirection,
        status, priority,
        customFields,
        assignedTo,
      } = req.body;

      if (!type || !['note', 'task', 'meeting', 'call'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      // ----- assignment rules -----
      let assignee = null;
      if (assignedTo && String(assignedTo) !== String(req.user._id)) {
        if (type !== 'task') {
          return res.status(400).json({ error: 'Only tasks can be assigned' });
        }
        if (!isManager(req.user)) {
          return res.status(403).json({ error: 'Only a Sales Manager can assign tasks to others' });
        }
        try {
          assignee = await resolveAssignee(assignedTo);
        } catch (e) {
          return res.status(e.status || 400).json({ error: e.message });
        }
      }

      if (!leadId && !(type === 'task' && assignee)) {
        return res.status(400).json({ error: 'leadId is required' });
      }
      if (leadId) {
        const lead = await Lead.findById(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
      }

      if (type === 'note' && (!content || !content.trim())) {
        return res.status(400).json({ error: 'Note content is required' });
      }
      if (type === 'task' && (!title || !title.trim())) {
        return res.status(400).json({ error: 'Task title is required' });
      }
      if (type === 'meeting') {
        if (!title || !title.trim()) return res.status(400).json({ error: 'Meeting title is required' });
        if (!scheduledAt) return res.status(400).json({ error: 'Meeting date & time is required' });
      }
      if (type === 'call') {
        if (!title || !title.trim()) return res.status(400).json({ error: 'Call subject is required' });
        if (!scheduledAt) return res.status(400).json({ error: 'Call date & time is required' });
      }

      const activity = await LeadActivity.create({
        leadId: leadId || null,
        type,
        title: title || '',
        content: content || '',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        dueAt: dueAt ? new Date(dueAt) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        location: location || '',
        attendees: Array.isArray(attendees) ? attendees : [],
        callOutcome: callOutcome || '',
        callDirection: callDirection || '',
        status: status || (type === 'task' ? 'Not Started' : 'Open'),
        priority: priority || 'Medium',
        customFields: Array.isArray(customFields) ? customFields : [],
        createdBy: req.user._id,
        ...(assignee
          ? { assignedTo: assignee._id, assignedBy: req.user._id, assignedAt: new Date() }
          : {}),
      });

      const populated = await populateAll(LeadActivity.findById(activity._id));

      if (assignee) {
        notifyAssigned({ task: activity, assignee, manager: req.user }).catch((e) =>
          console.error('notifyAssigned failed:', e.message)
        );
      }

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      console.error('POST lead activity error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// ============================================
// PATCH /api/lead-activities/:id  — update / complete / re-assign
//   assignedTo (managers only): hand to another rep. `null` takes it back.
// ============================================
router.patch(
  '/:id',
  authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'),
  async (req, res) => {
    try {
      const activity = await LeadActivity.findById(req.params.id);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });

      const me = String(req.user._id);
      const involved =
        String(activity.createdBy) === me ||
        (activity.assignedTo && String(activity.assignedTo) === me) ||
        isManager(req.user) ||
        !activity.assignedTo; // untouched legacy behaviour for ordinary activities
      if (!involved) {
        return res.status(403).json({ error: 'This task is assigned to someone else' });
      }

      const previousStatus = activity.status;
      let newAssignee = null;
      let reassigned = false;

      // ----- re-assignment -----
      if (req.body.assignedTo !== undefined) {
        if (!isManager(req.user)) {
          return res.status(403).json({ error: 'Only a Sales Manager can re-assign tasks' });
        }
        if (activity.type !== 'task') {
          return res.status(400).json({ error: 'Only tasks can be assigned' });
        }
        if (req.body.assignedTo === null || req.body.assignedTo === '') {
          activity.assignedTo = null;
          activity.assignedBy = null;
          activity.assignedAt = null;
        } else if (String(req.body.assignedTo) !== String(activity.assignedTo || '')) {
          try {
            newAssignee = await resolveAssignee(req.body.assignedTo);
          } catch (e) {
            return res.status(e.status || 400).json({ error: e.message });
          }
          reassigned = Boolean(activity.assignedTo);
          activity.assignedTo = newAssignee._id;
          activity.assignedBy = req.user._id;
          activity.assignedAt = new Date();
        }
      }

      const editable = [
        'title', 'content', 'scheduledAt', 'dueAt', 'durationMinutes',
        'location', 'attendees', 'callOutcome', 'callDirection',
        'status', 'priority', 'customFields',
      ];
      editable.forEach((k) => {
        if (req.body[k] !== undefined) activity[k] = req.body[k];
      });

      await activity.save();

      const populated = await populateAll(LeadActivity.findById(activity._id));

      // ----- notifications -----
      if (newAssignee) {
        notifyAssigned({ task: activity, assignee: newAssignee, manager: req.user, reassigned }).catch((e) =>
          console.error('notifyAssigned failed:', e.message)
        );
      }
      if (
        activity.type === 'task' &&
        activity.assignedBy &&
        previousStatus !== 'Completed' &&
        activity.status === 'Completed' &&
        String(activity.assignedBy) !== me
      ) {
        notifyCompleted({
          task: activity,
          assigneeName: req.user.name,
          manager: activity.assignedBy,
        }).catch((e) => console.error('notifyCompleted failed:', e.message));
      }

      res.json({ success: true, data: populated });
    } catch (err) {
      console.error('PATCH lead activity error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// ============================================
// POST /api/lead-activities/:id/remind  — manager nudges the assignee
// ============================================
router.post('/:id/remind', authorize('Sales Manager', 'Admin'), async (req, res) => {
  try {
    const task = await LeadActivity.findById(req.params.id);
    if (!task || task.type !== 'task') return res.status(404).json({ error: 'Task not found' });
    if (!task.assignedTo) return res.status(400).json({ error: 'Task is not assigned to anyone' });
    if (task.status === 'Completed') return res.status(400).json({ error: 'Task is already completed' });

    await notifyReminder({ task, assignee: task.assignedTo, manager: req.user });
    res.json({ success: true });
  } catch (err) {
    console.error('Remind error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/lead-activities/:id
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const activity = await LeadActivity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const canDelete =
      String(activity.createdBy) === String(req.user._id) ||
      (activity.assignedBy && String(activity.assignedBy) === String(req.user._id)) ||
      req.user.role === 'Admin' ||
      req.user.role === 'Super Admin' ||
      (req.user.role === 'Sales Manager' && activity.assignedBy);

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this activity' });
    }

    await activity.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE lead activity error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
