const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// GET notification count

router.get('/count', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Count unread notifications
    const unreadCount = user.unreadNotifications?.filter(n => !n.read).length || 0;
    
    // Count open tickets (for non-admin users)
    let openTicketCount = 0;
    if (req.user.role === 'Admin') {
      // Admin sees all open tickets
      openTicketCount = await Ticket.countDocuments({ 
        status: { $in: ['Open', 'In Progress'] } 
      });
    } else if (req.user.role === 'Client') {
      // Client sees their own open tickets
      openTicketCount = await Ticket.countDocuments({
        createdBy: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      });
    } else if (req.user.role === 'HR' || req.user.role === 'Finance') {
      // HR and Finance see tickets assigned to them
      openTicketCount = await Ticket.countDocuments({
        assignedTo: req.user._id,
        status: { $in: ['Open', 'In Progress'] }
      });
    } else {
      // PM, Developer, Team Lead see tickets they're involved with
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

// GET all notifications with comment details
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
    
    // Process unread notifications with comment details
    const processedNotifications = (user.unreadNotifications || []).map(notification => {
      const notif = notification.toObject ? notification.toObject() : notification;
      const ticketData = notif.ticketId;
      
      // Check if this is a comment notification and extract comment data
      let lastComment = null;
      let hasComments = false;
      
      if (notif.type === 'ticket_commented' && ticketData) {
        // If the ticket was populated with comments
        if (ticketData.comments && ticketData.comments.length > 0) {
          const latestComment = ticketData.comments[ticketData.comments.length - 1];
          lastComment = {
            text: latestComment.text,
            userName: latestComment.userName,
            createdAt: latestComment.createdAt
          };
          hasComments = true;
        }
        
        // If comment data was stored directly in the notification
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
    
    const allNotifications = [
      ...processedNotifications,
      ...openTicketNotifications
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate unread count from database
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

// Mark notification as read
router.patch('/:notificationId/read', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Check if it's an open ticket notification (starts with 'open_')
    if (req.params.notificationId && req.params.notificationId.toString().startsWith('open_')) {
      // Open ticket notifications are read-only, just return success
      return res.json({ success: true, message: 'Open ticket notification marked as read' });
    }
    
    const notification = user.unreadNotifications?.find(
      n => n._id.toString() === req.params.notificationId
    );
    
    if (notification) {
      notification.read = true;
      user.notificationCount = Math.max(0, (user.notificationCount || 0) - 1);
      await user.save();
      
      // Emit socket update
      const io = global.io;
      if (io) {
        io.to(req.user._id.toString()).emit('notification_count_update', {
          type: 'notification_read',
          count: user.notificationCount
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.unreadNotifications) {
      user.unreadNotifications.forEach(n => n.read = true);
      user.notificationCount = 0;
      await user.save();
      
      // Emit socket update
      const io = global.io;
      if (io) {
        io.to(req.user._id.toString()).emit('notification_count_update', {
          type: 'all_read',
          count: 0
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Get unread count only (lightweight endpoint)
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