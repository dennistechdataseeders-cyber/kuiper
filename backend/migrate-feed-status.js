// backend/migrate-feed-status.js
const mongoose = require('mongoose');
require('dotenv').config();

const FeedStatus = require('./models/FeedStatus');

async function migrateFeedStatus() {
  try {
    // Connect to the feed status database to read data
    const feedStatusConnection = mongoose.createConnection(process.env.FEED_STATUS_MONGO_URI);
    const oldFeedStatusModel = feedStatusConnection.model('FeedStatus', new mongoose.Schema({}, { strict: false, collection: 'feedstatuses' }));

    // Connect to the main database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to main database');

    // Read all existing feed statuses from old database
    const oldStatuses = await oldFeedStatusModel.find({});
    console.log(`📊 Found ${oldStatuses.length} feed statuses to migrate`);

    if (oldStatuses.length === 0) {
      console.log('No data to migrate');
      process.exit(0);
    }

    // Insert them into the new database
    let migratedCount = 0;
    for (const status of oldStatuses) {
      try {
        const statusData = status.toObject();
        delete statusData._id; // Remove the old _id to let MongoDB generate a new one

        await FeedStatus.updateOne(
          { feed_name: statusData.feed_name, date: statusData.date },
          { $set: statusData },
          { upsert: true }
        );
        migratedCount++;
      } catch (err) {
        console.error(`Failed to migrate feed ${statusData.feed_name}:`, err.message);
      }
    }

    console.log(`✅ Successfully migrated ${migratedCount} feed statuses to the main database`);

    // Close connections
    await feedStatusConnection.close();
    await mongoose.disconnect();
    console.log('Migration complete!');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run migration only if FEED_STATUS_MONGO_URI is defined
if (process.env.FEED_STATUS_MONGO_URI) {
  console.log('🚀 Starting feed status migration...');
  migrateFeedStatus();
} else {
  console.log('⚠️ FEED_STATUS_MONGO_URI not defined. Skipping migration.');
}