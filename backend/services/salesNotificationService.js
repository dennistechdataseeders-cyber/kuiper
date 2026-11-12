// backend/services/salesNotificationService.js
//
// Reminders for Sales activities (meetings, calls, tasks).
//
// Every open activity gets a series of reminders at fixed offsets before its time,
// by default 60, 45, 30, 15 and 0 minutes before (REMINDER_OFFSETS_MINUTES).
// e.g. a 15:30 meeting alerts at 14:30, 14:45, 15:00, 15:15 and 15:30.
//
// Each reminder is
//   • saved into the user's notification bucket (User.unreadNotifications), so it shows
//     up in the bell even if the user was offline, and
//   • pushed over socket.io (`sales:upcoming-activity`) so an open tab can show a desktop
//     notification and speak it aloud (see frontend SalesNotifier.jsx).
//
// "Already sent" state lives on the activity (activity.reminders.*), not in memory, so
// restarts never cause duplicates or missed reminders.
//
// Tasks only store a due DATE (the form has no time field). Those remind at
// TASK_REMINDER_HOUR_IST (default 09:00 IST) on the due day. A task that does carry a
// time is reminded at that time.

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const LeadActivity = require('../models/LeadActivity');
const sendEmail = require('./zohoMailer');
const { getActivityReminderTemplate } = require('../templates/emailTemplates');

const TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Minutes before the scheduled time at which to remind (0 = at the time itself).
const OFFSETS_MIN = String(process.env.REMINDER_OFFSETS_MINUTES ?? '60,45,30,15,0')
  .split(',').map((x) => Number(x.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0)
  .sort((a, b) => b - a);
const MAX_OFFSET_MIN = Math.max(0, ...OFFSETS_MIN);
const CATCHUP_MIN = Number(process.env.REMINDER_CATCHUP_MINUTES ?? 60);       // still alert if the server was down
const TASK_HOUR_IST = Number(process.env.TASK_REMINDER_HOUR_IST ?? 9);
const DONE_STATUSES = ['Completed', 'Cancelled'];
const MAX_BUCKET_SIZE = 200;

const isMidnight = (d) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
  d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

/**
 * When should this activity fire? Returns { at: Date, dateOnly: boolean } or null.
 */
function getRemindAt(activity) {
  if (activity.type !== 'task') {
    return activity.scheduledAt ? { at: new Date(activity.scheduledAt), dateOnly: false } : null;
  }
  if (!activity.dueAt) return null;

  const due = new Date(activity.dueAt);
  const dueInIst = new Date(due.getTime() + IST_OFFSET_MS);

  // "2026-11-12" parsed by the browser/Node is midnight UTC; a date picked in IST can be
  // midnight IST. Either way it means "that day", with no time of day.
  let day = null;
  if (isMidnight(due)) day = due.toISOString().slice(0, 10);
  else if (isMidnight(dueInIst)) day = dueInIst.toISOString().slice(0, 10);

  if (!day) return { at: due, dateOnly: false };

  const hh = String(TASK_HOUR_IST).padStart(2, '0');
  return { at: new Date(`${day}T${hh}:00:00+05:30`), dateOnly: true };
}

const formatTime = (date) =>
  date.toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });

const LABELS = { meeting: 'Meeting', call: 'Call', task: 'Task' };

function buildPayload(activity, offset, at, dateOnly) {
  const stage = offset === 0 ? 'due' : 'early';
  const label = LABELS[activity.type] || 'Activity';
  const name = activity.title || label.toLowerCase();
  const company = activity.leadId && activity.leadId.companyName;
  const withWho = company ? ` with ${company}` : '';
  const when = formatTime(at);
  const mins = Math.max(1, Math.round((at.getTime() - Date.now()) / 60000));

  let title;
  let message;
  let speech;

  if (stage === 'early') {
    title = `${label} in ${mins} min`;
    message = `${label} "${name}"${withWho} ${activity.type === 'task' ? 'is due' : 'starts'} at ${when}`;
    speech = `Reminder. ${label} ${name}${withWho} in ${mins} minutes, at ${when}.`;
  } else if (dateOnly) {
    title = 'Task due today';
    message = `Task "${name}"${withWho} is due today`;
    speech = `Reminder. Task ${name}${withWho} is due today.`;
  } else if (activity.type === 'task') {
    title = 'Task due now';
    message = `Task "${name}"${withWho} is due now`;
    speech = `Reminder. Task ${name}${withWho} is due now.`;
  } else {
    title = `${label} starting now`;
    message = `${label} "${name}"${withWho} is starting now (${when})`;
    speech = `Reminder. ${label} ${name}${withWho} is starting now.`;
  }

  return {
    stage,
    offset,
    type: activity.type,
    activityId: activity._id,
    title,
    message,
    speech,
    link: `/sales/activities/${activity.type}s`,
    remindAt: at,
  };
}

class SalesNotificationService {
  constructor(io) {
    this.io = io;
    this.running = false;
  }

