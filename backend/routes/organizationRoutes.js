const router = require('express').Router();
const { authorize } = require('../middleware/roleCheck'); 
const Organization = require('../models/Organization'); 
const Prospect = require('../models/Prospect');

// --- POST: Create Organization (with multiple POCs support) ---
router.post('/', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { 
      prospectId, 
      companyName, 
      website, 
      address,
      pointsOfContact 
    } = req.body;

    // Get primary POC or first POC for backward compatibility fields
    const primaryPOC = pointsOfContact?.find(p => p.isPrimary) || pointsOfContact?.[0];

    // Create the Organization with multiple POCs
    const newOrg = await Organization.create({
      companyName: companyName || req.body.name,
      website,
      address,
      pointsOfContact: pointsOfContact || [],
      salesRepId: req.user._id,
      status: 'New',
      // Backward compatibility fields
      pocName: primaryPOC?.pocName,
      pocEmail: primaryPOC?.pocEmail,
      pocPhone: primaryPOC?.pocPhone,
      linkedin: primaryPOC?.linkedin
    });

    // Update the Prospect to link it to this Organization
    if (prospectId) {
      await Prospect.findByIdAndUpdate(prospectId, {
        $set: { organizationId: newOrg._id }
      });
    }

    res.status(201).json(newOrg);
  } catch (err) {
    console.error("Org Creation Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// --- GET: View Organizations (with populated data) ---
router.get('/', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const filter = (req.user.role === 'Admin' || req.user.role === 'Sales Manager') 
      ? {} 
      : { salesRepId: req.user._id };
    
    const organizations = await Organization.find(filter)
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.json(organizations);
  } catch (err) {
    console.error("GET Organizations Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- GET: Check if company already exists (MUST BE BEFORE /:id ROUTE) ---
router.get('/check-existing', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { companyName } = req.query;
    
    if (!companyName || companyName.length < 2) {
      return res.json({ exists: false, suggestions: [] });
    }
    
    // Find similar companies (partial match)
    const similarCompanies = await Organization.find({
      companyName: { $regex: companyName, $options: 'i' }
    }).limit(5);
    
    if (similarCompanies.length > 0) {
      res.json({
        exists: true,
        suggestions: similarCompanies.map(org => ({
          _id: org._id,
          companyName: org.companyName,
          website: org.website,
          address: org.address,
          pointsOfContact: org.pointsOfContact || []
        }))
      });
    } else {
      res.json({ exists: false, suggestions: [] });
    }
  } catch (err) {
    console.error("Check existing error:", err);
    res.status(500).json({ error: 'Check failed' });
  }
});

// --- GET: Get Single Organization by ID (MUST BE AFTER SPECIFIC ROUTES) ---
router.get('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const isValidObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    if (!isValidObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid organization ID format' });
    }
    
    const organization = await Organization.findById(req.params.id)
      .select('-__v');
    
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    
    res.json({ success: true, data: organization });
  } catch (err) {
    console.error("Error fetching organization:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- PUT: Update Organization (with multiple POCs support) ---
router.put('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const filter = (req.user.role === 'Admin' || req.user.role === 'Sales Manager') 
      ? { _id: req.params.id } 
      : { _id: req.params.id, salesRepId: req.user._id };
    
    const { pointsOfContact, companyName, website, address } = req.body;
    
    // Get primary POC for backward compatibility fields
    const primaryPOC = pointsOfContact?.find(p => p.isPrimary) || pointsOfContact?.[0];
    
    const updateData = {
      companyName,
      website,
      address,
      pointsOfContact: pointsOfContact || [],
      // Update backward compatibility fields
      pocName: primaryPOC?.pocName,
      pocEmail: primaryPOC?.pocEmail,
      pocPhone: primaryPOC?.pocPhone,
      linkedin: primaryPOC?.linkedin
    };
    
    const updatedOrg = await Organization.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedOrg) {
      return res.status(404).json({ error: "Organization not found or unauthorized" });
    }
    
    res.json(updatedOrg);
  } catch (err) {
    console.error("Update Organization Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// --- DELETE: Remove Organization ---
router.delete('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const filter = (req.user.role === 'Admin' || req.user.role === 'Sales Manager') 
      ? { _id: req.params.id } 
      : { _id: req.params.id, salesRepId: req.user._id };
    
    const org = await Organization.findOneAndDelete(filter);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found or unauthorized" });
    }

    // Unlink from prospect if exists
    await Prospect.findOneAndUpdate(
      { organizationId: req.params.id },
      { $set: { organizationId: null } }
    );

    res.json({ message: "Organization deleted successfully" });
  } catch (err) {
    console.error("Delete Organization Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Add this endpoint to check if organization already exists
router.post('/check-duplicate', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { companyName, prospectId } = req.body;
    
    const existingOrg = await Organization.findOne({
      companyName: { $regex: `^${companyName}$`, $options: 'i' }
    });
    
    if (existingOrg) {
      return res.json({ 
        exists: true, 
        organization: existingOrg 
      });
    }
    
    res.json({ exists: false });
  } catch (err) {
    console.error("Check duplicate error:", err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;