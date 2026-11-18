// frontend/src/utils/roles.js
// Roles that share Project Manager rights. 'Project Coordinator' has exactly the
// same access as 'Project Manager' - only the name differs. Keep in sync with
// backend/utils/roles.js.
export const PM_ROLES = ['Project Manager', 'Project Coordinator'];

export const isPMRole = (role) => PM_ROLES.includes(role);
