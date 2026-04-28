const express = require('express');
const router = express.Router();
// Ensure these names EXACTLY match what's in authController.js
const { register, login } = require('../controllers/authController');

// If line 5 is router.post('/register', register), 
// and 'register' is undefined, it throws that error.
router.post('/register', register);
router.post('/login', login);

module.exports = router;