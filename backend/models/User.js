// backend/models/User.js - COMPLETE UPDATED FILE WITH PROBATION SUPPORT

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Super Admin', 'Admin', 'Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'POC', 'Team Lead', 'HR', 'Finance'], 
    default: 'Client' 
  },
  pocName: String, 
  pocPhone: String,
  website: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  githubUsername: { 
    type: String, 
    default: null,
    sparse: true
  },
  githubLinked: { 
    type: Boolean, 
    default: false 
  },
  clientType: {
    type: String,
    enum: ['organization', 'individual'],
    default: 'organization'
  },
  
  // Organization reference
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true
  },
  department: {
    type: String,
    enum: ['CEO', 'CTO', 'Sales', 'Marketing', 'Support', 'Developer', 'Other', 'HR', 'Finance', 'Legal'],
    default: 'Other'
  },
  isPrimaryPOC: {
    type: Boolean,
    default: false
  },
  
  jobTitle: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  linkedinProfile: {
    type: String,
    default: ''
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Employee Code
  employeeCode: {
    type: String,
    default: null
  },
  dateOfJoining: {
    type: Date,
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  contactNumber: {
    type: String,
    default: '',
    trim: true
  },
  emergencyContact: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  
  // ============================================
  // ✅ PROBATION FIELDS
  // ============================================
  isProbationary: {
    type: Boolean,
    default: false
  },
  probationEndDate: {
    type: Date,
    default: null
  },
  
  // ============================================
  // SHIFT TIMING - 3 FIELDS (Hour, Minute, AM/PM)
  // ============================================
  shiftHour: {
    type: Number,
    min: 1,
    max: 12,
    default: 9
  },
  shiftMinute: {
    type: Number,
    min: 0,
    max: 59,
    default: 0
  },
  shiftAmPm: {
    type: String,
    enum: ['AM', 'PM'],
    default: 'AM'
  },
  // ============================================
  // LEAVE BALANCES
  // ============================================
  leaveBalances: {
    type: Map,
    of: Number,
    default: {
      'Paid Leave': 12,
      'Sick Leave': 4,
      'Casual Leave': 2,
      'Unpaid Leave': 0 // Unlimited
    }
  },
  
  // Track when balances were last updated
  leaveBalancesLastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Track leave balance history (audit trail)
  leaveBalanceHistory: [{
    type: {
      type: String,
      enum: ['granted', 'deducted', 'adjusted']
    },
    leaveType: String,
    amount: Number,
    previousBalance: Number,
    newBalance: Number,
    reason: String,
    date: { type: Date, default: Date.now }
  }],
  
  // Notification fields
  notificationCount: {
    type: Number,
    default: 0
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  },
  // ============================================
  // unreadNotifications with announcement support
  // ============================================
  unreadNotifications: [{
    type: {
      type: String,
      enum: [
        'ticket_created', 
        'ticket_assigned', 
        'ticket_commented', 
        'ticket_status_updated', 
        'open_ticket', 
        'ticket_closed', 
        'leave_request', 
        'leave_approved', 
        'leave_rejected',
        'new_announcement',
        'leave_balance_updated',
        'system' // ✅ Added for probation notifications
      ]
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Announcement'
    },
    message: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],
  profileImage: {
    type: String,
    default: null
  },
  viewedOpenTickets: {
    type: [String],
    default: []
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// UPDATE LEAVE BALANCES MONTHLY
// ============================================
UserSchema.methods.updateLeaveBalances = async function() {
  const now = new Date();
  const lastUpdated = this.leaveBalancesLastUpdated || this.createdAt;
  
  // Calculate months passed
  const monthsPassed = (now.getFullYear() - lastUpdated.getFullYear()) * 12 + 
                       (now.getMonth() - lastUpdated.getMonth());
  
  if (monthsPassed > 0) {
    // Get current balance or default
    const currentPL = this.leaveBalances.get('Paid Leave') || 12;
    
    // Add 1 day per month, up to max of 12
    const newPL = Math.min(12, currentPL + monthsPassed);
    
    // Update balance
    this.leaveBalances.set('Paid Leave', newPL);
    this.leaveBalancesLastUpdated = now;
    
    // Log the update
    this.leaveBalanceHistory.push({
      type: 'granted',
      leaveType: 'Paid Leave',
      amount: monthsPassed,
      previousBalance: currentPL,
      newBalance: newPL,
      reason: `Monthly accrual (${monthsPassed} month${monthsPassed > 1 ? 's' : ''})`
    });
    
    await this.save();
  }
};

// ============================================
// GRANT ANNUAL LEAVES
// ============================================
UserSchema.methods.grantAnnualLeaves = async function() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastUpdated = this.leaveBalancesLastUpdated || this.createdAt;
  
  // Check if this is a new year
  if (lastUpdated.getFullYear() < now.getFullYear()) {
    // Reset and grant new year leaves
    this.leaveBalances.set('Paid Leave', 12);
    this.leaveBalances.set('Sick Leave', 4);
    this.leaveBalances.set('Casual Leave', 2);
    this.leaveBalances.set('Unpaid Leave', 0);
    this.leaveBalancesLastUpdated = yearStart;
    
    this.leaveBalanceHistory.push({
      type: 'granted',
      leaveType: 'Annual Grant',
      amount: 18, // 12 + 4 + 2
      previousBalance: 0,
      newBalance: 18,
      reason: `Annual leave grant for ${now.getFullYear()}`
    });
    
    await this.save();
  }
};

// ============================================
// ✅ PROBATION HELPER METHODS
// ============================================

/**
 * Check if employee is currently on probation
 * @returns {boolean} True if on probation
 */
UserSchema.methods.isOnProbation = function() {
  if (!this.isProbationary) return false;
  if (!this.probationEndDate) return true; // If flagged but no end date, still on probation
  
  const now = new Date();
  return now < this.probationEndDate;
};

/**
 * Get detailed probation status
 * @returns {Object} Probation status object
 */
UserSchema.methods.getProbationStatus = function() {
  // If not flagged as probationary
  if (!this.isProbationary) {
    return { 
      isProbationary: false, 
      status: 'Not on probation',
      daysRemaining: 0,
      endDate: null
    };
  }
  
  // If flagged but no end date
  if (!this.probationEndDate) {
    return { 
      isProbationary: true, 
      status: 'On probation (end date not set)',
      daysRemaining: null,
      endDate: null
    };
  }
  
  const now = new Date();
  const endDate = new Date(this.probationEndDate);
  
  // If probation period has ended
  if (now >= endDate) {
    return { 
      isProbationary: false, 
      status: 'Probation completed',
      daysRemaining: 0,
      endDate: endDate
    };
  }
  
  // Currently on probation
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  return { 
    isProbationary: true, 
    status: 'On probation',
    daysRemaining: daysRemaining,
    endDate: endDate
  };
};

/**
 * Auto-calculate probation end date based on joining date
 * @param {number} probationMonths - Number of months for probation (default: 3)
 */
UserSchema.methods.setProbationFromJoining = function(probationMonths = 3) {
  if (!this.dateOfJoining) {
    this.isProbationary = false;
    this.probationEndDate = null;
    return;
  }
  
  const joiningDate = new Date(this.dateOfJoining);
  const endDate = new Date(joiningDate);
  endDate.setMonth(endDate.getMonth() + probationMonths);
  
  this.isProbationary = true;
  this.probationEndDate = endDate;
};

/**
 * Complete probation early
 */
UserSchema.methods.completeProbation = async function() {
  this.isProbationary = false;
  this.probationEndDate = null;
  await this.save();
  
  // Add notification
  await this.addNotification({
    type: 'system',
    message: '🎉 Congratulations! Your probation period has been completed successfully.'
  });
};

// ============================================
// ✅ ADD NOTIFICATION METHOD
// ============================================
UserSchema.methods.addNotification = async function(notification) {
  try {
    if (!this.unreadNotifications) {
      this.unreadNotifications = [];
    }
    
    // Check for duplicate within last minute (avoid spam)
    const exists = this.unreadNotifications.some(
      n => n.type === notification.type && 
           n.message === notification.message &&
           n.createdAt > new Date(Date.now() - 60000)
    );
    
    if (exists) {
      console.log('⚠️ Duplicate notification skipped:', notification.type);
      return true;
    }
    
    this.unreadNotifications.push({
      type: notification.type || 'system',
      message: notification.message,
      createdAt: new Date(),
      read: false
    });
    
    this.notificationCount = (this.notificationCount || 0) + 1;
    await this.save();
    
    // Emit socket notification if available
    const io = global.io;
    if (io) {
      io.to(this._id.toString()).emit('notification_count_update', {
        count: this.notificationCount,
        type: notification.type,
        message: notification.message
      });
    }
    
    console.log(`✅ Notification sent to ${this.email}: ${notification.message}`);
    return true;
  } catch (error) {
    console.error('Error adding notification:', error);
    return false;
  }
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);