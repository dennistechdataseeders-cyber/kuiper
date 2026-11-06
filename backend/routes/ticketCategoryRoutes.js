// backend/routes/ticketCategoryRoutes.js
// Mounted at /api/ticket-categories
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const TicketCategory = require('../models/TicketCategory');
const defaults = require('../seed/ticketCategoryDefaults');

router.use(protect);

const clean = (s) => (typeof s === 'string' ? s.trim() : '');
const uniq = (arr) => [...new Set((arr || []).map(clean).filter(Boolean))];

function sanitizeOverrides(list) {
  return (list || [])
    .map(o => ({ creatorRoles: uniq(o.creatorRoles), assignRole: clean(o.assignRole) }))
    .filter(o => o.assignRole && o.creatorRoles.length);
}

function sanitizeCategory(body) {
  const seen = new Set();
  const subcategories = [];
  for (const s of body.subcategories || []) {
    const name = clean(s.name);
    if (!name || seen.has(name.toLowerCase())) continue;   // skip blank / duplicate names
    seen.add(name.toLowerCase());
    const sub = {
      name,
      items: uniq(s.items),
      special: !!s.special,
      clientVisible: s.clientVisible !== false,
      assignOverrides: sanitizeOverrides(s.assignOverrides),
      isActive: s.isActive !== false
    };
    if (s._id) sub._id = s._id;   // keep ids stable on edit
    subcategories.push(sub);
  }
  return {
    name: clean(body.name),
    icon: clean(body.icon) || '📁',
    color: clean(body.color) || 'slate',
    role: clean(body.role),
    clientVisible: !!body.clientVisible,
    isActive: body.isActive !== false,
    order: Number.isFinite(+body.order) ? +body.order : 0,
    assignOverrides: sanitizeOverrides(body.assignOverrides),
    subcategories
  };
}

async function seedIfEmpty() {
  if ((await TicketCategory.estimatedDocumentCount()) === 0) {
    await TicketCategory.insertMany(defaults);
  }
}

// ---------------------------------------------------------------
// GET /api/ticket-categories  -> every logged-in user (form needs it)
// ?all=true is honoured only for Admin / Super Admin (includes inactive)
// ---------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    await seedIfEmpty();
    const isAdmin = ['Admin', 'Super Admin'].includes(req.user.role);
    const filter = (req.query.all === 'true' && isAdmin) ? {} : { isActive: true };
    let cats = await TicketCategory.find(filter).sort({ order: 1, name: 1 }).lean();

    if (!(req.query.all === 'true' && isAdmin)) {
      cats = cats.map(c => ({ ...c, subcategories: (c.subcategories || []).filter(s => s.isActive !== false) }));
    }
    res.json(cats);
  } catch (err) {
    console.error('Error fetching ticket categories:', err);
    res.status(500).json({ error: 'Failed to fetch ticket categories' });
  }
});

// ---------------------------------------------------------------
// Admin / Super Admin only below
// ---------------------------------------------------------------
const adminOnly = authorize('Admin', 'Super Admin');

router.post('/', adminOnly, async (req, res) => {
  try {
    const data = sanitizeCategory(req.body);
    if (!data.name) return res.status(400).json({ error: 'Category name is required' });
    if (await TicketCategory.findOne({ name: new RegExp(`^${data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }
    const last = await TicketCategory.findOne().sort({ order: -1 }).select('order');
    data.order = (last?.order ?? -1) + 1;
    data.updatedBy = req.user._id;
    res.status(201).json(await TicketCategory.create(data));
  } catch (err) {
    console.error('Error creating ticket category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const data = sanitizeCategory(req.body);
    if (!data.name) return res.status(400).json({ error: 'Category name is required' });
    const clash = await TicketCategory.findOne({ _id: { $ne: req.params.id }, name: data.name });
    if (clash) return res.status(400).json({ error: 'A category with this name already exists' });
    data.updatedBy = req.user._id;
    const updated = await TicketCategory.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Category not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating ticket category:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Deleting a category never touches existing tickets (they store plain text).
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const deleted = await TicketCategory.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ticket category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Re-add any default category that was deleted (does not overwrite edited ones)
router.post('/restore-defaults', adminOnly, async (req, res) => {
  try {
    let added = 0;
    for (const d of defaults) {
      if (!(await TicketCategory.findOne({ name: d.name }))) { await TicketCategory.create(d); added++; }
    }
    res.json({ success: true, added });
  } catch (err) {
    console.error('Error restoring defaults:', err);
    res.status(500).json({ error: 'Failed to restore defaults' });
  }
});

module.exports = router;