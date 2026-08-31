// backend/routes/holidayRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const holidayController = require('../controllers/holidayController');

// ============================================
// READ-ONLY ROUTES - Any authenticated user can view
// ============================================
router.use(protect); // All routes require authentication

// Get holidays - ANY authenticated user can view
router.get('/', holidayController.getHolidays);

// Get a single holiday by ID
router.get('/:id', holidayController.getHolidayById);

// Get upcoming holidays
router.get('/upcoming', holidayController.getUpcomingHolidays);

// Check if a date is a holiday
router.get('/check', holidayController.checkHoliday);

// ============================================
// ADMIN ROUTES - Only HR/Admin/Super Admin can modify
// ============================================
router.post('/', authorize('Super Admin', 'Admin', 'HR'), holidayController.createHoliday);
router.put('/:id', authorize('Super Admin', 'Admin', 'HR'), holidayController.updateHoliday);
router.delete('/:id', authorize('Super Admin', 'Admin', 'HR'), holidayController.deleteHoliday);

module.exports = router;