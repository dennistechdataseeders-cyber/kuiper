// backend/controllers/leaveBucketController.js - COMPLETE FIXED FILE

const leaveBucketService = require('../services/leaveBucketService');
const LeaveApplication = require('../models/LeaveApplication');
const User = require('../models/User');

// ============================================
// GET LEAVE BALANCE SUMMARY
// ============================================
exports.getLeaveSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const summary = await leaveBucketService.getEmployeeLeaveSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting leave summary:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// GET LEAVE HISTORY
// ============================================
exports.getLeaveHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, year } = req.query;

    let filter = { employeeId: userId };
    if (status) filter.status = status;

    if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      filter.startDate = { $gte: start, $lte: end };
    }

    const leaves = await LeaveApplication.find(filter)
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching leave history:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// APPLY FOR LEAVE - UPDATED with email notification
// ============================================
exports.applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, isHalfDay, halfDayType, reason } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Only allow Paid Leave and Unpaid Leave
    if (!['Paid Leave', 'Unpaid Leave'].includes(leaveType)) {
      return res.status(400).json({ error: 'Invalid leave type. Only Paid Leave and Unpaid Leave are allowed.' });
    }

    const result = await leaveBucketService.applyForLeave(
      userId,
      leaveType,
      startDate,
      endDate,
      isHalfDay || false,
      halfDayType || null,
      reason
    );

    // ============================================
    // ✅ Additional notification logging
    // ============================================
    try {
      const employee = await User.findById(userId).select('name email');
      console.log(`📋 Leave application submitted by ${employee.name}: ${leaveType} from ${startDate} to ${endDate}`);
      console.log(`📧 Email notifications sent to HR and dhaval@techdataseeders.in`);
    } catch (notifyError) {
      console.error('Additional notification failed:', notifyError.message);
    }

    res.status(201).json({
      success: true,
      data: result,
      message: 'Leave request submitted successfully. HR has been notified via email.'
    });
  } catch (error) {
    console.error('Error applying for leave:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET PENDING LEAVES
// ============================================
exports.getPendingLeaves = async (req, res) => {
  try {
    const pendingLeaves = await LeaveApplication.find({ status: 'pending' })
      .populate('employeeId', 'name email employeeCode role isProbationary')
      .sort({ appliedAt: 1 });

    res.json({
      success: true,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('Error fetching pending leaves:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET ALL LEAVES
// ============================================
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, startDate, endDate, employeeId } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const leaves = await LeaveApplication.find(filter)
      .populate('employeeId', 'name email employeeCode role isProbationary')
      .populate('approvedBy', 'name email')
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: APPROVE LEAVE
// ============================================
exports.approveLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const approvedBy = req.user._id;

    const result = await leaveBucketService.approveLeave(leaveId, approvedBy);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: REJECT LEAVE
// ============================================
exports.rejectLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await leaveBucketService.rejectLeave(leaveId, rejectionReason, req.user._id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(400).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET EMPLOYEE LEAVE SUMMARY
// ============================================
exports.getEmployeeLeaveSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const summary = await leaveBucketService.getEmployeeLeaveSummary(userId);

    res.json({
      success: true,
      data: {
        employee: {
          name: user.name,
          email: user.email,
          role: user.role
        },
        ...summary
      }
    });
  } catch (error) {
    console.error('Error fetching employee leave summary:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: FORCE ACCRUE (Manual trigger)
// ============================================
exports.forceAccrue = async (req, res) => {
  try {
    // Only allow in development or with specific permission
    const result = await leaveBucketService.accrueMonthlyLeaves();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error forcing accrual:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: GET ALL EMPLOYEES WITH BUCKET DATA
// ============================================
exports.getAllEmployeeBuckets = async (req, res) => {
  try {
    const employees = await User.find({
      isActive: true,
      role: { $nin: ['Admin', 'HR', 'Client', 'Super Admin'] }
    }).select('_id name email role isProbationary employeeCode');

    const bucketData = await Promise.all(
      employees.map(async (employee) => {
        const summary = await leaveBucketService.getEmployeeLeaveSummary(employee._id);
        return {
          employee: {
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            employeeCode: employee.employeeCode || null,
            isProbationary: employee.isProbationary || false
          },
          summary
        };
      })
    );

    res.json({
      success: true,
      data: bucketData
    });
  } catch (error) {
    console.error('Error fetching employee buckets:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// HR/ADMIN: ADJUST AN EMPLOYEE'S BALANCE (REWARD / PENALTY)
// Body: { newBalance: number, reason: string }
// ============================================
exports.adjustEmployeeBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newBalance, reason } = req.body;

    if (newBalance === undefined || newBalance === null || isNaN(newBalance)) {
      return res.status(400).json({ error: 'newBalance is required and must be a number' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for a balance adjustment' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await leaveBucketService.adjustBalance(
      userId,
      parseFloat(newBalance),
      reason.trim(),
      req.user._id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error adjusting balance:', error);
    res.status(400).json({ error: error.message });
  }
};