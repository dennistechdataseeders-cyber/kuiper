// backend/routes/resourceAnalyticsRoutes.js

const express = require('express');
const router = express.Router();

const { getResourceAnalytics } = require('../controllers/resourceAnalyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// GET /api/resource-analytics
// Query params:
//   developerId  - 'all' | single id | comma-separated list of ids
//   projectId    - 'all' | project id
//   feedId       - 'all' | feed id      (optional extra narrowing)
//   ticketId     - 'all' | ticket id    (optional extra narrowing)
//   startDate    - 'YYYY-MM-DD'
//   endDate      - 'YYYY-MM-DD'
router.get(
  '/',
  protect,
  authorize('Super Admin', 'Admin', 'Project Manager'),
  getResourceAnalytics
);

module.exports = router;