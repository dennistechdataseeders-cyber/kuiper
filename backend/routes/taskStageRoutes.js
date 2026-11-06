// backend/routes/taskStageRoutes.js
// Mounted at /api/task-stages
const router = require('express').Router();
const TaskStage = require('../models/TaskStage');
const LeadActivity = require('../models/LeadActivity');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

const EDITORS = ['Admin', 'Sales', 'Sales Manager']; // Super Admin always passes authorize()
const RESERVED = ['open', 'cancelled'];              // legacy statuses, can't be used as stage names

const DEFAULT_STAGES = [
  { name: 'Not Started' },
  { name: 'Deferred' },
  { name: 'In Progress' },
  { name: 'Completed', locked: true },
  { name: 'Waiting for input' }
];

async function ensureSeeded() {
  if ((await TaskStage.estimatedDocumentCount()) > 0) return;
  try {
    await TaskStage.insertMany(
      DEFAULT_STAGES.map((s, i) => ({ ...s, nameKey: s.name.toLowerCase(), order: i + 1 })),
      { ordered: false }
    );
  } catch (e) { /* two requests seeding at once — duplicates are rejected by the unique index */ }
}

// Returns an error string, or null when the name is fine
async function checkName(raw, excludeId) {
  const name = (raw || '').toString().trim();
  if (!name) return 'Stage name is required';
  if (name.length > 40) return 'Stage name must be 40 characters or fewer';
  if (RESERVED.includes(name.toLowerCase())) return `"${name}" is reserved, please pick another name`;
  const clash = await TaskStage.findOne({ nameKey: name.toLowerCase(), ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (clash) return `A stage named "${clash.name}" already exists`;
  return null;
}

// ============================================
// GET /api/task-stages — all stages (+ how many tasks sit in each, team-wide)
// ============================================
router.get('/', async (req, res) => {
  try {
    await ensureSeeded();
    const [stages, counts] = await Promise.all([
      TaskStage.find().sort({ order: 1, createdAt: 1 }).lean(),
      LeadActivity.aggregate([
        { $match: { type: 'task' } },
        { $group: { _id: '$status', n: { $sum: 1 } } }
      ])
    ]);
    const byName = Object.fromEntries(counts.map(c => [c._id, c.n]));
    res.json({ success: true, data: stages.map(s => ({ ...s, taskCount: byName[s.name] || 0 })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/task-stages  { name } — add a stage at the end
// ============================================
router.post('/', authorize(...EDITORS), async (req, res) => {
  try {
    await ensureSeeded();
    const error = await checkName(req.body.name);
    if (error) return res.status(400).json({ error });

    const name = req.body.name.trim();
    const last = await TaskStage.findOne().sort({ order: -1 });
    const stage = await TaskStage.create({
      name,
      nameKey: name.toLowerCase(),
      order: (last?.order || 0) + 1
    });
    res.status(201).json({ success: true, data: { ...stage.toObject(), taskCount: 0 } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// PATCH /api/task-stages/:id  { name } — rename (tasks in it follow the new name)
// ============================================
router.patch('/:id', authorize(...EDITORS), async (req, res) => {
  try {
    const stage = await TaskStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.locked) return res.status(400).json({ error: `"${stage.name}" is a built-in stage and can't be renamed` });

    const error = await checkName(req.body.name, stage._id);
    if (error) return res.status(400).json({ error });

    const oldName = stage.name;
    const newName = req.body.name.trim();
    if (oldName === newName) return res.json({ success: true, data: stage });

    stage.name = newName;
    stage.nameKey = newName.toLowerCase();
    await stage.save();

    // keep every task that was in this stage
    const result = await LeadActivity.updateMany(
      { type: 'task', status: oldName },
      { $set: { status: newName } }
    );

    res.json({ success: true, data: stage, tasksUpdated: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/task-stages/:id?moveTo=<stageId> — remove a stage,
// moving its tasks into another stage
// ============================================
router.delete('/:id', authorize(...EDITORS), async (req, res) => {
  try {
    const stage = await TaskStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    if (stage.locked) return res.status(400).json({ error: `"${stage.name}" is a built-in stage and can't be removed` });

    const inStage = await LeadActivity.countDocuments({ type: 'task', status: stage.name });

    if (inStage > 0) {
      if (!req.query.moveTo) {
        return res.status(400).json({ error: `This stage has ${inStage} task(s). Choose a stage to move them to.` });
      }
      const target = await TaskStage.findById(req.query.moveTo);
      if (!target || String(target._id) === String(stage._id)) {
        return res.status(400).json({ error: 'Invalid stage to move tasks to' });
      }
      await LeadActivity.updateMany(
        { type: 'task', status: stage.name },
        { $set: { status: target.name } }
      );
    }

    await stage.deleteOne();
    res.json({ success: true, moved: inStage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;