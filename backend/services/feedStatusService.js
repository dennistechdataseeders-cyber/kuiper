// backend/services/feedStatusService.js
const { getFeedModelForProject } = require('../models/FeedDynamic');
const FeedStatus = require('../models/FeedStatus');

class FeedStatusService {
  /**
   * Get all feeds for a specific project from its collection
   * @param {string} projectId - The project ID used as collection name
   * @returns {Promise<Array>} - Array of feed documents
   */
  async getProjectFeeds(projectId) {
    try {
      const FeedModel = getFeedModelForProject(projectId);
      const feeds = await FeedModel.find({});
      return feeds;
    } catch (error) {
      console.error('Error fetching project feeds:', error);
      throw error;
    }
  }

  /**
   * Get a specific feed by ID from a project collection
   * @param {string} projectId - The project ID used as collection name
   * @param {string} feedId - The feed document ID
   * @returns {Promise<Object>} - Feed document
   */
  async getFeedById(projectId, feedId) {
    try {
      const FeedModel = getFeedModelForProject(projectId);
      const feed = await FeedModel.findById(feedId);
      return feed;
    } catch (error) {
      console.error('Error fetching feed by ID:', error);
      throw error;
    }
  }

  /**
   * Get feed status by name and date from the FeedStatus collection
   * @param {string} feedName - The name of the feed
   * @param {string} date - The date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Feed status document
   */
  async getFeedStatus(feedName, date) {
    try {
      return await FeedStatus.findOne({ feed_name: feedName, date });
    } catch (error) {
      console.error('Error getting feed status:', error);
      throw error;
    }
  }

  /**
   * Get all feed statuses for a project on a given date
   * @param {string} project - The project name or ID
   * @param {string} date - The date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of feed status documents
   */
  async getProjectFeedStatuses(project, date) {
    try {
      return await FeedStatus.find({ project, date });
    } catch (error) {
      console.error('Error getting project feed statuses:', error);
      throw error;
    }
  }

