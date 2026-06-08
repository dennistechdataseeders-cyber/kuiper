// backend/models/Project.js - UPDATED with Organization support
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // Original clients field for User references (backward compatibility)
  clients: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  
  // NEW: Organizations field for Organization references
  organizations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
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
  
  // Project Status Field
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
}, { timestamps: true });

// Method to update project status based on feed statuses
ProjectSchema.methods.updateStatusFromFeeds = async function() {
  const Feed = mongoose.model('Feed');
  const feeds = await Feed.find({ _id: { $in: this.feeds } });
  
  if (feeds.length === 0) {
    return this.projectStatus;
  }
  
  const allFeedsOnHold = feeds.every(feed => 
    feed.feedStatus && feed.feedStatus.startsWith('ON hold')
  );
  
  if (allFeedsOnHold) {
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
  
  const hasActiveFeeds = feeds.some(feed => {
    const status = feed.feedStatus;
    return status && !status.includes('Delivered') && !status.includes('Closed') && !status.startsWith('ON hold');
  });
  
  if (hasActiveFeeds && this.projectStatus === 'Closed') {
    this.projectStatus = 'BAU Initiated';
    await this.save();
  }
  
  return this.projectStatus;
};

// Virtual to get all assigned organizations with their details
ProjectSchema.virtual('organizationDetails', {
  ref: 'Organization',
  localField: 'organizations',
  foreignField: '_id',
  justOne: false
});

// Method to get all client names (both from clients and organizations)
ProjectSchema.methods.getAllClientNames = async function() {
  const clientNames = [];
  
  // Get from User clients
  if (this.clients && this.clients.length > 0) {
    const User = mongoose.model('User');
    const users = await User.find({ _id: { $in: this.clients } }).select('name');
    clientNames.push(...users.map(u => u.name));
  }
  
  // Get from Organization clients
  if (this.organizations && this.organizations.length > 0) {
    const Organization = mongoose.model('Organization');
    const orgs = await Organization.find({ _id: { $in: this.organizations } }).select('companyName');
    clientNames.push(...orgs.map(o => o.companyName));
  }
  
  return clientNames;
};

module.exports = mongoose.model('Project', ProjectSchema);