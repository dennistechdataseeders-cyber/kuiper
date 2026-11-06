// backend/models/TaskStage.js
// Columns of the Tasks Kanban board (Sales → Activities → Tasks).
// A task's `status` (LeadActivity.status) stores the NAME of its stage.
const mongoose = require('mongoose');

const taskStageSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 40 },
  nameKey: { type: String, required: true, unique: true }, // lower-case name → prevents duplicates
  order:   { type: Number, default: 0 },
  // "Completed" is locked: the Lead page treats status "Completed" as finished,
  // so this stage can't be renamed or removed.
  locked:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.TaskStage || mongoose.model('TaskStage', taskStageSchema);