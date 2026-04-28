const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  companyName: { type: String, required: [true, "Company Name is required"] },
  pocName: { type: String, required: [true, "POC Name is required"] },
  // Make these optional by removing 'required' or setting it to false
  website: { type: String }, 
  pocEmail: { type: String },
  pocPhone: { type: String },
  linkedin: { type: String },
  address: { type: String },
  salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  status: { 
    type: String, 
    enum: ['New', 'Contacted', 'Converted'], 
    default: 'New' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);