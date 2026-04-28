const express = require('express');
const router = express.Router();
const Prospect = require('../models/Prospect');
const { authorize } = require('../middleware/roleCheck');
const Lead = require('../models/LeadGen'); // <--- ADD THIS LINE HERE
// ==========================================
// 1. SPECIFIC ACTION ROUTES (MUST BE AT TOP)
// ==========================================
// POST /api/prospects/fetch-bucket
router.post('/fetch-bucket', async (req, res) => {
  try {
    // 1. Find prospects where salesRepId is explicitly null OR doesn't exist
    const available = await Prospect.find({
      $or: [
        { salesRepId: null },
        { salesRepId: { $exists: false } }
      ]
    }).limit(10);

    if (available.length === 0) {
      return res.status(404).json({ message: "No more prospects available in the bucket!" });
    }

    // 2. Map the IDs of the found prospects
    const idsToUpdate = available.map(p => p._id);

    // 3. Update them to belong to the current user
    // IMPORTANT: Ensure your auth middleware populates req.user
    await Prospect.updateMany(
      { _id: { $in: idsToUpdate } },
      { $set: { salesRepId: req.user.id } } 
    );

    res.json({ message: `Successfully claimed ${available.length} new prospects!` });
  } catch (error) {
    console.error("Fetch Bucket Error:", error);
    // Sending the actual error message helps debugging
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});
router.get('/bucket-count', async (req, res) => {
  try {
    // THE FIX: Specifically look for prospects where salesRepId is missing, null, or undefined
    const count = await Prospect.countDocuments({
      $or: [
        { salesRepId: { $exists: false } },
        { salesRepId: null }
      ]
    });
    res.json({ count });
  } catch (error) {
    console.error("Bucket Count Error:", error);
    res.status(500).json({ message: "Server error calculating bucket" });
  }
});


/**
 * @route   POST /api/prospects/bulk-import
 * @desc    SM/Admin uploads prospects into the unassigned bucket
 */
router.post('/bulk-import', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const rawData = req.body;

    // 1. Remove duplicates within the incoming request (Internal Uniqueness)
    // We use a Map to keep the first occurrence of each company name
    const uniqueMap = new Map();
    rawData.forEach(item => {
      const identifier = item.companyName?.trim(); // Or pocName, whichever is your unique key
      if (identifier && !uniqueMap.has(identifier)) {
        uniqueMap.set(identifier, {
          ...item,
          salesRepId: null // Resetting salesRepId as per your logic
        });
      }
    });

    const formattedData = Array.from(uniqueMap.values());

    if (formattedData.length === 0) {
      return res.status(400).json({ error: "No valid unique records provided." });
    }

    // 2. insertMany with { ordered: false }
    // This allows Mongo to skip records that already exist in the DB (External Uniqueness)
    const result = await Prospect.insertMany(formattedData, { ordered: false });
    
    res.status(201).json({ 
      message: "Import successful",
      count: result.length 
    });

  } catch (err) {
    // If some records failed due to uniqueness, insertMany throws an error 
    // but the successful ones are still saved because of { ordered: false }
    if (err.code === 11000 || err.name === 'BulkWriteError' || err.insertedDocs) {
      const count = err.insertedDocs ? err.insertedDocs.length : (err.result?.nInserted || 0);
      return res.status(201).json({ 
        message: "Partial import complete",
        count: count,
        duplicatesSkipped: rawData.length - count
      });
    }

    console.error("Import Error:", err);
    res.status(400).json({ error: "Import failed due to data formatting" });
  }
});

/**
 * @route   DELETE /api/prospects/clear/all
 * @desc    Admin only: Clear the entire database
 */
router.delete('/clear/all', authorize('Admin'), async (req, res) => {
  try {
    await Prospect.deleteMany({});
    res.json({ message: "All prospects cleared" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ==========================================
// 2. GENERAL CRUD ROUTES
// ==========================================

/**
 * @route   GET /api/prospects
 * @desc    Fetch prospects based on role (Populated with Sales Rep Name)
 */
/**
 * @route   GET /api/prospects
 * @desc    Fetch prospects based on role (Populated with Sales Rep Name and Conversion IDs)
 */
router.get('/', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    let filter = {};

    // 1. Logic for Sales Rep (Show only their assigned items)
    if (req.user.role === 'Sales') {
      filter = { salesRepId: req.user.id || req.user._id };
    } 
    // 2. Logic for Sales Manager / Admin (Show all)
    else if (req.user.role === 'Sales Manager' || req.user.role === 'Admin') {
      filter = {}; // Sees everything
    }

    // 3. Population Fix: 
    // IMPORTANT: Use 'LeadGen' instead of 'Lead' to match your model definition
    const prospects = await Prospect.find(filter)
      .populate('salesRepId', 'name') 
      .populate('organizationId', 'name') 
      .populate('leadId') // This will work if Prospect model ref is 'LeadGen'
      .sort({ createdAt: -1 });

    res.json(prospects);
  } catch (err) {
    console.error("Fetch Prospects Error:", err);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

/**
 * @route   POST /api/prospects
 * @desc    Create a single prospect (Added to bucket by default)
 */



router.post('/', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const newProspect = new Prospect({
      ...req.body,
      salesRepId: null // Goes to bucket
    });
    
    const saved = await newProspect.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: "Validation failed", details: err.message });
  }
});

/**
 * @route   DELETE /api/prospects/:id
 * @desc    Delete a specific prospect (Must be owner or Admin)
 */
router.delete('/:id', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const query = { _id: req.params.id };
    
    if (req.user.role !== 'Admin') {
      query.salesRepId = req.user._id;
    }

    const prospect = await Prospect.findOneAndDelete(query);
    
    if (!prospect) {
      return res.status(404).json({ error: "Prospect not found or unauthorized" });
    }
    
    res.json({ message: "Prospect deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error during deletion" });
  }
});

module.exports = router;