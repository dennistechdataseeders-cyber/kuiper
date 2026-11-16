// backend/utils/accessBlock.js
// Login blocking: an account is blocked when isActive is false, or when a scheduled
// block date (accessBlockedFrom) has been reached — e.g. the day after an employee's
// last working day.

const BLOCKED_MESSAGE = 'Your account access has been disabled. Please contact HR or Admin.';

const isLoginBlocked = (user, now = new Date()) => {
  if (!user) return false;
  if (user.isActive === false) return true;
  return !!(user.accessBlockedFrom && now >= new Date(user.accessBlockedFrom));
};

// A scheduled block that has come into effect is made permanent (isActive=false),
// so blocked users also drop out of assignment lists that filter on isActive.
const settleScheduledBlock = async (User, user) => {
  if (user && user.isActive !== false && isLoginBlocked(user)) {
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
    user.isActive = false;
  }
};

// Start of the day after `lastWorkingDay` (YYYY-MM-DD), in IST.
const blockStartAfter = (lastWorkingDay) => {
  const d = new Date(`${lastWorkingDay}T00:00:00+05:30`);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
};

module.exports = { BLOCKED_MESSAGE, isLoginBlocked, settleScheduledBlock, blockStartAfter };

// ---- Hiding blocked people (birthday / work-anniversary posts and widgets) ----

// Mongo filter for users who still have access right now
// (not blocked, and any scheduled block has not started yet).
const activeUserFilter = (now = new Date()) => ({
  isActive: { $ne: false },
  $or: [{ accessBlockedFrom: null }, { accessBlockedFrom: { $exists: false } }, { accessBlockedFrom: { $gt: now } }],
});

// Ids of users whose login is blocked now.
const blockedUserIds = async (User, now = new Date()) => {
  const rows = await User.find({
    $or: [{ isActive: false }, { accessBlockedFrom: { $ne: null, $lte: now } }],
  }).select('_id').lean();
  return rows.map((r) => r._id);
};

// Announcement filter that hides automated birthday / anniversary posts of blocked users.
const PERSONAL_POST_TYPES = ['birthday', 'work_anniversary'];
const visibleAnnouncementFilter = async (User) => {
  const ids = await blockedUserIds(User);
  if (!ids.length) return {};
  return { $nor: [{ automatedType: { $in: PERSONAL_POST_TYPES }, automatedUserId: { $in: ids } }] };
};

module.exports.activeUserFilter = activeUserFilter;
module.exports.blockedUserIds = blockedUserIds;
module.exports.visibleAnnouncementFilter = visibleAnnouncementFilter;
