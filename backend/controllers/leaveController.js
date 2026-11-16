// backend/controllers/leaveController.js - COMPLETE FIXED FILE

const LeaveApplication = require('../models/LeaveApplication');

// ============================================
// GET LEAVE HISTORY
// ============================================
exports.getLeaveHistory = async (req, res) => {
    try {
        const { status, year } = req.query;
        const userId = req.user._id;
        
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
        res.status(500).json({ error: 'Failed to fetch leave history' });
    }
};

// ============================================
// HR: GET ALL PENDING LEAVES
// ============================================
exports.getPendingLeaves = async (req, res) => {
    try {
        const pendingLeaves = await LeaveApplication.find({ status: 'pending' })
            .populate('employeeId', 'name email employeeCode designation department role')
            .sort({ appliedAt: 1 });
        
        res.json({
            success: true,
            data: pendingLeaves
        });
    } catch (error) {
        console.error('Error fetching pending leaves:', error);
        res.status(500).json({ error: 'Failed to fetch pending leaves' });
    }
};

// ============================================
// HR: GET ALL LEAVES WITH FILTERS
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
            .populate('employeeId', 'name email employeeCode designation department role')
            .populate('approvedBy', 'name email')
            .sort({ appliedAt: -1 });
        
        res.json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
};

module.exports = exports;