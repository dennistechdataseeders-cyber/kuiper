// backend/models/Lead.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, lowercase: true },
  phone: { type: String },
  mobile: { type: String },
  title: { type: String },
  department: { type: String, default: 'Other' },
  isPrimary: { type: Boolean, default: false }
});

const leadSchema = new mongoose.Schema({
  // Company / Account Details
  companyName: { type: String, required: true, trim: true },
  website: { type: String },
  industry: { type: String },
  noOfEmployees: { type: Number },
  
  // Address Details
  address: {
    countryRegion: String,
    flatHouse: String,
    streetAddress: String,
    city: String,
    stateProvince: String,
    zipPostalCode: String
  },
  
  // Contacts / POCs
  contacts: [contactSchema],

  // Meta Data
  leadOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  leadSource: { type: String, default: 'Web Research' },
  leadStatus: { type: String, default: 'Not Contacted' },
  description: { type: String },

  // Set when the Lead is converted to a Deal (also set on old leads that
  // already had an Account created the previous way)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },

  // ✅ Lead → Deal conversion
  isConverted: { type: Boolean, default: false },
  convertedAt: { type: Date },
  convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dealId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null },

  // optional dynamic fields from the configurable form (Label, Type, Value, etc.)
  dynamicFields: [{
    fieldKey: { type: String },
    label: { type: String },
    type: { type: String },
    section: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    options: [{ type: String }],
    required: { type: Boolean, default: false }
  }],

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema); 