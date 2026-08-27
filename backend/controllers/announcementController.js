// backend/controllers/announcementController.js - UPDATED with viewedBy tracking

const Announcement = require('../models/Announcement');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// ============================================
// HELPER: Check if user can create announcements
// ============================================
const canCreateAnnouncement = (role) => {
    const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Project Manager', 'Sales Manager'];
    return allowedRoles.includes(role);
};

// ============================================
// CREATE ANNOUNCEMENT NOTIFICATION HELPER - FIXED
// ============================================
async function createAnnouncementNotification(userId, announcement) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    if (!user.unreadNotifications) {
      user.unreadNotifications = [];
    }

    // Check if user already has this notification
    const exists = user.unreadNotifications.some(
      n => n.type === 'new_announcement' && 
      n.announcementId && 
      n.announcementId && 
      n.announcementId.toString() === announcement._id.toString()
    );
    
    if (exists) return;

    user.unreadNotifications.push({
      type: 'new_announcement',
      announcementId: announcement._id,  // ✅ ADDED
      message: `📢 ${announcement.title}`,
      createdAt: new Date(),
      read: false
    });

    user.notificationCount = (user.notificationCount || 0) + 1;
    await user.save();

    // Emit real-time socket event
    const io = global.io;
    if (io) {
      io.to(userId.toString()).emit('new_announcement', {
        announcementId: announcement._id,
        title: announcement.title,
        createdByName: announcement.createdByName,
        createdAt: announcement.createdAt,
        unviewedCount: await Announcement.countDocuments({
          viewedBy: { $ne: userId }
        })
      });
      
      // Also emit count update
      const unviewedCount = await Announcement.countDocuments({
        viewedBy: { $ne: userId }
      });
      io.to(userId.toString()).emit('announcement_count_update', {
        count: unviewedCount
      });
    }

    return true;
  } catch (error) {
    console.error('Error creating announcement notification:', error);
    return false;
  }
}

