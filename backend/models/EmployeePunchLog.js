// backend/models/EmployeePunchLog.js
const mongoose = require('mongoose');

const employeePunchLogSchema = new mongoose.Schema({
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    punchIn: { 
        type: Date, 
        required: true 
    },
    punchOut: { 
        type: Date, 
        default: null 
    },
    date: { 
        type: Date, 
        required: true 
    },
    isManualCorrection: { 
        type: Boolean, 
        default: false 
    },
    correctionNote: { 
        type: String, 
        default: '' 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
employeePunchLogSchema.index({ employeeId: 1, date: 1 });
employeePunchLogSchema.index({ date: 1 });

// Pre-save middleware to ensure date is normalized
employeePunchLogSchema.pre('save', function(next) {
    if (this.date) {
        // Normalize date to start of day (00:00:00)
        const dateObj = new Date(this.date);
        dateObj.setHours(0, 0, 0, 0);
        this.date = dateObj;
    }
    next();
});

module.exports = mongoose.model('EmployeePunchLog', employeePunchLogSchema);