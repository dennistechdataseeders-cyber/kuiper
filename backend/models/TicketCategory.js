// backend/models/TicketCategory.js
// Dynamic Category -> Subcategory -> Specific Issue tree used by the Create Ticket form.
const mongoose = require('mongoose');

// "When the ticket creator has one of creatorRoles, assign to users of assignRole instead"
const assignOverrideSchema = new mongoose.Schema({
  creatorRoles: [{ type: String }],
  assignRole: { type: String, required: true }
}, { _id: false });

const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  items: [{ type: String, trim: true }],            // "Specific Issue" options
  // special = no "Specific Issue" list, Project/Feed forced to General (Production > Feasibility / Others)
  special: { type: Boolean, default: false },
  clientVisible: { type: Boolean, default: true },  // only used when the category itself is clientVisible
  assignOverrides: [assignOverrideSchema],
  isActive: { type: Boolean, default: true }
});

const ticketCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  icon: { type: String, default: '📁' },
  color: { type: String, default: 'slate' },
  // Users with this role appear in the "Assign to ... Team Member" dropdown
  role: { type: String, default: '' },
  clientVisible: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  assignOverrides: [assignOverrideSchema],
  subcategories: [subcategorySchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('TicketCategory', ticketCategorySchema);