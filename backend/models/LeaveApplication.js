// backend/models/LeaveApplication.js - UPDATED
const mongoose = require('mongoose');

const leaveApplicationSchema = new mongoose.Schema({
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    leaveType: { 
        type: String, 
        enum: ['Paid Leave', 'Unpaid Leave'],
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
    halfDayType: { 
        type: String, 
        enum: ['first', 'second'],
        default: null 
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
    },
    // Track leave deduction for audit
    deductedFromBucket: {
        type: Boolean,
        default: false
    },
    notifiedEmails: [{
        type: String,
        default: []
    }]
}, {
    timestamps: true
});

// Index for efficient queries
leaveApplicationSchema.index({ employeeId: 1, status: 1 });
leaveApplicationSchema.index({ startDate: 1, endDate: 1 });

// Virtual for days count
leaveApplicationSchema.virtual('daysCount').get(function() {
    if (!this.startDate || !this.endDate) return 0;
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return this.isHalfDay ? 0.5 : diffDays;
});

// Ensure virtuals are included in JSON output
leaveApplicationSchema.set('toJSON', { virtuals: true });
leaveApplicationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveApplication', leaveApplicationSchema);