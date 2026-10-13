// backend/models/ShiftHistory.js
const mongoose = require('mongoose');

const shiftHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Shift start expressed as minutes-of-day in IST.
  // e.g. 10:30 AM IST = 630
  shiftStartMinutes: {
    type: Number,
    required: true,
    min: 0,
    max: 1439
  },

  // Raw components (for display/audit)
  shiftHour:   { type: Number },
  shiftMinute: { type: Number },
  shiftAmPm:   { type: String, enum: ['AM', 'PM'] },

  // Inclusive YYYY-MM-DD (IST). Stored as string to sidestep TZ drift.
  effectiveFrom: {
    type: String,
    required: true,
    index: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  effectiveTo: {
    type: String,
    default: null,           // null = still the active shift
    match: /^\d{4}-\d{2}-\d{2}$/
  },

  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  note: { type: String, default: '' }
}, { timestamps: true });

// Fast lookup: "which shift was active for this user on this date?"
shiftHistorySchema.index({ userId: 1, effectiveFrom: -1 });

// Only one open row per user (effectiveTo === null)
shiftHistorySchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { effectiveTo: null } }
);

module.exports = mongoose.model('ShiftHistory', shiftHistorySchema);