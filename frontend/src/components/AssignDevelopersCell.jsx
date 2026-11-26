// The "Assigned developers" cell of the feeds tables: shows the names, and opens a small popover
// with the DeveloperPicker to change them.
//   onSave(feed, ids) returns a promise of true when saved (the page shows the toasts).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Pencil, Users } from 'lucide-react';
import DeveloperPicker from './DeveloperPicker';
import useAnchoredPanel from '../utils/useAnchoredPanel';

const idsOf = (people) => people.filter(Boolean).map((p) => p._id || p);

const AssignDevelopersCell = ({ feed, developers, feedCounts, onSave, maxNames = 2 }) => {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);

  const close = () => { if (!saving) setOpen(false); };
  useAnchoredPanel(open, anchorRef, panelRef, close, { minWidth: 340, maxHeight: 460 });

  const assigned = (feed.assignedDevelopers || []).filter(Boolean);
  const names = assigned.map((d) => d.name || developers.find((dev) => dev._id === (d._id || d))?.name || 'Unknown');
  const currentIds = idsOf(assigned);
  const changed = ids.length !== currentIds.length || ids.some((id) => !currentIds.includes(id));

  const toggleOpen = () => {
    if (open) return close();
    setIds(currentIds);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const saved = await onSave(feed, ids);
    setSaving(false);
    if (saved) setOpen(false);
  };

  return (
    <div ref={anchorRef} className="inline-block max-w-full" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-panel-trigger
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={names.length > 0 ? names.join(', ') : 'Assign developers'}
        className="group flex items-center gap-1.5 min-w-[130px] max-w-full p-0.5 rounded-lg text-left hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-200 outline-none"
      >
        <span className="flex flex-wrap items-center gap-1 min-w-0">
          {names.slice(0, maxNames).map((name, i) => (
            <span key={currentIds[i]} className="badge bg-blue-50 text-blue-700 whitespace-nowrap">
              <Users size={12} className="shrink-0" />
              <span className="truncate max-w-[110px]">{name}</span>
            </span>
          ))}
          {names.length > maxNames && (
            <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">+{names.length - maxNames} more</span>
          )}
          {names.length === 0 && (
            <span className="text-xs font-semibold text-slate-400 italic whitespace-nowrap">Unassigned</span>
          )}
        </span>
        <Pencil size={12} className="shrink-0 text-slate-400 group-hover:text-blue-600" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Assign developers to ${feed.name}`}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[190] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
        >
          <div className="shrink-0 px-3 pt-2">
            <p className="text-sm font-semibold text-slate-800">Assign developers</p>
            <p className="meta truncate">{feed.name}</p>
          </div>
          <DeveloperPicker
            inline
            developers={developers}
            value={ids}
            onChange={setIds}
            disabled={saving}
            feedCounts={feedCounts}
            knownPeople={assigned}
            placeholder="No developer selected"
          />
          <div className="shrink-0 flex justify-end gap-2 px-3 py-2 border-t border-slate-100">
            <button type="button" onClick={close} disabled={saving} className="btn btn-sm btn-secondary">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !changed} className="btn btn-sm btn-primary">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AssignDevelopersCell;
