// backend/routes/dashboardConfigRoutes.js
// Saves / loads each user's own dashboard layout.
//
//   GET    /api/dashboard-config/:dashboard   → { success, data: widgets[] | null }
//   PUT    /api/dashboard-config/:dashboard   body { widgets: [...] }
//   DELETE /api/dashboard-config/:dashboard   → back to the default layout
const router = require('express').Router();
const DashboardConfig = require('../models/DashboardConfig');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

const ALLOWED_DASHBOARDS = ['sales'];
const MAX_WIDGETS = 60;
const MAX_BYTES = 200 * 1024;

// reject Mongo operator-style keys ($where, a.b) anywhere in the payload
const hasBadKey = (o) =>
  !!o &&
  typeof o === 'object' &&
  Object.entries(o).some(([k, v]) => k.startsWith('$') || k.includes('.') || hasBadKey(v));

const guard = (req, res, next) => {
  if (!ALLOWED_DASHBOARDS.includes(req.params.dashboard)) {
    return res.status(400).json({ error: 'Unknown dashboard' });
  }
  next();
};

router.get('/:dashboard', guard, async (req, res) => {
  try {
    const doc = await DashboardConfig.findOne({
      user: req.user._id,
      dashboard: req.params.dashboard
    }).lean();
    res.json({ success: true, data: doc ? doc.widgets : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:dashboard', guard, async (req, res) => {
  try {
    const { widgets } = req.body;
    if (!Array.isArray(widgets) || widgets.length > MAX_WIDGETS) {
      return res.status(400).json({ error: 'widgets must be an array (max 60)' });
    }
    if (widgets.some((w) => !w || typeof w !== 'object' || typeof w.id !== 'string')) {
      return res.status(400).json({ error: 'Every widget needs a string id' });
    }
    if (hasBadKey(widgets)) {
      return res.status(400).json({ error: 'Invalid widget data' });
    }
    if (Buffer.byteLength(JSON.stringify(widgets)) > MAX_BYTES) {
      return res.status(413).json({ error: 'Dashboard layout is too large' });
    }

    const doc = await DashboardConfig.findOneAndUpdate(
      { user: req.user._id, dashboard: req.params.dashboard },
      { $set: { widgets } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: doc.widgets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:dashboard', guard, async (req, res) => {
  try {
    await DashboardConfig.deleteOne({ user: req.user._id, dashboard: req.params.dashboard });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;