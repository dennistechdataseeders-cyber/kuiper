// backend/models/TicketAssignmentRule.js
const mongoose = require('mongoose');

const ticketAssignmentRuleSchema = new mongoose.Schema({
  // Which category this rule applies to
  category: {
    type: String,
    required: true,
    enum: ['Finance', 'HR', 'Payroll', 'Sales', 'Production', 'Admin', 'IT', 'Development']
  },
  
  // Subcategory (optional - for more granular matching)
  subcategory: {
    type: String,
    default: ''
  },
  
  // Specific sub-item (optional - most specific match)
  subItem: {
    type: String,
    default: ''
  },
  
  // The email address to send notifications to
  assigneeEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Optional: assignee name for display
  assigneeName: {
    type: String,
    default: ''
  },
  
  // Priority: higher number = higher priority when multiple rules match
  priority: {
    type: Number,
    default: 0
  },
  
  // Whether this rule is active
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Who created/updated this rule (for audit)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // For audit trail
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
ticketAssignmentRuleSchema.index({ category: 1, subcategory: 1, subItem: 1 });
ticketAssignmentRuleSchema.index({ isActive: 1, priority: 1 });

// Static method to find best matching rule
ticketAssignmentRuleSchema.statics.findBestMatch = async function(category, subcategory = '', subItem = '') {
  const rules = await this.find({
    isActive: true,
    $or: [
      // Exact match on all three
      { category, subcategory, subItem },
      // Match category + subcategory (any subItem)
      { category, subcategory, subItem: '' },
      // Match category only
      { category, subcategory: '', subItem: '' }
    ]
  }).sort({ priority: -1 }); // Highest priority first
  
  // Return first match (highest priority)
  return rules[0] || null;
};

module.exports = mongoose.model('TicketAssignmentRule', ticketAssignmentRuleSchema);