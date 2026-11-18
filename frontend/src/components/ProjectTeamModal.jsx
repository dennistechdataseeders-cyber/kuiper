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
    <div className="border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden">
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
                <span className="block text-[11px] text-slate-400 truncate">{p.email}</span>
              </span>
              {renderBadge && renderBadge(p)}
            </label>
          );
        })}
      </div>
    </div>
  );
};

const ProjectTeamModal = ({ project, projectManagers, teamLeads, adminBase, authHeader, onClose, onSaved }) => {
  const initialTeamLeads = (project.teamLeads && project.teamLeads.length ? project.teamLeads : project.teamLead ? [project.teamLead] : []).map(idOf);

  const [pmId, setPmId] = useState(idOf(project.projectManager));
  const [coordinatorIds, setCoordinatorIds] = useState((project.projectCoordinators || []).map(idOf));
  const [teamLeadIds, setTeamLeadIds] = useState(initialTeamLeads);
  const [coordSearch, setCoordSearch] = useState('');
  const [tlSearch, setTlSearch] = useState('');
  const [saving, setSaving] = useState(false);
  // Only Admin / Super Admin may change the Project Manager; a PM sees it read-only
  const canChangePm = ['Super Admin', 'Admin'].includes(localStorage.getItem('role'));

  const coordinatorChoices = projectManagers.filter((u) => idOf(u) !== pmId);
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[100] p-3 sm:p-6">
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl p-6 sm:p-10 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6 gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1B2559] tracking-tight">Project Settings</h2>
            <p className="text-xs text-slate-400 font-bold mt-1 truncate">{project.name}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-300 hover:text-slate-600 transition-colors disabled:opacity-40">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Project Manager */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Manager</label>
            <select
              value={pmId}
              onChange={(e) => changePm(e.target.value)}
              disabled={saving || !canChangePm}
              title={canChangePm ? undefined : 'Only Admin can change the Project Manager'}
              className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold text-sm"
            >
              <option value="">— None —</option>
              {projectManagers.map((u) => (
                <option key={idOf(u)} value={idOf(u)}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Coordinators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <UserCheck size={12} /> Project Coordinators
              </label>
              <span className="text-[10px] font-bold text-slate-400">{coordinatorIds.length} selected</span>
            </div>
            <p className="text-[11px] text-slate-400 ml-1">Coordinators get the same access to this project as its Project Manager.</p>
            <PersonList
              people={coordinatorChoices}
              selected={coordinatorIds}
              onToggle={toggle(setCoordinatorIds)}
              search={coordSearch}
              onSearch={setCoordSearch}
              emptyText="No Project Coordinators or Project Managers found."
              renderBadge={(u) => (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 whitespace-nowrap">{u.role}</span>
              )}
            />
          </div>

          {/* Team Leads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Users size={12} /> Team Leads
              </label>
              <span className="text-[10px] font-bold text-slate-400">{teamLeadIds.length} selected</span>
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      i === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                    }`}
                  >
                    <Star size={11} className={i === 0 ? 'fill-current' : ''} />
                    {nameOf(teamLeads, id)}
                  </button>
                ))}
              </div>
            )}
            {teamLeadIds.length > 1 && (
              <p className="text-[11px] text-slate-400 ml-1">The starred Team Lead is the primary one. Click a name to make it primary.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} disabled={saving} className="px-5 py-3 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-3 rounded-2xl font-black text-sm bg-[#1B2559] text-white hover:bg-indigo-700 transition-all disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectTeamModal;
