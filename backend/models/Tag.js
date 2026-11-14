// backend/models/Tag.js
// Zoho-style record tags. Tags belong to one module (Leads / Contacts / Accounts / Deals / Tasks / Meetings / Calls)
// and are shared by the whole sales team, so everyone picks from the same list.
const mongoose = require('mongoose');

const TAG_MODULES = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Meetings', 'Calls'];

const tagSchema = new mongoose.Schema({
  module:    { type: String, enum: TAG_MODULES, required: true, index: true },
  name:      { type: String, required: true, trim: true, maxlength: 40 },
  nameKey:   { type: String, required: true },          // lower-case name → no duplicates per module
  color:     { type: String, default: '#ffffff' },     // chip background (hex)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tagSchema.index({ module: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.models.Tag || mongoose.model('Tag', tagSchema);
module.exports.TAG_MODULES = TAG_MODULES;
