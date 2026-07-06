const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  folder: {
    type: String,
    required: true,
    trim: true
  },
  files: [{
    url: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster folder lookups
knowledgeBaseSchema.index({ folder: 1 });
knowledgeBaseSchema.index({ title: 1 });

// Static method to get all unique folders
knowledgeBaseSchema.statics.getFolders = async function() {
  return await this.distinct('folder');
};

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema); 