const mongoose = require('mongoose');

// Sub-schema for multiple Points of Contact
const pocSubSchema = new mongoose.Schema({
  pocName: { type: String, required: [true, "POC Name is required"] },
  pocEmail: { type: String },
  pocPhone: { type: String },
  linkedin: { type: String },
  isPrimary: { type: Boolean, default: false },
  department: { 
    type: String, 
    enum: ['CEO', 'CTO', 'Sales', 'Marketing', 'Support','Developer', 'Other'], 
    default: 'Other' 
  },
  notes: { type: String },
  addedAt: { type: Date, default: Date.now }
});

const organizationSchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    required: [true, "Company Name is required"],
    trim: true,
    index: true
  },
  website: { type: String },
  address: { type: String },
  salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['New', 'Contacted', 'Converted', 'Active', 'Inactive'], 
    default: 'New' 
  },
  // Multiple POCs array
  pointsOfContact: [pocSubSchema],
  
  // Backward compatibility fields (kept for existing data)
  pocName: { type: String },
  pocEmail: { type: String },
  pocPhone: { type: String },
  linkedin: { type: String },
  clientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Index for search functionality
organizationSchema.index({ companyName: 'text' });

// Pre-save middleware to maintain backward compatibility
organizationSchema.pre('save', function(next) {
  if (this.pointsOfContact && this.pointsOfContact.length > 0) {
    const primaryPOC = this.pointsOfContact.find(p => p.isPrimary) || this.pointsOfContact[0];
    if (primaryPOC) {
      this.pocName = primaryPOC.pocName;
      this.pocEmail = primaryPOC.pocEmail;
      this.pocPhone = primaryPOC.pocPhone;
      this.linkedin = primaryPOC.linkedin;
    }
  }
});

// Method to get primary POC
organizationSchema.methods.getPrimaryPOC = function() {
  return this.pointsOfContact?.find(p => p.isPrimary) || this.pointsOfContact?.[0];
};

// Method to add new POC
organizationSchema.methods.addPOC = function(pocData) {
  if (!this.pointsOfContact) {
    this.pointsOfContact = [];
  }
  this.pointsOfContact.push(pocData);
  
  // If this is the first POC or marked as primary, update backward compatibility fields
  if (this.pointsOfContact.length === 1 || pocData.isPrimary) {
    this.pocName = pocData.pocName;
    this.pocEmail = pocData.pocEmail;
    this.pocPhone = pocData.pocPhone;
    this.linkedin = pocData.linkedin;
  }
  
  return this;
};

module.exports = mongoose.model('Organization', organizationSchema);