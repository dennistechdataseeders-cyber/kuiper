// frontend/src/components/RecordTags.jsx
//
// Zoho-style tags UI for the sales tables (works with utils/useRecordTags.js)
//
//   selectionColumn({...})   checkbox + ⋯ row menu column for useColumnTable
//   tagsColumn(tagsApi, getId) "Tag" column (chips, × to remove, pick-list filter)
//   <TagToolbar />           "N selected · Add Tags · Remove Tags" + Manage Tags
//   <TagsModal />            Add Tags (type to search / create) or Remove Tags
//   <ManageTagsModal />      rename, recolour, delete tags
//   <TagChip /> <TagList />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Tag as TagIcon, X, Plus, Trash2, Pencil, Check, Loader2, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Same palette as the backend
export const TAG_COLORS = ['#ffffff', '#5b7f9b', '#d6a0f0', '#5cc47a', '#f6c344', '#f28b82', '#7bc8f6', '#c9a27e', '#a7b0bd'];

// readable text on any background
const textOn = (hex = '#ffffff') => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#1e293b';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1e293b' : '#ffffff';
};

const ARROW = 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)';

// ============================================
// Chip (Zoho's arrow-shaped tag)
// ============================================
export function TagChip({ tag, onRemove, size = 'sm' }) {
  const bg = tag.color || '#ffffff';
  const fg = textOn(bg);
  const pad = size === 'md' ? 'pl-2.5 pr-3.5 py-1 text-[13px]' : 'pl-2 pr-3 py-0.5 text-[11px]';
  return (
    // outer layer = 1px border, inner layer = colour (clip-path can't draw borders itself)
    <span className="inline-flex p-px bg-slate-400/60 shrink-0 max-w-full" style={{ clipPath: ARROW, borderRadius: 3 }}>
      <span
        className={`inline-flex items-center gap-1 font-semibold leading-tight ${pad} max-w-full`}
        style={{ clipPath: ARROW, background: bg, color: fg, borderRadius: 2 }}
        title={tag.name}
      >
        <span className="truncate">{tag.name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
            title={`Remove "${tag.name}"`}
            className="opacity-60 hover:opacity-100 -mr-1"
          >
            <X size={11} />
          </button>
        )}
      </span>
    </span>
  );
}

export function TagList({ tags = [], onRemove, max = 3 }) {
  if (!tags.length) return <span className="text-slate-300 text-sm">—</span>;
  const shown = tags.slice(0, max);
  const more = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((t) => <TagChip key={t._id} tag={t} onRemove={onRemove} />)}
      {more > 0 && (
        <span className="text-[11px] font-bold text-slate-500" title={tags.slice(max).map((t) => t.name).join(', ')}>
          +{more}
        </span>
      )}
    </div>
  );
}

