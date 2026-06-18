const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  // Category fields
  category: {
    type: String,
    enum: ['Finance', 'HR', 'Payroll', 'Sales', 'Production', 'Admin', 'IT', 'Development', ''],
    default: ''
  },
  subcategory: {
    type: String,
    default: ''
  },
  subItem: {
    type: String,
    default: ''
  },
  ticketType: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  feedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feed',
    default: null
  },
  isInternal: {
    type: Boolean,
    default: false
  },
  comments: [{
    text: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    images: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  }],
  resolvedAt: Date,
  closedAt: Date,
  startedAt: Date
}, { timestamps: true });

// Auto-generate ticket number
ticketSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const prefix = this.isInternal ? 'INT' : 'TKT';
    this.ticketNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);