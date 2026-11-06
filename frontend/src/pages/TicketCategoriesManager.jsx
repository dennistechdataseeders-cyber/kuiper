// frontend/src/pages/TicketCategoriesManager.jsx
// Admin / Super Admin screen to edit the Category -> Subcategory -> Specific Issue
// options used by the Create Ticket form.
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronRight, Layers, RotateCcw, Pencil
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';

const ROLES = ['Developer', 'Team Lead', 'Project Manager', 'Sales', 'Sales Manager', 'HR', 'Finance', 'Admin', 'IT'];
const CREATOR_ROLES = ['Sales', 'Sales Manager', 'Developer', 'Team Lead', 'Project Manager', 'HR', 'Finance', 'Admin', 'Client'];

const blankCategory = () => ({
  name: '', icon: '📁', color: 'slate', role: 'Developer',
  clientVisible: false, isActive: true, assignOverrides: [], subcategories: []
});
const blankSub = () => ({
  name: '', items: [], special: false, clientVisible: true, assignOverrides: [], isActive: true
});

const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

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
        <div key={i} className="p-2 rounded-lg border border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-amber-800">Assign to</span>
            <select value={o.assignRole} onChange={e => update(i, { assignRole: e.target.value })} className="px-2 py-1 text-xs border border-amber-200 rounded bg-white">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <span className="text-[11px] text-amber-800">when created by:</span>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="ml-auto text-red-500 hover:text-red-700"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {CREATOR_ROLES.map(r => (
              <button key={r} type="button" onClick={() => toggleRole(i, r)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${(o.creatorRoles || []).includes(r) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { creatorRoles: [], assignRole: 'Project Manager' }])}
        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
        <Plus size={12} /> Add assignee rule
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
          <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg text-xs font-medium">
            {it}
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={12} /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[11px] text-slate-400 italic">No specific issues yet</span>}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Add specific issue and press Enter" className={inputCls} />
        <button type="button" onClick={add} className="px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"><Plus size={16} /></button>
      </div>
    </div>
  );
};

const TicketCategoriesManager = () => {
  const { isCollapsed } = useSidebar();
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
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-8' : 'ml-64'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Layers className="text-blue-600" size={24} /> Ticket Categories</h1>
          <p className="text-sm text-slate-500 mt-1">Edit the Category, Subcategory and Specific Issue options shown on the Create Ticket form.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={restoreDefaults} className="px-3 py-2 text-sm font-semibold border border-slate-200 bg-white rounded-lg hover:bg-slate-100 flex items-center gap-1.5">
            <RotateCcw size={14} /> Restore defaults
          </button>
          <button onClick={() => startEdit(blankCategory())} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            <Plus size={16} /> New Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {categories.map(cat => (
            <div key={cat._id} className={`bg-white rounded-xl border p-4 ${cat.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span className="text-xl">{cat.icon}</span> {cat.name}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">assign → {cat.role || 'nobody'}</span>
                  {cat.clientVisible && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">clients</span>}
                  {!cat.isActive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">hidden</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(cat)} className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 hover:bg-slate-50">{cat.isActive ? 'Hide' : 'Show'}</button>
                  <button onClick={() => startEdit(cat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={15} /></button>
                  <button onClick={() => remove(cat)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {(cat.subcategories || []).map(s => (
                  <div key={s._id || s.name} className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">{s.name}</span>
                    {s.special && <span className="ml-1 text-purple-600">(special)</span>}
                    {(s.assignOverrides || []).length > 0 && <span className="ml-1 text-amber-600">(assignee rule)</span>}
                    {s.items?.length > 0 && <span className="text-slate-400"> — {s.items.join(', ')}</span>}
                  </div>
                ))}
                {(cat.subcategories || []).length === 0 && <p className="text-xs text-slate-400 italic">No subcategories</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ EDIT MODAL ============ */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{editing._id ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Category name *</label>
                  <input className={inputCls} value={editing.name} onChange={e => patch({ name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Icon (emoji)</label>
                  <input className={inputCls} value={editing.icon} onChange={e => patch({ icon: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Assign tickets to role</label>
                  <select className={inputCls} value={editing.role} onChange={e => patch({ role: e.target.value })}>
                    <option value="">(none)</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.clientVisible} onChange={e => patch({ clientVisible: e.target.checked })} /> Visible to clients</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={e => patch({ isActive: e.target.checked })} /> Show on ticket form</label>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Category-level assignee rules <span className="font-normal">(e.g. Developers raise this to Team Leads)</span></p>
                <OverrideEditor value={editing.assignOverrides || []} onChange={v => patch({ assignOverrides: v })} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700">Subcategories &amp; Specific Issues</h3>
                  <button type="button" onClick={() => { patch({ subcategories: [...editing.subcategories, blankSub()] }); setExpandedSub(p => ({ ...p, [editing.subcategories.length]: true })); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={13} /> Add subcategory</button>
                </div>

                <div className="space-y-2">
                  {editing.subcategories.map((s, i) => {
                    const open = !!expandedSub[i];
                    return (
                      <div key={s._id || i} className="border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t-xl">
                          <button type="button" onClick={() => setExpandedSub(p => ({ ...p, [i]: !open }))} className="text-slate-500">
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <input className="flex-1 bg-transparent font-semibold text-sm outline-none" placeholder="Subcategory name" value={s.name} onChange={e => patchSub(i, { name: e.target.value })} />
                          <span className="text-[10px] text-slate-400">{s.items.length} issue(s)</span>
                          <button type="button" onClick={() => patch({ subcategories: editing.subcategories.filter((_, idx) => idx !== i) })} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                        </div>
                        {open && (
                          <div className="p-3 space-y-3">
                            {!s.special && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Specific Issue options</p>
                                <ItemsEditor items={s.items} onChange={v => patchSub(i, { items: v })} />
                              </div>
                            )}
                            <div className="flex flex-wrap gap-5 text-xs text-slate-700">
                              <label className="flex items-center gap-2"><input type="checkbox" checked={s.special} onChange={e => patchSub(i, { special: e.target.checked })} /> Special (no specific issue, project/feed = General, pick from developer pool)</label>
                              <label className="flex items-center gap-2"><input type="checkbox" checked={s.clientVisible} onChange={e => patchSub(i, { clientVisible: e.target.checked })} /> Visible to clients</label>
                              <label className="flex items-center gap-2"><input type="checkbox" checked={s.isActive} onChange={e => patchSub(i, { isActive: e.target.checked })} /> Show on ticket form</label>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Assignee rules for this subcategory</p>
                              <OverrideEditor value={s.assignOverrides || []} onChange={v => patchSub(i, { assignOverrides: v })} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {editing.subcategories.length === 0 && <p className="text-xs text-slate-400 italic">No subcategories yet</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                <Save size={15} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketCategoriesManager;