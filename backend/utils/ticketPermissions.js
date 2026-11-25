// backend/utils/ticketPermissions.js
// Who may act on a ticket (Start / Resolve / Close / edit): only its assignee.
// Keep in sync with frontend/src/utils/ticketPermissions.js.

// Safety override: these roles can act on ANY ticket. Set to [] to remove the override.
const TICKET_OVERRIDE_ROLES = ['Admin', 'Super Admin'];

const idOf = (v) => (v ? String(v._id || v) : '');

const canActOnTicket = (user, ticket) =>
  !!user && !!ticket &&
  (TICKET_OVERRIDE_ROLES.includes(user.role) ||
    (user.role !== 'Client' && idOf(ticket.assignedTo) === String(user._id)));

// Assign / reassign: the assignee, the creator and these roles. Separate from the override above,
// so removing that never leaves unassigned tickets that nobody can assign.
const TICKET_REASSIGN_ROLES = ['Admin', 'Super Admin'];

// While a ticket is still unassigned, its project's managers (PM, coordinators, team leads) can
// assign it too: pass managesProject = true for them.
const canReassignTicket = (user, ticket, managesProject = false) =>
  !!user && !!ticket && user.role !== 'Client' &&
  (TICKET_REASSIGN_ROLES.includes(user.role) ||
    idOf(ticket.assignedTo) === String(user._id) ||
    idOf(ticket.createdBy) === String(user._id) ||
    (managesProject && !ticket.assignedTo));

module.exports = { TICKET_OVERRIDE_ROLES, TICKET_REASSIGN_ROLES, canActOnTicket, canReassignTicket };
