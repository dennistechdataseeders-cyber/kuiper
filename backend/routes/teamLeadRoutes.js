// backend/routes/teamLeadRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const Task = require('../models/Task');
const Log = require('../models/Log');
const User = require('../models/User');

// Import Middleware
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// ============================================
// GET ALL PROJECTS ASSIGNED TO TEAM LEAD
// ============================================
router.get('/my-projects',  authorize('Team Lead'), async (req, res) => {
  try {
    const projects = await Project.find({ teamLead: req.user._id })
      .populate('projectManager', 'name email')
      .populate('teamLead', 'name email')
      .populate('clients', 'name email')
      .populate('organizations', 'companyName')
      .populate({
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, projects });
  } catch (err) {
    console.error('Error fetching team lead projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET SINGLE PROJECT DETAILS
// ============================================
router.get('/projects/:id',  authorize('Team Lead'), async (req, res) => {
  try {
    const project = await Project.findOne({ 
      _id: req.params.id,
      teamLead: req.user._id
    })
      .populate('projectManager', 'name email')
      .populate('teamLead', 'name email')
      .populate('clients', 'name email')
      .populate('organizations', 'companyName')
      .populate({
        path: 'feeds',
        populate: {
          path: 'assignedDevelopers',
          select: 'name email'
        }
      });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or not assigned to you' });
    }

    res.json({ success: true, project });
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ASSIGN DEVELOPER TO FEED (Team Lead action)
// ============================================
router.patch('/feeds/:feedId/assign-developers',  authorize('Team Lead'), async (req, res) => {
  try {
    const { developerIds } = req.body;
    const feed = await Feed.findById(req.params.feedId).populate('projectId');

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    // Check if this feed belongs to a project assigned to this Team Lead
    const project = await Project.findOne({
      _id: feed.projectId._id,
      teamLead: req.user._id
    });

    if (!project) {
      return res.status(403).json({ error: 'Not authorized to manage this feed' });
    }

    // Validate developers exist and have Developer role
    const developers = await User.find({
      _id: { $in: developerIds },
      role: 'Developer'
    });

    if (developers.length !== developerIds.length) {
      return res.status(400).json({ 
        error: 'One or more developers not found or not valid Developer role' 
      });
    }

    // Update feed with assigned developers
    feed.assignedDevelopers = developerIds;
    await feed.save();

    // Create tasks for each developer
    const tasks = [];
    for (const developerId of developerIds) {
      const task = await Task.create({
        name: `Feed Assignment: ${feed.name}`,
        details: `You have been assigned to feed "${feed.name}" in project ${project.projectCustomId || project.name}.`,
        projectId: project._id,
        feedId: feed._id,
        performerId: req.user._id,
        targetUsers: [developerId],
        status: 'Pending'
      });
      tasks.push(task);
    }

    // Send socket notifications
    const io = req.app.get('io');
    if (io) {
      for (const developerId of developerIds) {
        io.to(developerId.toString()).emit('feed_assigned', {
          feed,
          project,
          message: `You've been assigned to feed: ${feed.name} in project ${project.projectCustomId || project.name}`
        });
        
        io.to(developerId.toString()).emit('new_task', {
          ...tasks.find(t => t.targetUsers.includes(developerId)).toObject(),
          feedName: feed.name,
          projectName: project.projectCustomId || project.name
        });
      }
    }

    // Log the action
    await Log.create({
      actionType: 'FEED_DEVELOPERS_ASSIGNED',
      performerId: req.user._id,
      details: `Team Lead assigned ${developerIds.length} developers to feed "${feed.name}" in project ${project.projectCustomId || project.name}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: `${developerIds.length} developer(s) assigned to feed`,
      feed,
      tasks
    });

  } catch (err) {
    console.error('Error assigning developers to feed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET ALL FEEDS FOR A PROJECT (Team Lead view)
// ============================================
router.get('/projects/:projectId/feeds',  authorize('Team Lead'), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      teamLead: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or not assigned to you' });
    }

    const feeds = await Feed.find({ projectId: project._id })
      .populate('assignedDevelopers', 'name email');

    res.json({ success: true, feeds });
  } catch (err) {
    console.error('Error fetching feeds:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET ALL DEVELOPERS (for assignment)
// ============================================
router.get('/developers',  authorize('Team Lead'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'Developer' })
      .select('name email githubUsername githubLinked _id');
    res.json({ success: true, developers });
  } catch (err) {
    console.error('Error fetching developers:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET ALL TICKETS FOR TEAM LEAD'S PROJECTS
// ============================================
router.get('/my-tickets',  authorize('Team Lead'), async (req, res) => {
  try {
    // Get all projects assigned to this Team Lead
    const projects = await Project.find({ teamLead: req.user._id }).select('_id');
    const projectIds = projects.map(p => p._id);

    // Get tickets for these projects
    const tickets = await Ticket.find({
      projectId: { $in: projectIds }
    })
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .populate('comments.userId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, tickets });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CREATE TICKET (Team Lead can create for their projects)
// ============================================
router.post('/tickets',  authorize('Team Lead'), async (req, res) => {
  try {
    const { title, description, priority, projectId, feedId, category, subcategory, subItem } = req.body;

    // Verify project is assigned to this Team Lead
    const project = await Project.findOne({
      _id: projectId,
      teamLead: req.user._id
    });

    if (!project) {
      return res.status(403).json({ error: 'Not authorized to create tickets for this project' });
    }

    let assignedTo = null;
    if (feedId) {
      const feed = await Feed.findById(feedId).populate('assignedDevelopers', '_id');
      if (feed && feed.assignedDevelopers && feed.assignedDevelopers.length > 0) {
        assignedTo = feed.assignedDevelopers[0]._id;
      }
    }

    const ticket = new Ticket({
      title,
      description,
      priority: priority || 'Medium',
      projectId,
      feedId: feedId || null,
      createdBy: req.user.id,
      assignedTo,
      isInternal: true,
      category: category || '',
      subcategory: subcategory || '',
      subItem: subItem || ''
    });

    await ticket.save();

    // Get populated ticket for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');

    // Socket notification
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_created', populatedTicket);
      if (ticket.assignedTo) {
        io.to(ticket.assignedTo.toString()).emit('ticket_created', populatedTicket);
      }
      io.to(req.user.id.toString()).emit('ticket_created', populatedTicket);
    }

    // Log the action
    await Log.create({
      actionType: 'TICKET_CREATED',
      performerId: req.user._id,
      details: `Team Lead ${req.user.name} created ticket ${ticket.ticketNumber} for project ${project.projectCustomId || project.name}`,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: populatedTicket
    });

  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UPDATE TICKET STATUS (Team Lead can update tickets in their projects)
// ============================================
router.patch('/tickets/:id/status',  authorize('Team Lead'), async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify project is assigned to this Team Lead
    const project = await Project.findOne({
      _id: ticket.projectId,
      teamLead: req.user._id
    });

    if (!project) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }

    ticket.status = status;
    if (status === 'Resolved') {
      ticket.resolvedAt = new Date();
    }
    if (status === 'Closed') {
      ticket.closedAt = new Date();
    }
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name');

    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', updatedTicket);
      if (ticket.assignedTo) {
        io.to(ticket.assignedTo.toString()).emit('ticket_updated', updatedTicket);
      }
      io.to(ticket.createdBy.toString()).emit('ticket_updated', updatedTicket);
    }

    res.json({ success: true, ticket: updatedTicket });

  } catch (err) {
    console.error('Error updating ticket status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADD COMMENT TO TICKET
// ============================================
router.post('/tickets/:id/comments',  authorize('Team Lead'), async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify project is assigned to this Team Lead
    const project = await Project.findOne({
      _id: ticket.projectId,
      teamLead: req.user._id
    });

    if (!project) {
      return res.status(403).json({ error: 'Not authorized to comment on this ticket' });
    }

    const comment = {
      text: text.trim(),
      userId: req.user.id,
      userName: req.user.name,
      createdAt: new Date()
    };

    if (!ticket.comments) ticket.comments = [];
    ticket.comments.push(comment);
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name projectCustomId')
      .populate('feedId', 'name')
      .populate('comments.userId', 'name');

    const io = req.app.get('io');
    if (io) {
      io.to(`ticket_${ticket._id}`).emit('ticket_commented', updatedTicket);
      if (ticket.assignedTo) {
        io.to(ticket.assignedTo.toString()).emit('ticket_commented', updatedTicket);
      }
      io.to(ticket.createdBy.toString()).emit('ticket_commented', updatedTicket);
    }

    res.json({ success: true, ticket: updatedTicket });

  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET TEAM LEAD DASHBOARD STATS
// ============================================
router.get('/stats',  authorize('Team Lead'), async (req, res) => {
  try {
    const projects = await Project.find({ teamLead: req.user._id });
    const projectIds = projects.map(p => p._id);

    const feeds = await Feed.find({ projectId: { $in: projectIds } });
    const tickets = await Ticket.find({ projectId: { $in: projectIds } });

    const stats = {
      totalProjects: projects.length,
      totalFeeds: feeds.length,
      totalTickets: tickets.length,
      openTickets: tickets.filter(t => t.status === 'Open').length,
      inProgressTickets: tickets.filter(t => t.status === 'In Progress').length,
      resolvedTickets: tickets.filter(t => t.status === 'Resolved').length,
      closedTickets: tickets.filter(t => t.status === 'Closed').length,
      projectsWithFeeds: projects.filter(p => p.feeds && p.feeds.length > 0).length
    };

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;