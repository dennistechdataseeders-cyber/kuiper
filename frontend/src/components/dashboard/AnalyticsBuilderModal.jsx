// frontend/src/components/dashboard/AnalyticsBuilderModal.jsx
// "Add analytics" / "Edit analytics" dialog for the Sales dashboard.
// The user picks a module (Leads, Contacts, Accounts, Deals, Tasks, Meetings, Calls),
// what to measure, an optional filter, how to group it and how to display it.
// Fields created in Customize Modules (e.g. "Email Sent", "LinkedIn Request Sent")
// show up automatically.
import React, { useMemo, useState } from 'react';
import { X, ExternalLink, RefreshCw, Plus, Loader2 } from 'lucide-react';
import {
  MODULE_LIST, buildCatalog, distinctValues, runAnalytics, autoTitle, ALL_PERIOD,
} from './dashboardUtils';
import { ChartView, VIEW_META } from './DashboardParts';

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white';
const labelCls = 'text-xs font-bold text-slate-600 block mb-1';

const slim = (f) => (f ? { key: f.key, label: f.label, kind: f.kind, ...(f.money ? { money: true } : {}) } : null);

const DEFAULT_FORM = {
  id: '', title: '', module: 'Leads',
  measureType: 'count', measureKey: '',
  whereKey: '', whereValue: '',
  groupKey: '',            // '' | 'f:<fieldKey>' | 'd:day' | 'd:month' | 'd:year'
  dateKey: 'createdAt',
  view: 'number', mineOnly: true, periodMode: 'all', span: 2,
};

const toForm = (w) =>
  !w
    ? { ...DEFAULT_FORM }
    : {
        id: w.id, title: w.title || '', module: w.module,
        measureType: w.measure?.type || 'count', measureKey: w.measure?.field?.key || '',
        whereKey: w.where?.field?.key || '', whereValue: w.where?.value ?? '',
        groupKey: w.groupBy ? (w.groupBy.type === 'field' ? `f:${w.groupBy.field.key}` : `d:${w.groupBy.unit}`) : '',
        dateKey: w.dateField?.key || 'createdAt',
        view: w.view || 'number', mineOnly: w.mineOnly !== false,
        periodMode: w.periodMode || 'all', span: w.span || 2,
      };

// form → stored widget config (field details are copied in so the widget works without the catalog)
const toWidget = (f, catalog) => {
  const find = (key, list) => list.find((x) => x.key === key);
  const measureField = f.measureType === 'count' ? null : find(f.measureKey, catalog.nums);
  const whereField = f.whereKey ? find(f.whereKey, catalog.cats) : null;
  const dateField = find(f.dateKey, catalog.dates) || catalog.dates[0];

  let groupBy = null;
  if (f.groupKey.startsWith('f:')) {
    const gf = find(f.groupKey.slice(2), catalog.cats);
    if (gf) groupBy = { type: 'field', field: slim(gf) };
  } else if (f.groupKey.startsWith('d:')) {
    groupBy = { type: 'date', unit: f.groupKey.slice(2) };
  }

  return {
    id: f.id,
    kind: 'custom',
    visible: true,
    module: f.module,
    title: f.title.trim(),
    measure: { type: measureField ? f.measureType : 'count', field: slim(measureField) },
    where: whereField && f.whereValue !== '' ? { field: slim(whereField), value: f.whereValue } : null,
    groupBy,
    dateField: slim(dateField),
    mineOnly: f.mineOnly,
    periodMode: f.periodMode,
    view: groupBy ? f.view : 'number',
    span: f.span,
  };
};

