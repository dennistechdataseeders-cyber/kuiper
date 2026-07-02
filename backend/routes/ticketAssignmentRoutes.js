// backend/routes/ticketAssignmentRoutes.js
const express = require('express');
const router = express.Router();
const TicketAssignmentRule = require('../models/TicketAssignmentRule');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// GET all rules
router.get('/ticket-rules', protect, authorize('Admin'), async (req, res) => {
  try {
    const rules = await TicketAssignmentRule.find().sort({ category: 1, priority: -1 });
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create rule
router.post('/ticket-rules', protect, authorize('Admin'), async (req, res) => {
  try {
    const { category, subcategory, subItem, assigneeEmail, assigneeName, priority, isActive } = req.body;
    
    // Check for duplicate rule
    const existing = await TicketAssignmentRule.findOne({ category, subcategory, subItem });
    if (existing) {
      return res.status(400).json({ error: 'A rule with this exact match already exists' });
    }
    
    const rule = new TicketAssignmentRule({
      category,
      subcategory: subcategory || '',
      subItem: subItem || '',
      assigneeEmail,
      assigneeName: assigneeName || '',
      priority: priority || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id,
      lastUpdatedBy: req.user.id
    });
    
    await rule.save();
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update rule
router.put('/ticket-rules/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const rule = await TicketAssignmentRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    const { category, subcategory, subItem, assigneeEmail, assigneeName, priority, isActive } = req.body;
    
    // Check for duplicate (excluding self)
    const existing = await TicketAssignmentRule.findOne({ 
      category, 
      subcategory: subcategory || '', 
      subItem: subItem || '',
      _id: { $ne: req.params.id }
    });
    if (existing) {
      return res.status(400).json({ error: 'A rule with this exact match already exists' });
    }
    
    rule.category = category;
    rule.subcategory = subcategory || '';
    rule.subItem = subItem || '';
    rule.assigneeEmail = assigneeEmail;
    rule.assigneeName = assigneeName || '';
    rule.priority = priority || 0;
    rule.isActive = isActive !== undefined ? isActive : true;
    rule.lastUpdatedBy = req.user.id;
    
    await rule.save();
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE rule
router.delete('/ticket-rules/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const rule = await TicketAssignmentRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;