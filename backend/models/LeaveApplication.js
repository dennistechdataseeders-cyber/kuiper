// backend/models/LeaveApplication.js
const mongoose = require('mongoose');

const leaveApplicationSchema = new mongoose.Schema({
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    leaveType: { 
        type: String, 
        required: true 
    },
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    isHalfDay: { 
        type: Boolean, 
        default: false 
    },
    reason: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    rejectionReason: { 
        type: String, 
        default: '' 
    },
    appliedAt: { 
        type: Date, 
        default: Date.now 
    },
    approvedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    approvedAt: { 
        type: Date, 
        default: null 
    }
}, {
    timestamps: true
});

// Index for efficient queries
leaveApplicationSchema.index({ employeeId: 1, status: 1 });
leaveApplicationSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('LeaveApplication', leaveApplicationSchema);