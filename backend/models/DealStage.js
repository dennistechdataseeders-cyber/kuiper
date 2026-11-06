// backend/models/DealStage.js
// Columns of the Deals Kanban board (Sales → Deals).
// A deal's `stage` (Deal.stage) stores the NAME of its stage.
const mongoose = require('mongoose');

const dealStageSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 40 },
  nameKey: { type: String, required: true, unique: true }, // lower-case name → prevents duplicates
  order:   { type: Number, default: 0 },
  // Probability shown next to the stage header on the Kanban.
  probability: { type: Number, default: 10, min: 0, max: 100 },
  // "Closed Won" and "Closed Lost" are locked because the Leads page / reports
  // treat them as terminal states. They can't be renamed or removed.
  locked:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.DealStage || mongoose.model('DealStage', dealStageSchema);