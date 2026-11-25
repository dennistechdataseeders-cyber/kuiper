// backend/routes/feedProgressRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isPMRole } = require('../utils/roles');
const { pmProjectFilter, isTeamAdmin } = require('../utils/projectAccess');
const Project = require('../models/Project');
const { getLiveProgress, isValidDate, serverToday } = require('../services/feedProgressService');

/**
 * GET /api/feeds/live-progress?scope=pm|developer&date=YYYY-MM-DD
 *   scope=pm        feeds of the projects this user is PM / Project Coordinator of (Admin, Super Admin: all)
 *   scope=developer feeds this user is assigned to
 *   date            optional, default: the server's date
 */
router.get('/live-progress', protect, async (req, res) => {
  try {
    const { scope } = req.query;
    const date = req.query.date || serverToday();
    if (!['pm', 'developer'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be "pm" or "developer"' });
    }
    if (typeof date !== 'string' || !isValidDate(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }

    let feedFilter;
    if (scope === 'developer') {
      if (req.user.role === 'Client') return res.status(403).json({ error: 'Not authorized' });
      feedFilter = { assignedDevelopers: req.user._id };
    } else if (isTeamAdmin(req.user)) {
      feedFilter = {};
    } else if (isPMRole(req.user.role)) {
      const projects = await Project.find(pmProjectFilter(req.user._id)).select('_id').lean();
      feedFilter = { projectId: { $in: projects.map((p) => p._id) } };
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ scope, ...(await getLiveProgress(feedFilter, date)) });
  } catch (error) {
    console.error('Error fetching live feed progress:', error);
    res.status(500).json({ error: 'Failed to fetch live feed progress' });
  }
});

module.exports = router;
