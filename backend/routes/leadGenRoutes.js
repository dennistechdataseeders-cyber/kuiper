const router = require('express').Router();
const LeadGen = require('../models/LeadGen');
const Organization = require('../models/Organization');
const Log = require('../models/Log'); 
const { authorize } = require('../middleware/roleCheck');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');
const Prospect = require('../models/Prospect'); 
const Project = require('../models/Project'); 

// --- MULTER CONFIG ---
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- GOOGLE DRIVE HELPER ---
const uploadToGoogleDrive = async (file) => { 
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const driveService = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await driveService.files.create({
    requestBody: {
      name: `${Date.now()}-${file.originalname}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    },
    fields: 'id, webViewLink',
  });

  return response.data;
};

// --- GET: Fetch all leads ---
router.get('/', authorize('Admin', 'Sales','Sales Manager'), async (req, res) => {
  try {
    const filter = (req.user.role === 'Admin' || req.user.role === 'Sales Manager') ? {} : { salesRepId: req.user._id };
    const leads = await LeadGen.find(filter)
      .populate('organizationId', 'companyName linkedin') 
      .populate('salesRepId', 'name')
      .sort({ createdAt: -1 }); 
      
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- POST: Create a Lead from an Organization ---
// This is STEP 2 in your flow (Org → Lead)
// --- POST: Create a Lead from an Organization ---
router.post('/', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const { 
      organizationId, 
      leadType, 
      referredBy,
      pocName,      // Add these fields to accept data from frontend
      pocEmail,     // Add these fields to accept data from frontend
      pocPhone,     // Add these fields to accept data from frontend
      linkedin      // Add these fields to accept data from frontend
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    // Fetch the organization to populate lead data
    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Use provided data or fall back to organization data
    const finalPocName = pocName || org.pocName;
    const finalPocEmail = pocEmail || org.pocEmail;
    const finalPocPhone = pocPhone || org.pocPhone;
    const finalLinkedin = linkedin || org.linkedin;

    // Validate required fields
    if (!finalPocName) {
      return res.status(400).json({ error: "POC Name is required" });
    }

    // Check for existing lead with same POC name and organization
    const existingLead = await LeadGen.findOne({
      organizationId: org._id,
      pocName: { $regex: new RegExp(`^${finalPocName}$`, 'i') }
    });

    if (existingLead) {
      return res.status(400).json({ 
        error: `A lead already exists for ${finalPocName} at this organization` 
      });
    }

    // Create the Lead using provided data
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

    // Update the prospect to mark it as converted to Lead
    if (req.body.prospectId) {
      await Prospect.findByIdAndUpdate(
        req.body.prospectId,
        { $set: { leadId: savedLead._id } }
      );
    } else {
      // Fallback: find prospect by organizationId
      await Prospect.findOneAndUpdate(
        { organizationId: org._id },
        { $set: { leadId: savedLead._id } }
      );
    }

    res.status(201).json(savedLead);
  } catch (err) {
    console.error("Lead Creation Error:", err);
    
    // Handle duplicate key error
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
// --- PATCH: Take Action on a Lead ---
// Add this to your organizationRoutes.js file
router.patch('/:id/action', authorize('Admin', 'Sales'), upload.single('file'), async (req, res) => {
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
        projectManagerId
    } = req.body;
    
    const lead = await LeadGen.findById(leadId).populate('organizationId');
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const updateData = { lastActionDate: Date.now() };

    if (status) updateData.status = status;
    if (followUpDate) updateData.followUpDate = followUpDate;
    if (followUpType) updateData.followUpType = followUpType;
    if (lastInteractionDesc) updateData.lastInteractionDesc = lastInteractionDesc;
    if (feasibilityId) updateData.feasibilityId = feasibilityId; 
    if (feasibilityDate) updateData.feasibilityDate = feasibilityDate; 
    if (taskDetails) updateData.taskDetails = taskDetails;

    if (req.file) {
      try {
        const driveData = await uploadToGoogleDrive(req.file);
        updateData.attachmentPath = driveData.webViewLink;
        updateData.driveFileId = driveData.id;
      } catch (driveErr) {
        console.error("Google Drive Upload Failed:", driveErr.message);
      }
    }

    // --- CONVERSION TO PROJECT LOGIC (STEP 3: Lead → Project) ---
 
    const updatedLead = await LeadGen.findByIdAndUpdate(
      leadId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // --- Audit Logging ---
    try {
      let actionType = 'LEAD_UPDATED';
      let logDetail = `Updated lead: ${lead.pocName}`;
      // Inside router.patch('/:id/action', ...
// Inside leadgenroutes.js -> router.patch('/:id/action')
if (status === 'Production Ready') {
  const existingProject = await Project.findOne({ leadId: lead._id });
  
  if (!existingProject) {
    const projectCount = await Project.countDocuments();
    const serialNumber = String(projectCount + 1).padStart(4, '0');
    
    const country = req.body.country || lead.country || 'Unknown';
    const industry = req.body.industry || lead.industry || 'General';
    
    const countryCode = COUNTRY_MAP[country] || country.substring(0, 2).toUpperCase();
    const industryCode = industry.toUpperCase().substring(0, 4);
    
    // CHANGE: Use the specific brief name from the frontend
    const briefName = req.body.projectBriefName || lead.organizationId?.companyName || "New Project";
    
    // RESULT: TDS0001-ECOM | AE | Books Data Extraction
    const fullFormattedName = `TDS${serialNumber}-${industryCode} | ${countryCode} | ${briefName}`;

    const newProject = await Project.create({
      name: fullFormattedName,
      projectCustomId: fullFormattedName,
      clients: lead.organizationId ? [lead.organizationId._id] : [],
      projectManager: projectManagerId,
      country: country,
      industry: industry,
      leadId: lead._id,
      description: `Launched: ${briefName}`,
      adminId: req.user._id
    });

    updateData.projectId = newProject._id;
    updateData.lastInteractionDesc = `Project Created: ${fullFormattedName}`;
  }
}
      if (status === 'Follow-up Scheduled') {
        actionType = 'FOLLOW_UP_SET';
        logDetail = `Scheduled ${followUpType} follow-up for ${lead.pocName} on ${followUpDate}`;
      } else if (status === 'Feasibility') {
        actionType = 'FEASIBILITY_REQUEST';
        logDetail = `Sent ${lead.pocName} to Feasibility (ID: ${feasibilityId})`;
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

module.exports = router;