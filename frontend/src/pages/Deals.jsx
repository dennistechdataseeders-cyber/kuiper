// frontend/src/pages/Deals.jsx
// Editable Kanban board for Deals — stages come from /api/deal-stages
// (mirrors the exact UX of ActivitiesTasks.jsx / TaskStage).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, LayoutGrid, List as ListIcon, Plus, MoreHorizontal,
  Pencil, Trash2, Lock, X,
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import Pagination from '../components/Pagination';
import useDashboardFilter, { idOf, ownerOf } from '../utils/useDashboardFilter';
import DashboardFilterBanner from '../components/DashboardFilterBanner';
import useColumnTable from '../utils/useColumnTable';
import { ColumnHead, ColumnToolbar } from '../components/ColumnTable';
import { rowClickHandler } from '../components/RecordDetailKit';
import useRecordTags, { useRowSelection } from '../utils/useRecordTags';
import {
  selectionColumn, tagsColumn, TagToolbar, TagDialogs, useTagDialogs, TagList,
} from '../components/RecordTags';

// These are the only stages the lead-side logic treats as "closed".
// Everything else is a normal movable stage.
const CLOSED_STAGE_NAMES = ['Closed Won', 'Closed Lost', 'Closed Lost to Competition'];
const EDIT_ROLES = ['Super Admin', 'Admin', 'Sales', 'Sales Manager'];

const fmtAmount = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const isOverdue = (deal, stageName) => {
  if (!deal.closingDate || CLOSED_STAGE_NAMES.includes(stageName)) return false;
  const end = new Date(deal.closingDate);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
};

