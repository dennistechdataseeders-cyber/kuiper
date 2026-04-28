// backend/seedAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); 

const MONGO_URI = "mongodb://localhost:27017/keyword_system"; 

const seed = async () => {
  try {
    console.log("Checking User Model:", typeof User, User.name); // Should say 'function User'
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to Mongo");

    // Check if the function exists before calling it
    if (typeof User.findOne !== 'function') {
        throw new Error("User.findOne is still not a function. Check your User.js export.");
    }

    const existing = await User.findOne({ email: 'admin@test.com' });
    
    if (existing) {
      await User.deleteOne({ email: 'admin@test.com' });
      console.log("Existing admin removed.");
    }

    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await User.create({
      name: "System Admin",
      email: "admin@test.com",
      password: hashedPassword,
      role: "Admin"
    });

    console.log("✅ Admin created: admin@test.com / password123");
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

seed();