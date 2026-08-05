// backend/routes/commentRoutes.js - COMPLETE FIX WITH FILE SAVING

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
      .populate('comments.userId', 'name email role')
      .select('comments teamLead projectManager');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user has access to view comments
    const hasAccess = await userHasProjectAccess(req.user, project);
    if (!hasAccess) {
      console.log(`❌ Access denied for user ${req.user.role} (${req.user._id}) on project ${project._id}`);
      console.log(`   Project Team Lead: ${project.teamLead}`);
      console.log(`   Project Manager: ${project.projectManager}`);
      return res.status(403).json({ error: 'Not authorized to view comments for this project' });
    }
    
    res.json({ success: true, comments: project.comments || [] });
  } catch (err) {
    console.error('Error fetching project comments:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST project comment - ✅ FIXED to save files
router.post('/projects/:projectId/comments', protect, async (req, res) => {
  try {
    const { text, files } = req.body;
    
    console.log('📝 Project comment payload:', { 
      text: text?.substring(0, 50), 
      files: files?.length || 0,
      filesData: files 
    });
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Who can comment on project?
    const canComment = await userCanCommentOnProject(req.user, project);
    if (!canComment) {
      console.log(`❌ Comment denied for user ${req.user.role} (${req.user._id}) on project ${project._id}`);
      return res.status(403).json({ error: 'Not authorized to comment on this project' });
    }
    
    // ✅ Create comment with files array
    const comment = {
      text: text.trim(),
      userId: req.user.id,
      userName: req.user.name,
      files: files || [], // ✅ THIS IS THE KEY FIX - saves files to the comment
      createdAt: new Date()
    };
    
    console.log('📝 Saving comment with files:', comment.files?.length || 0);
    
    if (!project.comments) project.comments = [];
    project.comments.push(comment);
    await project.save();
    
    // Populate user details for response
    const populatedProject = await Project.findById(project._id)
      .populate('comments.userId', 'name email role');
    
    const newComment = populatedProject.comments[populatedProject.comments.length - 1];
    
    console.log('✅ Project comment saved with files:', newComment.files?.length || 0);
    
    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error adding project comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE project comment
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
    
    // Who can delete project comments?
    const canDelete = await userCanDeleteComment(req.user, project, comment);
    if (!canDelete) {
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
// FEED COMMENTS - ✅ FIXED to save files
// ============================================

// GET feed comments
router.get('/feeds/:feedId/comments', protect, async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.feedId)
      .populate('comments.userId', 'name email role')
      .select('comments projectId assignedDevelopers');
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Check if user has access to view feed comments
    const hasAccess = await userHasFeedAccess(req.user, feed);
    if (!hasAccess) {
      console.log(`❌ Access denied for user ${req.user.role} (${req.user._id}) on feed ${feed._id}`);
      return res.status(403).json({ error: 'Not authorized to view comments for this feed' });
    }
    
    res.json({ success: true, comments: feed.comments || [] });
  } catch (err) {
    console.error('Error fetching feed comments:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST feed comment - ✅ FIXED to save files
router.post('/feeds/:feedId/comments', protect, async (req, res) => {
  try {
    const { text, files } = req.body;
    
    console.log('📝 Feed comment payload:', { 
      text: text?.substring(0, 50), 
      files: files?.length || 0,
      filesData: files 
    });
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const feed = await Feed.findById(req.params.feedId).populate('projectId');
    
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Who can comment on feed?
    const canComment = await userCanCommentOnFeed(req.user, feed);
    if (!canComment) {
      console.log(`❌ Comment denied for user ${req.user.role} (${req.user._id}) on feed ${feed._id}`);
      return res.status(403).json({ error: 'Not authorized to comment on this feed' });
    }
    
    // ✅ Create comment with files array
    const comment = {
      text: text.trim(),
      userId: req.user.id,
      userName: req.user.name,
      files: files || [], // ✅ THIS IS THE KEY FIX - saves files to the comment
      createdAt: new Date()
    };
    
    console.log('📝 Saving feed comment with files:', comment.files?.length || 0);
    
    if (!feed.comments) feed.comments = [];
    feed.comments.push(comment);
    await feed.save();
    
    // Populate user details for response
    const populatedFeed = await Feed.findById(feed._id)
      .populate('comments.userId', 'name email role');
    
    const newComment = populatedFeed.comments[populatedFeed.comments.length - 1];
    
    console.log('✅ Feed comment saved with files:', newComment.files?.length || 0);
    
    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error adding feed comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE feed comment
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
    
    // Who can delete feed comments?
    const canDelete = await userCanDeleteFeedComment(req.user, feed, comment);
    if (!canDelete) {
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

// ============================================
// HELPER FUNCTIONS - WITH BETTER TYPE HANDLING
// ============================================

/**
 * Compare IDs safely (handles both strings and ObjectIds)
 */
function compareIds(id1, id2) {
  if (!id1 || !id2) return false;
  return id1.toString() === id2.toString();
}

/**
 * Check if user has access to view project comments
 * - Admin: Yes
 * - Project Manager: Yes (if they manage the project)
 * - Team Lead: Yes (if they are assigned to the project)
 * - Developer: Yes (if they are assigned to any feed in the project)
 * - Others: No
 */
async function userHasProjectAccess(user, project) {
  const role = user.role;
  const userId = user._id;
  
  console.log(`🔍 Checking project access for ${role} (${userId})`);
  console.log(`   Project Team Lead: ${project.teamLead}`);
  console.log(`   Project Manager: ${project.projectManager}`);
  
  // Admin can see everything
  if (role === 'Admin') {
    console.log('✅ Admin access granted');
    return true;
  }
  
  // Project Manager can see their projects
  if (role === 'Project Manager') {
    const isPM = compareIds(project.projectManager, userId);
    console.log(`   PM check: ${isPM}`);
    if (isPM) return true;
  }
  
  // Team Lead can see projects they lead
  if (role === 'Team Lead') {
    const isTL = compareIds(project.teamLead, userId);
    console.log(`   TL check: ${isTL}`);
    if (isTL) return true;
  }
  
  // Developer can see projects they have feeds in
  if (role === 'Developer') {
    const Feed = require('../models/Feed');
    const feedCount = await Feed.countDocuments({
      projectId: project._id,
      assignedDevelopers: userId
    });
    console.log(`   Developer feed count: ${feedCount}`);
    return feedCount > 0;
  }
  
  console.log('❌ No access granted');
  return false;
}

/**
 * Check if user can comment on a project
 * - Admin: Yes
 * - Project Manager: Yes
 * - Team Lead: Yes (if assigned to the project)
 * - Developer: Yes (if assigned to any feed in the project)
 */
async function userCanCommentOnProject(user, project) {
  const role = user.role;
  const userId = user._id;
  
  if (role === 'Admin') return true;
  if (role === 'Project Manager') return true;
  
  if (role === 'Team Lead') {
    return compareIds(project.teamLead, userId);
  }
  
  // Developer can comment if assigned to any feed in this project
  if (role === 'Developer') {
    const Feed = require('../models/Feed');
    const feedCount = await Feed.countDocuments({
      projectId: project._id,
      assignedDevelopers: userId
    });
    return feedCount > 0;
  }
  
  return false;
}

/**
 * Check if user can delete a project comment
 * - Admin: Yes
 * - Project Manager: Yes
 * - Team Lead: Yes (if assigned to the project)
 * - Developer: Yes (if assigned to any feed in the project)
 * - Comment owner: Yes
 */
async function userCanDeleteComment(user, project, comment) {
  const role = user.role;
  const userId = user._id;
  
  if (role === 'Admin') return true;
  if (role === 'Project Manager') return true;
  
  if (role === 'Team Lead') {
    return compareIds(project.teamLead, userId);
  }
  
  // Developer can delete if assigned to any feed in this project
  if (role === 'Developer') {
    const Feed = require('../models/Feed');
    const feedCount = await Feed.countDocuments({
      projectId: project._id,
      assignedDevelopers: userId
    });
    if (feedCount > 0) return true;
  }
  
  // Comment owner can delete their own comment
  const commentUserId = comment.userId?._id || comment.userId;
  return compareIds(commentUserId, userId);
}

/**
 * Check if user has access to view feed comments
 * - Admin: Yes
 * - Project Manager: Yes (if they manage the project)
 * - Team Lead: Yes (if assigned to the project)
 * - Developer: Yes (if assigned to the feed)
 */
async function userHasFeedAccess(user, feed) {
  const role = user.role;
  const userId = user._id;
  
  if (role === 'Admin') return true;
  
  // Check if user is assigned to this feed
  const isAssignedToFeed = feed.assignedDevelopers?.some(
    devId => compareIds(devId, userId)
  );
  if (isAssignedToFeed) return true;
  
  // Check project access
  if (feed.projectId) {
    const project = await Project.findById(feed.projectId);
    if (project) {
      if (role === 'Project Manager' && compareIds(project.projectManager, userId)) {
        return true;
      }
      if (role === 'Team Lead' && compareIds(project.teamLead, userId)) {
        return true;
      }
      // Developer can access if assigned to any feed in the project
      if (role === 'Developer') {
        const Feed = require('../models/Feed');
        const feedCount = await Feed.countDocuments({
          projectId: project._id,
          assignedDevelopers: userId
        });
        return feedCount > 0;
      }
    }
  }
  
  return false;
}

/**
 * Check if user can comment on a feed
 * - Admin: Yes
 * - Project Manager: Yes (if they manage the project)
 * - Team Lead: Yes (if assigned to the project)
 * - Developer: Yes (if assigned to the feed)
 */
async function userCanCommentOnFeed(user, feed) {
  const role = user.role;
  const userId = user._id;
  
  if (role === 'Admin') return true;
  
  // Developer can comment if assigned to this feed
  if (role === 'Developer') {
    return feed.assignedDevelopers?.some(
      devId => compareIds(devId, userId)
    );
  }
  
  // Check project access for PM and Team Lead
  if (feed.projectId) {
    const project = await Project.findById(feed.projectId);
    if (project) {
      if (role === 'Project Manager' && compareIds(project.projectManager, userId)) {
        return true;
      }
      if (role === 'Team Lead' && compareIds(project.teamLead, userId)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if user can delete a feed comment
 * - Admin: Yes
 * - Project Manager: Yes
 * - Team Lead: Yes (if assigned to the project)
 * - Developer: Yes (if assigned to the feed)
 * - Comment owner: Yes
 */
async function userCanDeleteFeedComment(user, feed, comment) {
  const role = user.role;
  const userId = user._id;
  
  if (role === 'Admin') return true;
  if (role === 'Project Manager') return true;
  
  // Developer can delete if assigned to this feed
  if (role === 'Developer') {
    const isAssignedToFeed = feed.assignedDevelopers?.some(
      devId => compareIds(devId, userId)
    );
    if (isAssignedToFeed) return true;
  }
  
  if (role === 'Team Lead') {
    if (feed.projectId) {
      const project = await Project.findById(feed.projectId);
      return compareIds(project?.teamLead, userId);
    }
    return false;
  }
  
  // Comment owner can delete their own comment
  const commentUserId = comment.userId?._id || comment.userId;
  return compareIds(commentUserId, userId);
}

module.exports = router;