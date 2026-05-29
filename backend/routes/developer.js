const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import your Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Log = require('../models/Log');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const { getServerTimestamp } = require('../utils/serverTime');

// Import your Authentication Middleware
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');


/**
 * @route   GET /api/dev/system-time-check
 * @desc    Get server time — used for:
 *          1. Mismatch detection (>5 min diff or different date blocks access)
 *          2. Client clock offset calculation for server-side time tracking
 *          Returns ISO timestamp so client can compute offset = serverTime - clientReceiveTime
 * @access  Private (Developer)
 */
router.get('/system-time-check', protect, authorize('Developer'), async (req, res) => {
  try {
    // Use getServerTimestamp if available, otherwise fall back to new Date()
    const serverNow = typeof getServerTimestamp === 'function'
      ? getServerTimestamp()
      : new Date();

    res.json({
      success: true,
      serverTime: serverNow.toISOString(),
      serverTimestamp: serverNow.getTime(), // ms epoch — used by client for offset math
      timezone: 'Asia/Kolkata'
    });

  } catch (err) {
    console.error('Time check error:', err);
    res.status(500).json({ error: 'Failed to fetch server time' });
  }
});

/**
 * @route   GET /api/dev/my-projects
 * @desc    Get all projects where the developer is assigned to at least one feed
 * @access  Private (Developer)
 */
router.get('/my-projects', protect, authorize('Developer'), async (req, res) => {
  try {
    const assignedFeeds = await Feed.find({
      assignedDevelopers: req.user._id
    }).select('projectId');

    const projectIds = [...new Set(assignedFeeds.map(f => f.projectId))];

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
 * @desc    Get all individual feeds/tasks assigned to the developer (excluding completed)
 * @access  Private (Developer)
 */
router.get('/my-feeds', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const feeds = await Feed.find({ 
      assignedDevelopers: req.user._id
    })
      .populate('projectId', 'name projectCustomId')
      .populate('assignedDevelopers', 'name email')
      .sort({ createdAt: -1 });

    const filteredFeeds = feeds.filter(feed => {
      const isCompletedToday = feed.completionHistory && 
        Array.isArray(feed.completionHistory) && 
        feed.completionHistory.some(h => h && h.date === today);
      return !isCompletedToday;
    });

    res.json(filteredFeeds);
  } catch (err) {
    console.error('Error fetching dev feeds:', err);
    res.status(500).json({ error: 'Server error while fetching assigned feeds' });
  }
});

/**
 * @route   POST /api/dev/complete-feed
 * @desc    Mark a feed as completed by the developer for today
 * @access  Private (Developer)
 */
router.post('/complete-feed', protect, authorize('Developer'), async (req, res) => {
  try {
    const { feedId, description, completedAt } = req.body;

    if (!feedId) return res.status(400).json({ error: 'Feed ID is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required' });

    const feed = await Feed.findById(feedId);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });

    const isAssigned = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to complete this feed' });

    const today = new Date().toISOString().split('T')[0];

    if (!feed.completionHistory) feed.completionHistory = [];

    const alreadyCompleted = feed.completionHistory.some(h => h && h.date === today);
    if (alreadyCompleted) return res.status(400).json({ error: 'Feed already completed for today' });

    feed.completionHistory.push({
      date: today,
      completedBy: req.user._id,
      description,
      completedAt: completedAt ? new Date(completedAt) : new Date()
    });

    feed.completed = true;
    feed.completedAt = completedAt ? new Date(completedAt) : new Date();
    feed.completedBy = req.user._id;
    feed.completionDescription = description;
    
    await feed.save();

    if (Log) {
      try {
        await Log.create({
          actionType: 'FEED_COMPLETED',
          performerId: req.user._id,
          feedId: feed._id,
          projectId: feed.projectId,
          details: description,
          timestamp: new Date()
        });
      } catch (logError) {
        console.error('Log creation error (non-critical):', logError.message);
      }
    }

    res.json({
      success: true,
      message: `Feed "${feed.name}" marked as completed for today`,
      feed: {
        id: feed._id,
        name: feed.name,
        completed: feed.completed,
        completionHistory: feed.completionHistory
      }
    });

  } catch (err) {
    console.error('=== COMPLETE FEED ERROR ===', err.message);
    res.status(500).json({ error: 'Server error while completing feed', details: err.message });
  }
});

/**
 * @route   PATCH /api/dev/feeds/:id/status
 * @desc    Update the status of an assigned feed and log the activity
 * @access  Private (Developer)
 */
