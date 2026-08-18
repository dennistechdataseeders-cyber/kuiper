// backend/routes/prospects.js - FULL UPDATED CODE

const express = require('express');
const router = express.Router();
const Prospect = require('../models/Prospect');
const { authorize } = require('../middleware/roleCheck');
const Lead = require('../models/LeadGen'); 
const NoResponse = require('../models/NoResponse');

// ==========================================
// 1. SPECIFIC ACTION ROUTES (MUST BE AT TOP)
// ==========================================

// POST /api/prospects/fetch-bucket
// Sales Reps can fetch unassigned prospects from the global bucket
router.post('/fetch-bucket', authorize('Sales'), async (req, res) => {
  try {
    // Find prospects where salesRepId is explicitly null OR doesn't exist
    const available = await Prospect.find({
      $or: [
        { salesRepId: null },
        { salesRepId: { $exists: false } }
      ]
    }).limit(10);

    if (available.length === 0) {
      return res.status(404).json({ message: "No more prospects available in the bucket!" });
    }

    // Map the IDs of the found prospects
    const idsToUpdate = available.map(p => p._id);

    // Update them to belong to the current user
    await Prospect.updateMany(
      { _id: { $in: idsToUpdate } },
      { $set: { salesRepId: req.user.id } } 
    );

    res.json({ 
      message: `Successfully claimed ${available.length} new prospects!`,
      count: available.length
    });
  } catch (error) {
    console.error("Fetch Bucket Error:", error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET /api/prospects/bucket-count
// Get count of unassigned prospects in the global bucket
router.get('/bucket-count', authorize('Sales'), async (req, res) => {
  try {
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

// PUT /api/prospects/:id
// Update a prospect (for linking to Organization or Lead)
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

// PUT /api/prospects/approach/:id
// Record an approach/follow-up on a prospect
router.put('/approach/:id', authorize('Sales', 'Sales Manager', 'Admin'), async (req, res) => {
  try {
    const prospect = await Prospect.findById(req.params.id);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    // Helper: Fix consecutive dates + weekends
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

// POST /api/prospects/close/:id
// Move prospect to no_response table and delete from prospects
router.post('/close/:id', authorize('Sales', 'Sales Manager', 'Admin'), async (req, res) => {
  try {
    const prospectId = req.params.id;
    const { reason } = req.body;

    const prospect = await Prospect.findById(prospectId);
    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found" });
    }

    const closedProspect = new NoResponse({
      companyName: prospect.companyName,
      pocName: prospect.pocName,
      pocEmail: prospect.pocEmail,
      industry: prospect.industry,
      reasonForClosing: reason,
      closedBy: req.user.id,
      originalProspectData: prospect.toObject()
    });

    await closedProspect.save();

    await Prospect.findByIdAndDelete(prospectId);

    res.json({ message: "Prospect successfully moved to No Response archive" });
  } catch (error) {
    console.error("Close Prospect Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// ==========================================
// 2. BULK IMPORT ROUTE (UPDATED)
// ==========================================

/**
 * @route   POST /api/prospects/bulk-import
 * @desc    Import prospects with role-based assignment
 *          - Sales Reps: prospects are auto-assigned to them
 *          - Sales Managers/Admins: prospects go to global bucket (salesRepId: null)
 */
router.post('/bulk-import', authorize('Admin', 'Sales Manager', 'Sales'), async (req, res) => {
  try {
    const rawData = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Determine if the uploader is a Sales Rep
    const isSalesRep = userRole === 'Sales';

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: "No data provided. Please upload a valid Excel file." });
    }

    // 1. Validate required fields
    const invalidRecords = rawData.filter(item => !item.companyName?.trim() || !item.pocName?.trim());
    if (invalidRecords.length > 0) {
      return res.status(400).json({ 
        error: `${invalidRecords.length} record(s) missing required fields (companyName, pocName)`,
        invalidRecords: invalidRecords.slice(0, 5) // Show first 5 invalid records
      });
    }

    // 2. Remove duplicates within the incoming request (Internal Uniqueness)
    const uniqueMap = new Map();
    rawData.forEach(item => {
      const identifier = item.companyName?.trim();
      if (identifier && !uniqueMap.has(identifier)) {
        uniqueMap.set(identifier, {
          companyName: item.companyName?.trim(),
          pocName: item.pocName?.trim(),
          pocEmail: item.pocEmail?.trim() || '',
          pocContact: item.pocContact?.trim() || '',
          pocLinkedin: item.pocLinkedin?.trim() || '',
          industry: item.industry?.trim() || '',
          // ✅ KEY LOGIC: Sales Rep gets auto-assigned, others go to bucket
          salesRepId: isSalesRep ? userId : null,
          status: 'New',
          currentFollowUpStep: 0,
          approaches: []
        });
      }
    });

    const formattedData = Array.from(uniqueMap.values());

    if (formattedData.length === 0) {
      return res.status(400).json({ error: "No valid unique records provided." });
    }

    // 3. insertMany with { ordered: false }
    // This allows Mongo to skip records that already exist in the DB (External Uniqueness)
    const result = await Prospect.insertMany(formattedData, { ordered: false });
    
    const message = isSalesRep 
      ? `Successfully imported ${result.length} prospects assigned to you`
      : `Successfully imported ${result.length} prospects to the global bucket`;

    res.status(201).json({ 
      success: true,
      message: message,
      count: result.length,
      assignedTo: isSalesRep ? userId : null,
      role: userRole
    });

  } catch (err) {
    // If some records failed due to uniqueness, insertMany throws an error 
    // but the successful ones are still saved because of { ordered: false }
    if (err.code === 11000 || err.name === 'BulkWriteError' || err.insertedDocs) {
      const count = err.insertedDocs ? err.insertedDocs.length : (err.result?.nInserted || 0);
      return res.status(201).json({ 
        success: true,
        message: "Partial import complete",
        count: count,
        duplicatesSkipped: rawData.length - count
      });
    }

    console.error("Import Error:", err);
    res.status(400).json({ error: "Import failed due to data formatting", details: err.message });
  }
});

// ==========================================
// 3. CRUD ROUTES
// ==========================================

/**
 * @route   GET /api/prospects
 * @desc    Fetch prospects based on role
 *          - Sales Reps: only their own prospects
 *          - Sales Managers/Admins: all prospects
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
      .populate('leadId', 'leadNumber createdAt')
      .sort({ createdAt: -1 });

    res.json(prospects);
  } catch (err) {
    console.error("GET Prospects Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

/**
 * @route   POST /api/prospects
 * @desc    Create a single prospect
 *          - Sales Reps: prospect is auto-assigned to them
 *          - Sales Managers/Admins: prospect goes to bucket (salesRepId: null)
 */
router.post('/', authorize('Admin', 'Sales Manager', 'Sales'), async (req, res) => {
  try {
    const isSalesRep = req.user.role === 'Sales';
    
    const newProspect = new Prospect({
      ...req.body,
      salesRepId: isSalesRep ? req.user.id : null,
      status: 'New',
      currentFollowUpStep: 0,
      approaches: []
    });
    
    const saved = await newProspect.save();
    
    const message = isSalesRep 
      ? "Prospect created and assigned to you"
      : "Prospect added to the global bucket";
    
    res.status(201).json({ 
      success: true,
      message: message,
      prospect: saved 
    });
  } catch (err) {
    console.error("POST Prospect Error:", err);
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
    console.error("DELETE Prospect Error:", err);
    res.status(500).json({ error: "Server error during deletion" });
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
    console.error("Clear All Error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;