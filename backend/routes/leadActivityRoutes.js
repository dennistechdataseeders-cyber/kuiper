// backend/routes/leadActivityRoutes.js
const router = require('express').Router();
const LeadActivity = require('../models/LeadActivity');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// ============================================
// GET /api/lead-activities
//   ?leadId=xxx           → all activities for one lead
//   ?type=task|meeting|call|note  → filter by type (used by sidebar pages)
//   ?status=Open|Completed        → optional
// ============================================
router.get('/', async (req, res) => {
  try {
    const { leadId, type, status, scope } = req.query;
    const filter = {};

    if (leadId) filter.leadId = leadId;
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    // Sidebar pages: restrict to activities the user created
    if (scope === 'mine') {
      filter.createdBy = req.user._id;
    }

    const activities = await LeadActivity.find(filter)
      .populate({
        path: 'leadId',
        select: 'companyName contacts',
        // this lets us show the lead name in the sidebar cards
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('GET lead activities error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/lead-activities
//   Body: { leadId, type, title, content, scheduledAt, dueAt,
//           durationMinutes, location, attendees, callOutcome,
//           callDirection, status, priority }
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
      } = req.body;

      if (!leadId) return res.status(400).json({ error: 'leadId is required' });
      if (!type || !['note', 'task', 'meeting', 'call'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      const lead = await Lead.findById(leadId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      if (type === 'note') {
        if (!content || !content.trim()) {
          return res.status(400).json({ error: 'Note content is required' });
        }
      }
      if (type === 'task') {
        if (!title || !title.trim()) {
          return res.status(400).json({ error: 'Task title is required' });
        }
      }
      if (type === 'meeting') {
        if (!title || !title.trim()) {
          return res.status(400).json({ error: 'Meeting title is required' });
        }
        if (!scheduledAt) {
          return res.status(400).json({ error: 'Meeting date & time is required' });
        }
      }
      if (type === 'call') {
        if (!title || !title.trim()) {
          return res.status(400).json({ error: 'Call subject is required' });
        }
        if (!scheduledAt) {
          return res.status(400).json({ error: 'Call date & time is required' });
        }
      }

      const activity = await LeadActivity.create({
        leadId,
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
      });

      const populated = await LeadActivity.findById(activity._id)
        .populate({
          path: 'leadId',
          select: 'companyName contacts',
        })
        .populate('createdBy', 'name email');

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      console.error('POST lead activity error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// ============================================
// PATCH /api/lead-activities/:id  — update / complete a task
// ============================================
router.patch(
  '/:id',
  authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'),
  async (req, res) => {
    try {
      const activity = await LeadActivity.findById(req.params.id);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });

      const editable = [
        'title', 'content', 'scheduledAt', 'dueAt', 'durationMinutes',
        'location', 'attendees', 'callOutcome', 'callDirection',
        'status', 'priority', 'customFields',
      ];
      editable.forEach(k => {
        if (req.body[k] !== undefined) activity[k] = req.body[k];
      });

      await activity.save();

      const populated = await LeadActivity.findById(activity._id)
        .populate({ path: 'leadId', select: 'companyName contacts' })
        .populate('createdBy', 'name email');

      res.json({ success: true, data: populated });
    } catch (err) {
      console.error('PATCH lead activity error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// ============================================
// DELETE /api/lead-activities/:id
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const activity = await LeadActivity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const canDelete =
      String(activity.createdBy) === String(req.user._id) ||
      req.user.role === 'Admin' ||
      req.user.role === 'Super Admin';

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
