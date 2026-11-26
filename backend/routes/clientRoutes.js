// backend/routes/clientRoutes.js

const express = require('express');
const { pmProjectFilter, tlProjectFilter, isProjectPM, isProjectTL } = require('../utils/projectAccess');
const { isPMRole } = require('../utils/roles');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Project = require('../models/Project');
const Feed = require('../models/Feed'); // Added for Developer role check
const FeedStatus = require('../models/FeedStatus');
const feedStatusService = require('../services/feedStatusService');
const { describeRun, getPreviousRun, getProjectRuns } = require('../utils/feedRunStatus');

// ============================================
// GET /api/client/projects
// ✅ Role-aware: Clients, Developers, PMs, Team Leads, Admins
// ============================================
router.get('/projects', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const userOrganizationId = req.user.organizationId;

    let query = {};

    if (userRole === 'Client') {
      // Clients: check clients OR organizations
      query.$or = [
        { clients: userId }
      ];
      if (userOrganizationId) {
        query.$or.push({ organizations: userOrganizationId });
      }
    } else if (userRole === 'Developer') {
      // Developers: get projects where they are assigned to feeds
      const feeds = await Feed.find({ assignedDevelopers: userId }).select('projectId');
      const projectIds = [...new Set(feeds.map(f => f.projectId.toString()))];
      
      if (projectIds.length === 0) {
        return res.status(200).json([]);
      }
      query = { _id: { $in: projectIds } };
      
    } else if (isPMRole(userRole)) {
      // PMs: projects they manage OR where they are the team lead
      query.$or = [
        ...pmProjectFilter(userId).$or,
        ...tlProjectFilter(userId).$or
      ];
      
    } else if (userRole === 'Team Lead') {
      // Team Leads: projects where they are the team lead
      query = tlProjectFilter(userId);
      
    } else if (userRole === 'Admin' || userRole === 'Super Admin') {
      // Admins and Super Admins: all projects
      query = {};
      
    } else {
      return res.status(200).json([]);
    }

    const projects = await Project.find(query)
      .populate('clients', 'name')
      .populate('organizations', 'companyName')
      .select('name projectCustomId _id');

    if (!projects || projects.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Who may see a project's feed status
async function canViewProjectFeeds(project, user) {
  const userId = user._id;
  const userRole = user.role;
  const userOrganizationId = user.organizationId;

  let hasAccess = false;

  // Role-based access check
  if (userRole === 'Admin' || userRole === 'Super Admin') {
    hasAccess = true;
    
  } else if (userRole === 'Client') {
    // Check if client is assigned directly or through organization
    const isClient = project.clients.some(id => id.toString() === userId.toString());
    const isOrgClient = userOrganizationId && project.organizations.some(id => id.toString() === userOrganizationId.toString());
    hasAccess = isClient || isOrgClient;
    
  } else if (userRole === 'Developer') {
    // Check if developer is assigned to any feed in this project
    const feedCount = await Feed.countDocuments({
      projectId: project._id,
      assignedDevelopers: userId
    });
    hasAccess = feedCount > 0;
    
  } else if (isPMRole(userRole)) {
    // Check if PM manages this project OR is the team lead
    const isPM = isProjectPM(project, userId);
    const isTeamLead = isProjectTL(project, userId);
    hasAccess = isPM || isTeamLead;
    
  } else if (userRole === 'Team Lead') {
    // Check if Team Lead is assigned to this project
    hasAccess = isProjectTL(project, userId);
    
  } else {
    hasAccess = false;
  }

  return hasAccess;
}

// ============================================
// GET /api/client/projects/:projectId/feeds
// ✅ Reads from FeedStatus table - Role Aware
// ============================================
router.get('/projects/:projectId/feeds', protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    // First, get the project to check access
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasAccess = await canViewProjectFeeds(project, req.user);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // One entry per feed: today's run, else its most recent run, else "No run yet"
    const runs = await getProjectRuns(project, today);

    // Enrich feeds with project data
    const enrichedFeeds = runs.map(({ name, record, feed: feedDoc }) => {
      const run = describeRun(record, today);
      const feed = record || {};
      // older field: only the values it always had
      const status = run.isStalled ? 'In Progress' : (record ? run.displayStatus : 'Pending');
      const feedType = feed.feed_type || feedDoc?.feedType || 'Daily';

      return {
        feed_name: name,
        _id: feed._id || feedDoc._id,
        status: status,
        stages: feed.stages || {},
        failed: feed.failed || false,
        error_message: feed.error_message || '',
        updated_at: record ? feed.updated_at || new Date() : null,
        date: record ? feed.date || today : null,
        project: record ? feed.project : project.projectCustomId,
        client: feed.client,
        feed_type: feedType,
        projectId: project._id,
        projectName: project.name,
        projectCustomId: project.projectCustomId,
        feedStatus: status,
        feedType: feedType,
        output_path: feed.output_path || null,
        record_count: feed.record_count !== undefined && feed.record_count !== null ? feed.record_count : null,
        ...run
      };
    });

    res.status(200).json(enrichedFeeds);
    
  } catch (error) {
    console.error('❌ Error fetching project feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds', details: error.message });
  }
});

