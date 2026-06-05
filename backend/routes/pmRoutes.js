// backend/routes/pmRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Log = require('../models/Log');
const gitService = require('../services/gitService');
const getWelcomeTemplate = require('../templates/welcomeEmail');

const { getAllProjects, createProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck'); 

router.use(protect);

// FIXED: Added the space to match "Project Manager" in your database
router.use(authorize('Admin', 'Project Manager', 'Sales', 'Sales Manager')); 

router.get('/projects', getAllProjects);
router.post('/projects', createProject);

// Add endpoint for PM to create developers
router.post('/users', authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // PM can only create Developer roles
    let finalRole = role;
    if (req.user.role === 'Project Manager') {
      if (role !== 'Developer') {
        return res.status(403).json({ error: 'Project Managers can only create Developer accounts' });
      }
      finalRole = 'Developer';
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already in use" });

    const cleanPassword = String(password || Math.random().toString(36).slice(-8));
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    // Create user
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: finalRole,
      githubUsername: null,
      githubLinked: false
    });

    // Save user first to get ID
    await newUser.save();

    // Try to link GitHub account automatically for developers
    let gitHubLinkResult = null;
    if (finalRole === 'Developer') {
      console.log(`👨‍💻 PM: Attempting to link GitHub account for developer: ${email}`);
      gitHubLinkResult = await gitService.linkGitHubAccountToUser(newUser._id, email);
      
      if (gitHubLinkResult.success && gitHubLinkResult.githubUsername) {
        newUser.githubUsername = gitHubLinkResult.githubUsername;
        newUser.githubLinked = true;
        await newUser.save();
        console.log(`✅ GitHub account linked: ${gitHubLinkResult.githubUsername}`);
      } else {
        console.log(`⚠️ GitHub account not found for ${email}`);
      }
    }

    // Send welcome email
    const frontendUrl = process.env.FRONTEND_URL || "http://192.168.1.105:5173";
    const emailHtml = getWelcomeTemplate(name, email, cleanPassword, finalRole, frontendUrl);
    
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

    const mailOptions = {
      from: `"KUIPER SYSTEM" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your System Access Credentials',
      html: emailHtml
    };

    transporter.sendMail(mailOptions)
      .then(info => console.log("✅ Email sent successfully:", info.messageId))
      .catch(err => console.error("❌ Email failed to send:", err.message));

    // Logging
    try {
      await Log.create({
        actionType: 'USER_CREATED',
        performerId: req.user._id,
        details: `Created ${finalRole}: ${name} (By ${req.user.role})${gitHubLinkResult?.success ? ` - GitHub linked: ${gitHubLinkResult.githubUsername}` : ' - GitHub not linked'}`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }

    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      ...userResponse,
      gitHubLinked: newUser.githubLinked,
      gitHubUsername: newUser.githubUsername
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(400).json({ error: err.message });
  }
});

// Add manual GitHub linking endpoint for PMs
router.post('/users/:userId/link-github', authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    if (user.role !== 'Developer') {
      return res.status(400).json({ 
        success: false, 
        error: 'GitHub linking is only available for Developer role' 
      });
    }
    
    const result = await gitService.linkGitHubAccountToUser(userId, user.email);
    
    if (result.success && result.githubUsername) {
      res.json({
        success: true,
        message: `GitHub account ${result.githubUsername} linked successfully`,
        githubUsername: result.githubUsername,
        githubLinked: true,
        profile_url: result.profile_url
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message || 'No GitHub account found with this email address',
        githubLinked: false
      });
    }
  } catch (error) {
    console.error('Error linking GitHub account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;