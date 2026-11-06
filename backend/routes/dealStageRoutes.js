// backend/routes/dealStageRoutes.js
// Mounted at /api/deal-stages
const router = require('express').Router();
const DealStage = require('../models/DealStage');
const Deal = require('../models/Deal');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

const EDITORS = ['Admin', 'Sales', 'Sales Manager']; // Super Admin always passes authorize()
const RESERVED = []; // no legacy statuses to reserve for deals

const DEFAULT_STAGES = [
  { name: 'Qualification',              probability: 10 },
  { name: 'Needs Analysis',             probability: 20 },
  { name: 'Value Proposition',          probability: 40 },
  { name: 'Identify Decision Makers',   probability: 60 },
  { name: 'Proposal/Price Quote',       probability: 75 },
  { name: 'Negotiation/Review',         probability: 90 },
  { name: 'Closed Won',                 probability: 100, locked: true },
  { name: 'Closed Lost',                probability: 0,   locked: true },
  { name: 'Closed Lost to Competition', probability: 0,   locked: true }
];

async function ensureSeeded() {
  if ((await DealStage.estimatedDocumentCount()) > 0) return;
  try {
    await DealStage.insertMany(
      DEFAULT_STAGES.map((s, i) => ({
        ...s,
        nameKey: s.name.toLowerCase(),
        order: i + 1
      })),
      { ordered: false }
    );
  } catch (e) {
    // Two requests seeding at once — the unique index rejects the dupes.
  }
}

// Returns an error string, or null when the name is fine
async function checkName(raw, excludeId) {
  const name = (raw || '').toString().trim();
  if (!name) return 'Stage name is required';
  if (name.length > 40) return 'Stage name must be 40 characters or fewer';
  if (RESERVED.includes(name.toLowerCase())) return `"${name}" is reserved, please pick another name`;

  const clash = await DealStage.findOne({
    nameKey: name.toLowerCase(),
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });
  if (clash) return `A stage named "${clash.name}" already exists`;
  return null;
}

// ============================================
// GET /api/deal-stages — all stages (+ how many deals sit in each, team-wide)
// ============================================
router.get('/', async (req, res) => {
  try {
    await ensureSeeded();
    const [stages, counts] = await Promise.all([
      DealStage.find().sort({ order: 1, createdAt: 1 }).lean(),
      Deal.aggregate([
        { $group: { _id: '$stage', n: { $sum: 1 } } }
      ])
    ]);
    const byName = Object.fromEntries(counts.map(c => [c._id, c.n]));
    res.json({
      success: true,
      data: stages.map(s => ({ ...s, dealCount: byName[s.name] || 0 }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/deal-stages  { name, probability? } — add a stage at the end
// ============================================
router.post('/', authorize(...EDITORS), async (req, res) => {
  try {
    await ensureSeeded();
    const error = await checkName(req.body.name);
    if (error) return res.status(400).json({ error });

    const name = req.body.name.trim();
    const probability = Math.min(100, Math.max(0, Number(req.body.probability) || 10));
    const last = await DealStage.findOne().sort({ order: -1 });
    const stage = await DealStage.create({
      name,
      nameKey: name.toLowerCase(),
      probability,
      order: (last?.order || 0) + 1
    });
    res.status(201).json({ success: true, data: { ...stage.toObject(), dealCount: 0 } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// PATCH /api/deal-stages/:id  { name?, probability? }
// Renaming a stage keeps every deal in it — deals follow the new name.
// ============================================
router.patch('/:id', authorize(...EDITORS), async (req, res) => {
  try {
    const stage = await DealStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.locked) {
      return res.status(400).json({ error: `"${stage.name}" is a built-in stage and can't be renamed` });
    }

    let oldName = stage.name;
    let newName = oldName;

    if (req.body.name !== undefined) {
      const error = await checkName(req.body.name, stage._id);
      if (error) return res.status(400).json({ error });
      newName = req.body.name.trim();
    }

    if (req.body.probability !== undefined) {
      stage.probability = Math.min(100, Math.max(0, Number(req.body.probability)));
    }

    if (oldName !== newName) {
      stage.name = newName;
      stage.nameKey = newName.toLowerCase();
      await stage.save();
      await Deal.updateMany({ stage: oldName }, { $set: { stage: newName } });
    } else {
      await stage.save();
    }

    res.json({ success: true, data: stage });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/deal-stages/:id?moveTo=<stageId>
// Removes a stage, moving its deals into another stage.
// ============================================
router.delete('/:id', authorize(...EDITORS), async (req, res) => {
  try {
    const stage = await DealStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.locked) {
      return res.status(400).json({ error: `"${stage.name}" is a built-in stage and can't be removed` });
    }

    const inStage = await Deal.countDocuments({ stage: stage.name });

    if (inStage > 0) {
      if (!req.query.moveTo) {
        return res.status(400).json({ error: `This stage has ${inStage} deal(s). Choose a stage to move them to.` });
      }
      const target = await DealStage.findById(req.query.moveTo);
      if (!target || String(target._id) === String(stage._id)) {
        return res.status(400).json({ error: 'Invalid stage to move deals to' });
      }
      await Deal.updateMany({ stage: stage.name }, { $set: { stage: target.name } });
    }

    await stage.deleteOne();
    res.json({ success: true, moved: inStage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;