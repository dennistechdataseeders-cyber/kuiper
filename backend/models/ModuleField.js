// backend/models/ModuleField.js
const mongoose = require('mongoose');

const moduleFieldSchema = new mongoose.Schema({
  moduleName: { 
    type: String, 
    required: true, 
    // Add all the modules you want to support here
    enum: ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Meetings', 'Calls', 'Projects'] 
  },
  label: { type: String, required: true },
  fieldKey: { type: String, required: true }, // e.g., 'custom_1628392_abc'
  
  // The exact field types from your screenshot
  type: { 
    type: String, 
    required: true,
    enum: [
      'Single Line', 'Multi-Line', 'Email', 'Phone', 'Pick List', 'Multi-Select',
      'Date', 'Date/Time', 'Number', 'Auto-Number', 'Currency', 'Decimal',
      'Percent', 'Long Integer', 'Checkbox', 'URL', 'Lookup', 'Multi User',
      'Formula', 'User', 'File Upload', 'Image Upload', 'Address'
    ]
  },
  
  // For Pick List / Multi-Select
  options: [{ 
    label: { type: String, required: true },
    value: { type: String, required: true }
  }],
  
  // General properties
  isRequired: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  defaultValue: { type: mongoose.Schema.Types.Mixed },
  
  // For Lookup / User fields
  lookupModule: { type: String }, // e.g., 'Accounts'
  
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure a fieldKey is unique per module
moduleFieldSchema.index({ moduleName: 1, fieldKey: 1 }, { unique: true });

module.exports = mongoose.model('ModuleField', moduleFieldSchema);