router.patch('/feeds/:id/status', protect, authorize('Developer'), async (req, res) => {
  try {
    const { status, description } = req.body;
    const feedId = req.params.id;

    const feed = await Feed.findById(feedId);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });

    const isAssigned = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to update this feed' });

    feed.status = status;
    await feed.save();

    if (Log) {
      await Log.create({
        actionType: 'FEED_STATUS_UPDATED',
        performerId: req.user._id,
        feedId: feed._id,
        details: description || `Feed status updated to ${status}`,
        timestamp: new Date()
      });
    }

    const io = req.app.get('io');
    if (io) io.to(req.user._id.toString()).emit('feed_updated', feed);

    res.json({ message: `Feed status updated to ${status}`, feed });

  } catch (err) {
    console.error('Error updating feed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PATCH /api/dev/tasks/:taskId
 * @desc    Update the status of an assigned task
 * @access  Private (Developer)
 */
router.patch('/tasks/:taskId', protect, authorize('Developer'), async (req, res) => {
  try {
    const { status, details, name } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isAssigned = task.targetUsers.some(
      userId => userId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to update this task' });

    if (status) task.status = status;
    if (details) task.details = details;
    if (name) task.name = name;
    if (status === 'Completed') task.completedAt = new Date();

    await task.save();

    const io = req.app.get('io');
    if (io) io.to(req.user._id.toString()).emit('task_updated', task);

    if (Log) {
      await Log.create({
        actionType: 'TASK_COMPLETED',
        performerId: req.user._id,
        details: `Completed task: ${task.name}`,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Task updated successfully', task });

  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/dev/my-bucket
 * @desc    Get all incomplete tasks for the developer
 * @access  Private (Developer)
 */
router.get('/my-bucket', protect, authorize('Developer'), async (req, res) => {
  try {
    const tasks = await Task.find({
      targetUsers: req.user._id,
      status: { $ne: 'Completed' }
    })
      .populate('projectId', 'name')
      .populate('performerId', 'name')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/dev/worklog
 * @desc    Get worklogs for today
 * @access  Private (Developer)
 */
router.get('/worklog', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const feeds = await Feed.find({
      assignedDevelopers: req.user._id
    }).populate('projectId', 'name');

    const result = await Promise.all(
      feeds.map(async (feed) => {
        let log = await WorkLog.findOne({
          developerId: req.user._id,
          feedId: feed._id,
          date: today
        });

        if (!log) {
          log = await WorkLog.create({
            developerId: req.user._id,
            feedId: feed._id,
            projectId: feed.projectId?._id,
            date: today,
            timeBlocks: []
          });
        }

        return { feed, worklog: log };
      })
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch worklogs' });
  }
});

/**
 * @route   POST /api/dev/worklog/start/:feedId
 * @desc    Start timer for a feed
 *          Always records server-side startedAt — client cannot supply a timestamp.
 *          Returns serverTimestamp so client can recalibrate its offset.
 * @access  Private (Developer)
 */
router.post('/worklog/start/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });
    if (log.isRunning) return res.status(400).json({ error: 'Timer already running' });

    // Always use server clock — never trust client-supplied time
    const serverNow = new Date();

    log.startedAt = serverNow;
    log.isRunning = true;

    if (!log.timeBlocks) log.timeBlocks = [];

    log.timeBlocks.push({
      startTime: serverNow,
      endTime: null,
      duration: 0
    });

    await log.save();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime() // client uses this to correct offset
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/pause/:feedId
 * @desc    Pause timer for a feed
 *          Duration is computed server-side from stored startedAt.
 *          Returns serverTimestamp so client can recalibrate its offset.
 * @access  Private (Developer)
 */
router.post('/worklog/pause/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });
    if (!log.isRunning) return res.status(400).json({ error: 'Timer is not running' });

    // Server computes elapsed time — client clock is irrelevant
    const serverNow = new Date();
    const diff = Math.floor((serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000);

    log.totalTime += diff;

    if (log.timeBlocks?.length > 0) {
      const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];
      if (currentBlock && !currentBlock.endTime) {
        currentBlock.endTime = serverNow;
        currentBlock.duration = diff;
      }
    }

    log.isRunning = false;
    log.startedAt = null;

    await log.save();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime() // client uses this to correct offset
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/stop/:feedId
 * @desc    Stop timer for a feed
 *          If running, duration is computed server-side from stored startedAt.
 *          Returns serverTimestamp so client can recalibrate its offset.
 * @access  Private (Developer)
 */
router.post('/worklog/stop/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });

    if (log.isRunning) {
      // Server computes elapsed time — client clock is irrelevant
      const serverNow = new Date();
      const diff = Math.floor((serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000);

      log.totalTime += diff;

      if (log.timeBlocks?.length > 0) {
        const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];
        if (currentBlock && !currentBlock.endTime) {
          currentBlock.endTime = serverNow;
          currentBlock.duration = diff;
        }
      }
    }

    log.isRunning = false;
    log.startedAt = null;

    await log.save();

    const serverNow = new Date();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime() // client uses this to correct offset
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/deduct-break/:feedId
 * @desc    Deduct break time from a feed's worklog
 * @access  Private (Developer)
 */
router.post('/worklog/deduct-break/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { breakSeconds, breakDescription } = req.body;

    if (!breakSeconds || breakSeconds <= 0) {
      return res.status(400).json({ error: 'Valid break duration is required' });
    }

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });

    if (!log.breakEntries) log.breakEntries = [];
    if (!log.totalBreakTime) log.totalBreakTime = 0;

    log.totalBreakTime += breakSeconds;
    log.breakEntries.push({
      duration: breakSeconds,
      reason: breakDescription || 'Break/Lunch',
      timestamp: new Date()
    });
    
    log.netTime = Math.max(0, (log.totalTime || 0) - log.totalBreakTime);
    
    await log.save();

    if (Log) {
      await Log.create({
        actionType: 'BREAK_DEDUCTED',
        performerId: req.user._id,
        feedId: req.params.feedId,
        details: `Deducted ${Math.floor(breakSeconds / 60)} minutes break: ${breakDescription || 'No reason provided'}`,
        timestamp: new Date()
      });
    }

    res.json(log);
  } catch (err) {
    console.error('Error deducting break time:', err);
    res.status(500).json({ error: 'Failed to deduct break time' });
  }
});

module.exports = router;