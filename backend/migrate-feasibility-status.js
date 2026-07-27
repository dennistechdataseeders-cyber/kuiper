// backend/migrate-feasibility-status.js
const mongoose = require('mongoose');
require('dotenv').config();
const LeadGen = require('./models/LeadGen');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Add projectManagerId field to all existing leads
    await LeadGen.updateMany(
      { projectManagerId: { $exists: false } },
      { $set: { projectManagerId: null, feasibilityCompletedAt: null } }
    );
    
    console.log('✅ Added projectManagerId and feasibilityCompletedAt fields');
    
    // Update any leads with status 'Feasibility Completed' to ensure they have the field
    await LeadGen.updateMany(
      { status: 'Feasibility Completed', feasibilityCompletedAt: null },
      { $set: { feasibilityCompletedAt: new Date() } }
    );
    
    console.log('✅ Updated feasibility completion dates');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

migrate();