const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require('bcryptjs');

// Create a new User (Admin Dashboard logic)
exports.createUser = async (req, res) => {
  try {
    // Log the incoming type to your terminal
    console.log("Incoming Password Type:", typeof req.body.password);
    console.log("Incoming Body:", req.body);

    let { name, email, password, role } = req.body;

    // 1. Force the string type conversion again
    const saltPassword = String(password);

    if (!saltPassword || saltPassword === "undefined" || saltPassword === "") {
      return res.status(400).json({ error: "Password cannot be empty" });
    }

    // 2. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email exists" });

    // 3. Manual Hash
    const salt = await bcrypt.genSalt(10);
    // Passing saltPassword (the forced string) specifically
    const hashedPassword = await bcrypt.hash(saltPassword, salt);

    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role 
    });

    await user.save();
    res.status(201).json({ message: "User created" });
  } catch (error) {
    console.error("BCRYPT CRASH:", error);
    res.status(400).json({ error: error.message });
  }
};
// Get all Analytics Logs
exports.getAnalytics = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).populate('performerId', 'name role');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};