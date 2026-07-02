// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'POC', 'Team Lead'], 
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
    sparse: true // Allows multiple null values while maintaining uniqueness for non-null
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
  
  // New fields for POC (Point of Contact) management
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true // Added index for faster queries
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
  
  // Additional fields for better tracking
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
  
  // ============================================
  // NOTIFICATION FIELDS
  // ============================================
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
      enum: ['ticket_created', 'ticket_assigned', 'ticket_commented', 'ticket_status_updated', 'open_ticket']
    },
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
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware to update the updatedAt timestamp
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
});

// Middleware to ensure only one primary POC per organization
UserSchema.pre('save', async function(next) {
  if (this.isPrimaryPOC && this.organizationId && this.role === 'POC') {
    try {
      // Set all other POCs of this organization to non-primary
      await this.constructor.updateMany(
        {
          organizationId: this.organizationId,
          role: 'POC',
          _id: { $ne: this._id }
        },
        { $set: { isPrimaryPOC: false } }
      );
    } catch (error) {
      console.error('Error in primary POC middleware:', error);
    }
  }
});

// Virtual to get the organization name
UserSchema.virtual('organizationName').get(function() {
  if (this.organizationId && typeof this.organizationId === 'object') {
    return this.organizationId.companyName;
  }
  return null;
});

// Index for efficient queries on POCs by organization
UserSchema.index({ organizationId: 1, role: 1 });
UserSchema.index({ isPrimaryPOC: 1, organizationId: 1 });

// ============================================
// NOTIFICATION METHODS
// ============================================

// Method to add a notification
UserSchema.methods.addNotification = function(notificationData) {
  if (!this.unreadNotifications) {
    this.unreadNotifications = [];
  }
  
  this.unreadNotifications.push({
    type: notificationData.type || 'ticket_created',
    ticketId: notificationData.ticketId,
    message: notificationData.message,
    createdAt: new Date(),
    read: false
  });
  
  this.notificationCount = (this.notificationCount || 0) + 1;
  return this.save();
};

// Method to mark a notification as read
UserSchema.methods.markNotificationAsRead = function(notificationId) {
  const notification = this.unreadNotifications?.find(
    n => n._id.toString() === notificationId.toString()
  );
  
  if (notification && !notification.read) {
    notification.read = true;
    this.notificationCount = Math.max(0, (this.notificationCount || 0) - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to mark all notifications as read
UserSchema.methods.markAllNotificationsAsRead = function() {
  if (this.unreadNotifications) {
    this.unreadNotifications.forEach(n => n.read = true);
    this.notificationCount = 0;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to get unread notification count
UserSchema.methods.getUnreadCount = function() {
  return this.unreadNotifications?.filter(n => !n.read).length || 0;
};

// Method to get all notifications with ticket details populated
UserSchema.methods.getNotificationsWithDetails = async function() {
  await this.populate('unreadNotifications.ticketId', 'title ticketNumber status createdAt');
  return this.unreadNotifications || [];
};

// Method to check if user is a POC
UserSchema.methods.isPOC = function() {
  return this.role === 'POC' || this.role === 'Client';
};

// Method to get full POC details with organization
UserSchema.methods.getPOCDetails = async function() {
  if (this.organizationId) {
    await this.populate('organizationId', 'companyName website address');
  }
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    department: this.department,
    isPrimaryPOC: this.isPrimaryPOC,
    jobTitle: this.jobTitle,
    phoneNumber: this.phoneNumber,
    linkedinProfile: this.linkedinProfile,
    organization: this.organizationId ? {
      id: this.organizationId._id,
      name: this.organizationId.companyName,
      website: this.organizationId.website
    } : null
  };
};

// Delete any other exports and use ONLY this:
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);