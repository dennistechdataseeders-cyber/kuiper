const Prospect = require('../models/Prospect');

// GET all prospects (for the list)
exports.getProspects = async (req, res) => {
  try {
    let query = {};
    
    // If user is a Sales Rep, only show their assigned prospects OR available ones
    if (req.user.role === 'Sales Representative') {
      query = { 
        $or: [
          { salesRepId: req.user.id }, 
          { salesRepId: null }
        ] 
      };
    }

    const prospects = await Prospect.find(query)
      .populate('salesRepId', 'name email')
      .populate('organizationId', 'name') // To check if converted to Org
      .populate('leadId', '_id')         // To check if converted to Lead
      .sort({ createdAt: -1 });
      
    res.json(prospects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch prospects" });
  }
};

// POST Bulk Import
exports.bulkImport = async (req, res) => {
  try {
    const prospects = req.body; // Array from Excel
    const result = await Prospect.insertMany(prospects);
    res.status(201).json({ count: result.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// GET Count of available items in the bucket
exports.getBucketCount = async (req, res) => {
  try {
    const count = await Prospect.countDocuments({ salesRepId: null });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST Fetch/Claim 10 prospects from the bucket
exports.fetchBucket = async (req, res) => {
  try {
    // Find 10 unassigned prospects
    const available = await Prospect.find({ salesRepId: null }).limit(10);
    
    if (available.length === 0) {
      return res.status(404).json({ message: "Bucket is empty!" });
    }

    const ids = available.map(p => p._id);
    await Prospect.updateMany(
      { _id: { $in: ids } },
      { $set: { salesRepId: req.user.id } }
    );

    res.json({ message: `Successfully claimed ${available.length} prospects` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};