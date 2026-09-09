// backend/routes/leaveBucketRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const leaveBucketController = require('../controllers/leaveBucketController');

// ============================================
// EMPLOYEE ROUTES (All authenticated users)
// ============================================
router.use(protect);

// Get leave summary (balance, monthly usage, etc.)
router.get('/bucket/summary', leaveBucketController.getLeaveSummary);

// Get leave history
router.get('/history', leaveBucketController.getLeaveHistory);

// Apply for leave
router.post('/apply', leaveBucketController.applyLeave);

// ============================================
// HR/ADMIN ROUTES
// ============================================
router.use(authorize('HR', 'Admin'));

// Get pending leaves
router.get('/pending', leaveBucketController.getPendingLeaves);

// Get all leaves with filters
router.get('/all', leaveBucketController.getAllLeaves);

// Get employee leave summary
router.get('/employee/:userId/summary', leaveBucketController.getEmployeeLeaveSummary);

// Get all employee buckets
router.get('/employees/buckets', leaveBucketController.getAllEmployeeBuckets);

// ✅ NEW: Reward/penalize — directly set an employee's Paid Leave balance
router.patch('/employee/:userId/adjust', leaveBucketController.adjustEmployeeBalance);

// Approve leave
router.patch('/:id/approve', leaveBucketController.approveLeave);

// Reject leave
router.patch('/:id/reject', leaveBucketController.rejectLeave);

// Force accrual (admin only)
router.post('/force-accrue', authorize('Super Admin', 'Admin'), leaveBucketController.forceAccrue);

module.exports = router;