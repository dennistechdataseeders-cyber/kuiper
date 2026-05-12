const mongoose = require('mongoose');

const FeedSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },

  feedType: {
    type: String,
    required: true,
    enum: ['Daily', 'Once off', 'Weekly', 'Add hoc'],
    default: 'Daily'
  },

  weekDay: {
    type: String,
    enum: [
      '',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ],
    default: ''
  },

  assignedDevelopers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  parameters: {
    type: Object,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Feed', FeedSchema);