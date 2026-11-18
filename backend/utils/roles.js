// backend/utils/roles.js
// Roles that share Project Manager rights. 'Project Coordinator' has exactly the
// same access as 'Project Manager' - only the name differs.
const PM_ROLES = ['Project Manager', 'Project Coordinator'];

const isPMRole = (role) => PM_ROLES.includes(role);

module.exports = { PM_ROLES, isPMRole };
