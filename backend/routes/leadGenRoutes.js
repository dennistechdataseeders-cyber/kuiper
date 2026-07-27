// backend/routes/leadGenRoutes.js

const router = require('express').Router();
const LeadGen = require('../models/LeadGen');
const Organization = require('../models/Organization');
const Log = require('../models/Log'); 
const { authorize } = require('../middleware/roleCheck');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Prospect = require('../models/Prospect'); 
const Project = require('../models/Project'); 
const gitService = require('../services/gitService');
const User = require('../models/User');
const sendEmail = require('../services/zohoMailer');
const { getFeasibilityCreatedTemplate } = require('../templates/feasibilityEmailTemplates');
const { getLeadCreatedTemplate } = require('../templates/leadEmailTemplates');

// ============================================
// LOCAL FILE STORAGE CONFIGURATION
// ============================================

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/leads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: leadId_timestamp_originalname
    const leadId = req.params.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .substring(0, 100);
    cb(null, `lead-${leadId}-${uniqueSuffix}${ext}`);
  }
});

// File filter - allow PDF, Word, Excel, Images, etc.
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    // Text
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    // JSON/XML
    'application/json',
    'application/xml',
    'text/xml'
  ];
  
  // Also check by file extension for broader support
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
    '.ppt', '.pptx', '.ppsx', '.odp',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.txt', '.csv', '.tsv',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.json', '.xml'
  ];
  
  const extname = allowedExtensions.includes(ext);
  const mimetype = allowedTypes.includes(file.mimetype);
  
  if (mimetype || extname) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.originalname}" is not supported. Please upload PDF, Word, Excel, PowerPoint, Images, or ZIP files.`));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20MB max
  },
  fileFilter: fileFilter
});

