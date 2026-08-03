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
  }
}, {
  timestamps: true
});

employeePunchLogSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Derive punchIn/punchOut from sessions before save
// FIXED: Use function declaration with next parameter
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