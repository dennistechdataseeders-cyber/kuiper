// backend/models/Holiday.js
const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    isOptional: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
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

// Ensure unique date
holidaySchema.index({ date: 1 }, { unique: true });

// Static method to check if a date is a holiday
holidaySchema.statics.isHoliday = async function(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    const holiday = await this.findOne({
        date: { $gte: start, $lte: end }
    });
    return !!holiday;
};

// Static method to get holidays in a date range
holidaySchema.statics.getHolidaysInRange = async function(startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return await this.find({
        date: { $gte: start, $lte: end }
    }).sort({ date: 1 });
};

module.exports = mongoose.model('Holiday', holidaySchema);