// backend/controllers/resourceAnalyticsController.js

const WorkLog = require('../models/WorkLog');
const WorkDescription = require('../models/WorkDescription');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const User = require('../models/User');

// Helper: Get all time intervals for a developer
function getAllTimeIntervals(logs) {
  const intervals = [];
  
  logs.forEach(log => {
    if (log.timeBlocks && log.timeBlocks.length > 0) {
      log.timeBlocks.forEach(block => {
        if (block.startTime && block.endTime) {
          intervals.push({
            start: new Date(block.startTime).getTime(),
            end: new Date(block.endTime).getTime()
          });
        } else if (block.startTime && !block.endTime) {
          // If still running, use current time
          intervals.push({
            start: new Date(block.startTime).getTime(),
            end: Date.now()
          });
        }
      });
    }
  });
  
  return intervals;
}

// Helper: Merge overlapping intervals
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

// Helper: Calculate net time without overlap for a collection of worklogs
function calculateNetTime(logs) {
  const intervals = getAllTimeIntervals(logs);
  
  if (intervals.length === 0) {
    // Fallback to totalTime sum if no time blocks
    return logs.reduce((total, log) => total + (log.totalTime || 0), 0);
  }
  
  const merged = mergeIntervals(intervals);
  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000); // Convert to seconds
}

exports.getResourceAnalytics = async (req, res) => {
  try {
    const {
      projectId,
      feedId,
      developerId,
      startDate,
      endDate
    } = req.query;

    /*
    ========================================
    FILTER
    ========================================
    */

    let filter = {};

    if (projectId && projectId !== 'all') {
      filter.projectId = projectId;
    }

    if (feedId && feedId !== 'all') {
      filter.feedId = feedId;
    }

    if (developerId && developerId !== 'all') {
      filter.developerId = developerId;
    }

    /*
    ========================================
    DATE RANGE FILTER
    ========================================
    */

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = startDate;
      }
      if (endDate) {
        filter.date.$lte = endDate;
      }
    }

    /*
    ========================================
    FETCH WORKLOGS
    ========================================
    */

    const logs = await WorkLog.find(filter)
      .populate('developerId', 'name email')
      .populate('feedId', 'name')
      .populate('projectId', 'name')
      .sort({ date: -1 });

    /*
    ========================================
    FETCH DESCRIPTIONS
    ========================================
    */

    const descriptions = await WorkDescription.find()
      .populate('developer', 'name')
      .populate('feed', 'name');

    /*
    ========================================
    GROUP BY FEED FOR NET TIME CALCULATION
    ========================================
    */

    // Group logs by feed
    const feedLogsMap = new Map();
    
    logs.forEach(log => {
      const feedId = log.feedId?._id?.toString();
      if (!feedId) return;
      
      if (!feedLogsMap.has(feedId)) {
        feedLogsMap.set(feedId, {
          feedId: feedId,
          feedName: log.feedId?.name || 'Unknown',
          projectId: log.projectId?._id?.toString(),
          projectName: log.projectId?.name || 'Unknown',
          developerId: log.developerId?._id?.toString(),
          developerName: log.developerId?.name || 'Unknown',
          logs: [],
          totalTime: 0,
          netTime: 0,
          overlapTime: 0,
          description: '',
          lastDate: log.date || ''
        });
      }
      
      const entry = feedLogsMap.get(feedId);
      entry.logs.push(log);
      entry.totalTime += log.totalTime || 0;
      
      // Update description if found
      const matchingDescription = descriptions.find(
        (d) =>
          d.feed?._id?.toString() === log.feedId?._id?.toString() &&
          d.developer?._id?.toString() === log.developerId?._id?.toString() &&
          d.date === log.date
      );
      
      if (matchingDescription?.description) {
        entry.description = matchingDescription.description;
      }
      
      if (log.date > entry.lastDate) {
        entry.lastDate = log.date;
      }
    });

    // Calculate net time for each feed
    const analyticsData = [];
    
    for (const [feedId, entry] of feedLogsMap) {
      // Calculate net time without overlap
      const netTime = calculateNetTime(entry.logs);
      const overlapTime = Math.max(0, entry.totalTime - netTime);
      
      analyticsData.push({
        feedId: entry.feedId,
        feedName: entry.feedName,
        projectId: entry.projectId,
        projectName: entry.projectName,
        developerId: entry.developerId,
        developerName: entry.developerName,
        totalTime: entry.totalTime,
        netTime: netTime,
        overlapTime: overlapTime,
        formattedNetTime: formatTime(netTime),
        formattedTotalTime: formatTime(entry.totalTime),
        formattedOverlapTime: formatTime(overlapTime),
        description: entry.description,
        lastDate: entry.lastDate,
        logCount: entry.logs.length
      });
    }

    // Sort by net time (highest first)
    analyticsData.sort((a, b) => b.netTime - a.netTime);

    /*
    ========================================
    TOTAL SUMMARY (Using Net Time - Across ALL feeds, not summed per feed)
    ========================================
    */

    // Calculate total raw time across ALL logs
    const totalRawSeconds = logs.reduce((acc, l) => acc + (l.totalTime || 0), 0);
    
    // Calculate total net time across ALL logs (overlap-aware across ALL feeds)
    // This ensures overlapping work across different feeds is only counted once
    const totalNetSeconds = calculateNetTime(logs);
    
    // Overlap is the difference between raw and net
    const totalOverlapSeconds = Math.max(0, totalRawSeconds - totalNetSeconds);

    /*
    ========================================
    DROPDOWN DATA
    ========================================
    */

    const projects = await Project.find().select('name');
    const feeds = await Feed.find().select('name');
    const developers = await User.find({
      role: 'Developer'
    }).select('name email');

    /*
    ========================================
    RESPONSE
    ========================================
    */

    res.json({
      success: true,
      summary: {
        totalLogs: logs.length,
        totalFeeds: analyticsData.length,
        totalNetHours: (totalNetSeconds / 3600).toFixed(2),
        totalNetTimeFormatted: formatTime(totalNetSeconds),
        totalOverlapHours: (totalOverlapSeconds / 3600).toFixed(2),
        totalOverlapTimeFormatted: formatTime(totalOverlapSeconds),
        totalRawHours: (totalRawSeconds / 3600).toFixed(2)
      },
      analyticsData,
      projects,
      feeds,
      developers
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource analytics'
    });
  }
};

/*
========================================
FORMAT TIME
========================================
*/

function formatTime(seconds = 0) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}