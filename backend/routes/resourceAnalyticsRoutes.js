const express = require('express');

const router = express.Router();

const {
  getResourceAnalytics
} = require('../controllers/resourceAnalyticsController');

const {
  protect
} = require('../middleware/authMiddleware');

/*
========================================
RESOURCE ANALYTICS
========================================
*/

router.get(
  '/',
  protect,
  getResourceAnalytics
);

module.exports = router;