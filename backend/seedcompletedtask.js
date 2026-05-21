// scripts/updateFeeds.js
const mongoose = require('mongoose');
require('dotenv').config();

const Feed = require('./models/Feed');

const updateFeeds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await Feed.updateMany(
      {},
      {
        $set: {
          completed: false,
          completedAt: null,
          completedBy: null,
          completionDescription: "",
          completionHistory: []
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} feeds`);
    console.log(`Matched ${result.matchedCount} feeds`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error updating feeds:', error);
  }
};

updateFeeds();