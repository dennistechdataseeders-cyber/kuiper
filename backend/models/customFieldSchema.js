// backend/models/customFieldSchema.js
// Sub-schema for values of fields created in "Customize Modules".
// Used as:  customFields: [customFieldSchema]  on Organization, POC, Deal, LeadActivity.
const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema(
  {
    fieldKey: { type: String },
    label:    { type: String },
    type:     { type: String },
    value:    { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

module.exports = customFieldSchema;
