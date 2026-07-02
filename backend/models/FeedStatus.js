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
  
  // seamless support for strings or array paths
  output_path: { type: mongoose.Schema.Types.Mixed, default: '' }, 
  
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

// ... rest of the connection and model exporting logic below ...

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