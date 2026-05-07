const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// 1. Register Logic
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: role.trim()
    });
    
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// 2. Login Logic
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Generate Token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_fallback_secret',
      { expiresIn: '12h' }
    );

    // Send Response
    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        role: user.role 
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // Generate Token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Set token and expiry (30 mins = 30 * 60 * 1000 ms)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 1800000; 

    await user.save();

    // Send Email (Update the URL to your frontend domain)
    const resetUrl = `http://localhost:5173/set-password?token=${resetToken}`;
    
    // Use your existing transporter logic from adminController
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset Request - Valid for 30 Mins',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`
    };

    // await transporter.sendMail(mailOptions); // Uncomment when ready

    res.json({ message: "Reset link sent to email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // 1. Find user with valid token and check if expiry is in the future ($gt: now)
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Token is invalid or has expired" });
    }

    // 2. Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 3. Clear reset fields so token can't be used again
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password updated successfully! You can now login." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// 3. Export both
module.exports = { login, register,forgotPassword,resetPassword };