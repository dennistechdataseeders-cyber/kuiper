// backend/controllers/adminController.js - FULL UPDATED WITH PROBATION

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
    const { name, email, password, role, githubUsername, dateOfJoining } = req.body;
    const rawPassword = String(password);

    if (!rawPassword || rawPassword === "" || rawPassword === "undefined") {
      return res.status(400).json({ error: "Password is required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // ============================================
    // ✅ AUTO-SET PROBATION FOR EMPLOYEES
    // (not Admin, Super Admin, HR, Client)
    // ============================================
    let isProbationary = false;
    let probationEndDate = null;
    
    // Only set probation for regular employees (not Admin, Super Admin, HR, Client)
    const shouldHaveProbation = !['Admin', 'Super Admin', 'HR', 'Client'].includes(role);
    
    if (shouldHaveProbation) {
      isProbationary = true;
      
      // Use dateOfJoining if provided, otherwise use current date
      const startDate = dateOfJoining ? new Date(dateOfJoining) : new Date();
      probationEndDate = new Date(startDate);
      probationEndDate.setMonth(probationEndDate.getMonth() + 3); // 3 months probation
      
      console.log(`📋 Probation set for ${name}: until ${probationEndDate.toISOString().split('T')[0]}`);
    }

    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: role.trim(),
      githubUsername: githubUsername || '',
      // ✅ PROBATION FIELDS
      isProbationary: isProbationary,
      probationEndDate: probationEndDate,
      dateOfJoining: dateOfJoining || null
    });

    await user.save();
    console.log("✅ Checkpoint 1: User saved to DB");
    console.log(`📊 Probation status: ${isProbationary ? 'Active' : 'None'} (ends: ${probationEndDate || 'N/A'})`);

    // Send immediate response with probation info
    res.status(201).json({ 
      message: "User created. Sending email in background...",
      probation: isProbationary ? {
        isProbationary: true,
        endDate: probationEndDate,
        durationMonths: 3,
        daysRemaining: Math.ceil((probationEndDate - new Date()) / (1000 * 60 * 60 * 24))
      } : null
    });

    // BACKGROUND EMAIL LOGIC
    // We wrap this in an async IIFE to prevent blocking
    (async () => {
      try {
        console.log("✅ Checkpoint 2: Verifying Transporter...");
        
        // This line checks if your password/user is correct
        await transporter.verify(); 
        
        console.log("✅ Checkpoint 3: Transporter Verified. Sending Mail...");

        // Add probation info to email if applicable
        let probationNote = '';
        if (isProbationary && probationEndDate) {
          probationNote = `
            <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin:12px 0; border-left:4px solid #f59e0b;">
              <p style="margin:0; font-size:13px; color:#92400e;">
                <strong>📋 Probation Period:</strong> You are on probation for 3 months until 
                <strong>${probationEndDate.toLocaleDateString()}</strong>. 
                During this time, you can only apply for <strong>Unpaid Leave</strong>.
              </p>
            </div>
          `;
        }

        const mailOptions = {
          from: `"KUIPER" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: '🚀 Your System Access Credentials',
          html: `
            <h1>Welcome ${name}</h1>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${rawPassword}</p>
            ${probationNote}
            <p style="font-size:12px; color:#64748b; margin-top:16px;">
              Please change your password after your first login.
            </p>
          `
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