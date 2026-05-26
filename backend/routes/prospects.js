const express = require('express');
const router = express.Router();
const Prospect = require('../models/Prospect');
const { authorize } = require('../middleware/roleCheck');
const Lead = require('../models/LeadGen'); 
const NoResponse = require('../models/NoResponse'); // Import the new model

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
// Add this PUT route to update a prospect
router.put('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, leadId } = req.body;
    
    const updateData = {};
    if (organizationId) updateData.organizationId = organizationId;
    if (leadId) updateData.leadId = leadId;
    
    const updatedProspect = await Prospect.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedProspect) {
      return res.status(404).json({ error: "Prospect not found" });
    }
    
    res.json(updatedProspect);
  } catch (err) {
    console.error("Prospect update error:", err);
    res.status(500).json({ error: err.message });
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
 * @route   POST /api/prospects/close/:id
 * @desc    Move prospect to no_response table and delete from prospects
 */
router.post('/close/:id', authorize('Sales', 'Sales Manager', 'Admin'), async (req, res) => {
  try {
    const prospectId = req.params.id;
    const { reason } = req.body;

    // 1. Find the existing prospect
    const prospect = await Prospect.findById(prospectId);
    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found" });
    }

    // 2. Create the "No Response" entry
    const closedProspect = new NoResponse({
      companyName: prospect.companyName,
      pocName: prospect.pocName,
      pocEmail: prospect.pocEmail,
      industry: prospect.industry,
      reasonForClosing: reason,
      closedBy: req.user.id,
      originalProspectData: prospect.toObject() // Keep full history as a snapshot
    });

    await closedProspect.save();

    // 3. Delete from the Prospect table
    await Prospect.findByIdAndDelete(prospectId);

    res.json({ message: "Prospect successfully moved to No Response archive" });
  } catch (error) {
    console.error("Close Prospect Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Add this helper function at the top of your prospects.js file
const calculateNextFollowUp = (originalApproachDate, step) => {
  // Your requested fashion: +2, +5, +12, +22, +37
  const intervals = [2, 5, 12, 22, 37];
  
  if (step >= intervals.length) return null; // No more follow-ups after 37 days

  let nextDate = new Date(originalApproachDate);
  nextDate.setDate(nextDate.getDate() + intervals[step]);

  // Weekend logic: Ensure it doesn't land on Sat/Sun
  const day = nextDate.getDay();
  if (day === 6) nextDate.setDate(nextDate.getDate() + 2); // Move Sat to Mon
  else if (day === 0) nextDate.setDate(nextDate.getDate() + 1); // Move Sun to Mon

  return nextDate;
};

// CHANGE THIS FROM router.post TO router.put
// PUT /api/prospects/approach/:id
router.put('/approach/:id', async (req, res) => {
  try {
    const prospect = await Prospect.findById(req.params.id);
    if (!prospect) return res.status(404).json({ message: "Not found" });

    // 🔹 Helper: Fix consecutive dates + weekends
    const adjustSchedule = (approaches) => {
      for (let i = 1; i < approaches.length; i++) {
        const prev = new Date(approaches[i - 1].scheduledDate);
        let curr = new Date(approaches[i].scheduledDate);

        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

        // If same or consecutive → push 2 days ahead
        if (diffDays <= 1) {
          curr = new Date(prev);
          curr.setDate(curr.getDate() + 2);
        }

        // Weekend fix
        const day = curr.getDay();
        if (day === 6) curr.setDate(curr.getDate() + 2);
        else if (day === 0) curr.setDate(curr.getDate() + 1);

        approaches[i].scheduledDate = curr;
      }
      return approaches;
    };

    // CASE A: Initial Approach
    if (!prospect.approaches || prospect.approaches.length === 0) {
      const dayOffsets = [0, 2, 5, 12, 22, 37];

      const schedule = dayOffsets.map((days, index) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + days);

        const day = scheduledDate.getDay();
        if (day === 6) scheduledDate.setDate(scheduledDate.getDate() + 2);
        else if (day === 0) scheduledDate.setDate(scheduledDate.getDate() + 1);

        return {
          step: index,
          scheduledDate,
          status: index === 0 ? 'Completed' : 'Pending',
          method: index === 0 ? req.body.method : 'Pending',
          summary: index === 0 ? req.body.summary : '',
          approachedAt: index === 0 ? new Date() : null
        };
      });

      // ✅ Apply fix here
      const adjustedSchedule = adjustSchedule(schedule);

      prospect.status = 'Approached';
      prospect.approaches = adjustedSchedule;
      prospect.currentFollowUpStep = 1;
      prospect.nextFollowUpDate = adjustedSchedule[1].scheduledDate;
    } 
    
    // CASE B: Follow-Up
    else {
      const stepIndex = prospect.currentFollowUpStep;

      if (prospect.approaches[stepIndex]) {
        prospect.approaches[stepIndex].status = 'Completed';
        prospect.approaches[stepIndex].method = req.body.method;
        prospect.approaches[stepIndex].summary = req.body.summary;
        prospect.approaches[stepIndex].approachedAt = new Date();

        // ✅ Re-adjust entire schedule after update
        prospect.approaches = adjustSchedule(prospect.approaches);

        const nextStep = stepIndex + 1;
        prospect.currentFollowUpStep = nextStep;

        prospect.nextFollowUpDate = prospect.approaches[nextStep]
          ? prospect.approaches[nextStep].scheduledDate
          : null;
      }
    }

    await prospect.save();
    res.json(prospect);

  } catch (error) {
    console.error("Approach Error:", error);
    res.status(500).json({ error: error.message });
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

    // Standard Sales Rep sees only their own
    if (req.user.role === 'Sales') {
      filter = { salesRepId: req.user.id || req.user._id };
    } 
    // Admin and Sales Manager see everything
    else if (req.user.role === 'Sales Manager' || req.user.role === 'Admin') {
      filter = {}; 
    }

    const prospects = await Prospect.find(filter)
      .populate('salesRepId', 'name') 
      .populate('leadId', 'leadNumber createdAt') // <--- ADD THIS LINE
      .sort({ createdAt: -1 });

    res.json(prospects);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
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