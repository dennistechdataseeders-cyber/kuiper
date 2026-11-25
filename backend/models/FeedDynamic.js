// backend/models/FeedDynamic.js
const mongoose = require('mongoose');

// Get the feed database URI from environment
const FEED_DB_URI = process.env.FEED_STATUS_MONGO_URI || process.env.MONGO_URI;

// Use separate connection ONLY when FEED_STATUS_MONGO_URI is set and different from MONGO_URI
let feedConnection;

if (process.env.FEED_STATUS_MONGO_URI && process.env.FEED_STATUS_MONGO_URI !== process.env.MONGO_URI) {
  feedConnection = mongoose.createConnection(process.env.FEED_STATUS_MONGO_URI);

  feedConnection.on('connected', () => {
    console.log('✅ Connected to Feed Database for dynamic models (separate):', process.env.FEED_STATUS_MONGO_URI);
  });

  feedConnection.on('error', (err) => {
    console.error('❌ Feed Database connection error:', err);
  });
} else {
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
