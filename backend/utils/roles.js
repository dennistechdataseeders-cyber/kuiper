// backend/utils/roles.js
// Roles that share Project Manager rights. 'Project Coordinator' has exactly the
// same access as 'Project Manager' - only the name differs.
const PM_ROLES = ['Project Manager', 'Project Coordinator'];

const isPMRole = (role) => PM_ROLES.includes(role);

// Roles that can be assigned to a feed as a developer. Add 'Team Lead' here to make
// team leads assignable too.
const DEVELOPER_ROLES = ['Developer'];

module.exports = { PM_ROLES, isPMRole, DEVELOPER_ROLES };
