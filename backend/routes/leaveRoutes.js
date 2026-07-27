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

// Get leave balances
router.get('/balance', leaveController.getLeaveBalances);

// Get leave history
router.get('/history', leaveController.getLeaveHistory);

// Apply for leave
router.post('/apply', leaveController.applyLeave);

// ============================================
// HR/ADMIN ROUTES
// ============================================
router.use(authorize('HR', 'Admin'));

// Get pending leaves
router.get('/pending', leaveController.getPendingLeaves);

// Get all leaves with filters
router.get('/all', leaveController.getAllLeaves);

// Approve leave
router.patch('/:id/approve', leaveController.approveLeave);

// Reject leave
router.patch('/:id/reject', leaveController.rejectLeave);

module.exports = router;