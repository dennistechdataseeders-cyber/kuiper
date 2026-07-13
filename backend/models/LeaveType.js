// backend/models/LeaveType.js
const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
    name: { 
        type: String, 
        enum: ['Casual', 'Sick', 'Vacation', 'Maternity', 'Other'], 
        required: true, 
        unique: true 
    },
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },
    maxDays: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    requiresApproval: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Pre-save middleware to update updatedAt
leaveTypeSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('LeaveType', leaveTypeSchema);