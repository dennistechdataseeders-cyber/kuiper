// backend/services/taskAssignmentNotifier.js
//
// Notifications for tasks a Sales Manager assigns to a sales rep.
//   • saved in the user's notification bucket (User.unreadNotifications) → shows in the bell
//   • pushed over socket.io (`sales:task-assigned`) → toast + desktop alert (SalesNotifier.jsx)
//   • emailed (best effort – never blocks or fails the request)

const mongoose = require('mongoose');
const User = require('../models/User');

const MAX_BUCKET_SIZE = 200;
const TASKS_LINK = '/sales/activities/tasks';

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDue = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
    : null;

async function push(userId, { bucketType, event, title, message, speech, activityId, link = TASKS_LINK, priority }) {
  const io = global.io;
  const notificationId = new mongoose.Types.ObjectId();
  const bucketMessage = `${title}: ${message}`;

  const user = await User.findOneAndUpdate(
    { _id: userId },
    {
      $push: {
        unreadNotifications: {
          $each: [{
            _id: notificationId,
            type: bucketType,
            message: bucketMessage,
            activityId,
            activityType: 'task',
            link,
            createdAt: new Date(),
            read: false,
          }],
          $slice: -MAX_BUCKET_SIZE,
        },
      },
      $inc: { notificationCount: 1 },
    },
    { new: true, projection: { notificationCount: 1, email: 1, name: 1 } }
  );
  if (!user) return null;

  if (io) {
    const room = String(userId);
    io.to(room).emit(event, {
      notificationId: String(notificationId),
      activityId,
      type: 'task',
      stage: 'early',
      title,
      message,
      speech: speech || message,
      link,
      priority,
    });
    io.to(room).emit('notification_count_update', {
      type: bucketType,
      count: user.notificationCount,
      message: bucketMessage,
    });
  }
  return user;
}

async function sendAssignmentEmail(user, { task, managerName }) {
  try {
    if (!user?.email) return;
    const sendEmail = require('./zohoMailer');
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const due = fmtDue(task.dueAt);
    await sendEmail({
      to: user.email,
      subject: `📝 New task from ${managerName}: ${task.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2 style="margin:0 0 8px">New task assigned to you</h2>
          <p style="color:#475569">${escapeHtml(managerName)} assigned you a task.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#64748b">Task</td><td><b>${escapeHtml(task.title)}</b></td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Priority</td><td>${escapeHtml(task.priority || 'Medium')}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Due</td><td>${due || 'No due date'}</td></tr>
            ${task.content ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">Details</td><td>${escapeHtml(task.content)}</td></tr>` : ''}
          </table>
          <p><a href="${frontend}${TASKS_LINK}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open my tasks</a></p>
        </div>`,
    });
  } catch (err) {
    console.error('Assignment email failed (ignored):', err.message);
  }
}

/** Tell a rep a task was assigned (or re-assigned) to them. */
async function notifyAssigned({ task, assignee, manager, reassigned = false }) {
  const due = fmtDue(task.dueAt);
  const title = reassigned ? '📝 Task re-assigned to you' : '📝 New task assigned';
  const message = `${manager.name} assigned you "${task.title}"${due ? ` · due ${due}` : ''}${task.priority === 'High' ? ' · HIGH priority' : ''}`;
  const user = await push(assignee._id || assignee, {
    bucketType: 'task_assigned',
    event: 'sales:task-assigned',
    title,
    message,
    speech: `New task from ${manager.name}. ${task.title}.${due ? ` Due ${due}.` : ''}`,
    activityId: task._id,
    priority: task.priority,
  });
  if (user) sendAssignmentEmail(user, { task, managerName: manager.name });
}

/** Tell the manager that a rep finished a task they assigned. */
async function notifyCompleted({ task, assigneeName, manager }) {
  await push(manager._id || manager, {
    bucketType: 'task_update',
    event: 'sales:task-update',
    title: '✅ Task completed',
    message: `${assigneeName} completed "${task.title}"`,
    activityId: task._id,
  });
}

/** Manager nudge for an open / overdue task. */
async function notifyReminder({ task, assignee, manager }) {
  const due = fmtDue(task.dueAt);
  await push(assignee._id || assignee, {
    bucketType: 'task_assigned',
    event: 'sales:task-assigned',
    title: '⏰ Reminder from your manager',
    message: `${manager.name} is waiting on "${task.title}"${due ? ` (due ${due})` : ''}`,
    speech: `Reminder from ${manager.name}. ${task.title} is pending.`,
    activityId: task._id,
    priority: task.priority,
  });
}

module.exports = { notifyAssigned, notifyCompleted, notifyReminder };
