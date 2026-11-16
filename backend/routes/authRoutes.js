const express = require('express');
const router = express.Router();
// Ensure these names EXACTLY match what's in authController.js
const { login } = require('../controllers/authController');
router.post('/login', login);
module.exports = router;