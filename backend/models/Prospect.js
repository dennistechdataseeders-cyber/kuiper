const mongoose = require('mongoose');

const ProspectSchema = new mongoose.Schema({
companyName: { type: String, unique: true, required: true, trim: true },    pocName: { type: String },
    pocEmail: { type: String },
    pocPhone: { type: String },
    linkedin: { type: String },
    industry: { type: String },
    salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // NEW FIELDS FOR TRACKING CONVERSION
    organizationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization', 
        default: null 
    },
    leadId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'LeadGen'  ,
        default: null
    },

}, { timestamps: true });

module.exports = mongoose.model('Prospect', ProspectSchema);