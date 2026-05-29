const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({

  ticketId: {
    type: String,
    unique: true
  },

  title: {
    type: String,
    required: true
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

  issueType: {
    type: String,
    enum: [
      'Bug',
      'Enhancement',
      'Data Issue',
      'Feed Failure',
      'UI Issue',
      'Performance',
      'Task',
      'Other'
    ],
    required: true
  },

  referenceEntries: [{
    type: String
  }],

  description: {
    type: String,
    required: true
  },

  priority: {
    type: String,
    enum: ['P1', 'P2', 'P3'],
    required: true
  },

  status: {
    type: String,
    enum: [
      'Open',
      'Assigned',
      'In Progress',
      'Waiting for Client',
      'QA Review',
      'Resolved',
      'Closed',
      'Reopened'
    ],
    default: 'Open'
  },

  slaHours: {
    type: Number,
    enum: [24, 48, 72],
    default: 48
  },

  slaDeadline: {
    type: Date
  },

  resolvedAt: Date,

  closedAt: Date,

  reopenedCount: {
    type: Number,
    default: 0
  },

  commentsCount: {
    type: Number,
    default: 0
  },

  attachments: [{
    fileName: String,
    fileUrl: String
  }],

  tags: [String],

  isSlaBreached: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

/*
========================================
AUTO GENERATE TICKET ID
========================================
*/

ticketSchema.pre('save', async function(next) {

  if (!this.ticketId) {

    const count = await mongoose.model('Ticket').countDocuments();

    this.ticketId = `KPR-${String(count + 1).padStart(5, '0')}`;
  }

  /*
  ========================================
  SLA DEADLINE
  ========================================
  */

  if (!this.slaDeadline) {

    const deadline = new Date();

    deadline.setHours(deadline.getHours() + this.slaHours);

    this.slaDeadline = deadline;
  }

  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);