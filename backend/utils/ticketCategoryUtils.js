// backend/utils/ticketCategoryUtils.js
const matches = (overrides = [], creatorRole) =>
  (overrides || []).find(o => (o.creatorRoles || []).includes(creatorRole));

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