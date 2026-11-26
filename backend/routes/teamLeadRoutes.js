// backend/routes/teamLeadRoutes.js
const express = require('express');
const { tlProjectFilter } = require('../utils/projectAccess');
const { listActiveDevelopers, checkDeveloperIds } = require('../utils/feedDevelopers');
const router = express.Router();
const mongoose = require('mongoose');

// Import Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Ticket = require('../models/Ticket');
const Task = require('../models/Task');
const Log = require('../models/Log');

// Import Middleware
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

// ============================================
// GET ALL PROJECTS ASSIGNED TO TEAM LEAD
// ============================================
router.get('/my-projects',  authorize('Team Lead'), async (req, res) => {
  try {
    const projects = await Project.find(tlProjectFilter(req.user._id))
      .populate('projectManager', 'name email')
      .populate('teamLead', 'name email')
      .populate('teamLeads', 'name email')
      .populate('projectCoordinators', 'name email')
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
// ASSIGN DEVELOPER TO FEED (Team Lead action)
// ============================================
router.patch('/feeds/:feedId/assign-developers',  authorize('Team Lead'), async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.feedId).populate('projectId');

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    // Check if this feed belongs to a project assigned to this Team Lead
    const project = feed.projectId && await Project.findOne({
      _id: feed.projectId._id,
      ...tlProjectFilter(req.user._id)
    });

    if (!project) {
      return res.status(403).json({ error: 'Not authorized to manage this feed' });
    }

    // 0, 1 or many developers. Newly added ones must be active developers.
    const { ids: developerIds, added, error } = await checkDeveloperIds(req.body?.developerIds, feed.assignedDevelopers);
    if (error) {
      return res.status(400).json({ error });
    }

    // Update feed with assigned developers
    feed.assignedDevelopers = developerIds;
    await feed.save();

    // Create tasks for each newly added developer (not for those already assigned)
    const tasks = [];
    for (const developerId of added) {
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
      for (const developerId of added) {
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

    // Names for the page's table row
    await feed.populate('assignedDevelopers', 'name email');

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
// GET ALL DEVELOPERS (for assignment)
// ============================================
router.get('/developers',  authorize('Team Lead'), async (req, res) => {
  try {
    const developers = await listActiveDevelopers();
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
    const projects = await Project.find(tlProjectFilter(req.user._id)).select('_id');
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
// GET TEAM LEAD DASHBOARD STATS
// ============================================
router.get('/stats',  authorize('Team Lead'), async (req, res) => {
  try {
    const projects = await Project.find(tlProjectFilter(req.user._id));
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