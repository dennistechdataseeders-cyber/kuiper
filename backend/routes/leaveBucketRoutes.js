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

// ✅ One-shot request: preview the paid / unpaid split, then submit everything at once
router.post('/request/preview', leaveBucketController.previewLeave);
router.post('/request', leaveBucketController.applyLeaveRequest);

// ============================================
// HR/ADMIN ROUTES
// ============================================
router.use(authorize('HR', 'Admin'));

// Get pending leaves
router.get('/pending', leaveBucketController.getPendingLeaves);

// Get employee leave summary
router.get('/employee/:userId/summary', leaveBucketController.getEmployeeLeaveSummary);

// Get all employee buckets
router.get('/employees/buckets', leaveBucketController.getAllEmployeeBuckets);

// ✅ NEW: Reward/penalize — directly set an employee's Paid Leave balance
router.patch('/employee/:userId/adjust', leaveBucketController.adjustEmployeeBalance);

// ✅ Approve / reject a whole one-shot request (all its pieces together)
router.patch('/group/:groupId/approve', leaveBucketController.approveLeaveGroup);
router.patch('/group/:groupId/reject', leaveBucketController.rejectLeaveGroup);

// Approve leave
router.patch('/:id/approve', leaveBucketController.approveLeave);

// Reject leave
router.patch('/:id/reject', leaveBucketController.rejectLeave);

module.exports = router;