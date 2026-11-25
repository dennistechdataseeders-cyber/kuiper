// frontend/src/pages/TicketCategoriesManager.jsx
// Admin / Super Admin screen to edit the Category -> Subcategory -> Specific Issue
// options used by the Create Ticket form.
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronRight, Layers, RotateCcw, Pencil
} from 'lucide-react';
import API_BASE_URL from '../config';
import { Badge, Button, Modal, PageHeader } from '../components/ui';

const ROLES = ['Developer', 'Team Lead', 'Project Manager', 'Project Coordinator', 'Sales', 'Sales Manager', 'HR', 'Finance', 'Admin', 'IT'];
const CREATOR_ROLES = ['Sales', 'Sales Manager', 'Developer', 'Team Lead', 'Project Manager', 'HR', 'Finance', 'Admin', 'Client'];

const blankCategory = () => ({
  name: '', icon: '📁', color: 'slate', role: 'Developer',
  clientVisible: false, isActive: true, assignOverrides: [], subcategories: []
});
const blankSub = () => ({
  name: '', items: [], special: false, clientVisible: true, assignOverrides: [], isActive: true
});

const inputCls = 'input';

// Edits "when created by [roles] -> assign to [role]" rows
const OverrideEditor = ({ value, onChange }) => {
  const update = (i, patch) => onChange(value.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const toggleRole = (i, r) => {
    const cur = value[i].creatorRoles || [];
    update(i, { creatorRoles: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] });
  };
  return (
    <div className="space-y-2">
      {value.map((o, i) => (
        <div key={i} className="p-3 rounded-lg border border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-amber-800">Assign to</span>
            <select value={o.assignRole} onChange={e => update(i, { assignRole: e.target.value })} className="h-10 md:h-9 px-2 text-sm border border-amber-200 rounded-lg bg-white">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <span className="text-xs text-amber-800">when created by:</span>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove assignee rule" className="btn-icon ml-auto text-red-500 hover:text-red-700 hover:bg-red-50"><X size={16} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CREATOR_ROLES.map(r => (
              <button key={r} type="button" onClick={() => toggleRole(i, r)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${(o.creatorRoles || []).includes(r) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { creatorRoles: [], assignRole: 'Project Manager' }])}
        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
        <Plus size={14} /> Add assignee rule
      </button>
    </div>
  );
};

// Chips editor for the "Specific Issue" list
const ItemsEditor = ({ items, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { toast.error('Already in the list'); return; }
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((it, i) => (
          <span key={i} className="badge py-1 max-md:py-0 max-md:pr-0 bg-blue-50 text-blue-700 border border-blue-100">
            {it}
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label={`Remove ${it}`} className="flex items-center justify-center hover:text-red-500"><X size={14} /></button>
          </span>
        ))}
        {items.length === 0 && <span className="meta italic">No specific issues yet</span>}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Add specific issue and press Enter" className={inputCls} />
        <Button onClick={add} aria-label="Add specific issue" className="shrink-0 !px-3"><Plus size={16} /></Button>
      </div>
    </div>
  );
};

const TicketCategoriesManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);      // category object being edited (copy)
  const [expandedSub, setExpandedSub] = useState({}); // subIndex -> bool
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ticket-categories?all=true`, auth);
      setCategories(res.data || []);
    } catch (e) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const startEdit = (cat) => {
    setEditing(JSON.parse(JSON.stringify(cat)));
    setExpandedSub({});
  };

  const patch = (p) => setEditing(prev => ({ ...prev, ...p }));
  const patchSub = (i, p) => setEditing(prev => ({
    ...prev, subcategories: prev.subcategories.map((s, idx) => (idx === i ? { ...s, ...p } : s))
  }));

  const save = async () => {
    if (!editing.name.trim()) return toast.error('Category name is required');
    const names = editing.subcategories.map(s => s.name.trim().toLowerCase());
    if (editing.subcategories.some(s => !s.name.trim())) return toast.error('Every subcategory needs a name');
    if (new Set(names).size !== names.length) return toast.error('Subcategory names must be unique');
    setSaving(true);
    try {
      if (editing._id) await axios.put(`${API_BASE_URL}/api/ticket-categories/${editing._id}`, editing, auth);
      else await axios.post(`${API_BASE_URL}/api/ticket-categories`, editing, auth);
      toast.success('Category saved');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?\nExisting tickets keep their category text; only the form option is removed.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/ticket-categories/${cat._id}`, auth);
      toast.success('Category deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete');
    }
  };

  const toggleActive = async (cat) => {
    try {
      await axios.put(`${API_BASE_URL}/api/ticket-categories/${cat._id}`, { ...cat, isActive: !cat.isActive }, auth);
      load();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const restoreDefaults = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ticket-categories/restore-defaults`, {}, auth);
      toast.success(res.data.added ? `Restored ${res.data.added} default categor${res.data.added > 1 ? 'ies' : 'y'}` : 'All default categories already exist');
      load();
    } catch (e) {
      toast.error('Failed to restore defaults');
    }
  };

  return (
    <div className="page bg-slate-50">
      <div className="stack">
      <PageHeader
        title={<span className="flex items-center gap-2"><Layers className="text-blue-600 shrink-0" size={24} /> Ticket Categories</span>}
        subtitle="Edit the Category, Subcategory and Specific Issue options shown on the Create Ticket form."
        actions={
          <>
            <Button variant="secondary" onClick={restoreDefaults} className="flex-1 lg:flex-none">
              <RotateCcw size={16} /> Restore defaults
            </Button>
            <Button onClick={() => startEdit(blankCategory())} className="flex-1 lg:flex-none">
              <Plus size={16} /> New Category
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          {categories.map(cat => (
            <div key={cat._id} className={`card ${cat.isActive ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="section-title flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xl">{cat.icon}</span> {cat.name}
                  <Badge className="rounded-full bg-slate-100 text-slate-500">assign → {cat.role || 'nobody'}</Badge>
                  {cat.clientVisible && <Badge className="rounded-full bg-emerald-100 text-emerald-700">clients</Badge>}
                  {!cat.isActive && <Badge className="rounded-full bg-red-100 text-red-600">hidden</Badge>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => toggleActive(cat)}>{cat.isActive ? 'Hide' : 'Show'}</Button>
                  <button onClick={() => startEdit(cat)} aria-label={`Edit ${cat.name}`} title="Edit" className="btn-icon text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>
                  <button onClick={() => remove(cat)} aria-label={`Delete ${cat.name}`} title="Delete" className="btn-icon text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {(cat.subcategories || []).map(s => (
                  <div key={s._id || s.name} className="text-sm text-slate-600 break-words">
                    <span className="font-semibold text-slate-700">{s.name}</span>
                    {s.special && <span className="ml-1 text-purple-600">(special)</span>}
                    {(s.assignOverrides || []).length > 0 && <span className="ml-1 text-amber-600">(assignee rule)</span>}
                    {s.items?.length > 0 && <span className="text-slate-400"> — {s.items.join(', ')}</span>}
                  </div>
                ))}
                {(cat.subcategories || []).length === 0 && <p className="text-sm text-slate-400 italic">No subcategories</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {/* ============ EDIT MODAL ============ */}
      {editing && (
        <Modal
          size="xl"
          title={editing._id ? 'Edit Category' : 'New Category'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          }
        >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="label block mb-1.5">Category name *</label>
                  <input className={inputCls} value={editing.name} onChange={e => patch({ name: e.target.value })} />
                </div>
                <div>
                  <label className="label block mb-1.5">Icon (emoji)</label>
                  <input className={inputCls} value={editing.icon} onChange={e => patch({ icon: e.target.value })} />
                </div>
                <div>
                  <label className="label block mb-1.5">Assign tickets to role</label>
                  <select className={inputCls} value={editing.role} onChange={e => patch({ role: e.target.value })}>
                    <option value="">(none)</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                <label className="flex items-center gap-2 max-md:min-h-10"><input type="checkbox" className="w-4 h-4 shrink-0" checked={editing.clientVisible} onChange={e => patch({ clientVisible: e.target.checked })} /> Visible to clients</label>
                <label className="flex items-center gap-2 max-md:min-h-10"><input type="checkbox" className="w-4 h-4 shrink-0" checked={editing.isActive} onChange={e => patch({ isActive: e.target.checked })} /> Show on ticket form</label>
              </div>

              <div>
                <p className="label mb-1.5">Category-level assignee rules <span className="font-normal">(e.g. Developers raise this to Team Leads)</span></p>
                <OverrideEditor value={editing.assignOverrides || []} onChange={v => patch({ assignOverrides: v })} />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Subcategories &amp; Specific Issues</h3>
                  <button type="button" onClick={() => { patch({ subcategories: [...editing.subcategories, blankSub()] }); setExpandedSub(p => ({ ...p, [editing.subcategories.length]: true })); }}
                    className="btn btn-sm btn-ghost"><Plus size={16} /> Add subcategory</button>
                </div>

                <div className="space-y-2">
                  {editing.subcategories.map((s, i) => {
                    const open = !!expandedSub[i];
                    return (
                      <div key={s._id || i} className="border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-1 sm:gap-2 px-2 py-1 bg-slate-50 rounded-t-xl">
                          <button type="button" onClick={() => setExpandedSub(p => ({ ...p, [i]: !open }))} aria-label={open ? 'Collapse subcategory' : 'Expand subcategory'} aria-expanded={open} className="btn-icon text-slate-500 hover:bg-slate-100">
                            {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                          <input className="flex-1 min-w-0 h-10 bg-transparent font-semibold text-sm outline-none" placeholder="Subcategory name" value={s.name} onChange={e => patchSub(i, { name: e.target.value })} />
                          <span className="meta whitespace-nowrap">{s.items.length} issue(s)</span>
                          <button type="button" onClick={() => patch({ subcategories: editing.subcategories.filter((_, idx) => idx !== i) })} aria-label="Remove subcategory" className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 size={16} /></button>
                        </div>
                        {open && (
                          <div className="p-3 sm:p-4 space-y-4">
                            {!s.special && (
                              <div>
                                <p className="label mb-1.5">Specific Issue options</p>
                                <ItemsEditor items={s.items} onChange={v => patchSub(i, { items: v })} />
                              </div>
                            )}
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                              <label className="flex items-center gap-2 max-md:min-h-10"><input type="checkbox" className="w-4 h-4 shrink-0" checked={s.special} onChange={e => patchSub(i, { special: e.target.checked })} /> Special (no specific issue, project/feed = General, pick from developer pool)</label>
                              <label className="flex items-center gap-2 max-md:min-h-10"><input type="checkbox" className="w-4 h-4 shrink-0" checked={s.clientVisible} onChange={e => patchSub(i, { clientVisible: e.target.checked })} /> Visible to clients</label>
                              <label className="flex items-center gap-2 max-md:min-h-10"><input type="checkbox" className="w-4 h-4 shrink-0" checked={s.isActive} onChange={e => patchSub(i, { isActive: e.target.checked })} /> Show on ticket form</label>
                            </div>
                            <div>
                              <p className="label mb-1.5">Assignee rules for this subcategory</p>
                              <OverrideEditor value={s.assignOverrides || []} onChange={v => patchSub(i, { assignOverrides: v })} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {editing.subcategories.length === 0 && <p className="text-sm text-slate-400 italic">No subcategories yet</p>}
                </div>
              </div>
            </div>

        </Modal>
      )}
    </div>
  );
};

export default TicketCategoriesManager;