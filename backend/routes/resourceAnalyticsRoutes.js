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

function getAllTimeIntervals(logs) {
  const intervals = [];
  const now = Date.now();
  
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
            end: now
          });
        }
      });
    }
    
    if (log.isRunning && log.startedAt) {
      intervals.push({
        start: new Date(log.startedAt).getTime(),
        end: now
      });
    }
  });
  
  return intervals;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  
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
  
  return merged;
}

function calculateNetTime(logs) {
  const intervals = getAllTimeIntervals(logs);
  
  if (intervals.length === 0) {
    return logs.reduce((total, log) => total + (log.totalTime || 0), 0);
  }
  
  const merged = mergeIntervals(intervals);
  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000);
}

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

router.get(
  '/',
  protect,
  getResourceAnalytics
);

router.get('/tickets', protect, async (req, res) => {
  try {
    const { startDate, endDate, developerId, projectId } = req.query;
    
    const TicketWorkLog = require('../models/TicketWorkLog');
    
    const userId = req.user._id;
    console.log('🔍 Current user ID:', userId.toString());
    
    // Get ALL ticket worklogs to see what's available
    const allLogs = await TicketWorkLog.find({});
    console.log(`📊 Total ticket worklogs in DB: ${allLogs.length}`);
    
    // Log sample of what's in the database
    console.log('📋 Sample logs:');
    allLogs.slice(0, 5).forEach((log, i) => {
      console.log(`  ${i + 1}. developerId: ${log.developerId?.toString()}, ticketId: ${log.ticketId?.toString()}, totalTime: ${log.totalTime}, timeBlocks: ${log.timeBlocks?.length || 0}`);
    });
    
    // Build filter - try to get logs for the current user
    let filter = {};
    if (developerId && developerId !== 'all') {
      filter.developerId = developerId;
    } else {
      filter.developerId = userId;
    }
    
    let logs = await TicketWorkLog.find(filter);
    console.log(`📊 Found ${logs.length} logs for user`);
    
    // If no logs found for current user, try to get ALL logs with time data
    if (logs.length === 0) {
      console.log('🔄 No logs for current user, getting all logs with time data...');
      const logsWithTime = await TicketWorkLog.find({
        $or: [
          { totalTime: { $gt: 0 } },
          { 'timeBlocks.0': { $exists: true } }
        ]
      });
      console.log(`📊 Found ${logsWithTime.length} logs with time data`);
      
      if (logsWithTime.length > 0) {
        logs = logsWithTime;
        console.log('✅ Using logs with time data from all users');
      } else {
        console.log('⚠️ No logs with time data found at all');
      }
    }
    
    // If still no logs, return empty
    if (logs.length === 0) {
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
          logCount: 0,
          lastDate: log.date || ''
        });
      }
      
      const entry = ticketMap.get(ticketId);
      entry.logs.push(log);
      entry.totalTime += log.totalTime || 0;
      entry.logCount++;
      if (log.date > entry.lastDate) entry.lastDate = log.date;
    });
    
    console.log(`📊 Found ${ticketMap.size} unique tickets`);
    
    // Calculate net time for each ticket
    const analyticsData = [];
    for (const [ticketId, entry] of ticketMap) {
      const netTime = calculateNetTime(entry.logs);
      const rawTime = entry.totalTime;
      const overlapTime = Math.max(0, rawTime - netTime);
      
      console.log(`  Ticket ${entry.ticketNumber}: raw=${rawTime}s, net=${netTime}s, overlap=${overlapTime}s`);
      
      analyticsData.push({
        ticketId: entry.ticketId,
        ticketNumber: entry.ticketNumber,
        ticketTitle: entry.ticketTitle,
        projectId: entry.projectId,
        projectName: entry.projectName,
        developerId: entry.developerId,
        developerName: entry.developerName,
        totalTime: rawTime,
        netTime: netTime,
        overlapTime: overlapTime,
        formattedNetTime: formatTime(netTime),
        formattedTotalTime: formatTime(rawTime),
        formattedOverlapTime: formatTime(overlapTime),
        logCount: entry.logCount,
        lastDate: entry.lastDate
      });
    }
    
    // Sort by total time
    analyticsData.sort((a, b) => b.totalTime - a.totalTime);
    
    // Calculate global statistics
    const globalNetTime = calculateNetTime(populatedLogs);
    const globalRawTime = populatedLogs.reduce((sum, log) => sum + (log.totalTime || 0), 0);
    const globalOverlapTime = Math.max(0, globalRawTime - globalNetTime);
    
    console.log(`📊 GLOBAL - Raw: ${globalRawTime}s, Net: ${globalNetTime}s, Overlap: ${globalOverlapTime}s`);
    
    res.json({
      success: true,
      analyticsData,
      summary: {
        totalLogs: populatedLogs.length,
        totalTickets: analyticsData.length,
        totalNetHours: (globalNetTime / 3600).toFixed(2),
        totalNetTimeFormatted: formatTime(globalNetTime),
        totalOverlapHours: (globalOverlapTime / 3600).toFixed(2),
        totalOverlapTimeFormatted: formatTime(globalOverlapTime),
        totalRawHours: (globalRawTime / 3600).toFixed(2)
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