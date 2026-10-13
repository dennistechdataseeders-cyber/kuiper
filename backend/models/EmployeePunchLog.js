// backend/models/EmployeePunchLog.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  punchIn: { type: Date, required: true },
  punchOut: { type: Date, default: null } // null indicates an open / in-progress session
}, { _id: false });

const employeePunchLogSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  punchIn: {
    type: Date,
    default: null
  },
  punchOut: {
    type: Date,
    default: null
  },
  sessions: {
    type: [sessionSchema],
    default: []
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

  // ============================================
  // Shift-based late marking (Option B)
  // ============================================

  // Snapshot of the shift that was active on THIS log's date,
  // expressed as minutes-of-day in IST (e.g. 10:30 AM IST = 630).
  // Persisted at write time so historical evaluation never changes
  // when HR edits a user's shift mid-month.
  shiftStartMinutesUsed: {
    type: Number,
    default: null
  },

  // Server-authoritative late-ness for this log.
  // Every reader (dashboards, timelines, reports) must use these
  // values instead of recomputing on the fly.
  isLate: {
    type: Boolean,
    default: false
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  lateEvaluatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

// One log per employee per day
employeePunchLogSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Fast lookup for HR dashboards: "who is late today?"
employeePunchLogSchema.index({ date: 1, isLate: 1 });

// ============================================
// PRE-SAVE HOOK
// Derive punchIn/punchOut from sessions before save
// ============================================
employeePunchLogSchema.pre('save', function(next) {
  if (this.sessions && this.sessions.length > 0) {
    const firstSession = this.sessions[0];
    const lastSession = this.sessions[this.sessions.length - 1];
    this.punchIn = firstSession.punchIn;
    this.punchOut = lastSession.punchOut || null;
  } else {
    // If no sessions, ensure punchIn/punchOut are null
    this.punchIn = null;
    this.punchOut = null;
  }
});

module.exports = mongoose.model('EmployeePunchLog', employeePunchLogSchema);