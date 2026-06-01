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
    required: true
  },
  feedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feed'
  },
  comments: [{
    text: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    images: [{ type: String }], // Array of image URLs
    createdAt: { type: Date, default: Date.now }
  }],
  resolvedAt: Date,
  closedAt: Date
}, { timestamps: true });

// Auto-generate ticket number
ticketSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);