const mongoose = require('mongoose');

const ticketActivitySchema = new mongoose.Schema({

  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  action: {
    type: String
  },

  oldValue: String,

  newValue: String

}, { timestamps: true });

module.exports = mongoose.model('TicketActivity', ticketActivitySchema);