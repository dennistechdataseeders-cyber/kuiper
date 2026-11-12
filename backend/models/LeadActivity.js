// backend/models/LeadActivity.js
const mongoose = require('mongoose');
const customFieldSchema = require('./customFieldSchema');

// Default Kanban stages for tasks (used to seed the TaskStage collection).
// The board's stages are now editable, so `status` is a free string.
const TASK_STAGES = ['Not Started', 'Deferred', 'In Progress', 'Completed', 'Waiting for input'];

const leadActivitySchema = new mongoose.Schema({
  // A lead is required for notes / meetings / calls / normal tasks.
  // A task a Sales Manager assigns to a rep can stand on its own (no lead).
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: function () {
      return !(this.type === 'task' && this.assignedTo);
    },
    default: null,
    index: true
  },

  type: {
    type: String,
    enum: ['note', 'task', 'meeting', 'call'],
    required: true,
    index: true
  },

  // Common
  title:   { type: String, default: '' },
  content: { type: String, default: '' },

  // Scheduling (task / meeting / call)
  scheduledAt: { type: Date, default: null },
  dueAt:       { type: Date, default: null },
  durationMinutes: { type: Number, default: null },

  // Meeting-specific
  location:  { type: String, default: '' },
  attendees: [{ type: String }],

  // Call-specific
  callOutcome: {
    type: String,
    enum: ['', 'Connected', 'Voicemail', 'No Answer', 'Busy', 'Wrong Number'],
    default: ''
  },
  callDirection: {
    type: String,
    enum: ['', 'Outbound', 'Inbound'],
    default: ''
  },

  // Status
  //  - meetings / calls use:  Open, Completed, Cancelled
  //  - tasks use the NAME of a stage from the TaskStage collection
  status: { type: String, default: 'Open', trim: true },

  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },

  // values of fields created in Customize Modules → Tasks / Meetings / Calls
  customFields: [customFieldSchema],

  // Reminder bookkeeping — written by services/salesNotificationService.js
  reminders: {
    sent: { type: [Number], default: [] },
  },

  // ---------- Task assignment (Sales Manager → Sales rep) ----------
  // Who has to DO the activity. null = the creator (old behaviour).
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: null },

  // Owner / audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

}, { timestamps: true });

leadActivitySchema.index({ createdBy: 1, type: 1, createdAt: -1 });
leadActivitySchema.index({ assignedTo: 1, type: 1, dueAt: 1 });
leadActivitySchema.index({ type: 1, scheduledAt: 1 });
leadActivitySchema.index({ type: 1, dueAt: 1 });

// Re-arm reminders when an activity is rescheduled or handed to someone else.
leadActivitySchema.pre('save', function (next) {
  if (!this.isNew && (this.isModified('scheduledAt') || this.isModified('dueAt') || this.isModified('assignedTo'))) {
    this.reminders = { sent: [] };
  }
});

module.exports =
  mongoose.models.LeadActivity ||
  mongoose.model('LeadActivity', leadActivitySchema);

module.exports.TASK_STAGES = TASK_STAGES;