// <option>s split into Built-in / Custom fields
const FieldOptions = ({ list }) => {
  const builtin = list.filter((x) => !x.custom);
  const custom = list.filter((x) => x.custom);
  return (
    <>
      {builtin.length > 0 && (
        <optgroup label="Built-in fields">
          {builtin.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </optgroup>
      )}
      {custom.length > 0 && (
        <optgroup label="Custom fields">
          {custom.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </optgroup>
      )}
    </>
  );
};

export default function AnalyticsBuilderModal({
  initial, defs, getRecords, userId, onSave, onClose, onRefreshDefs, onCreateField,
}) {
  const [f, setF] = useState(() => toForm(initial));
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  // quick-create a tracking field (e.g. "Email Sent") without leaving the dashboard
  const [nf, setNf] = useState({ label: '', type: 'Checkbox' });
  const [creating, setCreating] = useState(false);
  const createField = async () => {
    const label = nf.label.trim();
    if (!label || !onCreateField) return;
    setCreating(true);
    const created = await onCreateField(f.module, { label, type: nf.type });
    setCreating(false);
    if (!created) return;
    setNf({ label: '', type: nf.type });
    const key = `cf:${created.fieldKey}`;
    // pre-fill the form so the new field is used straight away
    if (nf.type === 'Checkbox') set({ whereKey: key, whereValue: 'Yes', title: f.title || label });
    else if (nf.type === 'Number') set({ measureType: 'sum', measureKey: key, title: f.title || label });
    else if (nf.type === 'Date') set({ dateKey: key });
  };

  const catalog = useMemo(() => buildCatalog(f.module, defs[f.module] || []), [f.module, defs]);
  const records = useMemo(() => getRecords(f.module), [f.module, getRecords]);

  const whereField = catalog.cats.find((c) => c.key === f.whereKey);
  const whereOptions = useMemo(() => {
    if (!whereField) return [];
    if (whereField.kind === 'checkbox') return ['Yes', 'No'];
    if (whereField.options?.length) return whereField.options;
    return distinctValues(records, whereField);
  }, [whereField, records]);

  const draft = useMemo(() => toWidget(f, catalog), [f, catalog]);
  const preview = useMemo(
    () => runAnalytics(draft, records, ALL_PERIOD, userId),
    [draft, records, userId]
  );

  const needsField = f.measureType !== 'count' && !f.measureKey;
  const canChart = !!draft.groupBy;

  const changeModule = (m) =>
    set({ module: m, measureType: 'count', measureKey: '', whereKey: '', whereValue: '', groupKey: '', dateKey: 'createdAt', view: 'number' });

  const changeGroup = (g) => set({ groupKey: g, view: g ? (f.view === 'number' ? 'bar' : f.view) : 'number' });

  const submit = () => {
    if (needsField) return;
    const w = toWidget(f, catalog);
    w.id = f.id || `c_${Date.now().toString(36)}`;
    w.title = w.title || autoTitle(w);
    onSave(w);
  };

  const numberLabel =
    draft.measure.field
      ? `${draft.measure.type === 'sum' ? 'Total' : 'Average'} ${draft.measure.field.label}`
      : `${draft.module.toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-800">{initial ? 'Edit analytics' : 'Add analytics'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose what to track and how to show it on your dashboard.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* ---------- form ---------- */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title (optional)</label>
              <input
                value={f.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. LinkedIn requests sent"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Module</label>
              <select value={f.module} onChange={(e) => changeModule(e.target.value)} className={inputCls}>
                {MODULE_LIST.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Measure</label>
              <div className="flex gap-2">
                <select
                  value={f.measureType}
                  onChange={(e) => set({ measureType: e.target.value, measureKey: '' })}
                  className={inputCls}
                >
                  <option value="count">Count of records</option>
                  <option value="sum" disabled={!catalog.nums.length}>Sum of…</option>
                  <option value="avg" disabled={!catalog.nums.length}>Average of…</option>
                </select>
                {f.measureType !== 'count' && (
                  <select value={f.measureKey} onChange={(e) => set({ measureKey: e.target.value })} className={inputCls}>
                    <option value="">Select a number field</option>
                    <FieldOptions list={catalog.nums} />
                  </select>
                )}
              </div>
              {needsField && <p className="text-[11px] text-red-500 mt-1">Pick the number field to {f.measureType === 'sum' ? 'add up' : 'average'}.</p>}
            </div>

            <div>
              <label className={labelCls}>Only include records where (optional)</label>
              <div className="flex gap-2">
                <select
                  value={f.whereKey}
                  onChange={(e) => set({ whereKey: e.target.value, whereValue: '' })}
                  className={inputCls}
                >
                  <option value="">— no filter —</option>
                  <FieldOptions list={catalog.cats} />
                </select>
                {f.whereKey && (
                  <select value={f.whereValue} onChange={(e) => set({ whereValue: e.target.value })} className={inputCls}>
                    <option value="">Select value</option>
                    {whereOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Group by (needed for bar / pie)</label>
              <select value={f.groupKey} onChange={(e) => changeGroup(e.target.value)} className={inputCls}>
                <option value="">— none (single number) —</option>
                <FieldOptions list={catalog.cats} />
                <optgroup label="Over time">
                  <option value="d:day">Date · per day</option>
                  <option value="d:month">Date · per month</option>
                  <option value="d:year">Date · per year</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className={labelCls}>Date field (used for the Day / Month / Year filter and "over time")</label>
              <select value={f.dateKey} onChange={(e) => set({ dateKey: e.target.value })} className={inputCls}>
                <FieldOptions list={catalog.dates} />
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Default period</label>
                <select value={f.periodMode} onChange={(e) => set({ periodMode: e.target.value })} className={inputCls}>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Size</label>
                <select value={f.span} onChange={(e) => set({ span: Number(e.target.value) })} className={inputCls}>
                  <option value={2}>Small (⅓ width)</option>
                  <option value={3}>Medium (½ width)</option>
                  <option value={6}>Large (full width)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={f.mineOnly} onChange={(e) => set({ mineOnly: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              Only my records
            </label>
          </div>

          {/* ---------- display + preview ---------- */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Display as</label>
              <div className="grid grid-cols-3 gap-2">
                {['number', 'bar', 'pie'].map((v) => {
                  const Icon = VIEW_META[v].icon;
                  const disabled = v !== 'number' && !canChart;
                  const active = (canChart ? f.view : 'number') === v;
                  return (
                    <button
                      key={v}
                      disabled={disabled}
                      onClick={() => set({ view: v })}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                        active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Icon size={18} />
                      {VIEW_META[v].label}
                    </button>
                  );
                })}
              </div>
              {!canChart && <p className="text-[11px] text-slate-400 mt-1.5">Choose a "Group by" to unlock bar and pie charts.</p>}
            </div>

            <div>
              <label className={labelCls}>Preview (all time)</label>
              <div className="border border-slate-200 rounded-xl p-4 min-h-[200px] bg-slate-50/50">
                <p className="text-xs font-black text-slate-700 mb-3 truncate">{draft.title || autoTitle(draft)}</p>
                <ChartView
                  view={draft.view}
                  rows={preview.rows}
                  total={preview.total}
                  money={preview.money}
                  numberLabel={numberLabel}
                />
                <p className="text-[10px] text-slate-400 mt-3">{preview.count} matching record{preview.count === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-800 leading-relaxed">
              <b>Track something new</b> (e.g. "Email Sent", "LinkedIn Request Sent") in {f.module}
              <div className="flex gap-2 mt-2">
                <input
                  value={nf.label}
                  onChange={(e) => setNf((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Field name, e.g. Email Sent"
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs outline-none focus:border-amber-500 bg-white text-slate-700"
                />
                <select
                  value={nf.type}
                  onChange={(e) => setNf((p) => ({ ...p, type: e.target.value }))}
                  className="px-2 py-1.5 border border-amber-200 rounded-lg text-xs outline-none bg-white text-slate-700"
                >
                  <option value="Checkbox">Yes / No</option>
                  <option value="Number">Number</option>
                  <option value="Date">Date</option>
                </select>
                <button
                  onClick={createField}
                  disabled={!nf.label.trim() || creating || !onCreateField}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create
                </button>
              </div>
              <p className="mt-2">
                The field is added to {f.module} and will appear on its forms. Fill it in on your records
                (e.g. tick "Email Sent") and it is counted here.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => window.open('/admin/customize', '_blank')}
                  className="flex items-center gap-1 font-bold text-amber-900 hover:underline"
                >
                  <ExternalLink size={12} /> Open Customize Modules
                </button>
                <button onClick={onRefreshDefs} className="flex items-center gap-1 font-bold text-amber-900 hover:underline">
                  <RefreshCw size={12} /> Refresh fields
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={needsField}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {initial ? 'Update analytics' : 'Add to dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}