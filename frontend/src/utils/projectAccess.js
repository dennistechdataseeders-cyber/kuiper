// frontend/src/utils/projectAccess.js
// Mirrors backend/utils/projectAccess.js. A project has one projectManager plus any
// number of projectCoordinators (same access), and a legacy teamLead plus teamLeads.

const idOf = (v) => (v ? String(v._id || v) : '');

export const isProjectManagerOf = (project, userId) =>
  !!project && !!userId &&
  (idOf(project.projectManager) === String(userId) ||
    (project.projectCoordinators || []).some((c) => idOf(c) === String(userId)));

export const isTeamLeadOf = (project, userId) =>
  !!project && !!userId &&
  (idOf(project.teamLead) === String(userId) ||
    (project.teamLeads || []).some((t) => idOf(t) === String(userId)));

// Team leads to show for a project: teamLeads, falling back to the legacy single teamLead
export const projectTeamLeads = (project) => {
  const list = (project?.teamLeads || []).filter((t) => t && typeof t === 'object');
  if (list.length) return list;
  return project?.teamLead && typeof project.teamLead === 'object' ? [project.teamLead] : [];
};
