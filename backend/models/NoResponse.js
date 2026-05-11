const mongoose = require('mongoose');

const NoResponseSchema = new mongoose.Schema({
    companyName: String,
    pocName: String,
    pocEmail: String,
    industry: String,
    reasonForClosing: { type: String, required: true },
    closedAt: { type: Date, default: Date.now },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalProspectData: Object // Stores the full history of the prospect
});

module.exports = mongoose.model('NoResponse', NoResponseSchema);