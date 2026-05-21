const express = require('express');

const router = express.Router();

const {
  saveWorkDescription,
  getTodayDescriptions
} = require('../controllers/workDescriptionController');

/*
========================================
SAVE DESCRIPTION
========================================
*/

router.post(
  '/log-description',
  saveWorkDescription
);

/*
========================================
GET TODAY DESCRIPTIONS
========================================
*/

router.get(
  '/today',
  getTodayDescriptions
);

module.exports = router;