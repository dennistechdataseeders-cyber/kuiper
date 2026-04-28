const router = require('express').Router();
const { authorize } = require('../middleware/roleCheck'); 
const Organization = require('../models/Organization'); 
const Prospect = require('../models/Prospect');

// --- POST: Create Organization from Prospect (STEP 1 in flow) ---
router.post('/', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const { prospectId, companyName, website, pocName, pocEmail, pocPhone, linkedin, address } = req.body;

    // Create the Organization
    const newOrg = await Organization.create({
      companyName: companyName || req.body.name,
      website,
      pocName,
      pocEmail,
      pocPhone,
      linkedin,
      address,
      salesRepId: req.user._id,
      status: 'New'
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

// --- GET: View Organizations ---
router.get('/', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const filter = req.user.role === 'Admin' ? {} : { salesRepId: req.user._id };
    const organizations = await Organization.find(filter).sort({ createdAt: -1 });
    res.json(organizations);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- PUT: Update Organization ---
router.put('/:id', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const filter = req.user.role === 'Admin' 
      ? { _id: req.params.id } 
      : { _id: req.params.id, salesRepId: req.user._id };
    
    const updatedOrg = await Organization.findOneAndUpdate(
      filter,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedOrg) return res.status(404).json({ error: "Organization not found or unauthorized" });
    
    res.json(updatedOrg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- DELETE: Remove Organization ---
router.delete('/:id', authorize('Admin', 'Sales'), async (req, res) => {
  try {
    const org = await Organization.findOneAndDelete({ _id: req.params.id });
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Unlink from prospect if exists
    await Prospect.findOneAndUpdate(
      { organizationId: req.params.id },
      { $set: { organizationId: null } }
    );

    res.json({ message: "Organization deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;