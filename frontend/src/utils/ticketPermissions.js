// frontend/src/utils/ticketPermissions.js
// Who may act on a ticket (Start / Resolve / Close / edit): only its assignee.
// Keep in sync with backend/utils/ticketPermissions.js.

// Safety override: these roles can act on ANY ticket. Set to [] to remove the override.
export const TICKET_OVERRIDE_ROLES = ['Admin', 'Super Admin'];

const idOf = (v) => (v ? String(v._id || v) : '');

// assignedTo can be a populated user or a plain id
export const isTicketAssignee = (ticket, userId) =>
  !!userId && idOf(ticket?.assignedTo) === String(userId);

// Every non-Client user sees the action buttons (disabled unless canActOnTicket)
export const canSeeTicketActions = (role) => role !== 'Client';

export const canActOnTicket = (ticket, userId, role) =>
  TICKET_OVERRIDE_ROLES.includes(role) ||
  (canSeeTicketActions(role) && isTicketAssignee(ticket, userId));

// Assign / reassign: the assignee, the creator and these roles. Separate from the override above,
// so removing that never leaves unassigned tickets that nobody can assign.
export const TICKET_REASSIGN_ROLES = ['Admin', 'Super Admin'];

// While a ticket is still unassigned, its project's managers (PM, coordinators, team leads) can
// assign it too: managesProject is the viewerManagesProject flag from GET /api/tickets/:id.
export const canReassignTicket = (ticket, userId, role, managesProject = false) =>
  !!ticket && role !== 'Client' &&
  (TICKET_REASSIGN_ROLES.includes(role) ||
    isTicketAssignee(ticket, userId) ||
    (!!userId && idOf(ticket.createdBy) === String(userId)) ||
    (managesProject && !ticket.assignedTo));
