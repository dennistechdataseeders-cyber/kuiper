// backend/models/FeedStatus.js
const mongoose = require('mongoose');

// Get the feed status database URI from environment
const FEED_STATUS_DB_URI = process.env.FEED_STATUS_MONGO_URI || process.env.CLIENT_FEED_DB_URI;

// Create a separate connection for feed status data
let feedStatusConnection;

if (FEED_STATUS_DB_URI) {
  feedStatusConnection = mongoose.createConnection(FEED_STATUS_DB_URI);

  feedStatusConnection.on('connected', () => {
    console.log('✅ Connected to Feed Status Database:', FEED_STATUS_DB_URI);
  });

  feedStatusConnection.on('error', (err) => {
    console.error('❌ Feed Status Database connection error:', err);
  });
} else {
  console.warn('⚠️ FEED_STATUS_MONGO_URI not found, using main connection for FeedStatus');
  feedStatusConnection = mongoose;
}

// Sub-schema for individual file information
const fileInfoSchema = new mongoose.Schema({
  path: { type: String, required: true },
  size: { type: String, default: null }, // Human-readable size like "1.2 GB"
  size_bytes: { type: Number, default: null }, // Size in bytes for calculations
  records: { type: Number, default: null }, // Number of records in the file
  format: { type: String, default: null }, // File format like "jsonl", "csv", etc.
  compression: { type: String, default: null }, // Compression type like "gzip", "none"
  checksum: { type: String, default: null }, // File checksum for verification
  last_modified: { type: String, default: null } // Last modified timestamp
}, { _id: false });

const feedStatusSchema = new mongoose.Schema({
  feed_name: { type: String, required: true, index: true },
  project: { type: String, required: true, index: true },
  client: { type: String, required: true, index: true },
  feed_type: { type: String },
  date: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed', 'Failed'], 
    default: 'Pending' 
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  failed: { type: Boolean, default: false },
  error_message: { type: String, default: '' },
  
  // Enhanced output_path with support for:
  // - String: single path string
  // - Array: multiple path strings
  // - Object: single file with metadata
  // - Array of Objects: multiple files with metadata
  output_path: { 
    type: mongoose.Schema.Types.Mixed, 
    default: '' 
  },
  
  // File metadata for the feed (aggregated information)
  file_metadata: {
    total_size: { type: String, default: null }, // Human-readable total size
    total_size_bytes: { type: Number, default: null }, // Total size in bytes
    total_files: { type: Number, default: 0 },
    total_records: { type: Number, default: null },
    format: { type: String, default: null },
    compression: { type: String, default: null }
  },
  
  // Individual file details with size information
  files: [fileInfoSchema],
  
  // ➕ NEW: Added for tracking data volume/counts during integrity check
  record_count: { type: Number, default: null },

  stages: {
    extraction_done: {
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null }
    },
    file_generated: {
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null }
    },
    file_integrity: {
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null }
    },
    upload_path: {
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null }
    },
    process_complete: {
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null }
    }
  },
  updated_at: { type: Date, default: Date.now }
}, {
  indexes: [
    { fields: { feed_name: 1, date: 1 }, unique: true }
  ]
});

// ============================================================
// INSTANCE METHODS
// ============================================================

/**
 * Get formatted file information for display
 */
feedStatusSchema.methods.getFileInfo = function() {
  if (this.files && this.files.length > 0) {
    return {
      files: this.files,
      metadata: this.file_metadata || {
        total_files: this.files.length,
        total_size: this.files.reduce((total, f) => total + (f.size || ''), ''),
        total_records: this.files.reduce((total, f) => total + (f.records || 0), 0)
      }
    };
  }
  
  // Handle legacy output_path formats
  if (this.output_path) {
    if (Array.isArray(this.output_path)) {
      return {
        files: this.output_path.map(p => ({
          path: p,
          size: null,
          records: null
        })),
        metadata: { total_files: this.output_path.length }
      };
    } else if (typeof this.output_path === 'object') {
      return {
        files: [this.output_path],
        metadata: { total_files: 1 }
      };
    } else if (typeof this.output_path === 'string') {
      return {
        files: [{ path: this.output_path, size: null, records: null }],
        metadata: { total_files: 1 }
      };
    }
  }
  
  return { files: [], metadata: {} };
};

/**
 * Get total file size in human-readable format
 */
feedStatusSchema.methods.getTotalFileSize = function() {
  if (this.file_metadata && this.file_metadata.total_size) {
    return this.file_metadata.total_size;
  }
  
  if (this.files && this.files.length > 0) {
    const totalBytes = this.files.reduce((total, f) => total + (f.size_bytes || 0), 0);
    if (totalBytes > 0) {
      return this.formatFileSize(totalBytes);
    }
    
    // Fallback to string sizes
    const sizes = this.files.map(f => f.size).filter(s => s);
    if (sizes.length > 0) {
      return sizes.join(' + ');
    }
  }
  
  return null;
};

/**
 * Format file size from bytes to human-readable format
 */
feedStatusSchema.methods.formatFileSize = function(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
};

// ============================================================
// STATIC METHODS
// ============================================================

/**
 * Get feed status with file information for a specific feed
 */
feedStatusSchema.statics.getFeedWithFileInfo = async function(feedName, date) {
  const feed = await this.findOne({ feed_name: feedName, date });
  if (!feed) return null;
  
  const fileInfo = feed.getFileInfo();
  return {
    ...feed.toObject(),
    fileInfo
  };
};

/**
 * Get all feeds for a project with file information
 */
feedStatusSchema.statics.getProjectFeedsWithFileInfo = async function(project, date) {
  const feeds = await this.find({ project, date });
  return feeds.map(feed => ({
    ...feed.toObject(),
    fileInfo: feed.getFileInfo()
  }));
};

// Create the model on the appropriate connection
const FeedStatus = feedStatusConnection.model('FeedStatus', feedStatusSchema);

// Ensure collection exists when connection is ready
if (feedStatusConnection && feedStatusConnection !== mongoose) {
  feedStatusConnection.once('open', async () => {
    try {
      await FeedStatus.createCollection();
      console.log('✅ FeedStatus collection verified');
    } catch (err) {
      // Collection might already exist - that's fine
      if (err.code !== 48) { // 48 = namespace exists
        console.error('⚠️ FeedStatus collection creation warning:', err.message);
      }
    }
  });
} else {
  // Main connection - wait for it to be ready
  mongoose.connection.once('open', async () => {
    try {
      await FeedStatus.createCollection();
      console.log('✅ FeedStatus collection verified on main connection');
    } catch (err) {
      if (err.code !== 48) {
        console.error('⚠️ FeedStatus collection creation warning:', err.message);
      }
    }
  });
}

module.exports = FeedStatus;