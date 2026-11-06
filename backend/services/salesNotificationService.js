// backend/services/salesNotificationService.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const LeadActivity = require('../models/LeadActivity');
const sendEmail = require('./zohoMailer');
const { getActivityReminderTemplate } = require('../templates/emailTemplates'); // We'll add this template

class SalesNotificationService {
  constructor(io) {
    this.io = io;
    this.notifiedActivities = new Set(); // Prevent spamming notifications for the same event
  }

  /**
   * Checks for upcoming meetings/calls and sends real-time notifications.
   * Runs every 5 minutes.
   */
  startRealtimeNotifications() {
    cron.schedule('*/5 * * * *', async () => {
      console.log('📢 Running real-time sales notification check...');
      try {
        const now = new Date();
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60000);

        // Find upcoming activities assigned to users with 'Sales' role
        const activities = await LeadActivity.find({
          type: { $in: ['meeting', 'call'] },
          status: { $nin: ['Completed', 'Cancelled'] },
          scheduledAt: {
            $gte: now,
            $lte: thirtyMinutesFromNow
          }
        }).populate('createdBy', 'name _id');

        for (const activity of activities) {
          const notificationKey = `realtime-${activity._id}-${activity.scheduledAt.getTime()}`;
          if (this.notifiedActivities.has(notificationKey)) continue;

          const creator = await User.findById(activity.createdBy);
          if (!creator || creator.role !== 'Sales') continue;

          const io = this.io;
          if (io) {
            io.to(creator._id.toString()).emit('sales:upcoming-activity', {
              message: `Upcoming ${activity.type}: ${activity.title}`,
              details: `Scheduled at ${new Date(activity.scheduledAt).toLocaleTimeString()}`,
              activityId: activity._id,
              type: activity.type
            });
          }
          
          console.log(`Sent real-time notification to ${creator.name} for ${activity.title}`);
          this.notifiedActivities.add(notificationKey);
        }
      } catch (error) {
        console.error('Real-time notification cron failed:', error);
      }
    }, { timezone: "Asia/Kolkata" });
    console.log('⏰ Real-time sales notifications scheduled (every 5 min)');
  }

  /**
   * Sends a daily summary email at 10:30 AM IST.
   */
  startDailyEmailJob() {
    cron.schedule('30 10 * * *', async () => {
      console.log('📧 Sending daily sales alert emails (10:30 AM IST)...');
      try {
        const salesUsers = await User.find({ role: 'Sales', isActive: true });
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        for (const user of salesUsers) {
          const todaysActivities = await LeadActivity.find({
            createdBy: user._id,
            scheduledAt: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['Completed', 'Cancelled'] }
          }).sort({ scheduledAt: 'asc' }).populate('leadId', 'companyName');

          const todaysTasks = await LeadActivity.find({
            createdBy: user._id,
            type: 'task',
            dueAt: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['Completed', 'Cancelled'] }
          }).sort({ dueAt: 'asc' }).populate('leadId', 'companyName');
          
          const todaysFollowUps = await LeadActivity.find({
            createdBy: user._id,
            type: 'call',
            callOutcome: 'Connected',
            scheduledAt: { $gte: startOfDay, $lte: endOfDay },
          }).populate('leadId', 'companyName'); // This is a bit ambiguous, but let's stick to scheduled calls

          if (todaysActivities.length === 0 && todaysTasks.length === 0) {
            console.log(`No activities for ${user.name}. Skipping email.`);
            continue;
          }

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const emailHtml = getActivityReminderTemplate(user, todaysActivities, todaysTasks, frontendUrl);

          await sendEmail({
            to: user.email,
            subject: `📅 Your Schedule for Today - ${new Date().toLocaleDateString()}`,
            html: emailHtml
          });

          console.log(`📧 Daily schedule email sent to ${user.name} (${user.email})`);
        }
      } catch (error) {
        console.error('Daily sales email cron failed:', error);
      }
    }, { timezone: "Asia/Kolkata" });
    console.log('⏰ Daily sales alert email scheduled (10:30 AM IST)');
  }
}

module.exports = SalesNotificationService;