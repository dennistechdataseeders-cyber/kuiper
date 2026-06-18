const router = require('express').Router();
const { authorize } = require('../middleware/roleCheck'); 
const Organization = require('../models/Organization'); 
const Prospect = require('../models/Prospect');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// --- POST: Create Organization (with multiple POCs support and optional client user creation) ---
router.post('/', authorize('Admin', 'Sales', 'Sales Manager','Project Manager'), async (req, res) => {
  try {
    const { 
      prospectId, 
      companyName, 
      website, 
      address,
      pointsOfContact,
      createClientAccount,
      clientEmail,
      clientPassword
    } = req.body;

    // Validate required fields
    if (!companyName) {
      return res.status(400).json({ error: "Company name is required" });
    }

    if (createClientAccount && !clientEmail) {
      return res.status(400).json({ error: "Client email is required when creating a client account" });
    }

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

    // Create a client user account for the organization if requested
    let clientUser = null;
    if (createClientAccount && clientEmail) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: clientEmail });
      
      if (existingUser) {
        // If user exists, link them to this organization
        existingUser.organizationId = newOrg._id;
        await existingUser.save();
        clientUser = existingUser;
      } else {
        // Create new client user
        const tempPassword = clientPassword || Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        clientUser = await User.create({
          name: companyName,
          email: clientEmail,
          password: hashedPassword,
          role: 'Client',
          clientType: 'organization',
          organizationId: newOrg._id
        });
        
        // Store the client user ID in the organization
        newOrg.clientUserId = clientUser._id;
        await newOrg.save();
      }
    }

    // Update the Prospect to link it to this Organization
    if (prospectId) {
      await Prospect.findByIdAndUpdate(prospectId, {
        $set: { organizationId: newOrg._id }
      });
    }

    // Return response with client user info if created
    const response = {
      ...newOrg.toObject(),
      clientUser: clientUser ? {
        _id: clientUser._id,
        email: clientUser.email,
        name: clientUser.name,
        temporaryPassword: clientPassword || (createClientAccount ? 'Password sent via email' : null)
      } : null
    };

    res.status(201).json(response);
  } catch (err) {
    console.error("Org Creation Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orgs/client/me - Get the organization for the current client user
router.get('/client/me', authorize('Client'), async (req, res) => {
  try {
    const clientId = req.user._id;
    
    // Find organization where this client is linked
    const organization = await Organization.findOne({ 
      clientUserId: clientId 
    }).populate('clientUserId', 'name email');
    
    if (!organization) {
      return res.json({ success: true, data: null });
    }
    
    res.json({ success: true, data: organization });
  } catch (err) {
    console.error("Error fetching client's organization:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- GET: View Organizations (ALL sales people can see ALL organizations) ---
router.get('/', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    // ✅ REMOVED the salesRepId filter - ALL sales people can see ALL organizations
    const organizations = await Organization.find({})
      .populate('clientUserId', 'name email githubUsername')
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
    })
    .populate('clientUserId', 'name email')
    .limit(5);
    
    if (similarCompanies.length > 0) {
      res.json({
        exists: true,
        suggestions: similarCompanies.map(org => ({
          _id: org._id,
          companyName: org.companyName,
          website: org.website,
          address: org.address,
          pointsOfContact: org.pointsOfContact || [],
          clientUser: org.clientUserId
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
      .populate('clientUserId', 'name email githubUsername')
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

// --- PUT: Update Organization ---
router.put('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { pointsOfContact, companyName, website, address, clientUserId } = req.body;
    
    // ✅ No salesRepId filter - ANY sales person can update ANY organization
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
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
    
    // Update client user reference if provided
    if (clientUserId) {
      updateData.clientUserId = clientUserId;
    }
    
    // Update the organization
    const updatedOrg = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('clientUserId', 'name email');

    res.json(updatedOrg);
  } catch (err) {
    console.error("Update Organization Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// --- DELETE: Remove Organization ---
router.delete('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    // ✅ No salesRepId filter - ANY sales person can delete ANY organization
    const org = await Organization.findById(req.params.id);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Remove reference from client user if exists
    if (org.clientUserId) {
      await User.findByIdAndUpdate(org.clientUserId, {
        $unset: { organizationId: "" }
      });
    }

    // Unlink from prospect if exists
    await Prospect.findOneAndUpdate(
      { organizationId: req.params.id },
      { $set: { organizationId: null } }
    );

    // Delete the organization
    await Organization.findByIdAndDelete(req.params.id);

    res.json({ message: "Organization deleted successfully" });
  } catch (err) {
    console.error("Delete Organization Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- POST: Check if organization already exists ---
router.post('/check-duplicate', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { companyName, prospectId } = req.body;
    
    const existingOrg = await Organization.findOne({
      companyName: { $regex: `^${companyName}$`, $options: 'i' }
    }).populate('clientUserId', 'name email');
    
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

// --- POST: Add POC to existing organization (ALL sales people can add to ANY organization) ---
router.post('/:id/add-poc', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { pocName, pocEmail, pocPhone, linkedin, department, isPrimary } = req.body;
    
    if (!pocName) {
      return res.status(400).json({ error: "POC name is required" });
    }
    
    // ✅ No salesRepId filter - ANY sales person can add POC to ANY organization
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    // Create new POC
    const newPOC = {
      pocName,
      pocEmail,
      pocPhone,
      linkedin,
      department: department || 'Other',
      isPrimary: isPrimary || false,
      addedAt: new Date()
    };
    
    // If this POC is marked as primary, unset other primary POCs
    if (newPOC.isPrimary) {
      organization.pointsOfContact.forEach(poc => {
        poc.isPrimary = false;
      });
    }
    
    // Add to points of contact array
    organization.pointsOfContact.push(newPOC);
    
    // If this is the first POC or marked as primary, update backward compatibility fields
    if (organization.pointsOfContact.length === 1 || newPOC.isPrimary) {
      organization.pocName = newPOC.pocName;
      organization.pocEmail = newPOC.pocEmail;
      organization.pocPhone = newPOC.pocPhone;
      organization.linkedin = newPOC.linkedin;
    }
    
    await organization.save();
    
    res.status(201).json({
      success: true,
      message: "POC added successfully",
      poc: newPOC
    });
  } catch (err) {
    console.error("Add POC Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT: Update POC in organization ---
router.put('/:id/poc/:pocIndex', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { pocIndex } = req.params;
    const { pocName, pocEmail, pocPhone, linkedin, department, isPrimary } = req.body;
    
    // ✅ No salesRepId filter - ANY sales person can update POC in ANY organization
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const index = parseInt(pocIndex);
    if (index < 0 || index >= organization.pointsOfContact.length) {
      return res.status(400).json({ error: "Invalid POC index" });
    }
    
    // Update the POC
    organization.pointsOfContact[index] = {
      ...organization.pointsOfContact[index],
      pocName: pocName || organization.pointsOfContact[index].pocName,
      pocEmail: pocEmail !== undefined ? pocEmail : organization.pointsOfContact[index].pocEmail,
      pocPhone: pocPhone !== undefined ? pocPhone : organization.pointsOfContact[index].pocPhone,
      linkedin: linkedin !== undefined ? linkedin : organization.pointsOfContact[index].linkedin,
      department: department || organization.pointsOfContact[index].department,
      isPrimary: isPrimary !== undefined ? isPrimary : organization.pointsOfContact[index].isPrimary
    };
    
    // If this POC is marked as primary, unset other primary POCs
    if (organization.pointsOfContact[index].isPrimary) {
      organization.pointsOfContact.forEach((poc, idx) => {
        if (idx !== index) {
          poc.isPrimary = false;
        }
      });
      // Update backward compatibility fields
      organization.pocName = organization.pointsOfContact[index].pocName;
      organization.pocEmail = organization.pointsOfContact[index].pocEmail;
      organization.pocPhone = organization.pointsOfContact[index].pocPhone;
      organization.linkedin = organization.pointsOfContact[index].linkedin;
    }
    
    await organization.save();
    
    res.json({
      success: true,
      message: "POC updated successfully",
      poc: organization.pointsOfContact[index]
    });
  } catch (err) {
    console.error("Update POC Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE: Remove POC from organization ---
router.delete('/:id/poc/:pocIndex', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { pocIndex } = req.params;
    
    // ✅ No salesRepId filter - ANY sales person can remove POC from ANY organization
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const index = parseInt(pocIndex);
    if (index < 0 || index >= organization.pointsOfContact.length) {
      return res.status(400).json({ error: "Invalid POC index" });
    }
    
    // Remove the POC
    organization.pointsOfContact.splice(index, 1);
    
    // If there are remaining POCs, update backward compatibility fields with the first one
    if (organization.pointsOfContact.length > 0) {
      const firstPOC = organization.pointsOfContact[0];
      organization.pocName = firstPOC.pocName;
      organization.pocEmail = firstPOC.pocEmail;
      organization.pocPhone = firstPOC.pocPhone;
      organization.linkedin = firstPOC.linkedin;
      
      // Ensure at least one POC is marked as primary
      const hasPrimary = organization.pointsOfContact.some(poc => poc.isPrimary);
      if (!hasPrimary) {
        organization.pointsOfContact[0].isPrimary = true;
      }
    } else {
      // Clear backward compatibility fields if no POCs left
      organization.pocName = undefined;
      organization.pocEmail = undefined;
      organization.pocPhone = undefined;
      organization.linkedin = undefined;
    }
    
    await organization.save();
    
    res.json({
      success: true,
      message: "POC removed successfully"
    });
  } catch (err) {
    console.error("Remove POC Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET: Get all POCs for an organization ---
router.get('/:id/pocs', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    // ✅ No salesRepId filter - ANY sales person can view POCs in ANY organization
    const organization = await Organization.findById(req.params.id)
      .select('pointsOfContact companyName');
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    res.json({
      success: true,
      organizationName: organization.companyName,
      pointsOfContact: organization.pointsOfContact || []
    });
  } catch (err) {
    console.error("Get POCs Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET: Get statistics for organizations ---
router.get('/stats/summary', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const totalOrganizations = await Organization.countDocuments();
    const organizationsWithClientUsers = await Organization.countDocuments({ clientUserId: { $ne: null } });
    const totalPOCs = await Organization.aggregate([
      { $project: { pocCount: { $size: "$pointsOfContact" } } },
      { $group: { _id: null, total: { $sum: "$pocCount" } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalOrganizations,
        organizationsWithClientUsers,
        totalPOCs: totalPOCs[0]?.total || 0
      }
    });
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;