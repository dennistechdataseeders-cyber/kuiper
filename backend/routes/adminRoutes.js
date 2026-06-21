const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); 
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

const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');
// --- MIDDLEWARE ---
const { authorize } = require('../middleware/roleCheck');
const getWelcomeTemplate = require('../templates/welcomeEmail');

// --- NODEMAILER TRANSPORTER (kept for bulk-invite and other emails) ---
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
  tls: {
    rejectUnauthorized: false
  }
});

// --- RESEND (for invitation emails only) ---
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

// GET /users - Fetch all users
router.get('/users', authorize('Admin', 'Project Manager', 'Sales Manager', 'Sales'), async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Sales Manager') {
      filter = { role: 'Sales' };
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

// POST /change-password - Change user password
router.post('/change-password', authorize('Admin', 'Sales Manager', 'Sales', 'Project Manager', 'Developer'), async (req, res) => {
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

// POST /users - Create new user
router.post('/users', authorize('Admin', 'Project Manager', 'Sales Manager'), async (req, res) => {
  try {
    const { name, email, password, role, githubUsername, organizationId, department, isPrimaryPOC } = req.body;
    
    console.log("Creating user with data:", { name, email, role, organizationId, department, isPrimaryPOC });
    
    let finalRole = role;

    // Authorization Logic for Role Creation
    if (req.user.role === 'Sales Manager') {
      finalRole = 'Sales'; 
    } else if (req.user.role === 'Project Manager') {
      finalRole = 'Client'; 
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already in use" });

    const cleanPassword = String(password || "123456");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    // Create user with organization fields
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: finalRole,
      githubUsername: githubUsername || null,
      githubLinked: false,
      organizationId: organizationId || null,
      department: department || 'Other',
      isPrimaryPOC: isPrimaryPOC || false
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

    // Send welcome email via Resend
    const emailHtml = getWelcomeTemplate(name, email, cleanPassword, finalRole, "https://kuiperapp.co.in/login");

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
        details: `Created ${finalRole}: ${name} (By ${req.user.role})${gitHubLinkResult?.success ? ` - GitHub linked: ${gitHubLinkResult.githubUsername}` : ' - GitHub not linked'}${organizationId ? ` - Organization: ${organizationId}` : ''}`,
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
      gitHubUsername: newUser.githubUsername
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /users/:id - Update user (Single route - no duplicate)
router.put('/users/:id', authorize('Admin'), async (req, res) => {
  try {
    const { name, email, role, githubUsername, organizationId, department, isPrimaryPOC, password } = req.body;
    
    const updateData = { 
      name, 
      email, 
      role, 
      githubUsername: githubUsername || null,
      organizationId: organizationId || null,
      department: department || 'Other',
      isPrimaryPOC: isPrimaryPOC || false
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
    
    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id - Delete user
router.delete('/users/:id', authorize('Admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    // 🔍 Debug: directly call GitHub search and log the raw result
    console.log(`🔍 Searching GitHub for email: ${user.email}`);
    
    if (!gitService.octokit) {
      return res.status(500).json({ success: false, error: 'GitHub service not initialized. Check GITHUB_TOKEN.' });
    }

    const searchResult = await gitService.octokit.search.users({
      q: `${user.email} in:email`,
      per_page: 5
    });

    console.log(`🔍 GitHub search result for ${user.email}:`);
    console.log(`   total_count: ${searchResult.data.total_count}`);
    console.log(`   items: ${JSON.stringify(searchResult.data.items.map(i => ({ login: i.login, id: i.id })))}`);

    if (searchResult.data.total_count === 0) {
      return res.status(200).json({
        success: false,
        error: `GitHub returned 0 results for email: ${user.email}. The email is either still private on GitHub or not associated with any account.`,
        githubLinked: false,
        debug: {
          emailSearched: user.email,
          totalCount: 0,
          tip: 'Go to github.com/settings/profile and make sure the email is shown in your public profile'
        }
      });
    }

    const username = searchResult.data.items[0].login;
    console.log(`✅ Found GitHub user: ${username}`);

    // Get full profile
    const userDetails = await gitService.octokit.users.getByUsername({ username });

    user.githubUsername = userDetails.data.login;
    user.githubLinked = true;
    await user.save();

    res.json({
      success: true,
      message: `GitHub account ${userDetails.data.login} linked successfully`,
      githubUsername: userDetails.data.login,
      githubLinked: true,
      profile_url: userDetails.data.html_url
    });

  } catch (error) {
    console.error('Error linking GitHub account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AUDIT & ANALYTICS ROUTES
// ============================================

router.get('/analytics', authorize('Admin', 'Sales', 'Project Manager', 'Sales Manager'), async (req, res) => {
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

// GET /client-projects - Specific route for client projects (MUST come before /projects)
router.get('/client-projects', authorize('Admin', 'Project Manager', 'Client'), async (req, res) => {
  try {
    console.log('=== CLIENT PROJECTS ENDPOINT ===');
    const clientIdStr = req.user._id.toString();
    console.log('Looking for client ID (string):', clientIdStr);
    
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
          $expr: {
            $in: [clientIdStr, "$clientIdsAsString"]
          }
        }
      }
    ]);
    
    const populatedProjects = await Project.populate(projects, [
      { path: 'clients', select: 'name email role' },
      { path: 'organizations', select: 'companyName' },
      { path: 'projectManager', select: 'name email' },
      {
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email',
          model: 'User'
        }
      }
    ]);
    
    console.log(`Found ${populatedProjects.length} projects for client`);
    res.json(populatedProjects);
  } catch (err) {
    console.error('Error fetching client projects:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /projects - General projects route
router.get('/projects', authorize('Admin', 'Project Manager', 'Client'), async (req, res) => {
  try {
    const data = await Project.find()
      .populate('clients', 'name email role')
      .populate('organizations', 'companyName website address')
      .populate('projectManager', 'name email')
      .populate({
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email',
          model: 'User'
        }
      });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects - Create project with GitHub integration
router.post('/projects', authorize('Admin', 'Project Manager', 'Sales'), async (req, res) => {
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
router.patch('/projects/:id/status', authorize('Admin', 'Project Manager'), async (req, res) => {
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
router.put('/projects/:id', authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const updatedProject = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedProject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id - Delete project
router.delete('/projects/:id', authorize('Admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.feeds && project.feeds.length > 0) {
      await Feed.deleteMany({ _id: { $in: project.feeds } });
    }
    
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: "Project and its feeds deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /organizations - Fetch organizations
router.get('/organizations', authorize('Admin', 'Project Manager', 'Sales Manager'), async (req, res) => {
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

router.get('/projects/:id/invite-link', authorize('Project Manager', 'Admin'), async (req, res) => {
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

router.post('/projects/:id/bulk-invite', authorize('Project Manager', 'Admin'), async (req, res) => {
  try {
    const { developerEmails, customMessage } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.gitRepoName) {
      return res.status(404).json({ success: false, error: 'Project or Git repo not found' });
    }
    
    const inviteLink = gitService.getInviteLink(project.gitRepoName);
    const results = [];
    
    for (const email of developerEmails) {
      try {
        const mailOptions = {
          from: `"KUIPER CRM" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `GitHub Repository Invitation: ${project.projectCustomId || project.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #2563eb;">GitHub Repository Access</h2>
              <p>Hello,</p>
              <p>You have been granted access to the GitHub repository for project:</p>
              <h3 style="color: #1e293b;">${project.projectCustomId || project.name}</h3>
              <p>${customMessage || 'Please click the link below to accept the invitation and start contributing.'}</p>
              <a href="${inviteLink}" 
                 style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                Accept GitHub Invitation
              </a>
              <p style="color: #666; font-size: 12px;">Or copy this link to your browser: ${inviteLink}</p>
              <hr style="margin: 20px 0; border-color: #e0e0e0;">
              <p style="color: #999; font-size: 11px;">This invitation will expire in 7 days.</p>
            </div>
          `
        };
        
        await transporter.sendMail(mailOptions);
        results.push({ email, success: true, message: 'Invitation sent' });
        
        await Log.create({
          actionType: 'INVITE_SENT',
          performerId: req.user._id,
          details: `Sent GitHub invite for ${project.gitRepoName} to ${email}`,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      }
    }
    
    res.json({
      success: true,
      inviteLink: inviteLink,
      results: results,
      message: `Invitations sent to ${results.filter(r => r.success).length} developers`
    });
  } catch (error) {
    console.error('Error sending bulk invites:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects/:id/add-collaborator', authorize('Project Manager', 'Admin'), async (req, res) => {
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

router.get('/projects/:id/collaborators', authorize('Project Manager', 'Admin'), async (req, res) => {
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

router.delete('/projects/:id/remove-collaborator', authorize('Project Manager', 'Admin'), async (req, res) => {
  try {
    const { email } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.gitRepoName) {
      return res.status(404).json({ error: 'Project or Git repo not found' });
    }
    
    const result = await gitService.removeCollaborator(project.gitRepoName, email);
    
    if (result.success) {
      await Log.create({
        actionType: 'COLLABORATOR_REMOVED',
        performerId: req.user._id,
        details: `Removed ${result.username} from repo ${project.gitRepoName}`,
        timestamp: new Date()
      });
      res.json({ success: true, message: `Collaborator removed: ${result.username}` });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id/repo-contents', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.post('/feeds', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.put('/feeds/:id', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.delete('/feeds/:id', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.patch('/feeds/:id/status', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.post('/tasks/create', authorize('Admin', 'Project Manager'), async (req, res) => {
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

router.post('/feeds/push-task', authorize('Project Manager', 'Admin'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { feedId, projectId, details, targetUsers } = req.body;

    const createdTask = await Task.create({
      feedId,
      projectId,
      performerId: req.user._id,
      targetUsers,
      details,
      status: 'Pending'
    });

    const task = await Task.findById(createdTask._id)
      .populate('projectId', 'name')
      .populate('feedId', 'name')
      .populate('targetUsers', 'name')
      .populate('performerId', 'name');

    targetUsers.forEach(userId => {
      io.to(userId.toString()).emit('new_task', task);
    });

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to push task' });
  }
});

router.get('/pm/task-progress', authorize('Project Manager', 'Admin'), async (req, res) => {
  try {
    const projects = await Project.find({ projectManager: req.user._id })
      .populate({
        path: 'feeds',
        populate: { path: 'assignedDevelopers', select: 'name email' }
      });

    const projectIds = projects.map(p => p._id);
    const tasks = await Task.find({ projectId: { $in: projectIds } })
      .populate('feedId')
      .populate('targetUsers', 'name');

    const formattedProjects = projects.map(project => {
      const feeds = project.feeds.map(feed => {
        const feedTasks = tasks.filter(task => task.feedId?._id.toString() === feed._id.toString());
        const completed = feedTasks.filter(t => t.status === 'Completed').length;
        const progress = feedTasks.length > 0 ? Math.round((completed / feedTasks.length) * 100) : 0;
        return { ...feed.toObject(), tasks: feedTasks, progress };
      });
      return { ...project.toObject(), feeds };
    });

    res.json(formattedProjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task progress' });
  }
});

// ============================================
// HELPER ROUTES
// ============================================

router.get('/users/clients', authorize('Admin', 'Sales', 'Project Manager', 'Sales Manager'), async (req, res) => {
  try {
    const clients = await User.find({ role: 'Client' }).select('name email githubUsername');
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/developers', authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'Developer' })
      .select('name email _id githubUsername githubLinked');
    res.json(developers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/project-managers', authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const projectManagers = await User.find({ role: 'Project Manager' })
      .select('name email')
      .sort({ name: 1 });
    res.json(projectManagers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/project-status-options', authorize('Admin', 'Project Manager'), async (req, res) => {
  const statuses = [
    'New', 'Once off','Automation', 'Ad hoc', 'BAU Initiated', 'BAU Not Initiated',
    'ON hold[Sales]', 'ON hold[Technical]', 'ON hold[Client]', 'Closed'
  ];
  res.json(statuses);
});

router.get('/feed-status-options', authorize('Admin', 'Project Manager'), async (req, res) => {
  const statuses = [
    'New',  'In process','Awaiting Client Approval','Once off[In progress]', 'Once off[Delivered]',
    'Ad hoc In-progress', 'Ad hoc delivered','BAU Initiated',
    'ON hold[Sales]', 'ON hold[Technical]', 'ON hold[Client]','Closed'
  ];
  res.json(statuses);
});

// GET /client/projects - Specific endpoint for clients to see their assigned projects
router.get('/client/projects', authorize('Client'), async (req, res) => {
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

// COUNTRY MAP
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