// backend/models/User.js - Add leave balances

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
   enum: ['Super Admin', 'Admin', 'Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'POC', 'Team Lead', 'HR', 'Finance'],     default: 'Client' 
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
  unreadNotifications: [{
    type: {
      type: String,
    enum: ['ticket_created', 'ticket_assigned', 'ticket_commented', 'ticket_status_updated', 'open_ticket', 'ticket_closed', 'leave_request', 'leave_approved', 'leave_rejected']    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
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

// Update leave balances monthly (for Paid Leave accrual)
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

// Grant annual leaves (run at start of year)
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

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);