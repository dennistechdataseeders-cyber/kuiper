// backend/models/FeedDynamic.js
const mongoose = require('mongoose');

// Get the feed database URI from environment
const FEED_DB_URI = process.env.FEED_STATUS_MONGO_URI || process.env.CLIENT_FEED_DB_URI;

// Create a separate connection for feed data
let feedConnection;

if (FEED_DB_URI) {
  feedConnection = mongoose.createConnection(FEED_DB_URI);

  feedConnection.on('connected', () => {
    console.log('✅ Connected to Feed Database for dynamic models:', FEED_DB_URI);
  });

  feedConnection.on('error', (err) => {
    console.error('❌ Feed Database connection error:', err);
  });
} else {
  console.warn('⚠️ FEED_STATUS_MONGO_URI not found, using main connection');
  feedConnection = mongoose;
}

// Function to get a model for a specific collection (project)
const getFeedModelForProject = (projectId) => {
  const collectionName = String(projectId).trim();
  if (!collectionName) {
    throw new Error('Invalid project ID');
  }
  
  const modelName = `Feed_${collectionName}`;
  
  // Check if model already exists on the feed connection
  if (feedConnection.models[modelName]) {
    return feedConnection.models[modelName];
  }
  
  // Create a new model for this collection using the feed connection
  const dynamicSchema = new mongoose.Schema({}, {
    strict: false,
    collection: collectionName
  });
  
  return feedConnection.model(modelName, dynamicSchema);
};

module.exports = { getFeedModelForProject };