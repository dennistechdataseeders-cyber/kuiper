// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'POC'], 
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