// ============================================
// Small portal popup (never clipped by overflow-x-auto)
// ============================================
function Popup({ anchor, onClose, width = 180, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  return createPortal(
    <>
      <div className="fixed inset-0 z-[190]" onMouseDown={(e) => { e.stopPropagation(); onClose(); }} onClick={(e) => e.stopPropagation()} />
      <div
        className="fixed z-[191] bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5"
        style={{ top: anchor.bottom + 4, left, width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

const menuItem = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-left text-slate-700 hover:bg-slate-50 transition';

// ⋯ menu on each row
function RowMenuButton({ hasTags, onAddTags, onRemoveTags, onManage }) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor(anchor ? null : { left: r.left, bottom: r.bottom });
        }}
        title="Record actions"
        className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-500 border transition ${
          anchor ? 'bg-slate-100 border-slate-300' : 'border-transparent hover:bg-slate-100 hover:border-slate-200'
        }`}
      >
        <MoreHorizontal size={15} />
      </button>
      {anchor && (
        <Popup anchor={anchor} onClose={close}>
          <button type="button" className={menuItem} onClick={() => { close(); onAddTags(); }}>
            <TagIcon size={14} className="text-slate-400" /> Add Tags
          </button>
          {hasTags && (
            <button type="button" className={menuItem} onClick={() => { close(); onRemoveTags(); }}>
              <X size={14} className="text-slate-400" /> Remove Tags
            </button>
          )}
          <button type="button" className={menuItem} onClick={() => { close(); onManage(); }}>
            <Settings2 size={14} className="text-slate-400" /> Manage Tags
          </button>
        </Popup>
      )}
    </>
  );
}

function HeaderCheckbox({ checked, indeterminate, onChange, disabled }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      title="Select all on this page"
      className="w-4 h-4 accent-blue-600 cursor-pointer align-middle"
    />
  );
}

// ============================================
// Column helpers for useColumnTable
// ============================================
// getPageRows() = rows on the current page (the header box selects this page, like Zoho).
// It is a function so it can read the page's paged rows, which are computed after the columns.
// openTags(mode, ids) / openManage() come from useTagDialogs()
function SelectAllBox({ sel, getPageRows, getId }) {
  const pageIds = (getPageRows() || []).map(getId).map(String);
  const picked = pageIds.filter((id) => sel.isSelected(id)).length;
  return (
    <span className="inline-flex items-center pl-9">
      <HeaderCheckbox
        disabled={pageIds.length === 0}
        checked={pageIds.length > 0 && picked === pageIds.length}
        indeterminate={picked > 0 && picked < pageIds.length}
        onChange={(e) => sel.setMany(pageIds, e.target.checked)}
      />
    </span>
  );
}

export function selectionColumn({ sel, getPageRows, getId, tagsApi, openTags, openManage }) {
  return {
    key: '_select',
    label: 'Select',
    menu: false,
    fixed: 'start',
    width: 84,
    stopClick: true,
    thClass: 'pl-3 pr-2 py-3 w-[84px]',
    tdBase: 'pl-3 pr-2 py-3',
    renderHeader: () => <SelectAllBox sel={sel} getPageRows={getPageRows} getId={getId} />,
    render: (row) => {
      const id = String(getId(row));
      return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <RowMenuButton
            hasTags={tagsApi.tagsOf(id).length > 0}
            onAddTags={() => openTags('add', [id])}
            onRemoveTags={() => openTags('remove', [id])}
            onManage={openManage}
          />
          <input
            type="checkbox"
            checked={sel.isSelected(id)}
            onChange={() => sel.toggle(id)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
        </div>
      );
    },
  };
}

export function tagsColumn(tagsApi, getId, extra = {}) {
  return {
    key: 'tags',
    label: 'Tag',
    type: 'select', // pick-list filter; value is an array of tag names
    getValue: (row) => tagsApi.namesOf(getId(row)),
    render: (row) => (
      <TagList
        tags={tagsApi.tagsOf(getId(row))}
        onRemove={(t) => tagsApi.removeOne(getId(row), t._id)}
      />
    ),
    ...extra,
  };
}

// Field for the left "Filter <Module> by" panel
export const tagFilterField = (tagsApi, getId) => ({
  key: 'tags',
  label: 'Tag',
  type: 'select',
  options: tagsApi.tagNames,
  getValue: (row) => tagsApi.namesOf(getId(row)),
});

// ============================================
// Toolbar: selection actions + Manage Tags
// ============================================
export function TagToolbar({ sel, openTags, openManage, className = '' }) {
  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm transition';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {sel.count > 0 && (
        <>
          <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black">
            {sel.count} selected
          </span>
          <button type="button" onClick={() => openTags('add', sel.ids)} className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
            <TagIcon size={13} /> Add Tags
          </button>
          <button type="button" onClick={() => openTags('remove', sel.ids)} className={`${btn} border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600`}>
            <X size={13} /> Remove Tags
          </button>
          <button type="button" onClick={sel.clear} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1">
            Clear selection
          </button>
        </>
      )}
      <button type="button" onClick={openManage} className={`${btn} border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600`}>
        <Settings2 size={13} /> Manage Tags
      </button>
    </div>
  );
}

// ============================================
// Colour picker: palette + custom colour
// ============================================
export function ColorSwatches({ value, onChange }) {
  const custom = value && !TAG_COLORS.includes(value);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TAG_COLORS.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
            value === c ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300 hover:scale-110'
          }`}
          style={{ background: c }}
        >
          {value === c && <Check size={11} style={{ color: textOn(c) }} />}
        </button>
      ))}
      <label
        title="Custom colour"
        className={`relative w-5 h-5 rounded-full border cursor-pointer overflow-hidden flex items-center justify-center ${
          custom ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'
        }`}
        style={{ background: custom ? value : 'conic-gradient(#f28b82, #f6c344, #5cc47a, #7bc8f6, #d6a0f0, #f28b82)' }}
      >
        {custom && <Check size={11} style={{ color: textOn(value) }} />}
        <input
          type="color"
          value={custom ? value : '#3b82f6'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  );
}