// ============================================
// GET: Fetch leads
// ============================================
router.get('/', authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'), async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'Admin' || req.user.role === 'Sales Manager') {
      filter = {};
    } 
    else if (req.user.role === 'Project Manager') {
      // PM sees leads where they are assigned as projectManagerId
      filter = { projectManagerId: req.user._id };
    } 
    else {
      filter = { salesRepId: req.user._id };
    }
    
    const leads = await LeadGen.find(filter)
      .populate('organizationId', 'companyName linkedin') 
      .populate('salesRepId', 'name')
      .populate('projectManagerId', 'name email')
      .sort({ createdAt: -1 }); 
      
    res.json(leads);
  } catch (err) {
    console.error("Error fetching leads:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// POST: Create a Lead (with auto-created Feasibility org)
// ============================================
router.post('/', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const { 
      organizationId, 
      leadType, 
      referredBy,
      pocName,
      pocEmail,
      pocPhone,
      linkedin
    } = req.body;

    // ============================================
    // Auto-create a Feasibility organization if none provided
    // ============================================
    let finalOrgId = organizationId;
    
    if (!organizationId) {
      // Find or create a "Feasibility" organization
      let feasibilityOrg = await Organization.findOne({ 
        companyName: { $regex: /^Feasibility$/i } 
      });
      
      if (!feasibilityOrg) {
        feasibilityOrg = await Organization.create({
          companyName: 'Feasibility',
          website: '',
          address: '',
          pointsOfContact: [{
            pocName: 'Feasibility System',
            pocEmail: 'feasibility@system.com',
            isPrimary: true,
            department: 'Other'
          }],
          status: 'Active'
        });
        console.log('✅ Created Feasibility organization for fallback');
      }
      finalOrgId = feasibilityOrg._id;
    }

    const org = await Organization.findById(finalOrgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const finalPocName = pocName || org.pocName || 'Feasibility Task';
    const finalPocEmail = pocEmail || org.pocEmail || '';
    const finalPocPhone = pocPhone || org.pocPhone || '';
    const finalLinkedin = linkedin || org.linkedin || '';

    if (!finalPocName) {
      return res.status(400).json({ error: "POC Name is required" });
    }

    // Check for duplicate lead
    const existingLead = await LeadGen.findOne({
      organizationId: org._id,
      pocName: { $regex: new RegExp(`^${finalPocName}$`, 'i') }
    });

    if (existingLead) {
      return res.status(400).json({ 
        error: `A lead already exists for ${finalPocName} at this organization` 
      });
    }

    const newLead = new LeadGen({
      organizationId: org._id,
      pocName: finalPocName,
      pocEmail: finalPocEmail,
      pocPhone: finalPocPhone,
      linkedin: finalLinkedin,
      leadType: leadType || 'Inbound',
      referredBy: leadType === 'Reference' ? referredBy : undefined,
      salesRepId: req.user._id,
      status: 'New'
    });

    const savedLead = await newLead.save();

    // Link to prospect if provided
    if (req.body.prospectId) {
      await Prospect.findByIdAndUpdate(
        req.body.prospectId,
        { $set: { leadId: savedLead._id } }
      );
    } else if (org._id) {
      await Prospect.findOneAndUpdate(
        { organizationId: org._id },
        { $set: { leadId: savedLead._id } }
      );
    }

    // ============================================
    // SEND EMAIL NOTIFICATIONS FOR NEW LEAD
    // ============================================
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      // Get Sales Manager
      const salesManager = await User.findOne({ role: 'Sales Manager' });
      
      // Prepare lead data for email
      const leadEmailData = {
        pocName: savedLead.pocName,
        organizationName: org.companyName || 'N/A',
        leadNumber: savedLead.leadNumber,
        leadType: savedLead.leadType,
        leadId: savedLead._id
      };
      
      // Send email to Sales Rep (creator)
      const repEmailHtml = getLeadCreatedTemplate(
        leadEmailData, 
        req.user, 
        req.user, 
        frontendUrl
      );
      await sendEmail({
        to: req.user.email,
        subject: `🎯 Lead Created: ${savedLead.pocName} (${savedLead.leadNumber})`,
        html: repEmailHtml
      });
      console.log(`📧 Lead notification sent to Sales Rep: ${req.user.email}`);
      
      // Send email to Sales Manager
      if (salesManager) {
        const managerEmailHtml = getLeadCreatedTemplate(
          leadEmailData, 
          req.user, 
          salesManager, 
          frontendUrl
        );
        await sendEmail({
          to: salesManager.email,
          subject: `🎯 New Lead Created: ${savedLead.pocName} (${savedLead.leadNumber})`,
          html: managerEmailHtml
        });
        console.log(`📧 Lead notification sent to Sales Manager: ${salesManager.email}`);
      }
      
    } catch (emailErr) {
      console.error("Lead email notification failed:", emailErr.message);
    }

    res.status(201).json(savedLead);
  } catch (err) {
    console.error("Lead Creation Error:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: "Duplicate lead: A lead with this POC name already exists for this organization" 
      });
    }
    
    res.status(400).json({ error: err.message });
  }
});

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

