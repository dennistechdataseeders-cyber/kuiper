const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import your Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Log = require('../models/Log');
const Task = require('../models/Task');
// Import your Authentication Middleware
const { protect } = require('../middleware/authMiddleware');
const {authorize}=require('../middleware/roleCheck');
/**
 * @route   GET /api/dev/my-projects
 * @desc    Get all projects where the developer is assigned to at least one feed
 * @access  Private (Developer)
 */
router.get('/my-projects', protect, authorize('Developer'), async (req, res) => {
  try {
    // 1. Find all feeds where this specific developer is in the assignedDevelopers array
    const assignedFeeds = await Feed.find({ 
      assignedDevelopers: req.user._id 
    }).select('projectId');

    // 2. Extract unique project IDs from those feeds
    const projectIds = [...new Set(assignedFeeds.map(f => f.projectId))];

    // 3. Fetch the full project details
    const projects = await Project.find({ 
      _id: { $in: projectIds } 
    })
    .populate('projectManager', 'name email')
    .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (err) {
    console.error('Error fetching dev projects:', err);
    res.status(500).json({ error: 'Server error while fetching projects' });
  }
});

/**
 * @route   GET /api/dev/my-feeds
 * @desc    Get all individual feeds/tasks assigned to the developer
 * @access  Private (Developer)
 */
router.get('/my-feeds', protect, authorize('Developer'), async (req, res) => {
  try {
    const feeds = await Feed.find({ 
      assignedDevelopers: req.user._id 
    })
    .populate('projectId', 'name projectCustomId')
    .sort({ createdAt: -1 });

    res.json(feeds);
  } catch (err) {
    console.error('Error fetching dev feeds:', err);
    res.status(500).json({ error: 'Server error while fetching assigned feeds' });
  }
});

/**
 * @route   PATCH /api/dev/feeds/:id/status
 * @desc    Update the status of an assigned feed and log the activity
 * @access  Private (Developer)
 */
router.patch('/feeds/:id/status', protect, authorize('Developer'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status update' });
  }

  try {
    // Find the feed and ensure the developer is actually assigned to it
    const feed = await Feed.findOne({ 
      _id: req.params.id, 
      assignedDevelopers: req.user._id 
    });

    if (!feed) {
      return res.status(403).json({ error: 'Not authorized to update this feed' });
    }

    const oldStatus = feed.status;
    feed.status = status;
    feed.lastUpdatedBy = req.user._id;
    await feed.save();

    // 4. CREATE SYSTEM LOG
    // This makes the update visible to the Admin Dashboard in real-time
    await Log.create({
      actionType: 'FEED_UPDATE',
      performerId: req.user._id,
      details: `Updated feed [${feed.name}] from ${oldStatus} to ${status}`,
      timestamp: new Date()
    });

    res.json({ message: 'Status updated successfully', feed });
  } catch (err) {
    console.error('Error updating feed status:', err);
    res.status(500).json({ error: 'Server error during status update' });
  }
});
// GET: Fetch all tasks assigned to the logged-in developer
// backend/routes/developer.js
router.get('/my-bucket', protect, async (req, res) => {
  try {
    // The code was failing here because 'Task' was invisible to the script
    const tasks = await Task.find({ targetUsers: req.user._id })
      .populate('projectId', 'name')
      .populate('performerId', 'name')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
router.patch('/tasks/:taskId', protect, authorize('Developer'), async (req, res) => {
  try {
    const { status, details, name } = req.body;

    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Security: Ensure the developer updating the task is the one assigned to it
    if (task.performerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this task" });
    }

    // Update fields
    if (status) task.status = status;
    if (details) task.details = details;
    if (name) task.name = name;

    await task.save();

    // Optional: Log the activity
    await Log.create({
      actionType: 'TASK_COMPLETED',
      performerId: req.user._id,
      details: `Completed task: ${task.name}. Note: ${details}`,
      timestamp: new Date()
    });

    res.json({ message: "Task updated successfully", task });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;