// backend/routes/leaveRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const leaveController = require('../controllers/leaveController');

// ============================================
// EMPLOYEE ROUTES (All authenticated users)
// ============================================
router.use(protect);

// Get leave history
router.get('/history', leaveController.getLeaveHistory);

// ============================================
// HR/ADMIN ROUTES
// ============================================
router.use(authorize('HR', 'Admin'));

// Get pending leaves
router.get('/pending', leaveController.getPendingLeaves);

// Get all leaves with filters
router.get('/all', leaveController.getAllLeaves);

module.exports = router;