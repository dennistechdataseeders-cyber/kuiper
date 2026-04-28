const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  feedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feed' },
  performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The PM/Admin
  targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // The Developers
  details: { type: String, required: true },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Completed'] }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema); // This creates the 'tasks' collection