export default function Deals() {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const canEdit = EDIT_ROLES.includes(localStorage.getItem('role') || '');
  const dash = useDashboardFilter(); // ?rep=…&focus=open|won (set by the Sales Command dashboard)

  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  // list-view pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // stage management (identical UX to ActivitiesTasks.jsx)
  const [menuFor, setMenuFor] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const cancelRename = useRef(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProb, setNewProb] = useState(10);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [moveTo, setMoveTo] = useState('');

  const apiErr = (err, fallback) => err.response?.data?.error || fallback;

  // ---------- load ----------
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, d] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/deal-stages`, authHeader),
        axios.get(`${API_BASE_URL}/api/deals`, authHeader),
      ]);
      setStages(s.data?.data || []);
      setDeals(d.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, view]);

  // Old deals may still be sitting on a stage name that has since been
  // renamed/removed — normalize them into the first column instead of
  // silently hiding them.
  const stageNames = useMemo(() => stages.map((s) => s.name), [stages]);
  const normalizeStage = useCallback((name) => {
    if (stageNames.includes(name)) return name;
    return stageNames[0];
  }, [stageNames]);

  // ---------- derived ----------
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return deals.filter((d) => {
      if (dash.rep && idOf(d.owner) !== dash.rep) return false;
      if (dash.focus === 'open' && CLOSED_STAGE_NAMES.includes(d.stage)) return false;
      if (dash.focus === 'won' && d.stage !== 'Closed Won') return false;
      if (!s) return true;
      return (
        (d.dealName || '').toLowerCase().includes(s) ||
        (d.organizationId?.companyName || '').toLowerCase().includes(s) ||
        (d.contactName || '').toLowerCase().includes(s) ||
        (d.owner?.name || '').toLowerCase().includes(s)
      );
    });
  }, [deals, q, dash.rep, dash.focus]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(stageNames.map((n) => [n, []]));
    filtered.forEach((d) => {
      const n = normalizeStage(d.stage);
      if (map[n]) map[n].push(d);
    });
    return stages.map((stage) => {
      const list = map[stage.name] || [];
      return {
        stage,
        list,
        total: list.reduce((sum, d) => sum + Number(d.amount || 0), 0),
        overdue: list.filter((d) => isOverdue(d, stage.name)).length,
      };
    });
  }, [filtered, stages, stageNames, normalizeStage]);

  // ---------- move a deal (drag & drop) ----------
  const moveDeal = async (id, newStage) => {
    const deal = deals.find((d) => d._id === id);
    if (!deal || normalizeStage(deal.stage) === newStage) return;

    const previous = deal.stage;
    setDeals((prev) => prev.map((d) => (d._id === id ? { ...d, stage: newStage } : d))); // optimistic
    try {
      await axios.put(`${API_BASE_URL}/api/deals/${id}`, { stage: newStage }, authHeader);
      toast.success(`Moved to ${newStage}`);
    } catch (err) {
      setDeals((prev) => prev.map((d) => (d._id === id ? { ...d, stage: previous } : d)));
      toast.error(apiErr(err, 'Failed to move deal'));
    }
  };

  const onDrop = (e, stageName) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setOverStage(null);
    if (id) moveDeal(id, stageName);
  };

  // ---------- stage management ----------
  const startRename = (stage) => {
    setMenuFor(null);
    cancelRename.current = false;
    setRenamingId(stage._id);
    setRenameValue(stage.name);
  };

  const saveRename = async (stage) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (cancelRename.current) { cancelRename.current = false; return; }
    if (!name || name === stage.name) return;
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/deal-stages/${stage._id}`, { name }, authHeader);
      const saved = res.data?.data;
      setStages((prev) => prev.map((s) => (s._id === stage._id ? { ...s, name: saved?.name || name } : s)));
      setDeals((prev) => prev.map((d) => (d.stage === stage.name ? { ...d, stage: name } : d)));
      toast.success('Stage renamed');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to rename stage'));
    }
  };

  const addStage = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    try {
      setBusy(true);
      const res = await axios.post(`${API_BASE_URL}/api/deal-stages`, { name, probability: newProb }, authHeader);
      setStages((prev) => [...prev, res.data.data]);
      setNewName('');
      setNewProb(10);
      setAdding(false);
      toast.success('Stage added');
    } catch (err) {
      toast.error(apiErr(err, 'Failed to add stage'));
    } finally {
      setBusy(false);
    }
  };

  const askDelete = (stage) => {
    setMenuFor(null);
    const firstOther = stages.find((s) => s._id !== stage._id);
    setMoveTo(firstOther?._id || '');
    setDeleting(stage);
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    const target = stages.find((s) => s._id === moveTo);
    try {
      setBusy(true);
      await axios.delete(
        `${API_BASE_URL}/api/deal-stages/${deleting._id}${moveTo ? `?moveTo=${moveTo}` : ''}`,
        authHeader
      );
      setStages((prev) => prev.filter((s) => s._id !== deleting._id));
      if (target) {
        setDeals((prev) => prev.map((d) => (d.stage === deleting.name ? { ...d, stage: target.name } : d)));
      }
      toast.success('Stage removed');
      setDeleting(null);
    } catch (err) {
      toast.error(apiErr(err, 'Failed to remove stage'));
    } finally {
      setBusy(false);
    }
  };

  // ---------- Zoho-style tags ----------
  const tagsApi = useRecordTags('Deals');
  const sel = useRowSelection();
  const tagDialogs = useTagDialogs();

  // ---------- list view: Zoho-style per-column menu (sort / pin / filter by / hide) ----------
  const listColumns = [
    selectionColumn({
      sel, tagsApi, getId: (d) => d._id, getPageRows: () => paged,
      openTags: tagDialogs.openTags, openManage: tagDialogs.openManage,
    }),
    tagsColumn(tagsApi, (d) => d._id), // Tag column first (after the checkbox / quick-action columns)
    {
      key: 'dealName', label: 'Deal Name', type: 'text', width: 220,
      getValue: (d) => d.dealName,
      tdClass: 'text-sm font-bold text-slate-800',
      render: (d) => d.dealName,
    },
    {
      key: 'account', label: 'Account', type: 'select',
      getValue: (d) => d.organizationId?.companyName,
      tdClass: 'text-sm text-slate-600',
      render: (d) => d.organizationId?.companyName || '—',
    },
    {
      key: 'contact', label: 'Contact', type: 'text',
      getValue: (d) => d.contactName,
      tdClass: 'text-sm text-slate-600',
      render: (d) => (
        <>
          {d.contactName || '—'}
          {d.contactRole && <span className="block text-[10px] text-slate-400 font-semibold">{d.contactRole}</span>}
        </>
      ),
    },
    {
      key: 'amount', label: 'Amount', type: 'number',
      getValue: (d) => Number(d.amount || 0),
      tdClass: 'text-sm font-semibold text-slate-700',
      render: (d) => fmtAmount(d.amount),
    },
    {
      key: 'closingDate', label: 'Closing Date', type: 'date',
      getValue: (d) => d.closingDate,
      render: (d) => (
        <span className={`text-sm ${isOverdue(d, d.stage) ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>
          {fmtDate(d.closingDate)}
        </span>
      ),
    },
    {
      key: 'stage', label: 'Stage', type: 'select',
      getValue: (d) => normalizeStage(d.stage),
      render: (d) => (
        <select
          value={normalizeStage(d.stage)}
          onChange={(e) => moveDeal(d._id, e.target.value)}
          className="px-2 py-1 rounded-full text-[11px] font-black outline-none cursor-pointer border border-slate-200 bg-white"
        >
          {stages.map((s) => <option key={s._id}>{s.name}</option>)}
        </select>
      ),
    },
    {
      key: 'owner', label: 'Deal Owner', type: 'select',
      getValue: (d) => d.owner?.name,
      tdClass: 'text-sm text-slate-600',
      render: (d) => d.owner?.name || '—',
    },
  ];
  const ct = useColumnTable('deals', listColumns, filtered, `${stageNames.join('|')}#${tagsApi.version}`);
  const listRows = ct.rows;
  useEffect(() => { setPage(1); }, [ct.stateKey]);

  // list-view paging
  const totalPages = Math.max(1, Math.ceil(listRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => listRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [listRows, currentPage, pageSize]
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* ---------- Header ---------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Deals</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} deal{filtered.length === 1 ? '' : 's'} · drag a card to change its stage
          </p>
          <DashboardFilterBanner
            filter={dash}
            label={dash.focus === 'won' ? 'Won deals' : dash.focus === 'open' ? 'Open deals' : ''}
            className="mt-2"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search deals..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 shadow-sm bg-white"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            <button
              onClick={() => setView('kanban')}
              title="Kanban view"
              className={`p-2 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              title="List view"
              className={`p-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
      ) : view === 'kanban' ? (
        /* ================= KANBAN ================= */
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {columns.map(({ stage, list, total, overdue }) => (
            <div
              key={stage._id}
              onDragOver={(e) => { e.preventDefault(); if (overStage !== stage.name) setOverStage(stage.name); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null); }}
              onDrop={(e) => onDrop(e, stage.name)}
              className="w-[320px] shrink-0"
            >
              {/* column header */}
              <div className="bg-cyan-50 border-t-4 border-teal-300 rounded-t-lg px-4 py-3">
                {renamingId === stage._id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    maxLength={40}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(stage)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { cancelRename.current = true; setRenamingId(null); }
                    }}
                    className="w-full px-2 py-1 rounded-md border border-blue-400 text-sm font-bold text-slate-800 outline-none ring-2 ring-blue-100 bg-white"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{stage.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-200/70 text-teal-800 text-[11px] font-black">
                      {list.length}
                    </span>
                    <span className="text-xs text-slate-500">• {stage.probability ?? 0}%</span>
                    {stage.locked && (
                      <Lock size={12} className="text-slate-400 shrink-0" title="Built-in stage — can't be renamed or removed" />
                    )}

                    {canEdit && !stage.locked && (
                      <div className="relative ml-auto">
                        <button
                          onClick={() => setMenuFor(menuFor === stage._id ? null : stage._id)}
                          className="p-1 rounded-md text-slate-500 hover:bg-white/70 transition"
                          title="Stage options"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuFor === stage._id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5">
                              <button
                                onClick={() => startRename(stage)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                              >
                                <Pencil size={14} /> Rename
                              </button>
                              <button
                                onClick={() => askDelete(stage)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition text-left"
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm font-black text-slate-800 mt-1">{fmtAmount(total)}</p>
                <p className={`text-sm font-black mt-0.5 ${overdue > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                  {overdue} overdue
                </p>
              </div>

              {/* cards */}
              <div
                className={`rounded-b-lg p-2 space-y-2 min-h-[140px] max-h-[calc(100vh-290px)] overflow-y-auto transition-colors ${
                  overStage === stage.name ? 'bg-blue-100/70 ring-2 ring-blue-300' : 'bg-slate-200/50'
                }`}
              >
                {list.map((d) => {
                  const late = isOverdue(d, stage.name);
                  return (
                    <div
                      key={d._id}
                      draggable
                      onDragStart={(e) => { setDraggingId(d._id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d._id); }}
                      onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                      onClick={rowClickHandler(() => navigate(`/sales/deals/${d._id}`))}
                      className={`bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition ${draggingId === d._id ? 'opacity-40' : ''}`}
                    >
                      <p className="text-sm font-bold text-slate-900 truncate">{d.dealName}</p>
                      {tagsApi.tagsOf(d._id).length > 0 && (
                        <div className="mt-1"><TagList tags={tagsApi.tagsOf(d._id)} max={2} /></div>
                      )}
                      <div className="mt-1 space-y-0.5 text-[13px] text-slate-600">
                        <p className="truncate">{stage.name}</p>
                        <p className="truncate">{d.organizationId?.companyName || '—'}</p>
                        <p className="truncate">{d.owner?.name || '—'}</p>
                        <p className="truncate">{d.contactName || '—'}</p>
                        <p className="font-semibold text-slate-700">{fmtAmount(d.amount)}</p>
                      </div>
                      <p className={`text-[13px] mt-1 ${late ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                        {fmtDate(d.closingDate)}
                      </p>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <p className="text-center text-xs font-semibold text-slate-400 py-6">No deals</p>
                )}
              </div>
            </div>
          ))}

          {/* ---------- Add stage ---------- */}
          {canEdit && (
            <div className="w-[320px] shrink-0">
              {adding ? (
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                  <input
                    autoFocus
                    value={newName}
                    maxLength={40}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addStage();
                      if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewProb(10); }
                    }}
                    placeholder="Stage name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={busy}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-500">Probability %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newProb}
                      onChange={(e) => setNewProb(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-md border border-slate-300 text-sm"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setAdding(false); setNewName(''); setNewProb(10); }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addStage}
                      disabled={busy || !newName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busy ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-slate-300 text-sm font-bold text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition"
                >
                  <Plus size={16} /> Add Stage
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ================= LIST ================= */
        <>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <TagToolbar sel={sel} openTags={tagDialogs.openTags} openManage={tagDialogs.openManage} />
          <ColumnToolbar ct={ct} className="flex-1" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <ColumnHead ct={ct} />
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={ct.visibleColumns.length} className="text-center py-10 text-slate-400">
                      {filtered.length === 0 ? 'No deals yet. Open a lead and click “Convert Deal”.' : 'No deals match the column filters.'}
                    </td>
                  </tr>
                ) : paged.map((d) => (
                  <tr
                    key={d._id}
                    onClick={rowClickHandler(() => navigate(`/sales/deals/${d._id}`))}
                    className={`hover:bg-slate-50 transition group cursor-pointer ${sel.isSelected(d._id) ? 'bg-blue-50/60' : ''}`}
                  >
                    {ct.visibleColumns.map((col) => (
                      <td key={col.key} {...ct.cellProps(col, `${col.tdBase || 'px-6 py-4'} ${col.tdClass || ''}`)}>
                        {col.render(d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {listRows.length > 0 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={listRows.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </div>
        </>
      )}

      <TagDialogs dialogs={tagDialogs} tagsApi={tagsApi} onDone={sel.clear} />

      {/* ---------- Remove-stage dialog ---------- */}
      {deleting && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Remove “{deleting.name}”?</h3>
              <button onClick={() => setDeleting(null)} disabled={busy} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {deleting.dealCount > 0 ? (
                <>
                  <p className="text-sm text-slate-600">
                    This stage has <b>{deleting.dealCount}</b> deal{deleting.dealCount === 1 ? '' : 's'} (across the whole team).
                    Choose where they should go:
                  </p>
                  <select
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={busy}
                  >
                    {stages.filter((s) => s._id !== deleting._id).map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-sm text-slate-600">This stage has no deals. It will simply be removed from the board.</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDeleting(null)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={busy || (deleting.dealCount > 0 && !moveTo)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? <><Loader2 size={14} className="animate-spin" /> Removing...</> : 'Remove stage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}