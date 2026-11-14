// backend/models/Ticket.js

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open',
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
  },

  // ============================================
  // Category fields
  // ============================================
  // Free text now: the list of valid categories is managed dynamically
  // (see TicketCategory model) so the old hard-coded enum was removed.
  category: {
    type: String,
    default: '',
  },
  subcategory: {
    type: String,
    default: '',
  },
  subItem: {
    type: String,
    default: '',
  },
  ticketType: {
    type: String,
    default: '',
  },

  // ============================================
  // People on the ticket
  // ============================================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // ✅ NEW: Project Manager assigned by a Sales user when they create
  //    Development → Feasibility → New Feasibility tickets.
  //    Stays null for all other ticket types.
  assignedPM: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  // ============================================
  // NEW: Watchers field - users who follow this ticket
  // ============================================
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // ============================================
  // Project / Feed context
  // ============================================
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },
  feedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feed',
    default: null,
  },
  isInternal: {
    type: Boolean,
    default: false,
  },

  // ============================================
  // Attachments + comments
  // ============================================
  files: [{
    url: { type: String },
    filename: { type: String },
    originalName: { type: String },
    size: { type: Number },
    type: { type: String },
  }],
  comments: [{
    text: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    images: [{ type: String }],
    files: [{
      url: { type: String },
      filename: { type: String },
      originalName: { type: String },
      size: { type: Number },
      type: { type: String },
    }],
    createdAt: { type: Date, default: Date.now },
  }],

  resolvedAt: Date,
  closedAt: Date,
  startedAt: Date,

  // Every status change (shown on hover in the ticket's Progress bar)
  statusHistory: [{
    status: { type: String },
    from:   { type: String },
    at:     { type: Date, default: Date.now },
    by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String },
  }],
}, { timestamps: true });

// Auto-generate ticket number
ticketSchema.pre('save', async function () {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const prefix = this.isInternal ? 'INT' : 'TKT';
    this.ticketNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);