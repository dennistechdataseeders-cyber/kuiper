const mongoose = require('mongoose');

const ProspectSchema = new mongoose.Schema({
    companyName: { type: String, unique: true, required: true, trim: true },
    pocName: { type: String },
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
        ref: 'LeadGen',
        default: null
    },
    status: { 
        type: String, 
        enum: ['New', 'Approached', 'Lead', 'No-Response'], 
        default: 'New' 
    },

    /**
     * UPDATED: Integrated Approach Tracking
     * Instead of a single date, we track each step (0-5) in an array.
     */
    approaches: [{
        step: { type: Number }, // 0 to 5
        scheduledDate: { type: Date },
        method: { 
            type: String, 
            enum: ['Email', 'Message', 'WhatsApp', 'LinkedIn', 'Pending'],
            default: 'Pending'
        },
        status: { 
            type: String, 
            enum: ['Pending', 'Completed', 'Missed'], 
            default: 'Pending' 
        },
        summary: String,
        approachedAt: Date // The actual time the user clicked "Approach"
    }],

    // Helper to quickly identify which step the salesperson is currently on
    currentFollowUpStep: { type: Number, default: 0 }, 
    
    // The very next date the system should alert the user
    nextFollowUpDate: Date 

}, { timestamps: true });

// Indexing for faster dashboard queries
ProspectSchema.index({ "approaches.status": 1, "approaches.scheduledDate": 1 });

module.exports = mongoose.model('Prospect', ProspectSchema);