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
  // Added feedType with validation
 // models/Feed.js
feedType: { 
  type: String, 
  required: true,
  enum: ['Daily', 'Once off', 'Weekly', 'Add hoc'], // Must match frontend exactly
  default: 'Daily' 
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