// Searchable multi-select of developers, used to assign feeds and to filter the feeds tables.
//
//   developers   [{ _id, name, email, githubUsername }]  who can be picked
//   value        array of ids, onChange(newIds)
//   disabled, placeholder
// Optional:
//   feedCounts   { [developerId]: number }  shown next to each name
//   knownPeople  [{ _id, name }]  names for selected ids that are not in `developers` (e.g. someone
//                assigned earlier who is inactive now): they keep their chip but cannot be picked again
//   extraOptions [{ value, label }]  shown above the developers (e.g. "Unassigned feeds")
//   inline       show the list right here instead of in a dropdown (used inside a popover)
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { isMobileNow } from '../utils/useIsMobile';
import useAnchoredPanel from '../utils/useAnchoredPanel';

const NONE = [];

const Chips = ({ value, developers, knownPeople, extraOptions, disabled, onRemove }) => {
  const labelOf = (id) => {
    const extra = extraOptions.find((o) => o.value === id);
    if (extra) return { text: extra.label };
    const dev = developers.find((d) => d._id === id);
    if (dev) return { text: dev.name };
    const known = knownPeople.find((p) => p._id === id);
    if (developers.length === 0) return { text: known?.name || '…' }; // list still loading
    return { text: known?.name || 'Unknown developer', inactive: true };
  };

  return value.map((id) => {
    const { text, inactive } = labelOf(id);
    return (
      <span
        key={id}
        title={inactive ? `${text} is no longer an active developer` : text}
        className={`badge ${inactive ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}
      >
        <span className="truncate max-w-[160px]">{text}{inactive && ' (inactive)'}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove(id)}
          aria-label={`Remove ${text}`}
          className="inline-flex items-center justify-center shrink-0 w-6 h-6 md:w-4 md:h-4 min-h-0 rounded hover:bg-black/10 disabled:opacity-50"
        >
          <X size={12} />
        </button>
      </span>
    );
  });
};

// Search box + "Select all shown" / "Clear" + the list
const PickerList = ({ developers, value, onChange, disabled, feedCounts, extraOptions, listId }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  // No autofocus on phones: it would open the keyboard over the list
  useEffect(() => {
    if (!isMobileNow()) searchRef.current?.focus({ preventScroll: true });
  }, []);

  const shownDevelopers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return developers
      .filter((d) => !q || [d.name, d.email, d.githubUsername].some((text) => text?.toLowerCase().includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [developers, query]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [
      ...extraOptions
        .filter((o) => !q || o.label.toLowerCase().includes(q))
        .map((o) => ({ id: o.value, name: o.label })),
      ...shownDevelopers.map((d) => ({ id: d._id, name: d.name, email: d.email, github: d.githubUsername, isDeveloper: true })),
    ];
  }, [extraOptions, shownDevelopers, query]);

  const toggle = (id) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const moveTo = (index) => {
    setActive(index);
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      moveTo((active + step + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // never submits the form around it
      if (options[active]) toggle(options[active].id);
    }
  };

  const allShownSelected = shownDevelopers.every((d) => value.includes(d._id));

  return (
    <>
      <div className="relative shrink-0 p-2">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          aria-label="Search developers"
          autoComplete="off"
          placeholder="Search name, email or GitHub..."
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={handleKeyDown}
          className="input pl-8"
        />
      </div>

      <div className="shrink-0 flex items-center justify-between gap-2 px-2 pb-1">
        <button
          type="button"
          disabled={disabled || shownDevelopers.length === 0 || allShownSelected}
          onClick={() => onChange([...value, ...shownDevelopers.map((d) => d._id).filter((id) => !value.includes(id))])}
          className="px-1 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-300"
        >
          Select all shown ({shownDevelopers.length})
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange([])}
          className="px-1 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:text-slate-300"
        >
          Clear
        </button>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Developers"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {options.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No developers found</p>}
        {options.map((option, index) => {
          const selected = value.includes(option.id);
          const count = feedCounts?.[option.id] || 0;
          return (
            <div
              key={option.id}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={selected}
              // keeps the cursor in the search box
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => { if (active !== index) setActive(index); }}
              onClick={() => toggle(option.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${index === active ? 'bg-slate-100' : ''} ${disabled ? 'opacity-50' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700 truncate">{option.name}</span>
                {option.isDeveloper && (
                  <span className="block text-xs text-slate-500 truncate">
                    {option.email}{option.github ? ` · @${option.github}` : ''}
                  </span>
                )}
              </span>
              {option.isDeveloper && feedCounts && (
                <span className="shrink-0 text-xs text-slate-500" title="Feeds assigned in your projects">
                  {count} {count === 1 ? 'feed' : 'feeds'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

const DeveloperPicker = ({
  developers = NONE,
  value = NONE,
  onChange,
  disabled = false,
  placeholder = 'Select developers...',
  feedCounts,
  knownPeople = NONE,
  extraOptions = NONE,
  inline = false,
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();
  const isOpen = open && !disabled && !inline;
  useAnchoredPanel(isOpen, anchorRef, panelRef, () => setOpen(false));

  const chips = (
    <Chips
      value={value}
      developers={developers}
      knownPeople={knownPeople}
      extraOptions={extraOptions}
      disabled={disabled}
      onRemove={(id) => onChange(value.filter((v) => v !== id))}
    />
  );
  const list = (
    <PickerList
      developers={developers}
      value={value}
      onChange={onChange}
      disabled={disabled}
      feedCounts={feedCounts}
      extraOptions={extraOptions}
      listId={listId}
    />
  );

  if (inline) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 flex flex-wrap gap-1 px-2 pt-2 max-h-24 overflow-y-auto">
          {value.length > 0 ? chips : <span className="text-xs text-slate-400 italic">{placeholder}</span>}
        </div>
        {list}
      </div>
    );
  }

  return (
    <div
      ref={anchorRef}
      className={`flex flex-wrap items-center gap-1 w-full min-h-10 px-2 py-1 bg-white border rounded-lg transition-all ${
        isOpen ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {chips}
      <button
        type="button"
        data-panel-trigger
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !isOpen) { e.preventDefault(); setOpen(true); }
        }}
        className="flex flex-1 items-center justify-between gap-2 min-w-[90px] min-h-0 h-8 px-1 text-sm text-left outline-none disabled:cursor-not-allowed"
      >
        <span className="truncate text-slate-400">
          {value.length === 0 ? placeholder : `${value.length} selected`}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          // React events bubble to the React parent: keep them out of a clickable row or a form
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const next = e.relatedTarget;
            if (next && !panelRef.current?.contains(next) && !anchorRef.current?.contains(next)) setOpen(false);
          }}
          className="fixed z-[250] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
        >
          {list}
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeveloperPicker;
