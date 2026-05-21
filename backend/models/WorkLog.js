const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
  developerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  feedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feed',
    required: true
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },

  date: {
    type: String,
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
  }]
}, { timestamps: true });

module.exports = mongoose.model('WorkLog', workLogSchema);