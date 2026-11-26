// backend/utils/feedDevelopers.js
// Who can be assigned to a feed, and checking the list a page sends when it saves one.
const mongoose = require('mongoose');
const User = require('../models/User');
const { DEVELOPER_ROLES } = require('./roles');

// Mongo filter: people who can be picked as a feed's developer
const activeDeveloperFilter = () => ({ role: { $in: DEVELOPER_ROLES }, isActive: { $ne: false } });

// The list behind every developer picker, sorted by name.
// githubLinked is also read by the Project Management and Team pages.
const listActiveDevelopers = () =>
  User.find(activeDeveloperFilter())
    .select('_id name email githubUsername githubLinked')
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1 });

// Checks the ids sent for a feed. `current` = who is assigned already: they may stay even if they
// are no longer active, but anyone newly added must be an active developer.
// Returns { ids, added } (both without duplicates, in the order sent) or { error } for a 400.
const checkDeveloperIds = async (list, current = []) => {
  if (!Array.isArray(list)) return { error: 'Developers must be sent as a list' };

  const ids = [...new Set(list.map(String))];
  if (ids.some((id) => !mongoose.isObjectIdOrHexString(id))) return { error: 'One or more developers are not valid' };

  const assigned = new Set((current || []).map(String));
  const added = ids.filter((id) => !assigned.has(id));
  if (added.length > 0) {
    const found = await User.countDocuments({ _id: { $in: added }, ...activeDeveloperFilter() });
    if (found !== added.length) return { error: 'One or more developers were not found or are not active developers' };
  }
  return { ids, added };
};

module.exports = { activeDeveloperFilter, listActiveDevelopers, checkDeveloperIds };
