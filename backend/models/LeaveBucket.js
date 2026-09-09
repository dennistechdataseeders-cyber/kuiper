// backend/models/LeaveBucket.js - FIXED

const mongoose = require('mongoose');

const leaveBucketSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalBalance: {
    type: Number,
    default: 0
  },
  leavesTakenThisMonth: {
    type: Number,
    default: 0
  },
  leavesTakenThisYear: {
    type: Number,
    default: 0
  },
  lastAccrualMonth: {
    type: Number,
    default: -1
  },
  lastAccrualYear: {
    type: Number,
    default: -1
  },
  monthlyUsage: [{
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    leavesTaken: { type: Number, default: 0 },
    leavesAccrued: { type: Number, default: 0 }
  }],
  yearlyUsage: [{
    year: { type: Number, required: true },
    leavesTaken: { type: Number, default: 0 },
    leavesAccrued: { type: Number, default: 0 }
  }],
  // ✅ NEW: audit trail for HR reward/penalty adjustments
  adjustmentHistory: [{
    previousBalance: { type: Number },
    newBalance: { type: Number },
    change: { type: Number },
    reason: { type: String },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adjustedAt: { type: Date, default: Date.now }
  }],
  financialYearStart: { type: Date, default: null },
  financialYearEnd: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Static methods
leaveBucketSchema.statics.getFinancialYear = function(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();

  if (month >= 3) {
    return { startYear: year, endYear: year + 1 };
  } else {
    return { startYear: year - 1, endYear: year };
  }
};

leaveBucketSchema.statics.getFinancialYearStart = function(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();

  let startYear = year;
  if (month < 3) {
    startYear = year - 1;
  }

  return new Date(startYear, 3, 1);
};

leaveBucketSchema.statics.getFinancialYearEnd = function(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();

  let endYear = year;
  if (month >= 3) {
    endYear = year + 1;
  }

  return new Date(endYear, 2, 31);
};

// ✅ FIX: pre-save hook now actually calls next() — without this, EVERY
// bucket.save() call hangs forever, because declaring the `next` parameter
// tells Mongoose to wait for it to be invoked.
leaveBucketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
});

// Instance methods
leaveBucketSchema.methods.shouldAccrueLeaves = function(currentDate) {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  if (this.lastAccrualMonth === currentMonth && this.lastAccrualYear === currentYear) {
    return false;
  }

  const day = currentDate.getDate();
  if (day !== 1) {
    return false;
  }

  return true;
};

module.exports = mongoose.model('LeaveBucket', leaveBucketSchema);