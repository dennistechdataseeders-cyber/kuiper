const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// 1. Bulletproof Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, githubUsername } = req.body;
    const rawPassword = String(password);

    if (!rawPassword || rawPassword === "" || rawPassword === "undefined") {
      return res.status(400).json({ error: "Password is required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: role.trim(),
      githubUsername: githubUsername || ''
    });

    await user.save();
    console.log("✅ Checkpoint 1: User saved to DB");

    // Send immediate response so frontend is happy
    res.status(201).json({ message: "User created. Sending email in background..." });

    // BACKGROUND EMAIL LOGIC
    // We wrap this in an async IIFE to prevent blocking
    (async () => {
      try {
        console.log("✅ Checkpoint 2: Verifying Transporter...");
        
        // This line checks if your password/user is correct
        await transporter.verify(); 
        
        console.log("✅ Checkpoint 3: Transporter Verified. Sending Mail...");

        const mailOptions = {
          from: `"KUIPER" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: '🚀 Your System Access Credentials',
          html: `<h1>Welcome ${name}</h1><p>Email: ${email}</p><p>Pass: ${rawPassword}</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Checkpoint 4: Email Sent!", info.messageId);

      } catch (mailError) {
        console.error("❌ MAIL SYSTEM ERROR:", mailError.message);
        console.error("DEBUG INFO:", {
          user: process.env.EMAIL_USER,
          passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
        });
      }
    })();

  } catch (error) {
    console.error("❌ CONTROLLER ERROR:", error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).populate('performerId', 'name role');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};