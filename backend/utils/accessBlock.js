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
