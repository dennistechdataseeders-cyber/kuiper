// backend/models/LeadFieldSchema.js
const mongoose = require('mongoose');

const leadFieldSchemaSchema = new mongoose.Schema({
  fieldKey: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'email', 'phone', 'number', 'date', 'textarea', 'select', 'checkbox'],
    default: 'text'
  },
  section: {
    type: String,
    enum: ['Lead Information', 'Address Information', 'Description Information', 'Custom'],
    default: 'Custom'
  },
  placeholder: { type: String, default: '' },

  // ✅ Options can be plain strings (legacy) OR { value, locked } objects.
  //    normalizeOptions() in leadRoutes.js coerces strings to
  //    { value, locked: false } on every read, so old data keeps working.
  options: [{ type: mongoose.Schema.Types.Mixed }],

  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }, // system fields can't be removed
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('LeadFieldSchema', leadFieldSchemaSchema);