// ============================================
// PATCH: Take Action on a Lead - WITH EMAIL NOTIFICATIONS
// ============================================
router.patch('/:id/action', authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'), upload.single('file'), async (req, res) => {
  try {
    const leadId = req.params.id;
    const { 
        status, 
        followUpDate, 
        feasibilityId, 
        feasibilityDate, 
        taskDetails, 
        followUpType, 
        lastInteractionDesc,
        projectManagerId,
        organizations,
        completedAt,
        industry,
        country,
        projectBriefName,
        pocName,
        pocEmail,
        pocPhone
    } = req.body;
    
    const lead = await LeadGen.findById(leadId).populate('organizationId');
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const updateData = { lastActionDate: Date.now() };

    // Only update fields that are provided
    if (status !== undefined) updateData.status = status;
    if (followUpDate) updateData.followUpDate = followUpDate;
    if (followUpType) updateData.followUpType = followUpType;
    if (lastInteractionDesc) updateData.lastInteractionDesc = lastInteractionDesc;
    if (feasibilityId) updateData.feasibilityId = feasibilityId;
    if (feasibilityDate) updateData.feasibilityDate = feasibilityDate;
    if (taskDetails) updateData.taskDetails = taskDetails;
    if (projectManagerId) updateData.projectManagerId = projectManagerId;
    
    // Handle POC fields if provided
    if (pocName) updateData.pocName = pocName;
    if (pocEmail) updateData.pocEmail = pocEmail;
    if (pocPhone) updateData.pocPhone = pocPhone;
    
    // Store attachment path locally if file was uploaded
    if (req.file) {
      const fileUrl = `/uploads/leads/${req.file.filename}`;
      updateData.attachmentPath = fileUrl;
      updateData.attachmentFilename = req.file.originalname;
      updateData.driveFileId = req.file.filename;
      console.log(`📎 File saved locally: ${fileUrl}`);
    }

    if (status === 'Feasibility Completed') {
      updateData.feasibilityCompletedAt = completedAt || new Date();
    }

    // Remove undefined values to avoid overwriting with undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log('📝 Updating lead with data:', updateData);

    const updatedLead = await LeadGen.findByIdAndUpdate(
      leadId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // ============================================
    // SEND EMAIL NOTIFICATIONS FOR FEASIBILITY
    // ============================================
    if (status === 'Feasibility' && feasibilityId) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        // Get the Sales Manager
        const salesManager = await User.findOne({ role: 'Sales Manager' });
        
        // Get the assigned PM
        let pm = null;
        if (projectManagerId) {
          pm = await User.findById(projectManagerId).select('name email');
        }
        
        // Get the Sales Rep (creator of the lead)
        const salesRep = await User.findById(lead.salesRepId).select('name email');
        
        // Prepare feasibility data for email
        const feasibilityEmailData = {
          feasibilityId: feasibilityId,
          pocName: lead.pocName,
          organizationName: lead.organizationId?.companyName || 'N/A',
          feasibilityDate: feasibilityDate || new Date(),
          followUpDate: followUpDate || null,
          taskDetails: taskDetails || 'No details provided',
          leadNumber: lead.leadNumber,
          leadId: lead._id
        };
        
        // Send email to Sales Rep
        if (salesRep) {
          const repHtml = getFeasibilityCreatedTemplate(
            feasibilityEmailData,
            salesRep,
            salesManager || null,
            pm || null,
            frontendUrl
          );
          await sendEmail({
            to: salesRep.email,
            subject: `🔬 Feasibility Request Created: ${feasibilityId}`,
            html: repHtml
          });
          console.log(`📧 Feasibility notification sent to Sales Rep: ${salesRep.email}`);
        }
        
        // Send email to Sales Manager
        if (salesManager) {
          const managerHtml = getFeasibilityCreatedTemplate(
            feasibilityEmailData,
            salesRep || { name: 'Unknown Sales Rep' },
            salesManager,
            pm || null,
            frontendUrl
          );
          await sendEmail({
            to: salesManager.email,
            subject: `🔬 New Feasibility Request: ${feasibilityId}`,
            html: managerHtml
          });
          console.log(`📧 Feasibility notification sent to Sales Manager: ${salesManager.email}`);
        }
        
        // Send email to PM
        if (pm) {
          const pmHtml = getFeasibilityCreatedTemplate(
            feasibilityEmailData,
            salesRep || { name: 'Unknown Sales Rep' },
            salesManager || null,
            pm,
            frontendUrl
          );
          await sendEmail({
            to: pm.email,
            subject: `🔬 Feasibility Assigned: ${feasibilityId}`,
            html: pmHtml
          });
          console.log(`📧 Feasibility notification sent to PM: ${pm.email}`);
        }
        
      } catch (emailErr) {
        console.error("Feasibility email notification failed:", emailErr.message);
      }
    }

    // ============================================
    // CREATE PROJECT WHEN PRODUCTION READY
    // ============================================
    if (status === 'Production Ready') {
      try {
        // Get project manager name
        const pm = await User.findById(projectManagerId);
        
        // Create project
        const project = new Project({
          name: projectBriefName || `Project from lead: ${lead.pocName}`,
          projectCustomId: `PRJ${String(Date.now()).slice(-6)}`,
          organizations: organizations || [lead.organizationId?._id],
          projectManager: projectManagerId,
          description: lastInteractionDesc || `Project created from lead ${lead.pocName}`,
          country: country || 'US',
          industry: industry || 'General',
          createdBy: req.user._id,
          leadId: lead._id
        });
        
        await project.save();
        console.log(`✅ Project created: ${project.projectCustomId}`);
        
        // Send notification to PM
        if (pm) {
          try {
            await pm.addNotification({
              type: 'project_assigned',
              message: `New project "${projectBriefName}" has been assigned to you.`
            });
          } catch (notifErr) {
            console.error("Notification error:", notifErr);
          }
        }
      } catch (projectErr) {
        console.error("Project creation error:", projectErr);
        // Don't fail the entire request if project creation fails
      }
    }

    // --- Audit Logging ---
    try {
      let actionType = 'LEAD_UPDATED';
      let logDetail = `Updated lead: ${lead.pocName}`;
      
      if (status === 'Follow-up Scheduled') {
        actionType = 'FOLLOW_UP_SET';
        logDetail = `Scheduled ${followUpType} follow-up for ${lead.pocName} on ${followUpDate}`;
      } else if (status === 'Feasibility') {
        actionType = 'FEASIBILITY_REQUEST';
        logDetail = `Sent ${lead.pocName} to Feasibility (ID: ${feasibilityId})${projectManagerId ? ` assigned to PM: ${projectManagerId}` : ''}`;
        if (req.file) {
          logDetail += ` with attachment: ${req.file.filename}`;
        }
      } else if (status === 'Feasibility Completed') {
        actionType = 'FEASIBILITY_COMPLETED';
        logDetail = `Feasibility completed for ${lead.pocName} (ID: ${lead.feasibilityId})`;
      } else if (status === 'Closed') {
        actionType = 'LEAD_CLOSED';
        logDetail = `Closed Lead: ${lead.pocName}`;
      } else if (status === 'Production Ready') {
        actionType = 'LEAD_CONVERTED_TO_PROJECT';
        logDetail = `Lead ${lead.pocName} converted to Project and assigned to PM.`;
      }

      await Log.create({
        actionType,
        performerId: req.user._id,
        details: logDetail,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Audit Log failed:", logErr.message);
    }

    res.json(updatedLead);

  } catch (err) {
    console.error("Action Error Details:", err);
    res.status(500).json({ 
        error: "Action failed", 
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
});

// ============================================
// GET: Download attachment file
// ============================================
router.get('/download/:leadId', authorize('Admin', 'Sales', 'Project Manager'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await LeadGen.findById(leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    if (!lead.attachmentPath) {
      return res.status(404).json({ error: 'No attachment found for this lead' });
    }
    
    // Get the filename from the path
    const filename = path.basename(lead.attachmentPath);
    const filePath = path.join(__dirname, '../uploads/leads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// ============================================
// GET: Get PM's feasibility tasks
// ============================================
router.get('/pm/feasibility', authorize('Project Manager'), async (req, res) => {
  try {
    const filter = { 
      projectManagerId: req.user._id,
      status: { $in: ['Feasibility', 'Feasibility Completed'] }
    };
    
    const feasibilityTasks = await LeadGen.find(filter)
      .populate('organizationId', 'companyName linkedin')
      .populate('salesRepId', 'name')
      .populate('projectManagerId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(feasibilityTasks);
  } catch (err) {
    console.error("Error fetching PM feasibility tasks:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// GET: Get Feasibility Details for a Lead
// ============================================
router.get('/feasibility/:leadId', authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'), async (req, res) => {
  try {
    const { leadId } = req.params;
    
    const lead = await LeadGen.findById(leadId)
      .populate('organizationId', 'companyName')
      .populate('salesRepId', 'name email')
      .populate('projectManagerId', 'name email');
    
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    
    // Check if user has access
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    let hasAccess = false;
    
    if (userRole === 'Admin' || userRole === 'Sales Manager') {
      hasAccess = true;
    } else if (userRole === 'Sales') {
      // Sales can view if they are the sales rep OR if status is Feasibility/Feasibility Completed
      const isSalesRep = lead.salesRepId && lead.salesRepId._id.toString() === userId;
      const isFeasibility = lead.status === 'Feasibility' || lead.status === 'Feasibility Completed';
      hasAccess = isSalesRep || isFeasibility;
    } else if (userRole === 'Project Manager') {
      // PM can view if assigned
      const isPMAssigned = lead.projectManagerId && lead.projectManagerId._id.toString() === userId;
      hasAccess = isPMAssigned;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this feasibility' });
    }
    
    // Format the response with all feasibility details
    const feasibilityDetails = {
      _id: lead._id,
      leadNumber: lead.leadNumber,
      pocName: lead.pocName,
      pocEmail: lead.pocEmail,
      pocPhone: lead.pocPhone,
      linkedin: lead.linkedin,
      organizationName: lead.organizationId?.companyName || 'N/A',
      salesRepName: lead.salesRepId?.name || 'N/A',
      salesRepEmail: lead.salesRepId?.email || 'N/A',
      projectManagerName: lead.projectManagerId?.name || 'Unassigned',
      projectManagerId: lead.projectManagerId?._id || lead.projectManagerId,
      status: lead.status,
      feasibilityId: lead.feasibilityId,
      feasibilityDate: lead.feasibilityDate,
      taskDetails: lead.taskDetails || 'No details provided',
      lastInteractionDesc: lead.lastInteractionDesc || 'No description',
      attachmentPath: lead.attachmentPath,
      attachmentFilename: lead.attachmentFilename,
      feasibilityCompletedAt: lead.feasibilityCompletedAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      leadType: lead.leadType,
      followUpDate: lead.followUpDate,
      followUpType: lead.followUpType
    };
    
    res.json({ success: true, data: feasibilityDetails });
    
  } catch (err) {
    console.error("Error fetching feasibility details:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// PATCH: Add Comment to Lead
// ============================================
router.patch('/:id/comment', authorize('Admin', 'Sales', 'Sales Manager', 'Project Manager'), async (req, res) => {
  try {
    const leadId = req.params.id;
    const { lastInteractionDesc } = req.body;
    
    if (!lastInteractionDesc || !lastInteractionDesc.trim()) {
      return res.status(400).json({ error: "Comment is required" });
    }
    
    const lead = await LeadGen.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    let hasAccess = false;
    
    if (userRole === 'Admin' || userRole === 'Sales Manager') {
      hasAccess = true;
    } else if (userRole === 'Sales') {
      const isSalesRep = lead.salesRepId && lead.salesRepId.toString() === userId;
      const isFeasibility = lead.status === 'Feasibility' || lead.status === 'Feasibility Completed';
      hasAccess = isSalesRep || isFeasibility;
    } else if (userRole === 'Project Manager') {
      const isPMAssigned = lead.projectManagerId && lead.projectManagerId.toString() === userId;
      hasAccess = isPMAssigned;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: "Not authorized to comment on this lead" });
    }
    
    const updateData = {
      lastInteractionDesc: lastInteractionDesc,
      lastActionDate: Date.now()
    };
    
    const updatedLead = await LeadGen.findByIdAndUpdate(
      leadId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    try {
      await Log.create({
        actionType: `${userRole}_COMMENT_ADDED`,
        performerId: req.user._id,
        details: `${userRole} ${req.user.name} added comment to feasibility ${lead.feasibilityId || lead.pocName}`,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("Non-critical Log Error:", logErr.message);
    }
    
    res.json({
      success: true,
      message: "Comment added successfully",
      data: updatedLead
    });
    
  } catch (err) {
    console.error("Add Comment Error:", err);
    res.status(500).json({ 
      error: "Failed to add comment", 
      message: err.message 
    });
  }
});

module.exports = router;