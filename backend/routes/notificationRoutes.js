// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// ============================================
// GET notification count - ONLY unread
// ============================================
router.get('/count', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Count unread notifications
    const unreadCount = user.unreadNotifications?.filter(n => !n.read).length || 0;
    
    // Count open tickets (for non-admin users)
    let openTicketCount = 0;
    if (req.user.role === 'Admin') {
      openTicketCount = await Ticket.countDocuments({ 
        status: { $in: ['Open', 'In Progress'] } 
      });
    } else if (req.user.role === 'Client') {
      openTicketCount = await Ticket.countDocuments({
        createdBy: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      });
    } else if (req.user.role === 'HR' || req.user.role === 'Finance') {
      openTicketCount = await Ticket.countDocuments({
        assignedTo: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      });
    } else {
      openTicketCount = await Ticket.countDocuments({
        $or: [
          { createdBy: req.user._id },
          { assignedTo: req.user._id }
        ],
        status: { $in: ['Open', 'In Progress'] }
      });
    }
    
    res.json({
      success: true,
      unreadCount,
      openTicketCount,
      total: unreadCount + openTicketCount
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({ error: 'Failed to fetch notification count' });
  }
});

// ============================================
// GET all notifications - ONLY UNREAD
// ============================================
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'unreadNotifications.ticketId',
        select: 'title ticketNumber status priority createdAt',
        populate: {
          path: 'comments',
          select: 'text userName userId createdAt',
          options: { sort: { createdAt: -1 }, limit: 1 }
        }
      });
    
    // ============================================
    // FIX 1: Only get UNREAD notifications
    // ============================================
    const unreadNotifications = (user.unreadNotifications || [])
      .filter(n => n.read === false);
    
    // Get open tickets as notifications
    let openTickets = [];
    if (req.user.role === 'Admin') {
      openTickets = await Ticket.find({ 
        status: { $in: ['Open', 'In Progress'] } 
      })
      .populate('createdBy', 'name')
      .populate({
        path: 'comments',
        select: 'text userName userId createdAt',
        options: { sort: { createdAt: -1 }, limit: 1 }
      });
    } else if (req.user.role === 'Client') {
      openTickets = await Ticket.find({
        createdBy: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      })
      .populate('createdBy', 'name')
      .populate({
        path: 'comments',
        select: 'text userName userId createdAt',
        options: { sort: { createdAt: -1 }, limit: 1 }
      });
    } else if (req.user.role === 'HR' || req.user.role === 'Finance') {
      openTickets = await Ticket.find({
        assignedTo: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      })
      .populate('createdBy', 'name')
      .populate({
        path: 'comments',
        select: 'text userName userId createdAt',
        options: { sort: { createdAt: -1 }, limit: 1 }
      });
    } else {
      openTickets = await Ticket.find({
        $or: [
          { createdBy: req.user._id },
          { assignedTo: req.user._id }
        ],
        status: { $in: ['Open', 'In Progress'] }
      })
      .populate('createdBy', 'name')
      .populate({
        path: 'comments',
        select: 'text userName userId createdAt',
        options: { sort: { createdAt: -1 }, limit: 1 }
      });
    }
    
    const openTicketNotifications = openTickets.map(ticket => {
      const lastComment = ticket.comments && ticket.comments.length > 0 
        ? ticket.comments[ticket.comments.length - 1] 
        : null;
      
      return {
        type: 'open_ticket',
        ticketId: ticket,
        message: `Open ticket: ${ticket.title}`,
        createdAt: ticket.createdAt,
        read: false,
        _id: `open_${ticket._id}`,
        hasComments: ticket.comments && ticket.comments.length > 0,
        lastComment: lastComment ? {
          text: lastComment.text,
          userName: lastComment.userName,
          createdAt: lastComment.createdAt
        } : null,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        priority: ticket.priority
      };
    });
    
    // ============================================
    // Process UNREAD notifications only
    // ============================================
    const processedNotifications = unreadNotifications.map(notification => {
      const notif = notification.toObject ? notification.toObject() : notification;
      const ticketData = notif.ticketId;
      
      let lastComment = null;
      let hasComments = false;
      
      if (notif.type === 'ticket_commented' && ticketData) {
        if (ticketData.comments && ticketData.comments.length > 0) {
          const latestComment = ticketData.comments[ticketData.comments.length - 1];
          lastComment = {
            text: latestComment.text,
            userName: latestComment.userName,
            createdAt: latestComment.createdAt
          };
          hasComments = true;
        }
        
        if (notif.commentData) {
          lastComment = {
            text: notif.commentData.text,
            userName: notif.commentData.author,
            createdAt: notif.createdAt,
            hasAttachments: notif.commentData.hasAttachments || false,
            hasImages: notif.commentData.hasImages || false,
            hasFiles: notif.commentData.hasFiles || false
          };
          hasComments = true;
        }
      }
      
      return {
        ...notif,
        hasComments: hasComments || (ticketData && ticketData.comments && ticketData.comments.length > 0),
        lastComment: lastComment,
        ticketNumber: ticketData?.ticketNumber || null,
        ticketStatus: ticketData?.status || null,
        ticketPriority: ticketData?.priority || null
      };
    });
    
    // Combine unread notifications with open tickets
    const allNotifications = [
      ...processedNotifications,
      ...openTicketNotifications
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate unread count
    const unreadCount = user.unreadNotifications?.filter(n => !n.read).length || 0;
    
    res.json({
      success: true,
      notifications: allNotifications,
      unreadCount: unreadCount,
      total: allNotifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ============================================
// Mark notification as read - REMOVE from array
// ============================================
router.patch('/:notificationId/read', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Check if it's an open ticket notification (starts with 'open_')
    if (req.params.notificationId && req.params.notificationId.toString().startsWith('open_')) {
      return res.json({ success: true, message: 'Open ticket notification marked as read' });
    }
    
    // ============================================
    // FIX 2: REMOVE the notification from the array
    // ============================================
    const notificationIndex = user.unreadNotifications?.findIndex(
      n => n._id.toString() === req.params.notificationId
    );
    
    if (notificationIndex !== undefined && notificationIndex !== -1) {
      // Remove the notification from the array
      user.unreadNotifications.splice(notificationIndex, 1);
      user.notificationCount = Math.max(0, (user.notificationCount || 0) - 1);
      await user.save();
      
      console.log(`✅ Notification ${req.params.notificationId} removed from user's notifications`);
      
      // Emit socket update
      const io = global.io;
      if (io) {
        io.to(req.user._id.toString()).emit('notification_count_update', {
          type: 'notification_read',
          count: user.notificationCount
        });
      }
    } else {
      console.log(`⚠️ Notification ${req.params.notificationId} not found in user's notifications`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ============================================
// Mark all notifications as read - CLEAR array
// ============================================
router.patch('/mark-all-read', protect, async (req, res) => {
  try {
    console.log('📝 Clearing all notifications for user:', req.user._id);
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`📊 Before: ${user.unreadNotifications?.length || 0} notifications, count: ${user.notificationCount}`);
    
    // ============================================
    // FIX 3: CLEAR the entire array
    // ============================================
    if (user.unreadNotifications && user.unreadNotifications.length > 0) {
      // Clear all notifications
      user.unreadNotifications = [];
      user.notificationCount = 0;
      
      await user.save();
      
      console.log(`✅ Cleared all notifications`);
      console.log(`📊 After: count: ${user.notificationCount}`);
      
      // Emit socket update
      const io = global.io;
      if (io) {
        io.to(req.user._id.toString()).emit('notification_count_update', {
          type: 'all_read',
          count: 0
        });
      }
    } else {
      console.log('ℹ️ No notifications to clear');
    }
    
    res.json({ 
      success: true, 
      message: 'All notifications cleared',
      count: 0
    });
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    res.status(500).json({ 
      error: 'Failed to clear notifications',
      details: error.message 
    });
  }
});

// ============================================
// Get unread count only (lightweight endpoint)
// ============================================
router.get('/unread-count', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const unreadCount = user.unreadNotifications?.filter(n => !n.read).length || 0;
    
    res.json({
      success: true,
      count: unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;