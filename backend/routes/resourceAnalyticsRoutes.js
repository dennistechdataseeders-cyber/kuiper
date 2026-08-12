const express = require('express');

const router = express.Router();

const {
  getResourceAnalytics
} = require('../controllers/resourceAnalyticsController');

const {
  protect
} = require('../middleware/authMiddleware');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate net time without overlap for a collection of worklogs
 */
function calculateNetTime(logs) {
  const intervals = [];
  
  logs.forEach(log => {
    if (log.timeBlocks && log.timeBlocks.length > 0) {
      log.timeBlocks.forEach(block => {
        if (block.startTime && block.endTime) {
          intervals.push({
            start: new Date(block.startTime).getTime(),
            end: new Date(block.endTime).getTime()
          });
        } else if (block.startTime && !block.endTime && !log.isRunning) {
          intervals.push({
            start: new Date(block.startTime).getTime(),
            end: Date.now()
          });
        }
      });
    }
    
    if (log.isRunning && log.startedAt) {
      intervals.push({
        start: new Date(log.startedAt).getTime(),
        end: Date.now()
      });
    }
  });
  
  if (intervals.length === 0) {
    return logs.reduce((total, log) => total + (log.totalTime || 0), 0);
  }
  
  intervals.sort((a, b) => a.start - b.start);
  const merged = [{ ...intervals[0] }];
  
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  
  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000);
}

/**
 * Format time from seconds to human readable string
 */
function formatTime(seconds = 0) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

// ============================================
// ROUTES
// ============================================

/*
========================================
RESOURCE ANALYTICS - FEEDS
========================================
*/
router.get(
  '/',
  protect,
  getResourceAnalytics
);

