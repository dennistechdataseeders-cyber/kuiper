const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  actionType: { type: String, required: true }, // e.g., 'USER_CREATED', 'PROJECT_ADDED'
  performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema);