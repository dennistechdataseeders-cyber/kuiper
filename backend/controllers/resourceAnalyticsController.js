const WorkLog = require('../models/WorkLog');
const WorkDescription = require('../models/WorkDescription');
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const User = require('../models/User');

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
    MERGE DATA
    ========================================
    */

    const analyticsData = logs.map((log) => {

      const matchingDescription =
        descriptions.find(
          (d) =>
            d.feed?._id?.toString() ===
            log.feedId?._id?.toString()

            &&

            d.developer?._id?.toString() ===
            log.developerId?._id?.toString()

            &&

            d.date === log.date
        );

      return {

        _id: log._id,

        date: log.date,

        totalTime: log.totalTime || 0,

        formattedTime:
          formatTime(log.totalTime || 0),

        developer: log.developerId,

        feed: log.feedId,

        project: log.projectId,

        description:
          matchingDescription?.description || ''

      };

    });

    /*
    ========================================
    TOTAL SUMMARY
    ========================================
    */

    const totalSeconds =
      analyticsData.reduce(
        (acc, item) =>
          acc + (item.totalTime || 0),
        0
      );

    /*
    ========================================
    DROPDOWN DATA
    ========================================
    */

    const projects =
      await Project.find()
        .select('name');

    const feeds =
      await Feed.find()
        .select('name');

    const developers =
      await User.find({
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

        totalLogs:
          analyticsData.length,

        totalHours:
          (totalSeconds / 3600).toFixed(2),

        totalTimeFormatted:
          formatTime(totalSeconds)

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

      error:
        'Failed to fetch resource analytics'

    });

  }

};

/*
========================================
FORMAT TIME
========================================
*/

function formatTime(seconds = 0) {

  const hrs =
    Math.floor(seconds / 3600);

  const mins =
    Math.floor((seconds % 3600) / 60);

  const secs =
    seconds % 60;

  return `${hrs}h ${mins}m ${secs}s`;

}