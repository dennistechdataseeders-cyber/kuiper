// backend/models/Feed.js - UPDATED
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
    enum: ['Daily', 'Once off', 'Weekly', 'Monthly', 'Add hoc'],
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
  
  monthDay: {
    type: Number,
    min: 1,
    max: 31,
    default: null
  },
  
  feedPlatform: {
    type: String,
    enum: ['Web', 'App', 'Both'],
    default: null
  },
  
  webDomain: {
    type: String,
    default: null,
    trim: true
  },
  
  assignedDevelopers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  parameters: { 
    type: Object, 
    default: {} 
  },
  
  // Completion tracking fields
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
  },

  // Feed Status Field
  feedStatus: {
    type: String,
    enum: [
      'New',
      'In process', 
      'Awaiting Client Approval',
      'Once off[In progress]',
      'Once off[Delivered]',
      'Ad hoc In-progress',
      'Ad hoc delivered',
      'BAU Initiated',
      'ON hold[Sales]',
      'ON hold[Technical]',
      'ON hold[Client]',
      'Closed'
    ],
    default: 'New'
  },

  // ✅ FIX: Comments field at the top level (NOT inside feedStatus)
  comments: [{
    text: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }]
});

// Pre-save middleware to update the updatedAt timestamp
FeedSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
});

module.exports = mongoose.model('Feed', FeedSchema);