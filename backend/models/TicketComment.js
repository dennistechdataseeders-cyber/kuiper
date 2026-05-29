const mongoose = require('mongoose');

const ticketCommentSchema = new mongoose.Schema({

  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  comment: {
    type: String,
    required: true
  },

  isInternal: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

module.exports = mongoose.model('TicketComment', ticketCommentSchema);