// backend/utils/projectAccess.js
// Who "manages" or "leads" a project.
//
// A project has one projectManager plus any number of projectCoordinators, and a
// legacy single teamLead plus any number of teamLeads. Coordinators get the same
// project-level access as the projectManager; every team lead in teamLeads gets the
// same access as the legacy teamLead. The single fields are kept so existing data and
// code keep working: teamLead always mirrors teamLeads[0].

const idOf = (v) => (v ? String(v._id || v) : '');

// Mongo filters
const pmProjectFilter = (userId) => ({ $or: [{ projectManager: userId }, { projectCoordinators: userId }] });
const tlProjectFilter = (userId) => ({ $or: [{ teamLead: userId }, { teamLeads: userId }] });

// Checks on a loaded project document (ids or populated users)
const isProjectPM = (project, userId) =>
  !!project && !!userId &&
  (idOf(project.projectManager) === String(userId) ||
    (project.projectCoordinators || []).some((c) => idOf(c) === String(userId)));

const isProjectTL = (project, userId) =>
  !!project && !!userId &&
  (idOf(project.teamLead) === String(userId) ||
    (project.teamLeads || []).some((t) => idOf(t) === String(userId)));

// Fields to add to a .select() so the checks above work
const PROJECT_ACCESS_FIELDS = 'projectManager projectCoordinators teamLead teamLeads';

// Who may CHANGE a project's team (projectManager, projectCoordinators, teamLead/teamLeads):
// Super Admin, Admin, or a Project Manager who is that project's own primary projectManager.
// Coordinators and team leads keep their read/work access (isProjectPM / isProjectTL) but can
// never edit the team - so this deliberately does not use isProjectPM(), which counts coordinators.
const TEAM_EDIT_ROLES = ['Super Admin', 'Admin', 'Project Manager'];
const TEAM_FIELDS = ['projectManager', 'projectCoordinators', 'teamLead', 'teamLeads'];
const isTeamAdmin = (user) => !!user && ['Super Admin', 'Admin'].includes(user.role);
const canEditProjectTeam = (user, project) =>
  isTeamAdmin(user) ||
  (!!user && !!project && user.role === 'Project Manager' && idOf(project.projectManager) === String(user._id));

module.exports = {
  pmProjectFilter, tlProjectFilter, isProjectPM, isProjectTL, PROJECT_ACCESS_FIELDS, idOf,
  TEAM_EDIT_ROLES, TEAM_FIELDS, isTeamAdmin, canEditProjectTeam,
};