// ============================================
// Modal shell
// ============================================
function Modal({ title, onClose, children, width = 'max-w-lg' }) {
  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[200] flex items-start justify-center p-4 pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`bg-white rounded-2xl w-full ${width} shadow-2xl`}>
        <div className="flex justify-between items-center px-6 pt-5 pb-2">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ============================================
// Add Tags / Remove Tags
// ============================================
export function TagsModal({ state, tagsApi, onClose, onDone }) {
  // state = { mode: 'add' | 'remove', ids: [...] }
  const { mode, ids } = state;
  const [picked, setPicked] = useState([]); // add: [{ _id?, name, color? }]  remove: [tagId]
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // tags currently on the chosen records (for Remove)
  const present = useMemo(() => {
    const m = new Map();
    ids.forEach((id) => tagsApi.tagsOf(id).forEach((t) => {
      const e = m.get(String(t._id)) || { tag: t, count: 0 };
      e.count += 1;
      m.set(String(t._id), e);
    }));
    return [...m.values()].sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  }, [ids, tagsApi]);

  const pickedKeys = new Set(picked.map((p) => (p._id ? String(p._id) : `new:${p.name.toLowerCase()}`)));
  const q = text.trim().toLowerCase();
  const suggestions = tagsApi.tags
    .filter((t) => !pickedKeys.has(String(t._id)))
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = tagsApi.tags.find((t) => t.name.toLowerCase() === q);
  const canCreate = q && !exact && !pickedKeys.has(`new:${q}`);

  // colour a brand-new tag gets by default (continues the palette)
  const nextColor = (offset = 0) =>
    TAG_COLORS[(tagsApi.tags.length + picked.filter((p) => !p._id).length + offset) % TAG_COLORS.length];

  const setPickColor = (item, color) =>
    setPicked((all) => all.map((x) => (x === item ? { ...x, color } : x)));

  const addPick = (item) => {
    // existing tag: keep its colour (can be changed below); new tag: next palette colour
    const withColor = item._id ? { ...item, originalColor: item.color } : { ...item, color: item.color || nextColor() };
    setPicked((p) => [...p, withColor]);
    setText('');
    inputRef.current?.focus();
  };

  const commitText = () => {
    // Enter / comma: pick the existing tag with that name, else create a new one
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setPicked((prev) => {
      const next = [...prev];
      const keys = new Set(next.map((p) => (p._id ? String(p._id) : `new:${p.name.toLowerCase()}`)));
      parts.forEach((raw) => {
        const name = raw.slice(0, 40);
        const found = tagsApi.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        const key = found ? String(found._id) : `new:${name.toLowerCase()}`;
        if (!keys.has(key)) {
          keys.add(key);
          next.push(found
            ? { ...found, originalColor: found.color }
            : { name, color: TAG_COLORS[(tagsApi.tags.length + next.filter((p) => !p._id).length) % TAG_COLORS.length] });
        }
      });
      return next;
    });
    setText('');
  };

  const save = async () => {
    if (saving) return;
    let add = [];
    let remove = [];
    if (mode === 'add') {
      const pending = text.trim() ? [...picked, { name: text.trim().slice(0, 40), color: nextColor() }] : picked;
      if (!pending.length) return;
      add = pending.map((p) => (p._id ? String(p._id) : { name: p.name, color: p.color }));
      // existing tags whose colour was changed here → save the new colour first
      const recolor = pending.filter((p) => p._id && p.color && p.color !== p.originalColor);
      if (recolor.length) {
        setSaving(true);
        await Promise.all(recolor.map((p) => tagsApi.updateTag(p._id, { color: p.color })));
      }
    } else {
      remove = picked;
      if (!remove.length) return;
    }
    setSaving(true);
    const ok = await tagsApi.assign(ids, add, remove);
    setSaving(false);
    if (ok) {
      toast.success(
        mode === 'add'
          ? `Tags added to ${ids.length} record${ids.length === 1 ? '' : 's'}`
          : `Tags removed from ${ids.length} record${ids.length === 1 ? '' : 's'}`
      );
      onDone?.();
      onClose();
    }
  };

  const ready = mode === 'add' ? picked.length > 0 || !!text.trim() : picked.length > 0;

  return (
    <Modal title={mode === 'add' ? 'Add Tags' : 'Remove Tags'} onClose={onClose}>
      <div className="px-6 pb-5">
        {ids.length > 1 && (
          <p className="text-xs font-semibold text-slate-500 mb-2">{ids.length} records selected</p>
        )}

        {mode === 'add' ? (
          <div className="relative mt-2">
            <div
              className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border-2 border-blue-400 bg-white cursor-text"
              onClick={() => { inputRef.current?.focus(); setOpen(true); }}
            >
              {picked.map((p) => (
                <TagChip
                  key={p._id || `new:${p.name}`}
                  tag={{ ...p, _id: p._id || p.name, color: p.color || '#ffffff' }}
                  size="md"
                  onRemove={() => setPicked((all) => all.filter((x) => x !== p))}
                />
              ))}
              <input
                ref={inputRef}
                autoFocus
                value={text}
                maxLength={60}
                onChange={(e) => { setText(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitText(); }
                  if (e.key === 'Backspace' && !text && picked.length) setPicked((all) => all.slice(0, -1));
                  if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
                }}
                placeholder={picked.length ? '' : 'Enter Tags'}
                className="flex-1 min-w-[120px] outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>

            {open && (suggestions.length > 0 || canCreate) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 max-h-60 overflow-y-auto z-10">
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => addPick({ name: text.trim().slice(0, 40) })}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-left text-blue-700 font-semibold hover:bg-blue-50"
                  >
                    <Plus size={14} /> Create tag “{text.trim().slice(0, 40)}”
                  </button>
                )}
                {suggestions.map((t) => (
                  <button
                    type="button"
                    key={t._id}
                    onClick={() => addPick(t)}
                    className="w-full flex items-center px-3.5 py-1.5 text-left hover:bg-blue-50"
                  >
                    <TagChip tag={t} size="md" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Pick a tag or type a new one. Press Enter or comma to add more than one.
            </p>

            {picked.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Tag colour</p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {picked.map((p) => (
                    <div key={p._id || `new:${p.name}`} className="flex items-center gap-3 flex-wrap">
                      <div className="w-36 min-w-0 shrink-0">
                        <TagChip tag={{ ...p, _id: p._id || p.name }} size="md" />
                      </div>
                      <ColorSwatches value={p.color} onChange={(c) => setPickColor(p, c)} />
                      {!p._id && <span className="text-[10px] font-bold text-emerald-600">NEW</span>}
                      {p._id && p.color !== p.originalColor && (
                        <span className="text-[10px] font-bold text-amber-600" title="This tag's colour changes for everyone">
                          colour changed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : present.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">The selected record{ids.length === 1 ? ' has' : 's have'} no tags.</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto -mx-1">
            {present.map(({ tag, count }) => (
              <label key={tag._id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-red-600"
                  checked={picked.includes(String(tag._id))}
                  onChange={() =>
                    setPicked((p) => (p.includes(String(tag._id)) ? p.filter((x) => x !== String(tag._id)) : [...p, String(tag._id)]))
                  }
                />
                <TagChip tag={tag} size="md" />
                {ids.length > 1 && <span className="ml-auto text-[11px] font-bold text-slate-400">on {count}</span>}
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!ready || saving}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 ${
              mode === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === 'add' ? 'Save' : 'Remove'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Manage Tags (rename / colour / delete)
// ============================================
export function ManageTagsModal({ tagsApi, onClose }) {
  const [editing, setEditing] = useState(null); // tag id
  const [name, setName] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy] = useState(false);

  // Colour changes show instantly; the save is debounced (the custom picker fires while dragging)
  const [pendingColor, setPendingColor] = useState({});
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const colorOf = (t) => pendingColor[String(t._id)] || t.color;
  const recolor = (t, c) => {
    const id = String(t._id);
    if (c === colorOf(t)) return;
    setPendingColor((m) => ({ ...m, [id]: c }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      await tagsApi.updateTag(t._id, { color: c });
      setPendingColor((m) => { const next = { ...m }; delete next[id]; return next; });
    }, 400);
  };

  const usage = useMemo(() => {
    const m = new Map();
    Object.values(tagsApi.assignments).forEach((list) => list.forEach((id) => m.set(String(id), (m.get(String(id)) || 0) + 1)));
    return m;
  }, [tagsApi.assignments]);

  const sorted = [...tagsApi.tags].sort((a, b) => a.name.localeCompare(b.name));

  const saveName = async (t) => {
    const v = name.trim();
    setEditing(null);
    if (!v || v === t.name) return;
    await tagsApi.updateTag(t._id, { name: v });
  };

  return (
    <Modal title={`${tagsApi.module} Tags`} onClose={onClose} width="max-w-xl">
      <div className="px-6 pb-5">
        <p className="text-xs text-slate-500 mb-3">
          Tags are shared by the whole sales team. New tags are created from <b>Add Tags</b>. Changing a colour updates it everywhere.
        </p>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No tags yet.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {sorted.map((t) => (
              <div key={t._id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {editing === String(t._id) ? (
                    <input
                      autoFocus
                      value={name}
                      maxLength={40}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => saveName(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); }
                      }}
                      className="flex-1 px-2 py-1 rounded-md border border-blue-400 text-sm font-semibold outline-none ring-2 ring-blue-100"
                    />
                  ) : (
                    <div className="flex-1 min-w-0"><TagChip tag={{ ...t, color: colorOf(t) }} size="md" /></div>
                  )}
                  <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                    {usage.get(String(t._id)) || 0} record{(usage.get(String(t._id)) || 0) === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditing(String(t._id)); setName(t.name); }}
                    title="Rename"
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(confirmDel === String(t._id) ? null : String(t._id))}
                    title="Delete"
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-2 pl-0.5">
                  <ColorSwatches value={colorOf(t)} onChange={(c) => recolor(t, c)} />
                </div>

                {confirmDel === String(t._id) && (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-red-700 flex-1">
                      Delete “{t.name}”? It will be removed from {usage.get(String(t._id)) || 0} record(s).
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const ok = await tagsApi.deleteTag(t._id);
                        setBusy(false);
                        if (ok) { setConfirmDel(null); toast.success('Tag deleted'); }
                      }}
                      className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy ? 'Deleting...' : 'Delete'}
                    </button>
                    <button type="button" onClick={() => setConfirmDel(null)} className="text-xs font-semibold text-slate-500">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// One hook-like helper so each page needs only a few lines
// ============================================
export function useTagDialogs() {
  const [tagDialog, setTagDialog] = useState(null); // { mode, ids }
  const [manageOpen, setManageOpen] = useState(false);
  return {
    tagDialog,
    manageOpen,
    openTags: (mode, ids) => setTagDialog({ mode, ids: ids.map(String) }),
    openManage: () => setManageOpen(true),
    closeTags: () => setTagDialog(null),
    closeManage: () => setManageOpen(false),
  };
}

// Render once per page
export function TagDialogs({ dialogs, tagsApi, onDone }) {
  return (
    <>
      {dialogs.tagDialog && (
        <TagsModal
          key={`${dialogs.tagDialog.mode}-${dialogs.tagDialog.ids.join(',')}`}
          state={dialogs.tagDialog}
          tagsApi={tagsApi}
          onClose={dialogs.closeTags}
          onDone={onDone}
        />
      )}
      {dialogs.manageOpen && <ManageTagsModal tagsApi={tagsApi} onClose={dialogs.closeManage} />}
    </>
  );
}
