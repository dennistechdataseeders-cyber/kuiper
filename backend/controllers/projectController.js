const Project = require('../models/Project');
const Task = require('../models/Task');
const Prospect = require('../models/Prospect');

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

// backend/controllers/projectController.js - UPDATED getAllProjects

exports.getAllProjects = async (req, res) => {
  try {
    let query = {};
    
    // ✅ FIX: Super Admin and Admin see ALL projects
    if (req.user.role === 'Super Admin' || req.user.role === 'Admin') {
      // No filter - show ALL projects
      query = {};
    } else if (req.user.role === 'Project Manager') {
      query = { projectManager: req.user.id };
    } else if (req.user.role === 'Team Lead') {
      query = { teamLead: req.user.id };
    } else if (req.user.role === 'Client') {
      // Client-specific logic
      const clientIdStr = req.user.id;
      const clientOrgId = req.user.organizationId;
      
      const projects = await Project.find({
        $or: [
          { clients: clientIdStr },
          ...(clientOrgId ? [{ organizations: clientOrgId }] : [])
        ]
      });
      
      const populatedProjects = await Project.populate(projects, [
        { path: 'projectManager', select: 'name' },
        { path: 'leadId' }
      ]);
      
      return res.json(populatedProjects);
    }

    const projects = await Project.find(query)
      .populate('projectManager', 'name')
      .populate('leadId')
      .sort({ createdAt: -1 });
      
    res.json(projects);
  } catch (error) {
    console.error('Error in getAllProjects:', error);
    res.status(500).json({ error: "Failed to fetch PM bucket" });
  }
};

exports.getDeveloperBucket = async (req, res) => {
  try {
    const bucketTasks = await Task.find({ performerId: req.user.id })
      .populate('projectId', 'name')
      .populate('feedId', 'name feedType frequency') 
      .sort({ createdAt: -1 });
      
    res.json(bucketTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch developer bucket" });
  }
};


// Update the createProject function:

exports.createProject = async (req, res) => {
  try {
    const { name, clients, projectManager, description, country, industry, organizationId, teamLead } = req.body;

    // 1. Generate Serial Number (TDS + 4 digits)
    const projectCount = await Project.countDocuments();
    const serialNumber = String(projectCount + 1).padStart(4, '0');

    // 2. Get 2-letter Country Code
    const countryCode = COUNTRY_MAP[country] || (country ? country.substring(0, 2).toUpperCase() : 'XX');

    // 3. Get 4-letter Industry Code
    const industryCode = (industry || 'GEN').toUpperCase().substring(0, 4);

    // 4. Format: TDS0011-ECOM | AE | Books Data Extraction
    const fullFormattedName = `TDS${serialNumber}-${industryCode} | ${countryCode} | ${name}`;

    const newProject = new Project({
      name: fullFormattedName,
      projectCustomId: fullFormattedName,
      clients,
      projectManager: projectManager || req.user.id,
      teamLead: teamLead || null,  // ADD THIS LINE
      description,
      country,
      industry,
      createdBy: req.user.id 
    });

    const savedProject = await newProject.save();

    // Link to prospect if organizationId provided
    if (organizationId) {
      await Prospect.findOneAndUpdate(
        { organizationId: organizationId },
        { $set: { leadId: savedProject._id } }
      );
    }

    res.status(201).json(savedProject);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};