const mongoose = require('mongoose');

const EmailCampaignSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true
  },

  templateId: {
    type: String,
    required: true
  },

  startDate: {
    type: Date,
    default: Date.now
  },

  currentStep: {
    type: Number,
    default: 0
  },

  nextSendDate: {
    type: Date,
    required: true
  },

  completed: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: [
      'Pending',
      'Running',
      'Completed',
      'Failed'
    ],
    default: 'Pending'
  }

}, {
  timestamps: true
});

module.exports =
  mongoose.model(
    'EmailCampaign',
    EmailCampaignSchema
  );