  /**
   * Save a reminder in the user's notification bucket and push it to their open tabs.
   * Static so routes (e.g. the test endpoint) can reuse it.
   */
  static async deliver(io, userId, payload) {
    const notificationId = new mongoose.Types.ObjectId();
    const bucketMessage = `⏰ ${payload.title}: ${payload.message}`;

    const user = await User.findOneAndUpdate(
      { _id: userId },
      {
        $push: {
          unreadNotifications: {
            $each: [{
              _id: notificationId,
              type: 'activity_reminder',
              message: bucketMessage,
              activityId: payload.activityId,
              activityType: payload.type,
              link: payload.link,
              createdAt: new Date(),
              read: false,
            }],
            $slice: -MAX_BUCKET_SIZE,
          },
        },
        $inc: { notificationCount: 1 },
      },
      { new: true, projection: { notificationCount: 1 } }
    );
    if (!user) throw new Error('User not found');

    if (io) {
      const room = String(userId);
      io.to(room).emit('sales:upcoming-activity', {
        ...payload,
        notificationId: String(notificationId),
      });
      io.to(room).emit('notification_count_update', {
        type: 'activity_reminder',
        count: user.notificationCount,
        message: bucketMessage,
      });
    }
    return notificationId;
  }

  /** One pass: find activities that are due for a reminder and send them. */
  async checkReminders() {
    if (this.running) return;           // never overlap two passes
    this.running = true;
    try {
      const now = new Date();
      const lo = new Date(now.getTime() - CATCHUP_MIN * 60000);
      const hi = new Date(now.getTime() + MAX_OFFSET_MIN * 60000);
      const DAY = 24 * 60 * 60 * 1000;

      const candidates = await LeadActivity.find({
        status: { $nin: DONE_STATUSES },
        $or: [
          { type: { $in: ['meeting', 'call'] }, scheduledAt: { $gte: lo, $lte: hi } },
          // Task reminder time is derived (due date → 09:00 IST), so widen the DB window.
          { type: 'task', dueAt: { $gte: new Date(now.getTime() - 2 * DAY), $lte: new Date(now.getTime() + 2 * DAY) } },
        ],
      }).populate('leadId', 'companyName');

      if (!candidates.length) return;

      const activeCreators = new Set(
        (await User.find({
          _id: { $in: [...new Set(candidates.map((a) => String(a.createdBy)))] },
          isActive: { $ne: false },
        }).select('_id')).map((u) => String(u._id))
      );

      for (const activity of candidates) {
        if (!activeCreators.has(String(activity.createdBy))) continue;

        const when = getRemindAt(activity);
        if (!when) continue;

        // Reminder times for this activity. Date-only tasks get one reminder (09:00 IST).
        const offsets = when.dateOnly ? [0] : OFFSETS_MIN;
        const alreadySent = activity.reminders?.sent || [];
        const reached = offsets.filter((o) => when.at.getTime() - o * 60000 <= now.getTime());
        if (!reached.length) continue;

        // Only the most recent reminder is sent. If several were missed (activity created
        // late, server was down) the older ones are skipped, not replayed.
        const latest = Math.min(...reached);
        if (alreadySent.includes(latest)) continue;
        if (now.getTime() - (when.at.getTime() - latest * 60000) > CATCHUP_MIN * 60000) continue;

        // Atomically claim it so two server instances can't both send it.
        const claimed = await LeadActivity.findOneAndUpdate(
          { _id: activity._id, 'reminders.sent': { $ne: latest } },
          { $addToSet: { 'reminders.sent': { $each: reached } } },
          { timestamps: false }
        );
        if (!claimed) continue;

        try {
          await SalesNotificationService.deliver(
            this.io,
            activity.createdBy,
            buildPayload(activity, latest, when.at, when.dateOnly)
          );
          console.log(`🔔 reminder (-${latest}m) → user ${activity.createdBy}: ${activity.type} "${activity.title}"`);
        } catch (err) {
          console.error('Reminder delivery failed, will retry next pass:', err.message);
          await LeadActivity.updateOne(
            { _id: activity._id },
            { $pull: { 'reminders.sent': { $in: reached.filter((o) => !alreadySent.includes(o)) } } },
            { timestamps: false }
          );
        }
      }
    } catch (error) {
      console.error('Sales reminder check failed:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Checks every minute so a 15:00 meeting alerts at 15:00, not "somewhere in the next 5 minutes".
   * (Name kept so server.js does not need to change.)
   */
  startRealtimeNotifications() {
    cron.schedule('* * * * *', () => this.checkReminders(), { timezone: TZ });
    this.checkReminders(); // catch up immediately after a restart
    console.log(
      `⏰ Sales reminders scheduled (every minute; at ${OFFSETS_MIN.join(', ')} min before; ` +
      `date-only tasks at ${TASK_HOUR_IST}:00 IST)`
    );
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
    }, { timezone: TZ });
    console.log('⏰ Daily sales alert email scheduled (10:30 AM IST)');
  }
}

module.exports = SalesNotificationService;
module.exports.getRemindAt = getRemindAt; // exported for tests