// ============================================
// CREATE ANNOUNCEMENT - With notification
// ============================================
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, description, image } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        if (!canCreateAnnouncement(req.user.role)) {
            return res.status(403).json({ 
                error: 'Not authorized to create announcements. Allowed roles: Super Admin, Admin, HR, Project Manager, Sales Manager' 
            });
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
            viewedBy: [req.user._id] // Creator automatically viewed it
        });

        await announcement.save();

        // Populate createdBy for response
        const populated = await Announcement.findById(announcement._id)
            .populate('createdBy', 'name email role profileImage')
            .populate('likes', 'name email profileImage');

        // ============================================
        // SEND NOTIFICATIONS TO ALL USERS (except creator)
        // ============================================
        const io = req.app.get('io');
        if (io) {
            // Get all active users except creator
            const users = await User.find({ 
                isActive: true,
                _id: { $ne: req.user._id }
            }).select('_id role');

            for (const targetUser of users) {
                // Send socket notification
                io.to(targetUser._id.toString()).emit('new_announcement', {
                    announcementId: announcement._id,
                    title: announcement.title,
                    createdByName: announcement.createdByName,
                    createdAt: announcement.createdAt,
                    unviewedCount: await Announcement.countDocuments({
                        viewedBy: { $ne: targetUser._id }
                    })
                });

                // Create notification in database
                await createAnnouncementNotification(targetUser._id, announcement);
            }

            console.log(`📢 Announcement notification sent to ${users.length} users`);
        }

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
// GET ANNOUNCEMENTS - With viewed status
// ============================================
exports.getAnnouncements = async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const announcements = await Announcement.find()
            .populate('createdBy', 'name email role profileImage')
            .populate('comments.userId', 'name email role profileImage')
            .populate('likes', 'name email profileImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Mark announcements as viewed by current user
        const userId = req.user._id;
        for (const announcement of announcements) {
            if (!announcement.viewedBy) {
                announcement.viewedBy = [];
            }
            if (!announcement.viewedBy.includes(userId)) {
                announcement.viewedBy.push(userId);
            }
        }
        // Save all changes
        await Promise.all(announcements.map(a => a.save()));

        const total = await Announcement.countDocuments();

        // Get unviewed count for current user
        const unviewedCount = await Announcement.countDocuments({
            viewedBy: { $ne: userId }
        });

        res.json({
            success: true,
            announcements,
            unviewedCount,
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
// GET UNVIEWED ANNOUNCEMENT COUNT
// ============================================
exports.getUnviewedCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await Announcement.countDocuments({
            viewedBy: { $ne: userId }
        });

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Error fetching unviewed count:', error);
        res.status(500).json({ error: 'Failed to fetch count' });
    }
};

// ============================================
// MARK ANNOUNCEMENT AS VIEWED (click handler)
// ============================================
exports.markAsViewed = async (req, res) => {
    try {
        const { announcementId } = req.params;
        const userId = req.user._id;

        const announcement = await Announcement.findById(announcementId);
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        if (!announcement.viewedBy) {
            announcement.viewedBy = [];
        }

        if (!announcement.viewedBy.includes(userId)) {
            announcement.viewedBy.push(userId);
            await announcement.save();

            // Also remove from unread notifications
            const user = await User.findById(userId);
            if (user) {
                user.unreadNotifications = user.unreadNotifications.filter(
                    n => !(n.type === 'new_announcement' && 
                           n.announcementId && 
                           n.announcementId.toString() === announcementId)
                );
                user.notificationCount = Math.max(0, (user.notificationCount || 0) - 1);
                await user.save();

                // Emit updated count
                const io = req.app.get('io');
                if (io) {
                    const unviewedCount = await Announcement.countDocuments({
                        viewedBy: { $ne: userId }
                    });
                    io.to(userId.toString()).emit('announcement_count_update', {
                        count: unviewedCount
                    });
                }
            }
        }

        res.json({
            success: true,
            message: 'Announcement marked as viewed'
        });
    } catch (error) {
        console.error('Error marking announcement as viewed:', error);
        res.status(500).json({ error: 'Failed to mark as viewed' });
    }
};

// ============================================
// GET SINGLE ANNOUNCEMENT
// ============================================
exports.getAnnouncementById = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('createdBy', 'name email role profileImage')
            .populate('comments.userId', 'name email role profileImage')
            .populate('likes', 'name email profileImage');

        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Mark as viewed
        const userId = req.user._id;
        if (!announcement.viewedBy) {
            announcement.viewedBy = [];
        }
        if (!announcement.viewedBy.includes(userId)) {
            announcement.viewedBy.push(userId);
            await announcement.save();
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
            announcement.likes.push(userId);
            await announcement.save();
            
            const updatedAnnouncement = await Announcement.findById(req.params.id)
                .populate('likes', 'name email profileImage');

            res.json({
                success: true,
                action: 'liked',
                likeCount: updatedAnnouncement.likes.length,
                likes: updatedAnnouncement.likes
            });
        } else {
            announcement.likes.splice(likeIndex, 1);
            await announcement.save();
            
            const updatedAnnouncement = await Announcement.findById(req.params.id)
                .populate('likes', 'name email profileImage');

            res.json({
                success: true,
                action: 'unliked',
                likeCount: updatedAnnouncement.likes.length,
                likes: updatedAnnouncement.likes
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

        const populatedAnnouncement = await Announcement.findById(announcement._id)
            .populate('comments.userId', 'name email role profileImage')
            .populate('likes', 'name email profileImage');

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
        
        const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
        const isOwner = comment.userId.toString() === req.user._id.toString();
        
        if (announcement.isAutomated && !isAdmin) {
            return res.status(403).json({ 
                error: 'Comments on automated posts can only be deleted by Admins' 
            });
        }
        
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

        const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
        const isOwner = announcement.createdBy.toString() === req.user._id.toString();
        
        if (announcement.isAutomated && !isAdmin) {
            return res.status(403).json({ 
                error: 'Automated posts can only be deleted by Admins' 
            });
        }
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Not authorized to delete this announcement' });
        }

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

// ============================================
// UPLOAD IMAGE FOR ANNOUNCEMENT
// ============================================
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        if (!canCreateAnnouncement(req.user.role)) {
            return res.status(403).json({ 
                error: 'Not authorized to upload images for announcements' 
            });
        }

        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/announcements/${req.file.filename}`;

        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename
        });

    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
};