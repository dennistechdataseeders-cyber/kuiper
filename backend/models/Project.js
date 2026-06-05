// backend/models/Project.js - UPDATED
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  clients: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  projectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: String,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  feeds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Feed' }],
  country: { type: String, required: true },
  industry: { type: String, required: true },
  projectCustomId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  leadId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LeadGen'
  },
  gitRepoUrl: { type: String },
  gitRepoName: { type: String },
  
  // NEW: Project Status Field
  projectStatus: {
    type: String,
    enum: [
      'New',
      'Once off',
      'Ad hoc',
      'BAU Initiated',
      'BAU Not Initiated',
      'ON hold[Sales]',
      'ON hold[Technical]',
      'ON hold[Client]',
      'Closed'
    ],
    default: 'New'
  }
});

// Method to update project status based on feed statuses
ProjectSchema.methods.updateStatusFromFeeds = async function() {
  const Feed = mongoose.model('Feed');
  const feeds = await Feed.find({ _id: { $in: this.feeds } });
  
  if (feeds.length === 0) {
    // No feeds, keep current status
    return this.projectStatus;
  }
  
  // Check if all feeds are ON hold (any type)
  const allFeedsOnHold = feeds.every(feed => 
    feed.feedStatus && feed.feedStatus.startsWith('ON hold')
  );
  
  if (allFeedsOnHold) {
    // Determine which ON hold type to use (prioritize Sales > Technical > Client)
    let holdType = null;
    if (feeds.some(f => f.feedStatus === 'ON hold[Sales]')) holdType = 'ON hold[Sales]';
    else if (feeds.some(f => f.feedStatus === 'ON hold[Technical]')) holdType = 'ON hold[Technical]';
    else if (feeds.some(f => f.feedStatus === 'ON hold[Client]')) holdType = 'ON hold[Client]';
    
    if (holdType && holdType !== this.projectStatus) {
      this.projectStatus = holdType;
      await this.save();
    }
    return this.projectStatus;
  }
  
  // Check if any feed is still pending (not delivered/completed)
  const hasActiveFeeds = feeds.some(feed => {
    const status = feed.feedStatus;
    return status && !status.includes('Delivered') && !status.includes('Closed') && !status.startsWith('ON hold');
  });
  
  if (hasActiveFeeds && this.projectStatus === 'Closed') {
    // Re-open project if there are active feeds
    this.projectStatus = 'BAU Initiated';
    await this.save();
  }
  
  return this.projectStatus;
};

module.exports = mongoose.model('Project', ProjectSchema);