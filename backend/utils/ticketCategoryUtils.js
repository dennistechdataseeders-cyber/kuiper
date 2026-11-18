// backend/utils/ticketCategoryUtils.js
const { PM_ROLES, isPMRole } = require('./roles');

// A Project Coordinator matches any rule written for a Project Manager (and vice versa).
const roleMatches = (roles, creatorRole) =>
  roles.includes(creatorRole) || (isPMRole(creatorRole) && roles.some(r => PM_ROLES.includes(r)));
const matches = (overrides = [], creatorRole) =>
  (overrides || []).find(o => roleMatches(o.creatorRoles || [], creatorRole));

/**
 * Which role's users should this ticket be assigned to?
 * Priority: subcategory override > category override > category.role
 * @returns {{ role: string, viaOverride: boolean }}
 */
function resolveAssignRole(categoryDoc, subcategoryName, creatorRole) {
  if (!categoryDoc) return { role: '', viaOverride: false };
  const sub = (categoryDoc.subcategories || []).find(s => s.name === subcategoryName);
  const subHit = sub && matches(sub.assignOverrides, creatorRole);
  if (subHit) return { role: subHit.assignRole, viaOverride: true };
  const catHit = matches(categoryDoc.assignOverrides, creatorRole);
  if (catHit) return { role: catHit.assignRole, viaOverride: true };
  return { role: categoryDoc.role || '', viaOverride: false };
}

module.exports = { resolveAssignRole };