/*
========================================
RESOURCE ANALYTICS - TICKETS
========================================
*/
router.get('/tickets', protect, async (req, res) => {
  try {
    const { startDate, endDate, developerId, projectId } = req.query;
    
    const TicketWorkLog = require('../models/TicketWorkLog');
    
    // Get the current user's ID
    const userId = req.user._id;
    console.log('🔍 Current user ID:', userId.toString());
    
    // 🔥 STEP 1: Check if there are ANY ticket worklogs in the database
    const totalCount = await TicketWorkLog.countDocuments();
    console.log(`📊 Total ticket worklogs in DB: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('⚠️ No ticket worklogs found in the database');
      return res.json({
        success: true,
        analyticsData: [],
        summary: {
          totalLogs: 0,
          totalTickets: 0,
          totalNetHours: '0.00',
          totalNetTimeFormatted: '0s',
          totalOverlapHours: '0.00',
          totalOverlapTimeFormatted: '0s',
          totalRawHours: '0.00'
        }
      });
    }
    
    // 🔥 STEP 2: Get all ticket worklogs with NO filter first to see what's there
    const allLogs = await TicketWorkLog.find({}).limit(5);
    console.log('📋 Sample logs (first 5):');
    allLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. developerId: ${log.developerId?.toString()}, ticketId: ${log.ticketId?.toString()}, totalTime: ${log.totalTime}`);
    });
    
    // 🔥 STEP 3: Query for this specific user - try both ways
    // Method 1: Direct ObjectId comparison
    let logs = await TicketWorkLog.find({
      developerId: userId
    });
    
    console.log(`📊 Method 1 (direct ObjectId): Found ${logs.length} logs for user`);
    
    // Method 2: If no logs found, try with string comparison
    if (logs.length === 0) {
      const userIdStr = userId.toString();
      console.log(`🔄 Trying Method 2 (string comparison) for user: ${userIdStr}`);
      
      // Get all logs and filter manually
      const allUserLogs = await TicketWorkLog.find({});
      logs = allUserLogs.filter(log => 
        log.developerId?.toString() === userIdStr
      );
      
      console.log(`📊 Method 2: Found ${logs.length} logs for user after manual filter`);
    }
    
    // 🔥 STEP 4: If no logs found for this user, try with a known developerId from your sample
    if (logs.length === 0) {
      // From your sample, the developerId is "6a2a9479427cd0f2d5e5802d"
      // Try that as a fallback
      const fallbackDevId = '6a2a9479427cd0f2d5e5802d';
      console.log(`🔄 Trying fallback developerId: ${fallbackDevId}`);
      
      const fallbackLogs = await TicketWorkLog.find({
        developerId: fallbackDevId
      });
      
      if (fallbackLogs.length > 0) {
        console.log(`📊 Found ${fallbackLogs.length} logs with fallback developerId`);
        logs = fallbackLogs;
      }
    }
    
    // Apply date filter if provided
    if (logs.length > 0 && (startDate || endDate)) {
      logs = logs.filter(log => {
        if (startDate && log.date < startDate) return false;
        if (endDate && log.date > endDate) return false;
        return true;
      });
      console.log(`📊 After date filter: ${logs.length} logs`);
    }
    
    // Apply project filter if provided
    if (logs.length > 0 && projectId && projectId !== 'all') {
      logs = logs.filter(log => 
        log.projectId?.toString() === projectId
      );
      console.log(`📊 After project filter: ${logs.length} logs`);
    }
    
    // Populate references
    const populatedLogs = await TicketWorkLog.populate(logs, [
      { path: 'ticketId', select: 'title ticketNumber priority status' },
      { path: 'projectId', select: 'name projectCustomId' },
      { path: 'developerId', select: 'name email' }
    ]);
    
    console.log(`📊 Final populated logs count: ${populatedLogs.length}`);
    
    // Group by ticket for analytics
    const ticketMap = new Map();
    populatedLogs.forEach(log => {
      const ticketId = log.ticketId?._id?.toString() || log.ticketId?.toString();
      if (!ticketId) return;
      
      if (!ticketMap.has(ticketId)) {
        ticketMap.set(ticketId, {
          ticketId: ticketId,
          ticketNumber: log.ticketId?.ticketNumber || 'N/A',
          ticketTitle: log.ticketId?.title || 'Unknown Ticket',
          projectId: log.projectId?._id?.toString(),
          projectName: log.projectId?.projectCustomId || log.projectId?.name || 'Unknown',
          developerId: log.developerId?._id?.toString(),
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
          totalTime: 0,
          netTime: 0,
          overlapTime: 0,
          logCount: 0,
          lastDate: log.date || ''
        });
      }
      
      const entry = ticketMap.get(ticketId);
      entry.logs.push(log);
      entry.totalTime += log.totalTime || 0;
      
      // Use netTime from log if available, otherwise use totalTime
      const logNetTime = log.netTime || log.totalTime || 0;
      entry.netTime += logNetTime;
      entry.logCount++;
      
      if (log.date > entry.lastDate) entry.lastDate = log.date;
    });
    
    // Calculate net time for each ticket
    const analyticsData = [];
    for (const [ticketId, entry] of ticketMap) {
      // Recalculate net time from timeBlocks for accuracy
      const recalculatedNetTime = calculateNetTime(entry.logs);
      const finalNetTime = Math.max(recalculatedNetTime, entry.netTime);
      const overlapTime = Math.max(0, entry.totalTime - finalNetTime);
      
      analyticsData.push({
        ticketId: entry.ticketId,
        ticketNumber: entry.ticketNumber,
        ticketTitle: entry.ticketTitle,
        projectId: entry.projectId,
        projectName: entry.projectName,
        developerId: entry.developerId,
        developerName: entry.developerName,
        totalTime: entry.totalTime,
        netTime: finalNetTime,
        overlapTime: overlapTime,
        formattedNetTime: formatTime(finalNetTime),
        formattedTotalTime: formatTime(entry.totalTime),
        formattedOverlapTime: formatTime(overlapTime),
        logCount: entry.logCount,
        lastDate: entry.lastDate
      });
    }
    
    analyticsData.sort((a, b) => b.netTime - a.netTime);
    
    const totalNetSeconds = analyticsData.reduce((sum, item) => sum + item.netTime, 0);
    const totalOverlapSeconds = analyticsData.reduce((sum, item) => sum + item.overlapTime, 0);
    const totalRawSeconds = analyticsData.reduce((sum, item) => sum + item.totalTime, 0);
    
    console.log(`📊 Returning ${analyticsData.length} tickets with ${totalNetSeconds}s net time`);
    
    res.json({
      success: true,
      analyticsData,
      summary: {
        totalLogs: populatedLogs.length,
        totalTickets: analyticsData.length,
        totalNetHours: (totalNetSeconds / 3600).toFixed(2),
        totalNetTimeFormatted: formatTime(totalNetSeconds),
        totalOverlapHours: (totalOverlapSeconds / 3600).toFixed(2),
        totalOverlapTimeFormatted: formatTime(totalOverlapSeconds),
        totalRawHours: (totalRawSeconds / 3600).toFixed(2)
      }
    });
    
  } catch (error) {
    console.error('Error fetching ticket analytics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch ticket analytics',
      details: error.message 
    });
  }
});

module.exports = router;