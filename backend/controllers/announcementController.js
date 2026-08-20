// backend/controllers/announcementController.js
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// ============================================
// CREATE ANNOUNCEMENT
// ============================================
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, description, image } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const announcement = new Announcement({
            title,
            description,
            image: image || null,
            createdBy: req.user._id,
            createdByName: user.name,
            createdByRole: user.role,
            createdByAvatar: user.profileImage || null,
            likes: [],
            comments: [],
            isAutomated: false,
        });

        await announcement.save();

        // Populate createdBy for response
        const populated = await Announcement.findById(announcement._id)
            .populate('createdBy', 'name email role profileImage');

        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            announcement: populated
        });

    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
};

// ============================================
// GET ALL ANNOUNCEMENTS
// ============================================
exports.getAnnouncements = async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const announcements = await Announcement.find()
            .populate('createdBy', 'name email role profileImage')
            .populate('comments.userId', 'name email role profileImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Announcement.countDocuments();

        res.json({
            success: true,
            announcements,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
};

// ============================================
// GET SINGLE ANNOUNCEMENT
// ============================================
exports.getAnnouncementById = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('createdBy', 'name email role profileImage')
            .populate('comments.userId', 'name email role profileImage');

        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({
            success: true,
            announcement
        });

    } catch (error) {
        console.error('Error fetching announcement:', error);
        res.status(500).json({ error: 'Failed to fetch announcement' });
    }
};

// ============================================
// TOGGLE LIKE
// ============================================
exports.toggleLike = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const userId = req.user._id;
        const likeIndex = announcement.likes.indexOf(userId);

        if (likeIndex === -1) {
            // Add like
            announcement.likes.push(userId);
            await announcement.save();
            res.json({
                success: true,
                action: 'liked',
                likeCount: announcement.likes.length
            });
        } else {
            // Remove like
            announcement.likes.splice(likeIndex, 1);
            await announcement.save();
            res.json({
                success: true,
                action: 'unliked',
                likeCount: announcement.likes.length
            });
        }

    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
};

// ============================================
// ADD COMMENT
// ============================================
exports.addComment = async (req, res) => {
    try {
        const { text, images, files } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const announcement = await Announcement.findById(req.params.id);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const comment = {
            text: text.trim(),
            userId: req.user._id,
            userName: user.name,
            userRole: user.role,
            userAvatar: user.profileImage || null,
            images: images || [],
            files: files || [],
            createdAt: new Date()
        };

        announcement.comments.push(comment);
        await announcement.save();

        // Populate the new comment with user details
        const populatedAnnouncement = await Announcement.findById(announcement._id)
            .populate('comments.userId', 'name email role profileImage');

        const newComment = populatedAnnouncement.comments[populatedAnnouncement.comments.length - 1];

        res.status(201).json({
            success: true,
            comment: newComment,
            commentCount: populatedAnnouncement.comments.length
        });

    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
};

// ============================================
// DELETE COMMENT
// ============================================
exports.deleteComment = async (req, res) => {
    try {
        const { announcementId, commentId } = req.params;
        
        const announcement = await Announcement.findById(announcementId);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const commentIndex = announcement.comments.findIndex(
            c => c._id.toString() === commentId
        );

        if (commentIndex === -1) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const comment = announcement.comments[commentIndex];
        
        // Check if user can delete this comment
        const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
        const isOwner = comment.userId.toString() === req.user._id.toString();
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        announcement.comments.splice(commentIndex, 1);
        await announcement.save();

        res.json({
            success: true,
            message: 'Comment deleted successfully',
            commentCount: announcement.comments.length
        });

    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};

// ============================================
// DELETE ANNOUNCEMENT
// ============================================
exports.deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Check if user can delete this announcement
        const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
        const isOwner = announcement.createdBy.toString() === req.user._id.toString();
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Not authorized to delete this announcement' });
        }

        // Delete associated image file if exists
        if (announcement.image) {
            try {
                const imagePath = path.join(__dirname, '../uploads/announcements', path.basename(announcement.image));
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (err) {
                console.error('Error deleting image file:', err);
            }
        }

        await Announcement.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
};