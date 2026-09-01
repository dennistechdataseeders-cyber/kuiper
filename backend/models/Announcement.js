// backend/models/Announcement.js - FULL UPDATED WITH HOLIDAY REMINDER SUPPORT

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, default: '' },
    userAvatar: { type: String, default: null },
    images: [{ type: String }],
    files: [{
        url: { type: String },
        filename: { type: String },
        originalName: { type: String },
        size: { type: Number },
        type: { type: String },
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, default: '' },
    createdByAvatar: { type: String, default: null },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    isAutomated: { type: Boolean, default: false },
    automatedType: { 
        type: String, 
        enum: ['birthday', 'work_anniversary', 'holiday_reminder'], 
        default: null 
    },
    automatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Track which users have viewed this announcement
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Index for faster queries
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ isAutomated: 1 });
announcementSchema.index({ automatedType: 1 });

// Virtual for like count
announcementSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
announcementSchema.virtual('commentCount').get(function() {
    return this.comments ? this.comments.length : 0;
});

// Ensure virtuals are included in JSON output
announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Announcement', announcementSchema);