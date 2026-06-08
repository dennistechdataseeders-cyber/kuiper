const mongoose = require('mongoose');

const POCSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  linkedin: { type: String },
  department: { 
    type: String, 
    enum: ['CEO', 'CTO', 'Sales', 'Marketing', 'Support', 'Developer', 'Other'],
    default: 'Other'
  },
  isPrimary: { type: Boolean, default: false },
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization',
    required: true 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('POC', POCSchema);