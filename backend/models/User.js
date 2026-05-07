// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Client', 'Developer', 'Sales', 'Project Manager','Sales Manager'], 
    default: 'Client' 
  },
  pocName: String, 
  pocPhone: String,
  website: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

// Delete any other exports and use ONLY this:
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);