// backend/models/Deal.js
const mongoose = require('mongoose');
const customFieldSchema = require('./customFieldSchema');

const CONTACT_ROLES = [
  'Developer/Evaluator', 'Decision Maker', 'Purchasing',
  'Executive Sponsor', 'Engineering Lead', 'Economic Decision Maker',
  'Product Management'
];

const dealSchema = new mongoose.Schema({
  dealName:    { type: String, required: [true, 'Deal Name is required'], trim: true },
  amount:      { type: Number, default: 0, min: 0 },
  closingDate: { type: Date, required: [true, 'Closing Date cannot be empty.'] },

  // ✅ FIX: stage is now a free string (validated against DealStage collection
  //         in the route layer, exactly like LeadActivity.status is validated
  //         against TaskStage).
  stage:       { type: String, default: 'Qualification', trim: true },

  contactRole: { type: String, enum: [...CONTACT_ROLES, ''], default: '' },

  leadId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  contactId:      { type: mongoose.Schema.Types.ObjectId },
  contactName:    { type: String },

  // values of fields created in Customize Modules → Deals
  customFields: [customFieldSchema],

  owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Deal', dealSchema);
module.exports.CONTACT_ROLES = CONTACT_ROLES;
