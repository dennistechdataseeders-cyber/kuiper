// backend/models/FeedSeparate.js
const mongoose = require('mongoose');

// Get the feed database URI from environment
const FEED_DB_URI = process.env.FEED_STATUS_MONGO_URI;

// Create a separate connection for feed data
let feedConnection;

if (FEED_DB_URI) {
  feedConnection = mongoose.createConnection(FEED_DB_URI);

  feedConnection.on('connected', () => {
    console.log('✅ Connected to Feed Database:', FEED_DB_URI);
  });

  feedConnection.on('error', (err) => {
    console.error('❌ Feed Database connection error:', err);
  });
} else {
  console.warn('⚠️ FEED_STATUS_MONGO_URI not found in .env, using main connection');
  feedConnection = mongoose;
}

const feedSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String },
  projectCustomId: { type: String },
  feedType: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Once off'], default: 'Daily' },
  weekDay: { type: String },
  monthDay: { type: Number },
  feedPlatform: { type: String, enum: ['Web', 'App', 'Both'] },
  webDomain: { type: String },
  assignedDevelopers: [{ type: String }],
  feedStatus: { type: String, default: 'New' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FeedSeparate = feedConnection.model('Feed', feedSchema);

module.exports = FeedSeparate;