// backend/routes/moduleFieldRoutes.js
const express = require('express');
const router = express.Router();
const ModuleField = require('../models/ModuleField');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// ✅ Only these roles may CREATE / DELETE custom fields (Customize Modules page)
const canCustomize = authorize('Admin', 'Super Admin', 'Sales', 'Sales Manager');

// GET all custom fields for a specific module.
// Any logged-in user may READ them, because every create-form
// (Leads, Contacts, Accounts, Deals, Tasks, Meetings, Calls) needs to render them.
router.get('/:moduleName', async (req, res) => {
  try {
    const fields = await ModuleField.find({ moduleName: req.params.moduleName, isActive: true })
      .sort({ order: 1 });
    res.json({ success: true, data: fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new field
router.post('/:moduleName', canCustomize, async (req, res) => {
  try {
    const { label, type, options, isRequired, placeholder, lookupModule } = req.body;
    
    // Generate a unique key for the new field
    const fieldKey = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Get the current max order to append at the end
    const lastField = await ModuleField.findOne({ moduleName: req.params.moduleName }).sort({ order: -1 });
    const order = lastField ? lastField.order + 1 : 0;

    const newField = await ModuleField.create({
      moduleName: req.params.moduleName,
      fieldKey,
      label,
      type,
      options: options || [],
      isRequired: isRequired || false,
      placeholder: placeholder || '',
      lookupModule: lookupModule || null,
      order
    });

    res.status(201).json({ success: true, data: newField });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a field
router.delete('/:id', canCustomize, async (req, res) => {
  try {
    const field = await ModuleField.findById(req.params.id);
    if (!field) return res.status(404).json({ error: 'Field not found' });
    
    // Soft delete (or use findByIdAndDelete for hard delete)
    field.isActive = false;
    await field.save();
    
    res.json({ success: true, message: 'Field removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