  /**
   * Create or update a feed status entry in the client_feed_dashboard database
   * @param {Object} data - Feed status data
   * @param {string} data.feed_name - The name of the feed
   * @param {string} data.date - The date in YYYY-MM-DD format
   * @param {string} data.project - The project name
   * @param {string} data.client - The client name
   * @param {string} data.feed_type - The feed type (Daily, Weekly, Monthly)
   * @param {string} data.status - Current status (Pending, In Progress, Completed, Failed)
   * @param {number} data.progress - Progress percentage (0-100)
   * @param {Object} data.stages - Stage completion status
   * @param {boolean} data.failed - Whether the feed has failed
   * @param {string} data.error_message - Error message if failed
   * @returns {Promise<Object>} - Updated or created feed status document
   */
  async upsertFeedStatus(data) {
    try {
      const { feed_name, date, ...updateData } = data;
      
      // Validate required fields
      if (!feed_name || !date) {
        throw new Error('feed_name and date are required for upsertFeedStatus');
      }

      const result = await FeedStatus.findOneAndUpdate(
        { feed_name, date },
        { 
          $set: {
            ...updateData,
            updated_at: new Date()
          }
        },
        { 
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      console.log(`✅ Feed status ${feed_name} (${date}) upserted successfully`);
      return result;
    } catch (error) {
      console.error('Error upserting feed status:', error);
      throw error;
    }
  }

  /**
   * Update a specific stage progress for a feed
   * @param {string} feedName - The name of the feed
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {string} stage - The stage name (in_progress, extraction, file_generated, file_integrity, upload_path, process_complete)
   * @param {boolean} completed - Whether the stage is completed
   * @returns {Promise<Object>} - Updated feed status document
   */
  async updateFeedStage(feedName, date, stage, completed = true) {
    try {
      const update = {};
      update[`stages.${stage}.completed`] = completed;
      if (completed) {
        update[`stages.${stage}.completed_at`] = new Date();
      }
      
      const result = await FeedStatus.findOneAndUpdate(
        { feed_name: feedName, date },
        { 
          $set: update,
          $inc: { progress: completed ? 16.67 : -16.67 }
        },
        { new: true }
      );
      
      return result;
    } catch (error) {
      console.error('Error updating feed stage:', error);
      throw error;
    }
  }

  /**
   * Get today's feed statuses for a client
   * @param {string} client - The client name
   * @param {string} date - Optional date (defaults to today)
   * @returns {Promise<Array>} - Array of feed status documents
   */
  async getClientTodayFeedStatuses(client, date) {
    try {
      const today = date || new Date().toISOString().split('T')[0];
      return await FeedStatus.find({ client, date: today });
    } catch (error) {
      console.error('Error getting client today feed statuses:', error);
      throw error;
    }
  }

  /**
   * Get feed statuses for a date range
   * @param {string} feedName - The name of the feed
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of feed status documents
   */
  async getFeedStatusesByDateRange(feedName, startDate, endDate) {
    try {
      return await FeedStatus.find({
        feed_name: feedName,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });
    } catch (error) {
      console.error('Error getting feed statuses by date range:', error);
      throw error;
    }
  }

  /**
   * Get the latest feed status for a feed
   * @param {string} feedName - The name of the feed
   * @returns {Promise<Object>} - Latest feed status document
   */
  async getLatestFeedStatus(feedName) {
    try {
      return await FeedStatus.findOne({ feed_name: feedName })
        .sort({ date: -1, updated_at: -1 });
    } catch (error) {
      console.error('Error getting latest feed status:', error);
      throw error;
    }
  }

  /**
   * Get all feed statuses for a client with date filtering
   * @param {string} client - The client name
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of feed status documents
   */
  async getClientFeedStatusesByDate(client, startDate, endDate) {
    try {
      return await FeedStatus.find({
        client,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });
    } catch (error) {
      console.error('Error getting client feed statuses by date:', error);
      throw error;
    }
  }

  /**
   * Delete feed status entries for a feed
   * @param {string} feedName - The name of the feed
   * @param {string} date - Optional date (deletes all if not provided)
   * @returns {Promise<Object>} - Delete result
   */
  async deleteFeedStatus(feedName, date = null) {
    try {
      const query = { feed_name: feedName };
      if (date) {
        query.date = date;
      }
      const result = await FeedStatus.deleteMany(query);
      console.log(`🗑️ Deleted ${result.deletedCount} feed status entries for ${feedName}${date ? ` on ${date}` : ''}`);
      return result;
    } catch (error) {
      console.error('Error deleting feed status:', error);
      throw error;
    }
  }

  /**
   * Update feed status and emit real-time update via WebSocket
   * @param {string} feedName - The name of the feed
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {Object} statusData - Status data to update
   * @param {Object} io - Socket.io instance
   * @returns {Promise<Object>} - Updated feed status document
   */
  async updateFeedStatusWithSocket(feedName, date, statusData, io) {
    try {
      const updated = await FeedStatus.findOneAndUpdate(
        { feed_name: feedName, date },
        { 
          $set: {
            ...statusData,
            updated_at: new Date()
          }
        },
        { 
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      if (io) {
        // Emit to all connected clients
        io.emit('feed_status_updated', {
          feed_name: feedName,
          date: date,
          status: updated.status,
          progress: updated.progress,
          stages: updated.stages,
          failed: updated.failed,
          error_message: updated.error_message,
          updated_at: updated.updated_at
        });
        console.log(`📡 Emitted real-time update for feed: ${feedName}`);
      }
      
      return updated;
    } catch (error) {
      console.error('Error updating feed status with socket:', error);
      throw error;
    }
  }

  /**
   * Bulk upsert feed statuses
   * @param {Array} statuses - Array of feed status data objects
   * @returns {Promise<Array>} - Array of upserted documents
   */
  async bulkUpsertFeedStatuses(statuses) {
    try {
      const results = [];
      for (const statusData of statuses) {
        const result = await this.upsertFeedStatus(statusData);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Error bulk upserting feed statuses:', error);
      throw error;
    }
  }

  /**
   * Get feed status summary for a project
   * @param {string} project - The project name
   * @param {string} date - The date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Summary statistics
   */
  async getProjectFeedStatusSummary(project, date) {
    try {
      const statuses = await this.getProjectFeedStatuses(project, date);
      
      const summary = {
        total: statuses.length,
        pending: statuses.filter(s => s.status === 'Pending').length,
        inProgress: statuses.filter(s => s.status === 'In Progress').length,
        completed: statuses.filter(s => s.status === 'Completed').length,
        failed: statuses.filter(s => s.failed === true).length,
        averageProgress: 0,
        completionRate: 0
      };

      if (statuses.length > 0) {
        const totalProgress = statuses.reduce((sum, s) => sum + (s.progress || 0), 0);
        summary.averageProgress = Math.round(totalProgress / statuses.length);
        summary.completionRate = Math.round((summary.completed / statuses.length) * 100);
      }

      return summary;
    } catch (error) {
      console.error('Error getting project feed status summary:', error);
      throw error;
    }
  }
}

module.exports = new FeedStatusService();