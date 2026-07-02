// backend/routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Project = require('../models/Project');
const FeedStatus = require('../models/FeedStatus');
const feedStatusService = require('../services/feedStatusService');

// ============================================
// GET /api/client/projects
// ============================================
router.get('/projects', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const userOrganizationId = req.user.organizationId;

    const query = {
      $or: [
        { clients: userId }
      ]
    };

    if (userOrganizationId) {
      query.$or.push({ organizations: userOrganizationId });
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
    console.error('Error fetching client projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ============================================
// GET /api/client/projects/:projectId/feeds
// ✅ Reads from FeedStatus table in client_feed_dashboard DB
// ============================================
router.get('/projects/:projectId/feeds', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;
    const userOrganizationId = req.user.organizationId;

    // Verify project belongs to client
    const query = {
      _id: projectId,
      $or: [
        { clients: userId }
      ]
    };

    if (userOrganizationId) {
      query.$or.push({ organizations: userOrganizationId });
    }

    const project = await Project.findOne(query);

    if (!project) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📊 Project name: "${project.name}"`);
    console.log(`📊 Project Custom ID: "${project.projectCustomId}"`);
    console.log(`📊 Today's date: ${today}`);
    console.log(`📊 FeedStatus DB URI: ${process.env.FEED_STATUS_MONGO_URI || 'Not set'}`);
    
    // ✅ Query FeedStatus table in client_feed_dashboard DB
    const feedStatuses = await FeedStatus.find({ 
      project: project.projectCustomId, 
      date: today 
    });

    console.log(`📊 Found ${feedStatuses.length} feed statuses for project "${project.name}" on ${today}`);

    // If no feed statuses found, try without date filter
    let allFeeds = feedStatuses;
    if (allFeeds.length === 0) {
      console.log(`⚠️ No feed statuses for today, checking all dates...`);
      const allStatuses = await FeedStatus.find({ 
        project: project.name
      }).sort({ date: -1 });
      
      console.log(`📊 Found ${allStatuses.length} total feed statuses for this project`);
      
      // Get the most recent status for each feed
      const feedMap = new Map();
      allStatuses.forEach(status => {
        const key = status.feed_name;
        if (!feedMap.has(key) || status.date > feedMap.get(key).date) {
          feedMap.set(key, status);
        }
      });
      
      allFeeds = Array.from(feedMap.values());
      console.log(`📊 Found ${allFeeds.length} unique feeds for this project`);
    }

    // If still no feeds, return empty array
    if (!allFeeds || allFeeds.length === 0) {
      console.log('⚠️ No feeds found for this project in FeedStatus table');
      return res.status(200).json([]);
    }

    // Enrich feeds with project data
    const enrichedFeeds = allFeeds.map(feed => {
      // Calculate progress from stages
      let progress = feed.progress || 0;
      let status = feed.status || 'Pending';
      
      if (feed.stages && typeof feed.stages === 'object') {
        const totalStages = 5; // Updated to 5 stages
        const completedStages = Object.values(feed.stages).filter(
          s => s && s.completed === true
        ).length;
        progress = feed.progress !== undefined ? feed.progress : Math.round((completedStages / totalStages) * 100);
        
        if (feed.failed) {
          status = 'Failed';
        } else if (progress === 100) {
          status = 'Completed';
        } else if (progress > 0) {
          status = 'In Progress';
        } else {
          status = 'Pending';
        }
      }
      
      return {
        feed_name: feed.feed_name,
        _id: feed._id,
        status: status,
        progress: progress,
        stages: feed.stages || {},
        failed: feed.failed || false,
        error_message: feed.error_message || '',
        updated_at: feed.updated_at || new Date(),
        date: feed.date || today,
        project: feed.project,
        client: feed.client,
        feed_type: feed.feed_type || 'Daily',
        projectId: project._id,
        projectName: project.name,
        projectCustomId: project.projectCustomId,
        feedStatus: status,
        feedType: feed.feed_type || 'Daily',
        output_path: feed.output_path || null,
        // ✅ FIX: Include record_count in the response
        record_count: feed.record_count !== undefined && feed.record_count !== null ? feed.record_count : null
      };
    });

    console.log(`✅ Returning ${enrichedFeeds.length} enriched feeds from FeedStatus table`);
    console.log(`📊 First feed record_count: ${enrichedFeeds[0]?.record_count || 'null'}`);
    res.status(200).json(enrichedFeeds);
    
  } catch (error) {
    console.error('❌ Error fetching project feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds', details: error.message });
  }
});

