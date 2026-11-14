// backend/routes/tagRoutes.js
// Zoho-style tags for the sales tables.
//
//   GET    /api/tags?module=Leads           → { tags: [...], assignments: { [recordId]: [tagId] } }
//   POST   /api/tags                        { module, name, color }        → create (or return existing)
//   PATCH  /api/tags/:id                    { name?, color? }              → rename / recolour
//   DELETE /api/tags/:id                                                   → delete + untag every record
//   POST   /api/tags/assign                 { module, recordIds, add?: [tagId | name], remove?: [tagId] }
//            add  : tag ids, names, or { name, color } (unknown names are created with that colour)
//            remove: tag ids
//          → { tags, assignments } for the records touched (+ any new tags)
const router = require('express').Router();
const mongoose = require('mongoose');
const Tag = require('../models/Tag');
const { TAG_MODULES } = require('../models/Tag');
const RecordTag = require('../models/RecordTag');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);
router.use(authorize('Admin', 'Sales', 'Sales Manager')); // Super Admin always passes

// Only these can rename / recolour / delete a tag someone else created
const TAG_ADMINS = ['Super Admin', 'Admin', 'Sales Manager'];

// Zoho-like palette; a new tag gets the next colour unless one is given
const PALETTE = ['#ffffff', '#5b7f9b', '#d6a0f0', '#5cc47a', '#f6c344', '#f28b82', '#7bc8f6', '#c9a27e', '#a7b0bd'];
const HEX = /^#[0-9a-f]{6}$/i;

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isModule = (m) => TAG_MODULES.includes(m);
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v)) && String(new mongoose.Types.ObjectId(String(v))) === String(v);
const canManage = (req, tag) =>
  TAG_ADMINS.includes(req.user.role) || (tag.createdBy && String(tag.createdBy) === String(req.user._id));

const toAssignments = (docs) =>
  Object.fromEntries(docs.map((d) => [d.recordId, (d.tags || []).map(String)]));

// find-or-create a tag by name (case-insensitive) inside a module
async function ensureTag(module, rawName, color, userId) {
  const name = clean(rawName).slice(0, 40);
  if (!name) return null;
  const nameKey = name.toLowerCase();
  const existing = await Tag.findOne({ module, nameKey });
  if (existing) return existing;
  const count = await Tag.countDocuments({ module });
  try {
    return await Tag.create({
      module, name, nameKey,
      color: HEX.test(clean(color)) ? clean(color) : PALETTE[count % PALETTE.length],
      createdBy: userId,
    });
  } catch (e) {
    if (e.code === 11000) return Tag.findOne({ module, nameKey }); // created at the same moment by someone else
    throw e;
  }
}

// ---------------- list ----------------
router.get('/', async (req, res) => {
  try {
    const module = clean(req.query.module);
    if (!isModule(module)) return res.status(400).json({ error: 'Invalid module' });

    const [tags, docs] = await Promise.all([
      Tag.find({ module }).sort({ name: 1 }).lean(),
      RecordTag.find({ module, 'tags.0': { $exists: true } }).select('recordId tags').lean(),
    ]);
    res.json({ tags, assignments: toAssignments(docs) });
  } catch (err) {
    console.error('GET /api/tags', err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

// ---------------- create ----------------
router.post('/', async (req, res) => {
  try {
    const module = clean(req.body.module);
    if (!isModule(module)) return res.status(400).json({ error: 'Invalid module' });
    if (!clean(req.body.name)) return res.status(400).json({ error: 'Tag name is required' });
    const tag = await ensureTag(module, req.body.name, req.body.color, req.user._id);
    res.status(201).json({ data: tag });
  } catch (err) {
    console.error('POST /api/tags', err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// ---------------- assign / unassign (bulk) ----------------
// Defined before '/:id' so "assign" is never treated as an id.
router.post('/assign', async (req, res) => {
  try {
    const module = clean(req.body.module);
    if (!isModule(module)) return res.status(400).json({ error: 'Invalid module' });

    const recordIds = [...new Set((req.body.recordIds || []).map(clean).filter(Boolean))].slice(0, 1000);
    if (recordIds.length === 0) return res.status(400).json({ error: 'Select at least one record' });

    // add: ids or names
    const addIds = [];
    const created = [];
    for (const raw of req.body.add || []) {
      // accepts: tagId | name | { _id } | { name, color }
      const item = raw && typeof raw === 'object' ? raw : { [isId(raw) ? '_id' : 'name']: raw };
      if (item._id && isId(item._id)) {
        const t = await Tag.findOne({ _id: item._id, module });
        if (t) addIds.push(t._id);
      } else if (clean(item.name)) {
        const t = await ensureTag(module, item.name, item.color, req.user._id);
        if (t) { addIds.push(t._id); created.push(t); }
      }
    }
    const removeIds = (req.body.remove || []).filter(isId).map((id) => new mongoose.Types.ObjectId(String(id)));

    if (addIds.length === 0 && removeIds.length === 0) {
      return res.status(400).json({ error: 'Nothing to add or remove' });
    }

    const ops = [];
    recordIds.forEach((recordId) => {
      if (addIds.length) {
        ops.push({
          updateOne: {
            filter: { module, recordId },
            update: { $addToSet: { tags: { $each: addIds } } },
            upsert: true,
          },
        });
      }
      if (removeIds.length) {
        ops.push({
          updateOne: {
            filter: { module, recordId },
            update: { $pull: { tags: { $in: removeIds } } },
          },
        });
      }
    });
    await RecordTag.bulkWrite(ops, { ordered: true });

    const docs = await RecordTag.find({ module, recordId: { $in: recordIds } }).select('recordId tags').lean();
    const assignments = Object.fromEntries(recordIds.map((id) => [id, []]));
    Object.assign(assignments, toAssignments(docs));

    res.json({ tags: created, assignments });
  } catch (err) {
    console.error('POST /api/tags/assign', err);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

// ---------------- rename / recolour ----------------
router.patch('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid tag' });
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    if (!canManage(req, tag)) return res.status(403).json({ error: 'Only the tag creator or a manager can edit this tag' });

    if (req.body.name !== undefined) {
      const name = clean(req.body.name).slice(0, 40);
      if (!name) return res.status(400).json({ error: 'Tag name is required' });
      const clash = await Tag.findOne({ module: tag.module, nameKey: name.toLowerCase(), _id: { $ne: tag._id } });
      if (clash) return res.status(409).json({ error: 'A tag with this name already exists' });
      tag.name = name;
      tag.nameKey = name.toLowerCase();
    }
    if (req.body.color !== undefined) {
      if (!HEX.test(clean(req.body.color))) return res.status(400).json({ error: 'Invalid colour' });
      tag.color = clean(req.body.color);
    }
    await tag.save();
    res.json({ data: tag });
  } catch (err) {
    console.error('PATCH /api/tags/:id', err);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// ---------------- delete ----------------
router.delete('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid tag' });
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    if (!canManage(req, tag)) return res.status(403).json({ error: 'Only the tag creator or a manager can delete this tag' });

    await RecordTag.updateMany({ module: tag.module, tags: tag._id }, { $pull: { tags: tag._id } });
    await tag.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tags/:id', err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

module.exports = router;
