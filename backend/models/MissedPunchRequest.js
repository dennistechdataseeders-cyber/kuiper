// backend/models/MissedPunchRequest.js
const mongoose = require('mongoose');

const missedPunchRequestSchema = new mongoose.Schema({
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['in', 'out'], 
        required: true 
    },
    expectedTime: { 
        type: Date, 
        required: true 
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
    reviewedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    reviewedAt: { 
        type: Date, 
        default: null 
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
missedPunchRequestSchema.index({ employeeId: 1, status: 1 });
missedPunchRequestSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('MissedPunchRequest', missedPunchRequestSchema);