// ============================================================
// GET /api/client/feeds/status/:feedName
// ============================================================
router.get('/feeds/status/:feedName', async (req, res) => {
  try {
    const { feedName } = req.params;
    const date = new Date().toISOString().split('T')[0];
    
    console.log(`📊 Checking status for feed: "${feedName}" on ${date}`);
    console.log(`📊 FeedStatus DB URI: ${process.env.FEED_STATUS_MONGO_URI || 'Not set'}`);

    const feed = await FeedStatus.findOne({ feed_name: feedName, date });

    if (!feed) {
      console.log(`⚠️ No status found for "${feedName}", returning default`);
      return res.json({
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

    console.log(`✅ Status for "${feedName}": ${feed.status} (${feed.progress}%, ${completedStages}/${totalStages} stages)`);

    res.json({
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
      // ✅ FIX: Include record_count in the response
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
      path,   
      paths,  
      count, // ➕ NEW: Accept a row/item count metric from python tracking pipeline
    } = req.body;

    if (!project_id || !feed_name || !stage) {
      return res.status(400).json({
        error: 'Missing required fields: project_id, feed_name, stage',
      });
    }

    const date = new Date().toISOString().split('T')[0];
    
    console.log(`📥 Updating feed status: ${feed_name} | ${stage} = ${completed}`);

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
        record_count: null, // ➕ Initialize
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

    // ➕ NEW: If updating file_integrity, record the captured processing metrics
    if (stage === 'file_integrity' && count !== undefined) {
      feed.record_count = Number(count);
      console.log(`📊 Integrity metric verified for ${feed_name}: ${count} records calculated.`);
    }

    // If this is process_complete, assign paths array or fallback to single string path
    if (stage === 'process_complete') {
      if (Array.isArray(paths) && paths.length > 0) {
        feed.output_path = paths;
        console.log(`📂 Stored multiple output_paths:`, paths);
      } else if (path) {
        feed.output_path = path;
        console.log(`📂 Stored single output_path: ${path}`);
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

    // Save the document
    await feed.save();

    console.log(`✅ Feed "${feed_name}" updated: ${stage} → ${progress}% (${feed.status})`);

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
        record_count: feed.record_count // Send out count transparently over WebSocket connection
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
// GET /api/client/feeds/:feedId - UPDATED with output_path & record_count
// ============================================================
router.get('/feeds/:feedId', protect, async (req, res) => {
  try {
    const { feedId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📊 Fetching feed details for: ${feedId}`);
    
    // Find in FeedStatus table by feed_name
    let feedStatus = await FeedStatus.findOne({ 
      feed_name: feedId,
      date: today
    });
    
    if (!feedStatus) {
      feedStatus = await FeedStatus.findOne({ feed_name: feedId })
        .sort({ date: -1 });
    }
    
    if (!feedStatus) {
      feedStatus = await FeedStatus.findById(feedId).catch(() => null);
    }
    
    if (!feedStatus) {
      console.log(`⚠️ Feed not found: ${feedId}`);
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Enrich with project details
    const project = await Project.findOne({ name: feedStatus.project });
    
    // Calculate progress
    const stages = feedStatus.stages || {};
    const totalStages = 5; // Updated to 5 stages
    const completedStages = Object.values(stages).filter(
      (s) => s && s.completed === true
    ).length;
    const progress = feedStatus.progress !== undefined ? feedStatus.progress : Math.round((completedStages / totalStages) * 100);
    
    let status = feedStatus.status || 'Pending';
    if (feedStatus.failed) {
      status = 'Failed';
    } else if (progress === 100) {
      status = 'Completed';
    } else if (progress > 0) {
      status = 'In Progress';
    } else {
      status = 'Pending';
    }
    
    const enrichedFeed = {
      feed_name: feedStatus.feed_name,
      _id: feedStatus._id,
      status: status,
      progress: progress,
      stages: feedStatus.stages || {},
      failed: feedStatus.failed || false,
      error_message: feedStatus.error_message || '',
      updated_at: feedStatus.updated_at || new Date(),
      date: feedStatus.date || today,
      project: feedStatus.project,
      client: feedStatus.client,
      feed_type: feedStatus.feed_type || 'Daily',
      projectId: project?._id || null,
      projectName: project?.name || feedStatus.project,
      projectCustomId: project?.projectCustomId || feedStatus.project,
      feedStatus: status,
      feedType: feedStatus.feed_type || 'Daily',
      output_path: feedStatus.output_path || null,
      // ✅ FIX: Include record_count in the response
      record_count: feedStatus.record_count !== undefined && feedStatus.record_count !== null ? feedStatus.record_count : null
    };

    console.log(`✅ Returning feed: ${enrichedFeed.feed_name} (${status}, ${progress}%)`);
    console.log(`📊 Feed record_count: ${enrichedFeed.record_count}`);
    res.status(200).json(enrichedFeed);
    
  } catch (error) {
    console.error('❌ Error fetching feed details:', error);
    res.status(500).json({ error: 'Failed to fetch feed details', details: error.message });
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
    
    console.log(`📥 Received feed status update for: ${feedId} (${targetDate})`);
    
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
    
    // Include output_path if provided
    if (output_path !== undefined) {
      updateData.output_path = output_path;
    }
    
    // ✅ Include record_count if provided
    if (record_count !== undefined && record_count !== null) {
      updateData.record_count = record_count;
      console.log(`📊 Setting record_count to: ${record_count}`);
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
        // ✅ Include record_count in WebSocket event
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
    
    console.log(`📥 Received feed status notification for: ${feed_name} (${targetDate})`);
    
    const updateData = {
      feed_name,
      date: targetDate,
      status: status || 'In Progress',
      progress: progress || 0,
      stages: stages || {},
      failed: failed || false,
      error_message: error_message || ''
    };
    
    // Include output_path if provided
    if (output_path !== undefined) {
      updateData.output_path = output_path;
    }
    
    // ✅ Include record_count if provided
    if (record_count !== undefined && record_count !== null) {
      updateData.record_count = record_count;
      console.log(`📊 Setting record_count to: ${record_count}`);
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
        // ✅ Include record_count in WebSocket event
        record_count: updatedFeed.record_count !== undefined && updatedFeed.record_count !== null ? updatedFeed.record_count : null
      };
      
      if (updatedFeed.output_path) {
        eventData.output_path = updatedFeed.output_path;
      }
      
      io.emit('feed_status_updated', eventData);
      
      if (project_id) {
        io.to(`project_${project_id}`).emit('feed_status_updated', eventData);
      }
      
      console.log(`📡 Emitted real-time update for feed: ${feed_name}`);
      console.log(`📊 Record count in WebSocket event: ${eventData.record_count}`);
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

// ============================================================
// ⚠️ DEBUG: Check FeedStatus connection
// ============================================================
router.get('/debug/feedstatus', async (req, res) => {
  try {
    // Check connection status
    const isConnected = FeedStatus.db ? FeedStatus.db.readyState === 1 : false;
    
    // Get a sample count
    const count = await FeedStatus.countDocuments();
    
    // Get sample records
    const samples = await FeedStatus.find().limit(5);
    
    res.json({
      success: true,
      connection: {
        readyState: FeedStatus.db ? FeedStatus.db.readyState : 'unknown',
        isConnected: isConnected,
        databaseName: FeedStatus.db ? FeedStatus.db.databaseName : 'unknown'
      },
      totalRecords: count,
      samples: samples
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;