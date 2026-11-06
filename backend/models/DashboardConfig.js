// backend/models/DashboardConfig.js
// Per-user layout of a dashboard (which widgets, order, size, chart type, custom analytics).
const mongoose = require('mongoose');

const dashboardConfigSchema = new mongoose.Schema(
  {
    user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dashboard: { type: String, required: true, default: 'sales' },   // 'sales' (room for 'sales-manager', ...)
    // Array of widget definitions (built-in + user-built analytics).
    widgets:   { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

dashboardConfigSchema.index({ user: 1, dashboard: 1 }, { unique: true });

module.exports =
  mongoose.models.DashboardConfig ||
  mongoose.model('DashboardConfig', dashboardConfigSchema);