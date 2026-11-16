const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');  
const Task = require('../models/Task');
const gitService = require('../services/gitService');

// --- MODELS ---
const User = require('../models/User');
const Log = require('../models/Log');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Prospect = require('../models/Prospect');
const LeadGen = require('../models/LeadGen');
const Organization = require('../models/Organization');
const ProjectClient = require('../models/ProjectClient');

// --- MIDDLEWARE ---
const { authorize } = require('../middleware/roleCheck');
const { blockStartAfter } = require('../utils/accessBlock');
const getWelcomeTemplate = require('../templates/welcomeEmail');
const { protect } = require('../middleware/authMiddleware');

// --- RESEND (for invitation emails only) ---
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// POC / client accounts are visible to and managed by Admin and Super Admin only (not HR)
const POC_ROLES = ['Client', 'POC'];

// HELPER: Protect Admin / Super Admin / HR accounts from HR edits
// ============================================
function hrCannotTouchPrivilegedRoles(req) {
  // Returns true if the requester is HR — callers then check the target
  return req.user && req.user.role === 'HR';
}

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

// GET /users - Fetch all users
router.get('/users', authorize('Super Admin', 'Admin', 'Project Manager', 'Sales Manager', 'Sales', 'Team Lead', 'HR', 'Finance', 'Developer'), async (req, res) => {
  try {
    let filter = {};
    
    // If role query param is provided, filter by it
    if (req.query.role) {
      filter = { role: req.query.role };
    } else if (req.user.role === 'Sales Manager') {
      filter = { role: 'Sales' };
    }

    // HR never sees POC / client accounts — only Admin and Super Admin manage them
    if (req.user.role === 'HR') {
      if (req.query.role && POC_ROLES.includes(req.query.role)) return res.json([]);
      if (!req.query.role) filter = { role: { $nin: POC_ROLES } };
    }
    
    const users = await User.find(filter)
      .select('-password')
      .populate('organizationId', 'companyName website')
      .sort({ createdAt: -1 });
    
    // Attach counts for Prospects and Leads to each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();
      userObj.prospectCount = await Prospect.countDocuments({ salesRepId: user._id });
      userObj.leadCount = await LeadGen.countDocuments({ salesRepId: user._id });
      return userObj;
    }));
    
    res.json(usersWithStats);
  } catch (err) {
    console.error("Error in /users route:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET USERS BY ROLE - FOR TICKET ASSIGNMENT
// ============================================
router.get('/users/by-role/:role', protect, authorize('Super Admin', 'Admin', 'Project Manager', 'Team Lead', 'HR', 'Finance','Developer', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { role } = req.params;

    if (req.user.role === 'HR' && POC_ROLES.includes(role)) {
      return res.status(403).json({ error: 'HR cannot view POC accounts' });
    }
    
    // Validate role
    const validRoles = ['Admin', 'HR', 'Finance', 'Sales', 'Project Manager', 'Developer', 'Team Lead', 'IT', 'Client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    // Find users with the specified role
    const users = await User.find({ role: role, isActive: { $ne: false } })
      .select('name email _id role githubUsername githubLinked')
      .sort({ name: 1 });
    
    console.log(`👥 Found ${users.length} users with role: ${role}`);
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /change-password - Change user password
router.post('/change-password', authorize('Super Admin', 'Admin', 'Sales Manager', 'Sales', 'Project Manager', 'Developer'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    
    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ UPDATED: POST /users - Create new user WITH PROBATION
// ✅ HR added — HR can create users, but cannot create Admin / Super Admin
// ============================================
router.post('/users', authorize('Super Admin', 'Admin', 'HR', 'Project Manager', 'Sales Manager'), async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      githubUsername, 
      organizationId, 
      department, 
      isPrimaryPOC,
      dateOfJoining,
      dateOfBirth,
      contactNumber,
      emergencyContact,
      address,
      shiftHour,
      shiftMinute,
      shiftAmPm
    } = req.body;
    
    console.log("Creating user with data:", { name, email, role, organizationId, department, isPrimaryPOC, dateOfJoining });
    
    let finalRole = role;

    // ============================================
    // ✅ HR SAFETY GUARD: HR cannot create Admin / Super Admin
    // ============================================
    if (hrCannotTouchPrivilegedRoles(req)) {
      if (POC_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Only Admin or Super Admin can add POC accounts' });
      }
      if (['Admin', 'Super Admin'].includes(role)) {
        return res.status(403).json({
          error: 'HR cannot create Admin or Super Admin accounts'
        });
      }
    }

    // Authorization Logic for Role Creation
    if (req.user.role === 'Sales Manager') {
      finalRole = 'Sales'; 
    } else if (req.user.role === 'Project Manager') {
      // PM can create: Client OR Team Lead
      if (role === 'Team Lead') {
        finalRole = 'Team Lead';
      } else {
        finalRole = 'Client';
      }
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already in use" });

    const cleanPassword = String(password || "123456");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    // ============================================
    // ✅ AUTO-SET PROBATION FOR EMPLOYEES
    // (not Admin, Super Admin, HR, Client)
    // ============================================
    let isProbationary = false;
    let probationEndDate = null;
    
    // Only set probation for regular employees (not Admin, Super Admin, HR, Client)
    const shouldHaveProbation = !['Admin', 'Super Admin', 'HR', 'Client'].includes(finalRole);
    
    if (shouldHaveProbation) {
      isProbationary = true;
      
      // Use dateOfJoining if provided, otherwise use current date
      const startDate = dateOfJoining ? new Date(dateOfJoining) : new Date();
      probationEndDate = new Date(startDate);
      probationEndDate.setMonth(probationEndDate.getMonth() + 3); // 3 months probation
      
      console.log(`📋 Probation set for ${name}: until ${probationEndDate.toISOString().split('T')[0]}`);
    }

    // Create user with organization fields AND PROBATION
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: finalRole,
      githubUsername: githubUsername || null,
      githubLinked: false,
      organizationId: organizationId || null,
      department: department || 'Other',
      isPrimaryPOC: isPrimaryPOC || false,
      employeeCode: null,
      // NEW FIELDS
      dateOfJoining: dateOfJoining || null,
      dateOfBirth: dateOfBirth || null,
      contactNumber: contactNumber || '',
      emergencyContact: emergencyContact || '',
      address: address || '',
      shiftHour: parseInt(shiftHour) || 9,
      shiftMinute: parseInt(shiftMinute) || 0,
      shiftAmPm: shiftAmPm || 'AM',
      // ✅ PROBATION FIELDS
      isProbationary: isProbationary,
      probationEndDate: probationEndDate
    });

    // If role is Developer, try to link GitHub account automatically
    let gitHubLinkResult = null;
    if (finalRole === 'Developer') {
      console.log(`👨‍💻 Attempting to link GitHub account for developer: ${email}`);
      gitHubLinkResult = await gitService.linkGitHubAccountToUser(newUser._id, email);
      
      if (gitHubLinkResult.success && gitHubLinkResult.githubUsername) {
        newUser.githubUsername = gitHubLinkResult.githubUsername;
        newUser.githubLinked = true;
        console.log(`✅ GitHub account linked: ${gitHubLinkResult.githubUsername}`);
      } else {
        console.log(`⚠️ GitHub account not found for ${email}`);
      }
    }

    await newUser.save();
    
    console.log("User saved with organizationId:", newUser.organizationId);
    console.log(`📊 Probation status: ${isProbationary ? 'Active' : 'None'} (ends: ${probationEndDate || 'N/A'}`);

    // Send welcome email via Resend with probation info
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

    const emailHtml = `
      ${getWelcomeTemplate(name, email, cleanPassword, finalRole, "https://kuiperapp.co.in/login")}
      ${probationNote}
    `;

    resend.emails.send({
      from: 'Kuiper CRM <no-reply@kuiperapp.co.in>',
      to: email,
      subject: 'Your System Access Credentials',
      html: emailHtml
    })
      .then(data => console.log("✅ Invitation email sent:", data.id))
      .catch(err => console.error("❌ Invitation email failed:", err.message));

    // Logging
    try {
      await Log.create({
        actionType: 'USER_CREATED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} created ${finalRole}: ${name} (${email})${gitHubLinkResult?.success ? ` - GitHub linked: ${gitHubLinkResult.githubUsername}` : ' - GitHub not linked'}${organizationId ? ` - Organization: ${organizationId}` : ''}${isProbationary ? ` - Probation until ${probationEndDate.toISOString().split('T')[0]}` : ''}`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }

    // Return user with GitHub status and organization
    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    // Populate organization details if needed
    if (userResponse.organizationId) {
      const org = await Organization.findById(userResponse.organizationId).select('companyName');
      if (org) {
        userResponse.organizationId = org;
      }
    }
    
    res.status(201).json({
      ...userResponse,
      gitHubLinked: newUser.githubLinked,
      gitHubUsername: newUser.githubUsername,
      probation: isProbationary ? {
        isProbationary: true,
        endDate: probationEndDate,
        durationMonths: 3,
        daysRemaining: Math.ceil((probationEndDate - new Date()) / (1000 * 60 * 60 * 24))
      } : null
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// ✅ UPDATED: PUT /users/:id - Update user
// ✅ HR added — HR can edit, but cannot touch Admin / Super Admin / other HR
// ============================================
router.put('/users/:id', authorize('Super Admin', 'Admin', 'HR'), async (req, res) => {
  try {
    const { 
      name, 
      email, 
      role, 
      githubUsername, 
      organizationId, 
      department, 
      isPrimaryPOC, 
      password,
      employeeCode,
      dateOfJoining,
      dateOfBirth,
      contactNumber,
      emergencyContact,
      address,
      shiftHour,
      shiftMinute,
      shiftAmPm,
      isProbationary,
      probationEndDate
    } = req.body;
    
    // First, get the existing user to preserve GitHub info
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ============================================
    // ✅ HR SAFETY GUARD: HR cannot edit Admin / Super Admin / HR
    // ============================================
    if (hrCannotTouchPrivilegedRoles(req)) {
      if (POC_ROLES.includes(existingUser.role) || (role && POC_ROLES.includes(role))) {
        return res.status(403).json({ error: 'Only Admin or Super Admin can manage POC accounts' });
      }
      if (['Admin', 'Super Admin', 'HR'].includes(existingUser.role)) {
        return res.status(403).json({
          error: 'HR cannot modify Admin, Super Admin, or other HR accounts'
        });
      }
      // Also block HR from promoting someone INTO Admin / Super Admin / HR
      if (role && ['Admin', 'Super Admin', 'HR'].includes(role) && role !== existingUser.role) {
        return res.status(403).json({
          error: 'HR cannot promote users to Admin, Super Admin, or HR'
        });
      }
    }
    
    // Build update data - preserve GitHub info if not provided in request
    const updateData = { 
      name, 
      email, 
      role, 
      githubUsername: githubUsername !== undefined ? githubUsername : existingUser.githubUsername,
      githubLinked: existingUser.githubLinked,
      organizationId: organizationId || null,
      department: department || 'Other',
      isPrimaryPOC: isPrimaryPOC || false,
      employeeCode: employeeCode || null,
      // NEW FIELDS
      dateOfJoining: dateOfJoining !== undefined ? dateOfJoining : existingUser.dateOfJoining,
      dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existingUser.dateOfBirth,
      contactNumber: contactNumber !== undefined ? contactNumber : existingUser.contactNumber,
      emergencyContact: emergencyContact !== undefined ? emergencyContact : existingUser.emergencyContact,
      address: address !== undefined ? address : existingUser.address,
      shiftHour: shiftHour !== undefined ? parseInt(shiftHour) : existingUser.shiftHour,
      shiftMinute: shiftMinute !== undefined ? parseInt(shiftMinute) : existingUser.shiftMinute,
      shiftAmPm: shiftAmPm !== undefined ? shiftAmPm : existingUser.shiftAmPm,
      // ✅ PROBATION FIELDS - allow updates
      isProbationary: isProbationary !== undefined ? isProbationary : existingUser.isProbationary,
      probationEndDate: probationEndDate !== undefined ? probationEndDate : existingUser.probationEndDate
    };
    
    // Only update password if provided
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Log the update
    try {
      await Log.create({
        actionType: 'USER_UPDATED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} updated user ${existingUser.email}`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }
    
    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PATCH /users/:id/access - Block / unblock login
// body: { action: 'block' | 'unblock', mode: 'now' | 'after', lastWorkingDay: 'YYYY-MM-DD', reason }
//   mode 'now'   → signed out and blocked immediately
//   mode 'after' → can work through lastWorkingDay; blocked from 00:00 IST the next day
// Admin / Super Admin / HR. HR cannot block Admin, Super Admin, HR or POC accounts.
// ============================================
router.patch('/users/:id/access', authorize('Super Admin', 'Admin', 'HR'), async (req, res) => {
  try {
    const { action, mode = 'now', lastWorkingDay, reason = '' } = req.body || {};
    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({ error: "action must be 'block' or 'unblock'" });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot block your own account' });
    }
    if (target.role === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Only a Super Admin can block a Super Admin' });
    }
    if (hrCannotTouchPrivilegedRoles(req)) {
      if (POC_ROLES.includes(target.role)) {
        return res.status(403).json({ error: 'Only Admin or Super Admin can manage POC accounts' });
      }
      if (['Admin', 'Super Admin', 'HR'].includes(target.role)) {
        return res.status(403).json({ error: 'HR cannot block Admin, Super Admin, or other HR accounts' });
      }
    }

    let summary;
    if (action === 'unblock') {
      target.isActive = true;
      target.accessBlockedFrom = null;
      target.accessBlockReason = '';
      target.accessBlockedBy = null;
      target.accessBlockedOn = null;
      summary = 'restored login access for';
    } else {
      let from = new Date();
      if (mode === 'after') {
        const start = blockStartAfter(lastWorkingDay);
        if (!start) return res.status(400).json({ error: 'Pick a valid last working day' });
        if (start > from) from = start; // a past last working day just blocks now
      }
      const immediate = from <= new Date();
      target.accessBlockedFrom = from;
      target.accessBlockReason = String(reason).trim().slice(0, 500);
      target.accessBlockedBy = req.user._id;
      target.accessBlockedOn = new Date();
      if (immediate) target.isActive = false;
      summary = immediate
        ? 'blocked login for'
        : `scheduled login block (from ${from.toISOString()}) for`;
    }

    await target.save();

    try {
      await Log.create({
        actionType: action === 'block' ? 'USER_ACCESS_BLOCKED' : 'USER_ACCESS_RESTORED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} ${summary} ${target.email} (${target.role})${target.accessBlockReason ? ` - Reason: ${target.accessBlockReason}` : ''}`,
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error('Non-critical Log Error:', logErr.message);
    }

    const out = target.toObject();
    delete out.password;
    res.json({ message: action === 'block' ? 'Access updated' : 'Access restored', user: out });
  } catch (err) {
    console.error('Error updating user access:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ UPDATED: DELETE /users/:id - Delete user
// ✅ HR added — HR cannot delete Admin / Super Admin / other HR
// ============================================
router.delete('/users/:id', authorize('Super Admin', 'Admin', 'HR'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ============================================
    // ✅ HR SAFETY GUARD
    // ============================================
    if (hrCannotTouchPrivilegedRoles(req)) {
      if (POC_ROLES.includes(target.role)) {
        return res.status(403).json({ error: 'Only Admin or Super Admin can manage POC accounts' });
      }
      if (['Admin', 'Super Admin', 'HR'].includes(target.role)) {
        return res.status(403).json({
          error: 'HR cannot delete Admin, Super Admin, or other HR accounts'
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    // Log the delete
    try {
      await Log.create({
        actionType: 'USER_DELETED',
        performerId: req.user._id,
        details: `${req.user.role} ${req.user.name} deleted user ${target.email} (${target.role})`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ UPDATED: POST /users/:userId/link-github - Link GitHub account for a developer
// ✅ HR added
// ============================================
router.post('/users/:userId/link-github', authorize('Super Admin', 'Admin', 'HR', 'Project Manager'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    if (user.role !== 'Developer') {
      return res.status(400).json({ 
        success: false, 
        error: 'GitHub linking is only available for Developer role' 
      });
    }

    // Check if GitHub token is configured
    if (!process.env.GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN not configured in .env');
      return res.status(500).json({
        success: false,
        error: 'GitHub service is not configured. Please check the GITHUB_TOKEN environment variable.',
        debug: {
          hasToken: false,
          tip: 'Add GITHUB_TOKEN to your .env file'
        }
      });
    }

    // Check if octokit is initialized
    if (!gitService.octokit) {
      console.error('❌ Octokit not initialized. Check GITHUB_TOKEN.');
      return res.status(500).json({
        success: false,
        error: 'GitHub service is not initialized. Please check the GITHUB_TOKEN environment variable.',
        debug: {
          hasToken: !!process.env.GITHUB_TOKEN,
          tokenPrefix: process.env.GITHUB_TOKEN?.substring(0, 4),
          tip: 'Make sure GITHUB_TOKEN starts with "ghp_" and has the correct permissions'
        }
      });
    }

    console.log(`🔍 Searching GitHub for email: ${user.email}`);
    
    try {
      // Search for user by email
      const searchResult = await gitService.octokit.search.users({
        q: `${user.email} in:email`,
        per_page: 5
      });

      console.log(`🔍 GitHub search result for ${user.email}:`);
      console.log(`   total_count: ${searchResult.data.total_count}`);
      
      if (searchResult.data.items && searchResult.data.items.length > 0) {
        console.log(`   items:`, searchResult.data.items.map(i => ({ 
          login: i.login, 
          id: i.id,
          type: i.type
        })));
      }

      if (searchResult.data.total_count === 0) {
        return res.status(200).json({
          success: false,
          error: `No GitHub account found for email: ${user.email}. The email may be private or not associated with a GitHub account.`,
          githubLinked: false,
          debug: {
            emailSearched: user.email,
            totalCount: 0,
            tip: 'Go to github.com/settings/profile and make sure the email is visible in your public profile'
          }
        });
      }

      const username = searchResult.data.items[0].login;
      console.log(`✅ Found GitHub user: ${username}`);

      // Get full profile
      const userDetails = await gitService.octokit.users.getByUsername({ 
        username 
      });

      // Update user with GitHub info
      user.githubUsername = userDetails.data.login;
      user.githubLinked = true;
      await user.save();

      console.log(`✅ GitHub account linked for ${user.email}: ${userDetails.data.login}`);

      res.json({
        success: true,
        message: `GitHub account ${userDetails.data.login} linked successfully`,
        githubUsername: userDetails.data.login,
        githubLinked: true,
        profile_url: userDetails.data.html_url,
        avatar_url: userDetails.data.avatar_url
      });

    } catch (searchError) {
      console.error('❌ GitHub search error:', searchError.message);
      
      // Handle rate limiting
      if (searchError.status === 403 && searchError.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'GitHub API rate limit exceeded. Please try again later or use a GitHub token with higher limits.',
          githubLinked: false
        });
      }
      
      // Handle not found
      if (searchError.status === 404) {
        return res.status(200).json({
          success: false,
          error: `No GitHub account found for email: ${user.email}`,
          githubLinked: false,
          debug: {
            emailSearched: user.email,
            status: 404,
            tip: 'Make sure the email is public on GitHub'
          }
        });
      }
      
      throw searchError;
    }

  } catch (error) {
    console.error('❌ Error linking GitHub account:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to link GitHub account',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// AUDIT & ANALYTICS ROUTES
// ============================================

router.get('/analytics', authorize('Super Admin', 'Admin', 'Sales', 'Project Manager', 'Sales Manager', 'HR'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    let filter = {};
    
    if (req.user.role === 'Sales') {
      filter = { performerId: req.user._id };
    } else if (req.user.role === 'Sales Manager') {
      const salesActions = ['USER_CREATED', 'PROSPECT_IMPORTED', 'LEAD_GENERATED', 'FOLLOW_UP_SET', 'LEAD_CLOSED'];
      filter = { actionType: { $in: salesActions } };
    }

    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('performerId', 'name role')
      .lean();

    const count = await Log.countDocuments(filter);

    res.json({
      logs,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: parseInt(page),
      totalLogs: count
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// ============================================
// PROJECT MANAGEMENT ROUTES
// ============================================

// GET /projects - General projects route
router.get('/projects', authorize('Super Admin', 'Admin', 'Project Manager', 'Client', 'Team Lead', 'HR', 'Developer'), async (req, res) => {
  try {
    let query = {};
    
    // ✅ FIX: Super Admin and Admin see ALL projects (no filter)
    if (req.user.role === 'Super Admin' || req.user.role === 'Admin' || req.user.role === 'HR') {
      query = {};
    } 
    // Role-based filtering for other roles
    else if (req.user.role === 'Team Lead') {
      query = { teamLead: req.user._id };
    } else if (req.user.role === 'Project Manager') {
      query = { projectManager: req.user._id };
    } else if (req.user.role === 'Developer') {
      // Developer: only projects that contain a feed assigned to them (same rule as /api/dev/my-projects)
      const assignedFeeds = await Feed.find({ assignedDevelopers: req.user._id }).select('projectId');
      query = { _id: { $in: [...new Set(assignedFeeds.map(f => String(f.projectId)))] } };
    } else if (req.user.role === 'Client') {
      // Client logic - get projects where they are a client or their organization is assigned
      const clientIdStr = req.user._id.toString();
      const clientOrgId = req.user.organizationId;
      
      const projects = await Project.aggregate([
        {
          $addFields: {
            clientIdsAsString: {
              $map: {
                input: "$clients",
                as: "client",
                in: { $toString: "$$client" }
              }
            }
          }
        },
        {
          $match: {
            $or: [
              { $expr: { $in: [clientIdStr, "$clientIdsAsString"] } },
              ...(clientOrgId ? [{ organizations: clientOrgId }] : [])
            ]
          }
        }
      ]);
      
      const populatedProjects = await Project.populate(projects, [
        { path: 'clients', select: 'name email role' },
        { path: 'organizations', select: 'companyName' },
        { path: 'projectManager', select: 'name email' },
        { path: 'teamLead', select: 'name email' },
        {
          path: 'feeds',
          populate: {
            path: 'assignedDevelopers',
            select: 'name email',
            model: 'User'
          }
        }
      ]);
      
      return res.json(populatedProjects);
    }
    
    // Execute query for Admin, Super Admin, PM, Team Lead
    const data = await Project.find(query)
      .populate('clients', 'name email role')
      .populate('organizations', 'companyName website address')
      .populate('projectManager', 'name email')
      .populate('teamLead', 'name email')
      .populate({
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 });
      
    res.json(data);
  } catch (err) {
    console.error('Error in /projects route:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /projects - Create project with GitHub integration
router.post('/projects', authorize('Super Admin', 'Admin', 'Project Manager', 'Sales'), async (req, res) => {
  try {
    const { name, clients, organizations, description, country, industry, projectManager, assignedDevelopers } = req.body;

    // Generate Serial Number
    const projectCount = await Project.countDocuments();
    const serialNumber = String(projectCount + 1).padStart(4, '0');
    
    // Get 2-letter Country Code
    const countryCode = COUNTRY_MAP[country] || (country ? country.substring(0, 2).toUpperCase() : 'XX');
    
    // Get 4-letter Industry Code (uppercase)
    const industryCode = (industry || 'GEN').toUpperCase().substring(0, 4);
    
    // Format: TDS0011-ECOM | AE | Books Data Extraction
    const fullFormattedName = `TDS${serialNumber}-${industryCode} | ${countryCode} | ${name}`;

    const newProject = new Project({
      name: fullFormattedName,
      clients: clients || [],
      organizations: organizations || [],
      description,
      adminId: req.user._id,
      projectManager: projectManager || (req.user.role === 'Project Manager' ? req.user._id : null),
      country,
      industry,
      projectCustomId: fullFormattedName
    });

    await newProject.save();
    
    // CREATE GITHUB REPOSITORY AND INVITE DEVELOPERS BY USER ID
    let gitRepo = null;
    let inviteResults = [];
    
    if (process.env.GITHUB_TOKEN) {
      const cleanDescription = (description || '')
        .replace(/[\n\r\t]/g, ' ')
        .replace(/[^\x20-\x7E]/g, '')
        .substring(0, 350);
      
      let developerIds = [];
      let developersWithNoGitHub = [];
      
      if (assignedDevelopers && assignedDevelopers.length > 0) {
        const developers = await User.find({ 
          _id: { $in: assignedDevelopers },
          role: 'Developer'
        }).select('email name githubUsername githubLinked');
        
        developerIds = developers.map(d => d._id);
        developersWithNoGitHub = developers.filter(d => !d.githubUsername || !d.githubLinked);
        
        if (developersWithNoGitHub.length > 0) {
          console.warn(`⚠️ ${developersWithNoGitHub.length} developers without GitHub account:`, 
            developersWithNoGitHub.map(d => d.email));
        }
        
        console.log(`Will invite ${developerIds.length} developers via GitHub using stored usernames`);
      }
      
      gitRepo = await gitService.createRepository(
        fullFormattedName,
        `Project: ${name} | Industry: ${industry} | Country: ${country}`,
        developerIds
      );
      
      if (gitRepo && gitRepo.success) {
        newProject.gitRepoUrl = gitRepo.repoUrl;
        newProject.gitRepoName = gitRepo.repoName;
        await newProject.save();
        
        console.log(`Repository created: ${gitRepo.repoName}`);
        if (gitRepo.addedCollaborators && gitRepo.addedCollaborators.length > 0) {
          console.log(`GitHub invited: ${gitRepo.addedCollaborators.map(c => c.username).join(', ')}`);
        }
        if (gitRepo.failedCollaborators && gitRepo.failedCollaborators.length > 0) {
          console.log(`Failed invitations:`, gitRepo.failedCollaborators);
          inviteResults = gitRepo.failedCollaborators;
        }
      }
    }

    // Log creation
    try {
      await Log.create({
        actionType: 'PROJECT_CREATED',
        performerId: req.user._id,
        details: `Created project: ${name} [${fullFormattedName}]${gitRepo?.success ? ' ✓ Git repo created' : ''}`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }

    res.status(201).json({
      ...newProject.toObject(),
      gitRepo: gitRepo || null,
      inviteResults: inviteResults || null
    });
  } catch (err) {
    console.error('Project creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /projects/:id/status - Update project status
router.patch('/projects/:id/status', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const { projectStatus } = req.body;
    const project = await Project.findById(req.params.id).populate('feeds');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const validStatuses = [
      'New', 'Once off','Automation', 'Ad hoc', 'BAU Initiated', 'BAU Not Initiated',
      'ON hold[Sales]', 'ON hold[Technical]', 'ON hold[Client]', 'Closed'
    ];
    
    if (!validStatuses.includes(projectStatus)) {
      return res.status(400).json({ error: 'Invalid project status' });
    }
    
    project.projectStatus = projectStatus;
    await project.save();
    
    await Log.create({
      actionType: 'PROJECT_STATUS_UPDATED',
      performerId: req.user._id,
      details: `Project ${project.projectCustomId} status changed to ${projectStatus}`,
      timestamp: new Date()
    });
    
    res.json({ 
      success: true, 
      project: {
        _id: project._id,
        projectCustomId: project.projectCustomId,
        projectStatus: project.projectStatus
      }
    });
  } catch (err) {
    console.error('Error updating project status:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /projects/:id - Update project
router.put('/projects/:id', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const updatedProject = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedProject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /organizations - Fetch organizations
router.get('/organizations', authorize('Super Admin', 'Admin', 'Project Manager', 'Sales Manager', 'HR'), async (req, res) => {
  try {
    const organizations = await Organization.find({})
      .select('companyName website address pointsOfContact')
      .sort({ companyName: 1 });
    
    res.json(organizations);
  } catch (err) {
    console.error("Error fetching organizations:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GIT INTEGRATION ROUTES
// ============================================

router.get('/projects/:id/invite-link', authorize('Super Admin', 'Project Manager', 'Admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    if (!project.gitRepoName) {
      return res.status(400).json({ 
        success: false, 
        error: 'No GitHub repository linked to this project' 
      });
    }
    
    const inviteLink = gitService.getInviteLink(project.gitRepoName);
    
    res.json({
      success: true,
      inviteLink: inviteLink,
      repoName: project.gitRepoName,
      repoUrl: project.gitRepoUrl
    });
  } catch (error) {
    console.error('Error generating invite link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects/:id/add-collaborator', authorize('Super Admin', 'Project Manager', 'Admin'), async (req, res) => {
  try {
    const { email, permission = 'push' } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.gitRepoName) {
      return res.status(404).json({ error: 'Project or Git repo not found' });
    }
    
    const result = await gitService.addCollaboratorToRepo(project.gitRepoName, email, permission);
    
    if (result.success) {
      await Log.create({
        actionType: 'COLLABORATOR_ADDED',
        performerId: req.user._id,
        details: `Added ${result.email} → ${result.username} to repo ${project.gitRepoName}`,
        timestamp: new Date()
      });
      res.json({ success: true, message: `Collaborator added: ${result.email} → ${result.username}` });
    } else {
      const inviteLink = gitService.getInviteLink(project.gitRepoName);
      res.status(400).json({ 
        success: false, 
        error: result.error,
        inviteLink: inviteLink,
        message: 'Could not add automatically. Please share this invite link with the developer.'
      });
    }
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id/collaborators', authorize('Super Admin', 'Project Manager', 'Admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.gitRepoName) {
      return res.status(404).json({ error: 'Project or Git repo not found' });
    }
    
    const result = await gitService.getCollaborators(project.gitRepoName);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id/repo-contents', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.gitRepoName) {
      return res.json({ success: false, error: 'No Git repository found for this project' });
    }
    
    const contents = await gitService.getRepoContents(project.gitRepoName, req.query.path || '');
    res.json({ success: true, contents });
  } catch (err) {
    console.error('Error fetching repo contents:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FEED MANAGEMENT ROUTES
// ============================================

router.post('/feeds', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const {
      name,
      assignedDevelopers,
      projectId,
      feedType,
      weekDay,
      monthDay,
      feedPlatform,
      webDomain
    } = req.body;

    const newFeed = await Feed.create({
      name,
      assignedDevelopers,
      projectId,
      adminId: req.user._id,
      feedType: feedType || 'Daily',
      weekDay: feedType === 'Weekly' ? weekDay : null,
      monthDay: feedType === 'Monthly' ? monthDay : null,
      feedPlatform: feedPlatform || null,
      webDomain: (feedPlatform === 'Web' || feedPlatform === 'Both') ? webDomain : null
    });

    await Project.findByIdAndUpdate(projectId, { $push: { feeds: newFeed._id } });
    
    // Get project details
    const project = await Project.findById(projectId).select('projectCustomId name gitRepoName gitRepoUrl');
    
    // --- SEND GITHUB INVITATIONS FOR THE FEED ---
    let githubInviteResults = [];
    
    if (project && project.gitRepoName && assignedDevelopers && assignedDevelopers.length > 0) {
      console.log(`📧 Sending GitHub invitations for feed "${name}" to ${assignedDevelopers.length} developers...`);
      
      // Get developer details
      const developers = await User.find({ 
        _id: { $in: assignedDevelopers },
        role: 'Developer'
      });
      
      for (const developer of developers) {
        try {
          // Check if developer has GitHub linked
          if (!developer.githubLinked || !developer.githubUsername) {
            console.log(`⚠️ Developer ${developer.email} doesn't have GitHub linked. Attempting to link...`);
            const linkResult = await gitService.linkGitHubAccountToUser(developer._id, developer.email);
            
            if (linkResult.success && linkResult.githubUsername) {
              developer.githubUsername = linkResult.githubUsername;
              developer.githubLinked = true;
              await developer.save();
              console.log(`✅ Linked GitHub account for ${developer.email}: ${linkResult.githubUsername}`);
            } else {
              console.log(`❌ Could not link GitHub for ${developer.email}`);
              githubInviteResults.push({
                email: developer.email,
                success: false,
                error: 'GitHub account not found or email not public',
                inviteLink: gitService.getInviteLink(project.gitRepoName)
              });
              continue;
            }
          }
          
          // Send GitHub invitation
          const inviteResult = await gitService.addCollaboratorById(
            project.gitRepoName,
            developer._id,
            'push'
          );
          
          if (inviteResult.success) {
            console.log(`✅ GitHub invitation sent to ${developer.githubUsername} (${developer.email})`);
            githubInviteResults.push({
              email: developer.email,
              username: developer.githubUsername,
              success: true,
              message: 'GitHub invitation sent'
            });
          } else {
            console.log(`❌ Failed to send GitHub invitation to ${developer.email}: ${inviteResult.error}`);
            githubInviteResults.push({
              email: developer.email,
              success: false,
              error: inviteResult.error,
              inviteLink: gitService.getInviteLink(project.gitRepoName)
            });
          }
        } catch (err) {
          console.error(`Error sending GitHub invitation to ${developer.email}:`, err.message);
          githubInviteResults.push({
            email: developer.email,
            success: false,
            error: err.message,
            inviteLink: gitService.getInviteLink(project.gitRepoName)
          });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // --- CREATE FEED FOLDER ON GITHUB ---
    let feedFolderResult = null;
    if (project && project.gitRepoName) {
      console.log(`📁 Creating feed folder "${name}" in GitHub repo ${project.gitRepoName}...`);
      feedFolderResult = await gitService.createFeedFolder(
        project.gitRepoName,
        name,
        newFeed._id,
        assignedDevelopers || []
      );
      
      if (feedFolderResult && feedFolderResult.success) {
        console.log(`✅ Feed folder created: ${feedFolderResult.feedPath}`);
      } else {
        console.log(`⚠️ Could not create feed folder: ${feedFolderResult?.error || 'Unknown error'}`);
      }
    }
    
    // --- SEND SOCKET NOTIFICATIONS ---
    const io = req.app.get('io');
    
    // Notify each assigned developer
    if (assignedDevelopers && assignedDevelopers.length > 0) {
      for (const developerId of assignedDevelopers) {
        // Emit to developer's personal room
        io.to(developerId.toString()).emit('feed_assigned', {
          feed: newFeed,
          project: project,
          githubInviteSent: githubInviteResults.some(r => r.success),
          message: `You've been assigned to a new feed: ${name} in project ${project?.projectCustomId || 'Unknown'}`
        });
        
        // Create a task for the developer
        await Task.create({
          name: `New Feed Assignment: ${name}`,
          details: `You have been assigned to feed "${name}" in project ${project?.projectCustomId || 'Unknown'}.\n\n${githubInviteResults.some(r => r.success) ? 'GitHub invitation has been sent to your email.' : 'Please check with your Project Manager for GitHub repository access.'}`,
          projectId: projectId,
          feedId: newFeed._id,
          performerId: req.user._id,
          targetUsers: [developerId],
          status: 'Pending'
        });
      }
      
      console.log(`📡 Socket notifications sent to ${assignedDevelopers.length} developers for feed: ${name}`);
    }
    
    // Log the action
    await Log.create({
      actionType: 'FEED_CREATED',
      performerId: req.user._id,
      details: `Created feed "${name}" in project ${project?.projectCustomId || 'Unknown'} with ${assignedDevelopers?.length || 0} assigned developers. GitHub invites: ${githubInviteResults.filter(r => r.success).length} successful, ${githubInviteResults.filter(r => !r.success).length} failed.`,
      timestamp: new Date()
    });
    
    // Return response with invite results
    res.status(201).json({
      feed: newFeed,
      githubInvites: githubInviteResults,
      feedFolder: feedFolderResult
    });
    
  } catch (err) {
    console.error('Feed creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/feeds/:id', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const {
      name,
      assignedDevelopers,
      feedType,
      weekDay,
      monthDay,
      feedPlatform,
      webDomain
    } = req.body;

    const updatedFeed = await Feed.findByIdAndUpdate(
      req.params.id,
      {
        name,
        assignedDevelopers,
        feedType,
        weekDay: feedType === 'Weekly' ? weekDay : null,
        monthDay: feedType === 'Monthly' ? monthDay : null,
        feedPlatform: feedPlatform || null,
        webDomain: (feedPlatform === 'Web' || feedPlatform === 'Both') ? webDomain : null
      },
      { new: true, runValidators: true }
    );
    
    res.json(updatedFeed);
  } catch (err) {
    console.error('Feed update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/feeds/:id', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.id);
    if (!feed) return res.status(404).json({ error: "Feed not found" });
    
    await Project.findByIdAndUpdate(feed.projectId, { $pull: { feeds: feed._id } });
    await Feed.findByIdAndDelete(req.params.id);
    res.json({ message: "Feed deleted successfully" });
  } catch (err) {
    console.error('Feed deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/feeds/:id/status', authorize('Super Admin', 'Admin', 'Project Manager','Team Lead'), async (req, res) => {
  try {
    const { feedStatus } = req.body;
    const feed = await Feed.findById(req.params.id);
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    feed.feedStatus = feedStatus;
    await feed.save();
    
    res.json({ success: true, feed });
  } catch (err) {
    console.error('Error updating feed status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TASK MANAGEMENT ROUTES
// ============================================

router.post('/tasks/create', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const newTask = new Task({
      projectId: req.body.projectId,
      feedId: req.body.feedId,
      performerId: req.user._id,
      targetUsers: req.body.assignedDevelopers,
      details: req.body.details
    });
    await newTask.save();
    res.status(201).json({ message: "Task inserted into tasks table!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// HELPER ROUTES
// ============================================

router.get('/users/developers', authorize('Super Admin','HR', 'Admin', 'Project Manager', 'Team Lead'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'Developer' })
      .select('name email _id githubUsername githubLinked');
    res.json(developers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/project-managers', authorize('Super Admin','HR', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const projectManagers = await User.find({ role: 'Project Manager' })
      .select('name email')
      .sort({ name: 1 });
    res.json(projectManagers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/project-status-options', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  const statuses = [
    'New', 'Once off','Automation', 'Ad hoc', 'BAU Initiated', 'BAU Not Initiated',
    'ON hold[Sales]', 'ON hold[Technical]', 'ON hold[Client]', 'Closed'
  ];
  res.json(statuses);
});

router.get('/feed-status-options', authorize('Super Admin', 'Admin', 'Project Manager','Team Lead'), async (req, res) => {
  const statuses = [
    'New',  'In process','Awaiting Client Approval','Once off[In progress]', 'Once off[Delivered]',
    'Ad hoc In-progress', 'Ad hoc delivered','BAU Initiated',
    'ON hold[Sales]', 'ON hold[Technical]', 'ON hold[Client]','Closed'
  ];
  res.json(statuses);
});

// GET /client/projects - Specific endpoint for clients to see their assigned projects
router.get('/client/projects', authorize('Super Admin', 'Client'), async (req, res) => {
  try {
    const clientId = req.user._id;
    const clientOrgId = req.user.organizationId;
    
    console.log('Fetching projects for client:', clientId);
    console.log('Client organization ID:', clientOrgId);
    
    const query = {
      $or: []
    };
    
    query.$or.push({ clients: clientId });
    
    if (clientOrgId) {
      query.$or.push({ organizations: clientOrgId });
    }
    
    console.log('Query:', JSON.stringify(query, null, 2));
    
    const projects = await Project.find(query)
      .populate('clients', 'name email')
      .populate('organizations', 'companyName')
      .populate('projectManager', 'name email')
      .populate({
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 });
    
    console.log(`Found ${projects.length} projects for client`);
    
    res.json(projects);
  } catch (err) {
    console.error('Error fetching client projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TEAM LEAD ASSIGNMENT ROUTES
// ============================================

// POST /projects/:projectId/assign-teamlead - Assign Team Lead to project
router.post('/projects/:projectId/assign-teamlead', authorize('Super Admin', 'Admin', 'Project Manager'), async (req, res) => {
  try {
    const { teamLeadId } = req.body;
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Validate Team Lead exists and has correct role
    const teamLead = await User.findOne({ _id: teamLeadId, role: 'Team Lead' });
    if (!teamLead) {
      return res.status(400).json({ error: 'User not found or not a Team Lead' });
    }
    
    project.teamLead = teamLeadId;
    await project.save();
    
    await Log.create({
      actionType: 'TEAM_LEAD_ASSIGNED',
      performerId: req.user._id,
      details: `Assigned ${teamLead.name} as Team Lead for project ${project.projectCustomId}`,
      timestamp: new Date()
    });
    
    res.json({ 
      success: true, 
      message: 'Team Lead assigned successfully', 
      project: {
        _id: project._id,
        projectCustomId: project.projectCustomId,
        teamLead: teamLead
      }
    });
  } catch (err) {
    console.error('Error assigning Team Lead:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /users/teamleads - Get all Team Leads
router.get('/users/teamleads', authorize('Super Admin', 'Admin', 'Project Manager', 'HR'), async (req, res) => {
  try {
    const teamLeads = await User.find({ role: 'Team Lead' })
      .select('name email _id');
    res.json(teamLeads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PROFILE IMAGE UPLOAD
// ============================================

// Configure multer for profile images
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + req.user._id + '-' + uniqueSuffix + ext);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
});

// POST /upload-profile-image - Upload profile image
router.post('/upload-profile-image', protect, profileUpload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old profile image if exists
    const user = await User.findById(req.user._id);
    if (user.profileImage) {
      const oldImagePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profileImage));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // ✅ FIX: Determine the correct base URL
    let baseUrl;
    
    // 1. Check for environment variable first (production)
    if (process.env.API_BASE_URL) {
      baseUrl = process.env.API_BASE_URL.replace(/\/+$/, '');
    } 
    // 2. Check for FRONTEND_URL as fallback
    else if (process.env.FRONTEND_URL) {
      baseUrl = process.env.FRONTEND_URL.replace(/\/+$/, '');
    }
    // 3. Check if we're behind a proxy (production)
    else if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']) {
      baseUrl = `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`;
    }
    // 4. Fallback to localhost (development)
    else {
      baseUrl = `${req.protocol}://${req.get('host')}`;
    }

    // Construct the URL for the uploaded image
    const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;

    // Update user with profile image URL
    user.profileImage = imageUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: imageUrl
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// DELETE /remove-profile-image - Remove profile image
router.delete('/remove-profile-image', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.profileImage) {
      return res.status(404).json({ error: 'No profile image found' });
    }

    // Delete the file
    const imagePath = path.join(__dirname, '../uploads/profiles', path.basename(user.profileImage));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    user.profileImage = null;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image removed successfully'
    });
  } catch (error) {
    console.error('Profile image removal error:', error);
    res.status(500).json({ error: 'Failed to remove profile image' });
  }
});

// ============================================
// BULK IMPORT FEEDS VIA EXCEL
// ============================================
router.post('/feeds/bulk', authorize('Super Admin', 'Admin', 'Project Manager','Team Lead'), async (req, res) => {
  try {
    const { projectId, feeds } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
      return res.status(400).json({ error: 'At least one feed is required' });
    }
    
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const createdFeeds = [];
    const errors = [];
    
    // Process each feed
    for (const feedData of feeds) {
      try {
        // Validate required fields
        if (!feedData.name || !feedData.name.trim()) {
          errors.push({ feed: feedData, error: 'Feed name is required' });
          continue;
        }
        
        // Parse assigned developers (can be comma-separated list of names or emails)
        let assignedDeveloperIds = [];
        if (feedData.assignedDevelopers && feedData.assignedDevelopers.trim()) {
          const devNames = feedData.assignedDevelopers.split(',').map(s => s.trim()).filter(Boolean);
          // Try to find developers by name or email
          const foundDevs = await User.find({
            $or: [
              { name: { $in: devNames } },
              { email: { $in: devNames } }
            ],
            role: 'Developer'
          }).select('_id');
          assignedDeveloperIds = foundDevs.map(d => d._id);
          
          // If some developers weren't found, log a warning
          const foundNames = foundDevs.map(d => d.name);
          const notFound = devNames.filter(n => !foundNames.includes(n));
          if (notFound.length > 0) {
            errors.push({ 
              feed: feedData.name, 
              error: `Developers not found: ${notFound.join(', ')}` 
            });
          }
        }
        
        // Create the feed
        const feed = new Feed({
          name: feedData.name.trim(),
          projectId: projectId,
          feedType: feedData.feedType || 'Daily',
          weekDay: feedData.feedType === 'Weekly' ? feedData.weekDay : '',
          monthDay: feedData.feedType === 'Monthly' ? (feedData.monthDay || null) : null,
          feedPlatform: feedData.feedPlatform || null,
          webDomain: (feedData.feedPlatform === 'Web' || feedData.feedPlatform === 'Both') ? feedData.webDomain : null,
          assignedDevelopers: assignedDeveloperIds,
          feedStatus: feedData.feedStatus || 'New',
          adminId: req.user._id
        });
        
        await feed.save();
        createdFeeds.push(feed);
        
      } catch (err) {
        console.error('Error creating feed:', err);
        errors.push({ 
          feed: feedData.name || 'Unknown', 
          error: err.message 
        });
      }
    }
    
    // Update project's feeds array
    if (createdFeeds.length > 0) {
      const feedIds = createdFeeds.map(f => f._id);
      await Project.findByIdAndUpdate(projectId, {
        $push: { feeds: { $each: feedIds } }
      });
    }
    
    res.json({
      success: true,
      created: createdFeeds.length,
      failed: errors.length,
      feeds: createdFeeds,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Bulk feed import error:', error);
    res.status(500).json({ 
      error: 'Failed to import feeds',
      details: error.message 
    });
  }
});

// ============================================
// COUNTRY MAP
// ============================================
const COUNTRY_MAP = {
  "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", 
  "Australia": "AU", "Brazil": "BR", "Canada": "CA", 
  "China": "CN", "France": "FR", "Germany": "DE", 
  "India": "IN", "Indonesia": "ID", "Italy": "IT", 
  "Japan": "JP", "Mexico": "MX", "Netherlands": "NL", 
  "Nigeria": "NG", "Pakistan": "PK", "Russia": "RU", 
  "Saudi Arabia": "SA", "Singapore": "SG", "South Africa": "ZA", 
  "South Korea": "KR", "Spain": "ES", "Turkey": "TR", 
  "United Arab Emirates": "AE", "United Kingdom": "GB", 
  "United States": "US", "Vietnam": "VN"
};  

module.exports = router;