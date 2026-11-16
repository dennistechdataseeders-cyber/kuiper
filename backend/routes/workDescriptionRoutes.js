const express = require('express');

const router = express.Router();

const {
  saveWorkDescription
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

module.exports = router;