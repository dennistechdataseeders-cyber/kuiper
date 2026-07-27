// backend/models/LeadGen.js - FULL UPDATED FILE

const mongoose = require('mongoose');

const leadGenSchema = new mongoose.Schema({
  leadNumber: { type: Number, unique: true },

  leadType: { 
    type: String, 
    enum: ['Inbound', 'Outbound', 'Email Marketing', 'LinkedIn', 'Reference', 'Cold Call'], 
    required: true 
  },
  
  referredBy: { type: String },

  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: false },
  pocName: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true 
  },
  pocPhone: { type: String },
  pocEmail: { type: String },
  linkedin: { type: String },
  salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  status: { 
    type: String, 
    enum: ['New', 'Follow-up Scheduled', 'Feasibility', 'Feasibility Completed', 'Closed', 'Production Ready'], 
    default: 'New' 
  },
  lastActionDate: { type: Date, default: Date.now },

  followUpDate: { type: Date },
  followUpType: { type: String, enum: ['call', 'email', 'message', 'meeting', 'custom'] },
  lastInteractionDesc: { type: String },

  feasibilityId: { type: String },
  feasibilityDate: { type: Date },
  taskDetails: { type: String },
  
  // ============================================
  // ✅ ATTACHMENT FIELDS - Added for file storage
  // ============================================
  attachmentPath: { type: String, default: null },
  attachmentFilename: { type: String, default: null },
  // ============================================
  
  driveFileId: { type: String },
  
  projectManagerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  feasibilityCompletedAt: { type: Date, default: null }

}, { timestamps: true });

// AUTO-INCREMENT LOGIC
leadGenSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const lastLead = await this.constructor.findOne({}, {}, { sort: { 'leadNumber': -1 } });
      this.leadNumber = lastLead && lastLead.leadNumber ? lastLead.leadNumber + 1 : 1;
    } catch (err) {
      next(err); 
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('LeadGen', leadGenSchema);