// backend/routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

const Project = require('../models/Project');
const Feed = require('../models/Feed');
const User = require('../models/User');

// ============================================
// PROJECT COMMENTS
// ============================================

// GET project comments
router.get('/projects/:projectId/comments', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('comments.userId', 'name email')
      .select('comments');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ success: true, comments: project.comments || [] });
  } catch (err) {
    console.error('Error fetching project comments:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST project comment (PM, Admin, or assigned users)
router.post('/projects/:projectId/comments', protect, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user has permission (PM, Admin, or assigned to project)
    const hasPermission = 
      req.user.role === 'Admin' ||
      req.user.role === 'Project Manager' ||
      (project.projectManager && project.projectManager.toString() === req.user.id);
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to comment on this project' });
    }
    
    const comment = {
      text: text.trim(),
      userId: req.user.id,
      userName: req.user.name,
      createdAt: new Date()
    };
    
    if (!project.comments) project.comments = [];
    project.comments.push(comment);
    await project.save();
    
    // Populate user details for response
    const populatedProject = await Project.findById(project._id)
      .populate('comments.userId', 'name email');
    
    const newComment = populatedProject.comments[populatedProject.comments.length - 1];
    
    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error adding project comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE project comment (owner or admin/pm)
router.delete('/projects/:projectId/comments/:commentId', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const commentIndex = project.comments.findIndex(
      c => c._id.toString() === req.params.commentId
    );
    
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const comment = project.comments[commentIndex];
    
    // Check permission: admin, pm, or comment owner
    const hasPermission = 
      req.user.role === 'Admin' ||
      req.user.role === 'Project Manager' ||
      comment.userId.toString() === req.user.id;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    project.comments.splice(commentIndex, 1);
    await project.save();
    
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('Error deleting project comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FEED COMMENTS
// ============================================

// GET feed comments
router.get('/feeds/:feedId/comments', protect, async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.feedId)
      .populate('comments.userId', 'name email')
      .select('comments');
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    res.json({ success: true, comments: feed.comments || [] });
  } catch (err) {
    console.error('Error fetching feed comments:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST feed comment (developers assigned to feed, PM, Admin)
router.post('/feeds/:feedId/comments', protect, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const feed = await Feed.findById(req.params.feedId).populate('projectId');
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Check if user has permission (Developer assigned to feed, PM, Admin)
    const isAssignedDeveloper = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user.id
    );
    
    const isProjectPM = feed.projectId && 
      feed.projectId.projectManager && 
      feed.projectId.projectManager.toString() === req.user.id;
    
    const hasPermission = 
      req.user.role === 'Admin' ||
      isProjectPM ||
      isAssignedDeveloper;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to comment on this feed' });
    }
    
    const comment = {
      text: text.trim(),
      userId: req.user.id,
      userName: req.user.name,
      createdAt: new Date()
    };
    
    if (!feed.comments) feed.comments = [];
    feed.comments.push(comment);
    await feed.save();
    
    // Populate user details for response
    const populatedFeed = await Feed.findById(feed._id)
      .populate('comments.userId', 'name email');
    
    const newComment = populatedFeed.comments[populatedFeed.comments.length - 1];
    
    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error adding feed comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE feed comment (owner or admin/pm)
router.delete('/feeds/:feedId/comments/:commentId', protect, async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.feedId);
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    const commentIndex = feed.comments.findIndex(
      c => c._id.toString() === req.params.commentId
    );
    
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const comment = feed.comments[commentIndex];
    
    // Check permission: admin, pm, assigned developer, or comment owner
    const isAssignedDeveloper = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user.id
    );
    
    const hasPermission = 
      req.user.role === 'Admin' ||
      req.user.role === 'Project Manager' ||
      isAssignedDeveloper ||
      comment.userId.toString() === req.user.id;
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    
    feed.comments.splice(commentIndex, 1);
    await feed.save();
    
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('Error deleting feed comment:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;