const Project = require('../models/Project');
const Task = require('../models/Task'); // Assuming Tasks are linked to the bucket
const Prospect = require('../models/Prospect'); // Add this import at the top
// GET all projects with full population
// Inside projectController.js or pmRoutes.js
exports.getAllProjects = async (req, res) => {
  try {
    let query = {};
    // If the user is a PM, only show projects assigned to them
    if (req.user.role === 'Project Manager' ) {
      query = { projectManager: req.user.id };
    }

    const projects = await Project.find(query)
      .populate('projectManager', 'name')
      .populate('leadId')
      .sort({ createdAt: -1 });
      
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch PM bucket" });
  }
};

// GET specifically for the Developer Bucket (Fixes the "undefined" error)
exports.getDeveloperBucket = async (req, res) => {
  try {
    // We populate 'feedId' so the frontend can access feedId.frequency and feedId.feedType
    const bucketTasks = await Task.find({ performerId: req.user.id })
      .populate('projectId', 'name')
      .populate('feedId', 'name feedType frequency') 
      .sort({ createdAt: -1 });
      
    res.json(bucketTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch developer bucket" });
  }
};

// POST Create project
// exports.createProject = async (req, res) => {
//   try {
//     const { name, clients, projectManager, description, country, industry, prospectId } = req.body;
    
//     // ... (Your ID generation logic)
//     const shortName = name.substring(0, 3).toUpperCase();
//     const countryCode = country.substring(0, 3).toUpperCase();
//     const projectCustomId = `TDS-${industry.toUpperCase()}-${countryCode}-${shortName}`;

//     const newProject = new Project({
//       name,
//       projectCustomId,
//       clients,
//       projectManager,
//       description,
//       country,
//       industry,
//       createdBy: req.user.id 
//     });

//     const savedProject = await newProject.save();

//     // NEW: If this was converted from a prospect, link it now
//     if (prospectId) {
//       await Prospect.findByIdAndUpdate(prospectId, { 
//         organizationId: savedProject._id 
//       });
//     }

//     res.status(201).json(savedProject);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };
exports.createProject = async (req, res) => {
  try {
    // ... existing project creation logic ...
    const savedProject = await newProject.save();

    // LINKING LOGIC: Update the Prospect via organizationId
    if (req.body.organizationId) {
      await Prospect.findOneAndUpdate(
        { organizationId: req.body.organizationId },
        { $set: { leadId: savedProject._id } }
      );
    }

    res.status(201).json(savedProject);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};