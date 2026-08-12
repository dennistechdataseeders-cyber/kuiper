const mongoose = require('mongoose');

const ticketWorkLogSchema = new mongoose.Schema({
  developerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  totalTime: {
    type: Number,
    default: 0
  },
  isRunning: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: null
  },
  timeBlocks: [{
    startTime: Date,
    endTime: Date,
    duration: Number
  }],
  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Indexes for efficient queries
ticketWorkLogSchema.index({ developerId: 1, ticketId: 1, date: 1 }, { unique: true });
ticketWorkLogSchema.index({ developerId: 1, date: 1 });
ticketWorkLogSchema.index({ ticketId: 1 });

module.exports = mongoose.model('TicketWorkLog', ticketWorkLogSchema);