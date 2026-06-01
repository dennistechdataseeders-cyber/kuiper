// models/Project.js
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  clients: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'  // This allows population to get client details
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
  }
});

module.exports = mongoose.model('Project', ProjectSchema);