const WorkDescription = require('../models/WorkDescription');

exports.saveWorkDescription = async (req, res) => {

  try {

    const developerId =
      req.user.id;

    const {
      feedId,
      description
    } = req.body;

    if (!description) {

      return res.status(400).json({
        error: 'Description required'
      });

    }

    // SERVER DATE ONLY
    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    /*
    ========================================
    CHECK EXISTING TODAY LOG
    ========================================
    */

    let existing =
      await WorkDescription.findOne({
        developer: developerId,
        feed: feedId,
        date: today
      });

    /*
    ========================================
    IF EXISTS → APPEND
    ========================================
    */

    if (existing) {

      existing.description +=
        `\n\n• ${description}`;

      await existing.save();

      return res.json(existing);

    }

    /*
    ========================================
    CREATE NEW
    ========================================
    */

    const log =
      await WorkDescription.create({

        developer: developerId,

        feed: feedId,

        description:
          `• ${description}`,

        date: today

      });

    res.status(201).json(log);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error:
        'Failed to save work description'
    });

  }

};
exports.getDeveloperWorklogs = async (req, res) => {

  try {

    const developerId = req.user.id;

    // SERVER DATE
    const today =
      new Date().toISOString().split('T')[0];

    const feeds = await Feed.find({
      assignedDeveloper: developerId
    }).populate('projectId', 'name');

    const result = await Promise.all(

      feeds.map(async (feed) => {

        const worklog =
          await Worklog.findOne({
            developer: developerId,
            feed: feed._id,
            date: today
          });

        const todayDescription =
          await WorkDescription.findOne({
            developer: developerId,
            feed: feed._id,
            date: today
          });

        return {

          feed,

          worklog: worklog || {
            totalTime: 0,
            isRunning: false
          },

          todayDescription,

          // IMPORTANT
          canEditToday:
            todayDescription &&
            todayDescription.date === today
        };

      })

    );

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Failed to fetch worklogs'
    });

  }

};

/*
========================================
GET TODAY DESCRIPTIONS
========================================
*/

exports.getTodayDescriptions =
  async (req, res) => {

    try {

      const developerId =
        req.user.id;

      const today =
        new Date()
          .toISOString()
          .split('T')[0];

      const logs =
        await WorkDescription.find({

          developer: developerId,

          date: today

        });

      res.json(logs);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          'Failed to fetch descriptions'
      });

    }

  };