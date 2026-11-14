// backend/models/RecordTag.js
// Which tags are on which record. Kept in its own collection so the existing
// Lead / Organization / Deal schemas (and Contacts, which live inside an
// Organization's pointsOfContact) don't need to change.
//
// recordId = the row id the list page uses:
//   Leads → lead._id, Accounts → org._id, Deals → deal._id,
//   Contacts → `${org._id}-${poc._id}`
const mongoose = require('mongoose');
const { TAG_MODULES } = require('./Tag');

const recordTagSchema = new mongoose.Schema({
  module:   { type: String, enum: TAG_MODULES, required: true },
  recordId: { type: String, required: true },
  tags:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

recordTagSchema.index({ module: 1, recordId: 1 }, { unique: true });
recordTagSchema.index({ tags: 1 });

module.exports = mongoose.models.RecordTag || mongoose.model('RecordTag', recordTagSchema);
