// frontend/src/components/ProjectTeamModal.jsx
// Project settings: one Project Manager, any number of Project Coordinators and Team Leads.
// Saves through PUT /api/admin/projects/:id/team.
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Search, Star, Loader2, Users, UserCheck } from 'lucide-react';

const idOf = (v) => (v ? String(v._id || v) : '');

const PersonList = ({ people, selected, onToggle, search, onSearch, emptyText, renderBadge }) => {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? people.filter((p) => p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)) : people;
  }, [people, search]);

  return (
    <div className="border border-slate-100 rounded-xl bg-slate-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white">
        <Search size={14} className="text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 && <p className="px-4 py-3 text-xs text-slate-400 italic">{emptyText}</p>}
        {filtered.map((p) => {
          const checked = selected.includes(idOf(p));
          return (
            <label key={idOf(p)} className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white ${checked ? 'bg-white' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(idOf(p))} className="accent-indigo-600" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-700 truncate">{p.name}</span>
                <span className="block text-xs text-slate-400 truncate">{p.email}</span>
              </span>
              {renderBadge && renderBadge(p)}
            </label>
          );
        })}
      </div>
    </div>
  );
};

const ProjectTeamModal = ({ project, projectManagers, coordinators, teamLeads, adminBase, authHeader, onClose, onSaved }) => {
  const initialTeamLeads = (project.teamLeads && project.teamLeads.length ? project.teamLeads : project.teamLead ? [project.teamLead] : []).map(idOf);

  const [pmId, setPmId] = useState(idOf(project.projectManager));
  const [coordinatorIds, setCoordinatorIds] = useState((project.projectCoordinators || []).map(idOf));
  const [teamLeadIds, setTeamLeadIds] = useState(initialTeamLeads);
  const [coordSearch, setCoordSearch] = useState('');
  const [tlSearch, setTlSearch] = useState('');
  const [saving, setSaving] = useState(false);
  // Only Admin / Super Admin may change the Project Manager; a PM sees it read-only
  const canChangePm = ['Super Admin', 'Admin'].includes(localStorage.getItem('role'));

  const coordinatorChoices = coordinators.filter((u) => idOf(u) !== pmId);
  // Older projects may have someone who is not a Project Manager (e.g. a Project Coordinator)
  // saved as PM: keep that person as an option so the saved value is never shown as blank.
  const savedPmId = idOf(project.projectManager);
  const legacyPm = savedPmId && !projectManagers.some((u) => idOf(u) === savedPmId)
    ? coordinators.find((u) => idOf(u) === savedPmId) || { _id: savedPmId, name: project.projectManager.name || 'Current manager' }
    : null;
  const pmChoices = legacyPm ? [legacyPm, ...projectManagers] : projectManagers;
  const nameOf = (list, id) => list.find((u) => idOf(u) === id)?.name || 'Unknown user';

  const toggle = (setter) => (id) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const makePrimary = (id) => setTeamLeadIds((prev) => [id, ...prev.filter((x) => x !== id)]);

  const changePm = (id) => {
    setPmId(id);
    setCoordinatorIds((prev) => prev.filter((x) => x !== id)); // the PM is not also a coordinator
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put(
        `${adminBase}/projects/${project._id}/team`,
        { projectManager: pmId || null, projectCoordinators: coordinatorIds, teamLeads: teamLeadIds },
        authHeader
      );
      toast.success('Project team updated');
      onSaved(res.data.project);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update project team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-xl">
        <div className="modal-header">
          <div className="min-w-0">
            <h2 className="section-title">Project Settings</h2>
            <p className="text-xs text-slate-400 font-semibold mt-1 break-words">{project.name}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="btn-icon text-slate-300 hover:text-slate-600 disabled:opacity-40">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
        <div className="stack">
          {/* Project Manager */}
          <div className="space-y-2">
            <label className="label block mb-1.5">Project Manager</label>
            <select
              value={pmId}
              onChange={(e) => changePm(e.target.value)}
              disabled={saving || !canChangePm}
              title={canChangePm ? undefined : 'Only Admin can change the Project Manager'}
              className="input bg-slate-50"
            >
              <option value="">— None —</option>
              {pmChoices.map((u) => (
                <option key={idOf(u)} value={idOf(u)}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Coordinators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="label mb-1.5 flex items-center gap-1.5">
                <UserCheck size={12} /> Project Coordinators
              </label>
              <span className="text-xs font-semibold text-slate-400">{coordinatorIds.length} selected</span>
            </div>
            <p className="text-xs text-slate-400 ml-1">Coordinators get the same access to this project as its Project Manager.</p>
            <PersonList
              people={coordinatorChoices}
              selected={coordinatorIds}
              onToggle={toggle(setCoordinatorIds)}
              search={coordSearch}
              onSearch={setCoordSearch}
              emptyText="No Project Coordinators or Project Managers found."
              renderBadge={(u) => (
                <span className="badge rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 whitespace-nowrap">{u.role}</span>
              )}
            />
          </div>

          {/* Team Leads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="label mb-1.5 flex items-center gap-1.5">
                <Users size={12} /> Team Leads
              </label>
              <span className="text-xs font-semibold text-slate-400">{teamLeadIds.length} selected</span>
            </div>
            <PersonList
              people={teamLeads}
              selected={teamLeadIds}
              onToggle={toggle(setTeamLeadIds)}
              search={tlSearch}
              onSearch={setTlSearch}
              emptyText="No Team Leads found."
            />
            {teamLeadIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {teamLeadIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => makePrimary(id)}
                    title={i === 0 ? 'Primary Team Lead' : 'Make primary Team Lead'}
                    className={`btn btn-sm border rounded-full max-w-full whitespace-normal text-left ${
                      i === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                    }`}
                  >
                    <Star size={12} className={i === 0 ? 'fill-current' : ''} />
                    {nameOf(teamLeads, id)}
                  </button>
                ))}
              </div>
            )}
            {teamLeadIds.length > 1 && (
              <p className="text-xs text-slate-400 ml-1">The starred Team Lead is the primary one. Click a name to make it primary.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 sm:mt-6">
          <button onClick={onClose} disabled={saving} className="btn btn-md text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn btn-md bg-[#1B2559] text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTeamModal;