// ============================================================
// GET /api/client/projects/:projectId/feeds/previous-run?feed=<name>&before=YYYY-MM-DD
// The run of one feed just before a date. Same access rules as the list above.
// ============================================================
router.get('/projects/:projectId/feeds/previous-run', protect, async (req, res) => {
  try {
    const { feed, before } = req.query;
    if (typeof feed !== 'string' || !feed.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
      return res.status(400).json({ error: 'feed and before (YYYY-MM-DD) are required' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!(await canViewProjectFeeds(project, req.user))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const today = new Date().toISOString().split('T')[0];
    const record = await getPreviousRun(project, feed, before);
    res.json({
      run: record && {
        ...describeRun(record, today),
        feed_name: record.feed_name,
        stages: record.stages || {},
        error_message: record.error_message || '',
        output_path: record.output_path || null,
        record_count: record.record_count ?? null,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching previous run:', error);
    res.status(500).json({ error: 'Failed to fetch the previous run' });
  }
});

// ============================================================
// GET /api/client/feeds/status/:feedName
// ============================================================
router.get('/feeds/status/:feedName', async (req, res) => {
  try {
    const { feedName } = req.params;
    const date = new Date().toISOString().split('T')[0];

    const feed = await FeedStatus.findOne({ feed_name: feedName, date });

    if (!feed) {
      // No run today: the existing fields stay as they were; the extra ones describe the latest run
      const latest = await FeedStatus.findOne({ feed_name: feedName }).sort({ date: -1, updated_at: -1 }).lean();
      return res.json({
        ...describeRun(latest, date),
        feed_name: feedName,
        date,
        status: 'Pending',
        progress: 0,
        completed_stages: 0,
        total_stages: 5,
        stages: {},
        output_path: null,
        record_count: null
      });
    }

    const stages = feed.stages || {};
    const totalStages = 5;
    const completedStages = Object.values(stages).filter(
      (s) => s && s.completed === true
    ).length;

    res.json({
      ...describeRun(await FeedStatus.findById(feed._id).lean(), date),
      feed_name: feedName,
      date,
      status: feed.status,
      progress: feed.progress,
      completed_stages: completedStages,
      total_stages: totalStages,
      stages: feed.stages,
      failed: feed.failed,
      error_message: feed.error_message,
      updated_at: feed.updated_at,
      output_path: feed.output_path || null,
      record_count: feed.record_count !== undefined && feed.record_count !== null ? feed.record_count : null
    });
  } catch (error) {
    console.error('❌ Error fetching feed status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/client/feeds/update - UPDATED with File Integrity Count Tracking
// ============================================================
// backend/routes/clientRoutes.js - Updated POST /api/client/feeds/update

router.post('/feeds/update', async (req, res) => {
  try {
    const {
      project_id,
      feed_name,
      stage,
      completed,
      timestamp,
      project,
      client,
      path,       // existing
      paths,      // existing
      count,      // existing
      file_path,  // NEW: single file path
      file_size,  // NEW: single file size
      file_details // NEW: multiple files details
    } = req.body;

    if (!project_id || !feed_name || !stage) {
      return res.status(400).json({
        error: 'Missing required fields: project_id, feed_name, stage',
      });
    }

    const date = new Date().toISOString().split('T')[0];

    // First, find or create the document
    let feed = await FeedStatus.findOne({ feed_name, date });

    if (!feed) {
      feed = new FeedStatus({
        feed_name,
        date,
        project: project || project_id || 'Unknown',
        client: client || 'Client',
        feed_type: 'Daily',
        status: 'Pending',
        progress: 0,
        failed: false,
        error_message: '',
        output_path: '',
        record_count: null,
        stages: {
          extraction_done: { completed: false, completed_at: null },
          file_generated: { completed: false, completed_at: null },
          file_integrity: { completed: false, completed_at: null },
          upload_path: { completed: false, completed_at: null },
          process_complete: { completed: false, completed_at: null }
        }
      });
    }

    if (!feed.stages) {
      feed.stages = {};
    }
    
    feed.stages[stage] = {
      completed: completed !== false,
      completed_at: timestamp || new Date().toISOString()
    };

    // Handle record count for file_integrity
    if (stage === 'file_integrity' && count !== undefined) {
      feed.record_count = Number(count);
    }

    // Handle process_complete with file information
    if (stage === 'process_complete') {
      // Handle existing path/paths
      if (paths && Array.isArray(paths) && paths.length > 0) {
        feed.output_path = paths;
      } else if (path) {
        feed.output_path = path;
      }
      
      // ============================================
      // NEW: Handle file_info data
      // ============================================
      
      // Case 1: Single file with file_path and file_size
      if (file_path) {
        const fileData = {
          path: file_path,
          size: file_size || null
        };
        // Store as single file in output_path (as object)
        feed.output_path = fileData;
        console.log(`📂 Single file stored: ${file_path} (${file_size || 'size not specified'})`);
      }
      
      // Case 2: Multiple files from file_details
      if (file_details && file_details.files && Array.isArray(file_details.files)) {
        const files = file_details.files.map(f => ({
          path: f.path,
          size: f.size || null
        }));
        feed.output_path = files;
        console.log(`📂 Multiple files stored: ${files.length} files`);
      }
    }

    // Recalculate progress
    const totalStages = 5;
    const completedStages = Object.values(feed.stages).filter(
      (s) => s && s.completed === true
    ).length;
    const progress = Math.round((completedStages / totalStages) * 100);

    feed.progress = progress;
    feed.status = progress === 100 ? 'Completed' : (progress > 0 ? 'In Progress' : 'Pending');
    feed.updated_at = new Date();

    await feed.save();

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      const eventData = {
        feed_name,
        date,
        status: feed.status,
        progress: feed.progress,
        stages: feed.stages,
        failed: feed.failed || false,
        error_message: feed.error_message || '',
        updated_at: feed.updated_at,
        output_path: feed.output_path,
        record_count: feed.record_count
      };

      io.emit('feed_status_updated', eventData);

      const projectRoom = req.query.projectId || req.body.project_id;
      if (projectRoom) {
        io.to(`project_${projectRoom}`).emit('feed_status_updated', eventData);
      }
    }

    res.json({
      success: true,
      message: `Feed "${feed_name}" updated: ${stage} → ${completed !== false ? '✅' : '⏳'}`,
      data: {
        feed_name,
        stage,
        progress,
        status: feed.status,
        completed_stages: completedStages,
        total_stages: totalStages,
        output_path: feed.output_path,
        record_count: feed.record_count,
      },
    });
  } catch (error) {
    console.error('❌ Error updating feed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/client/feeds/:feedId/status - UPDATED with record_count
// ============================================================
router.post('/feeds/:feedId/status', protect, async (req, res) => {
  try {
    const { feedId } = req.params;
    const { status, progress, stages, failed, error_message, date, project, client, feed_type, output_path, record_count } = req.body;
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const updateData = {
      feed_name: feedId,
      date: targetDate,
      project: project || 'Unknown Project',
      client: client || 'Client',
      feed_type: feed_type || 'Daily',
      status: status || 'In Progress',
      progress: progress || 0,
      stages: stages || {},
      failed: failed || false,
      error_message: error_message || ''
    };
    
    if (output_path !== undefined) {
      updateData.output_path = output_path;
    }
    
    if (record_count !== undefined && record_count !== null) {
      updateData.record_count = record_count;
    }
    
    const updatedFeed = await feedStatusService.upsertFeedStatus(updateData);
    
    const io = req.app.get('io');
    if (io) {
      const projectId = req.query.projectId || req.body.projectId;
      const eventData = {
        feed_name: feedId,
        date: targetDate,
        status: updatedFeed.status,
        progress: updatedFeed.progress,
        stages: updatedFeed.stages,
        failed: updatedFeed.failed,
        error_message: updatedFeed.error_message,
        updated_at: updatedFeed.updated_at,
        record_count: updatedFeed.record_count !== undefined && updatedFeed.record_count !== null ? updatedFeed.record_count : null
      };
      
      if (updatedFeed.output_path) {
        eventData.output_path = updatedFeed.output_path;
      }
      
      if (projectId) {
        io.to(`project_${projectId}`).emit('feed_status_updated', eventData);
      } else {
        io.emit('feed_status_updated', eventData);
      }
    }
    
    res.json({ success: true, feed: updatedFeed });
  } catch (error) {
    console.error('❌ Error updating feed status:', error);
    res.status(500).json({ error: 'Failed to update feed status' });
  }
});

// ============================================================
// POST /api/client/feeds/status/notify - UPDATED with record_count
// ============================================================
router.post('/feeds/status/notify', async (req, res) => {
  try {
    const { feed_name, date, status, progress, stages, failed, error_message, project_id, output_path, record_count } = req.body;
    
    if (!feed_name) {
      return res.status(400).json({ error: 'Missing feed_name' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const updateData = {
      feed_name,
      date: targetDate,
      status: status || 'In Progress',
      progress: progress || 0,
      stages: stages || {},
      failed: failed || false,
      error_message: error_message || ''
    };
    
    if (output_path !== undefined) {
      updateData.output_path = output_path;
    }
    
    if (record_count !== undefined && record_count !== null) {
      updateData.record_count = record_count;
    }
    
    const updatedFeed = await feedStatusService.upsertFeedStatus(updateData);
    
    const io = req.app.get('io');
    if (io) {
      const eventData = {
        feed_name: feed_name,
        date: targetDate,
        status: updatedFeed.status,
        progress: updatedFeed.progress,
        stages: updatedFeed.stages,
        failed: updatedFeed.failed,
        error_message: updatedFeed.error_message,
        updated_at: updatedFeed.updated_at,
        record_count: updatedFeed.record_count !== undefined && updatedFeed.record_count !== null ? updatedFeed.record_count : null
      };
      
      if (updatedFeed.output_path) {
        eventData.output_path = updatedFeed.output_path;
      }
      
      io.emit('feed_status_updated', eventData);
      
      if (project_id) {
        io.to(`project_${project_id}`).emit('feed_status_updated', eventData);
      }
    }
    
    res.json({ 
      success: true, 
      feed: updatedFeed,
      message: `Feed "${feed_name}" updated successfully`
    });
  } catch (error) {
    console.error('❌ Error in feed notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process feed notification',
      details: error.message 
    });
  }
});

module.exports = router;