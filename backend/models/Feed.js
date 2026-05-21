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

  // ADD THESE FIELDS FOR COMPLETION TRACKING
  completed: {
    type: Boolean,
    default: false
  },

  completedAt: {
    type: Date,
    default: null
  },

  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  completionDescription: {
    type: String,
    default: ''
  },

  // Track completion history for each day
  completionHistory: [{
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    description: {
      type: String,
      default: ''
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
FeedSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Feed', FeedSchema);