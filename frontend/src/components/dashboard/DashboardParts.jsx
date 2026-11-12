// frontend/src/components/dashboard/DashboardParts.jsx
import React from 'react';
import {
  ChevronLeft, ChevronRight, Loader2, List, Hash, BarChart3, PieChart, Filter,
  GripVertical, Pencil, Trash2, EyeOff,
} from 'lucide-react';
import { chartColor, fmtAmount, fmtNumber, fmtCompact } from './dashboardUtils';

// ============================================
// view types
// ============================================
export const VIEW_META = {
  list:   { label: 'List',       icon: List },
  number: { label: 'Data point', icon: Hash },
  bar:    { label: 'Bar chart',  icon: BarChart3 },
  pie:    { label: 'Pie chart',  icon: PieChart },
  funnel: { label: 'Funnel',     icon: Filter },
};

// ============================================
// tiny pieces
// ============================================
export const ViewAll = ({ onClick }) => (
  <button onClick={onClick} className="text-[11px] font-bold text-blue-600 hover:underline flex-shrink-0">
    View all
  </button>
);

export const Empty = ({ text }) => (
  <p className="text-xs italic text-slate-400 text-center py-8">{text}</p>
);

export const Loading = () => (
  <div className="flex justify-center py-10">
    <Loader2 size={22} className="animate-spin text-slate-300" />
  </div>
);

export const MoreLink = ({ shown, total, onClick }) =>
  total > shown ? (
    <button onClick={onClick} className="mt-2 w-full text-center text-[11px] font-bold text-blue-600 hover:underline">
      +{total - shown} more
    </button>
  ) : null;

// ============================================
// PERIOD BAR (Day / Month / Year / All)
// ============================================
const MODES = [['day', 'Day'], ['month', 'Month'], ['year', 'Year'], ['all', 'All']];

export const PeriodBar = ({ p, hint }) => {
  const thisYear = new Date().getFullYear();
  const years = new Set();
  for (let y = thisYear - 6; y <= thisYear + 2; y++) years.add(String(y));
  years.add(p.year);
  const yearOptions = [...years].sort();

  const inputCls =
    'px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 bg-white';

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex bg-slate-100 p-0.5 rounded-lg">
          {MODES.map(([m, text]) => (
            <button
              key={m}
              onClick={() => p.setMode(m)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${
                p.mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {p.mode !== 'all' && (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => p.shift(-1)} className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                <ChevronLeft size={13} />
              </button>
              {p.mode === 'day' && (
                <input type="date" value={p.day} onChange={(e) => e.target.value && p.setDay(e.target.value)} className={inputCls} />
              )}
              {p.mode === 'month' && (
                <input type="month" value={p.month} onChange={(e) => e.target.value && p.setMonth(e.target.value)} className={inputCls} />
              )}
              {p.mode === 'year' && (
                <select value={p.year} onChange={(e) => p.setYear(e.target.value)} className={inputCls}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              <button onClick={() => p.shift(1)} className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                <ChevronRight size={13} />
              </button>
            </div>
            <button onClick={p.reset} className="text-[10px] font-bold text-blue-600 hover:underline">
              Today
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[10px] font-bold text-slate-400">
        {p.label}{hint ? ` · ${hint}` : ''}
      </p>
    </div>
  );
};

// ============================================
// CHARTS
//   rows: [{ label, value, color?, extra? }]
// ============================================
const BigNumber = ({ value, label }) => (
  <div className="py-8 text-center">
    <p className="text-4xl font-black text-slate-800 break-words">{value}</p>
    {label && <p className="text-xs font-bold text-slate-400 mt-1.5">{label}</p>}
  </div>
);

const Bars = ({ rows, fmt }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
            <span className="font-bold text-slate-700 truncate" title={r.label}>{r.label}</span>
            <span className="text-slate-500 whitespace-nowrap">
              {r.extra || <b className="text-slate-800">{fmt(r.value)}</b>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Every non-zero entry gets at least this share of the ring so tiny values stay visible
// (the legend and tooltips still show the true percentage).
const MIN_SLICE = 0.012;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const truncate = (str, n) => (str.length > n ? `${str.slice(0, n - 1)}…` : str);

const Donut = ({ rows, total, fmt, money }) => {
  const [active, setActive] = React.useState(null);

  const positive = rows.filter((r) => r.value > 0);
  const sum = positive.reduce((s, r) => s + r.value, 0);
  if (!sum) return <Empty text="No data for this period" />;

  const pct = (v) => {
    const p = (v / sum) * 100;
    return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
  };

  // Ring geometry
  const R = 42;
  const STROKE = 16;
  const C = 2 * Math.PI * R;
  const HOLE_WIDTH = 2 * (R - STROKE / 2) - 8; // usable width inside the ring

  const shares = positive.map((r) => Math.max(r.value / sum, MIN_SLICE));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  let offset = 0;
  const slices = positive.map((r, i) => {
    const len = (shares[i] / shareSum) * C;
    const slice = { r, len, offset };
    offset += len;
    return slice;
  });

  // Centre label: compact so it always fits the hole, and it follows the hovered slice.
  const shown = active !== null ? positive[active] : null;
  const main = fmtCompact(shown ? shown.value : total);
  const sub = shown ? truncate(shown.label, 14) : money ? 'Rs. total' : 'Total';
  const mainSize = clamp(HOLE_WIDTH / (main.length * 0.62), 8, 16);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-36 h-36 flex-shrink-0">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
        {slices.map(({ r, len, offset: off }, i) => (
          <circle
            key={`${r.label}-${i}`}
            cx="60" cy="60" r={R} fill="none"
            stroke={r.color}
            strokeWidth={active === i ? STROKE + 3 : STROKE}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-off}
            transform="rotate(-90 60 60)"
            opacity={active === null || active === i ? 1 : 0.45}
            style={{ transition: 'opacity 150ms, stroke-width 150ms', cursor: 'pointer' }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${r.label}: ${r.extra || fmt(r.value)} (${pct(r.value)})`}</title>
          </circle>
        ))}
        <g pointerEvents="none">
          <text x="60" y="60" textAnchor="middle" className="fill-slate-800" style={{ fontSize: mainSize, fontWeight: 900 }}>
            {main}
          </text>
          <text x="60" y="72" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 7.5, fontWeight: 700 }}>
            {sub}
          </text>
        </g>
        <title>{fmt(total)}</title>
      </svg>
      <div className="flex-1 min-w-[140px] space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {positive.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            className={`flex items-center gap-2 text-[11px] rounded px-1 -mx-1 transition-colors ${active === i ? 'bg-slate-50' : ''}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: r.color }} />
            <span className="font-bold text-slate-700 truncate flex-1" title={r.label}>{r.label}</span>
            <span className="text-slate-500 whitespace-nowrap">
              {r.extra || fmt(r.value)} · {pct(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Funnel = ({ rows, fmt }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const widths = rows.map((r) => Math.max(24, (r.value / max) * 100));
  return (
    <div>
      {rows.map((r, i) => {
        const top = widths[i];
        const bottom = i < rows.length - 1 ? widths[i + 1] : top * 0.8;
        const a = (100 - top) / 2;
        const b = (100 - bottom) / 2;
        return (
          <div key={r.label} className="flex items-center gap-4 mb-0.5">
            <div className="flex-1 min-w-0">
              <div
                className="h-9 w-full"
                style={{
                  background: r.color,
                  opacity: r.value === 0 ? 0.25 : 1,
                  clipPath: `polygon(${a}% 0, ${100 - a}% 0, ${100 - b}% 100%, ${b}% 100%)`,
                }}
              />
            </div>
            <div className="w-[44%] flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 truncate" title={r.label}>{r.label}</span>
              <span className="text-slate-500 whitespace-nowrap">{r.extra || fmt(r.value)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ChartView = ({ view, rows = [], total = 0, money = false, numberLabel }) => {
  const fmt = money ? fmtAmount : fmtNumber;
  const colored = rows.map((r, i) => ({ ...r, color: r.color || chartColor(i) }));

  if (view === 'number') return <BigNumber value={fmt(total)} label={numberLabel} />;
  if (!colored.length) return <Empty text="No data for this period" />;
  if (view === 'pie') return <Donut rows={colored} total={total} fmt={fmt} money={money} />;
  if (view === 'funnel') return <Funnel rows={colored} fmt={fmt} />;
  return <Bars rows={colored} fmt={fmt} />;
};

// ============================================
// EDIT TOOLBAR (shown on every widget while customizing)
// ed = { views, view, span, periodMode, onView, onSpan, onPeriodMode, onMove, onHide, hideLabel, onEdit }
// ============================================
const SIZES = [[2, 'S'], [3, 'M'], [6, 'L']];

export const EditBar = ({ ed }) => {
  const seg = (active) =>
    `p-1.5 rounded-md transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t-2xl">
      <GripVertical size={14} className="text-blue-400 cursor-grab" title="Drag to reorder" />

      <div className="flex bg-white p-0.5 rounded-lg border border-blue-100" title="Display as">
        {ed.views.map((v) => {
          const Icon = VIEW_META[v].icon;
          return (
            <button key={v} title={VIEW_META[v].label} onClick={() => ed.onView(v)} className={seg(ed.view === v)}>
              <Icon size={12} />
            </button>
          );
        })}
      </div>

      <div className="flex bg-white p-0.5 rounded-lg border border-blue-100" title="Size">
        {SIZES.map(([s, text]) => (
          <button
            key={s}
            onClick={() => ed.onSpan(s)}
            className={`px-2 py-1 rounded-md text-[10px] font-black ${ed.span === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {text}
          </button>
        ))}
      </div>

      <select
        value={ed.periodMode}
        onChange={(e) => ed.onPeriodMode(e.target.value)}
        title="Default period"
        className="px-1.5 py-1 rounded-lg border border-blue-100 bg-white text-[10px] font-bold text-slate-600 outline-none"
      >
        {MODES.map(([m, text]) => <option key={m} value={m}>{text}</option>)}
      </select>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => ed.onMove(-1)} title="Move earlier" className="p-1.5 rounded-md text-slate-500 hover:bg-white">
          <ChevronLeft size={13} />
        </button>
        <button onClick={() => ed.onMove(1)} title="Move later" className="p-1.5 rounded-md text-slate-500 hover:bg-white">
          <ChevronRight size={13} />
        </button>
        {ed.onEdit && (
          <button onClick={ed.onEdit} title="Edit analytics" className="p-1.5 rounded-md text-blue-600 hover:bg-white">
            <Pencil size={13} />
          </button>
        )}
        <button onClick={ed.onHide} title={ed.hideLabel} className="p-1.5 rounded-md text-red-500 hover:bg-white">
          {ed.hideLabel === 'Delete' ? <Trash2 size={13} /> : <EyeOff size={13} />}
        </button>
      </div>
    </div>
  );
};

// ============================================
// CARD + WIDGET FRAME
// ============================================
export const Card = ({ title, icon, count, action, ed, children }) => (
  <div className={`h-full bg-white rounded-2xl border shadow-sm flex flex-col ${ed ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
    {ed && <EditBar ed={ed} />}
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2 min-w-0">
        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">{icon}</span>
        <h3 className="text-sm font-black text-slate-800 truncate" title={title}>{title}</h3>
        {count !== undefined && (
          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      {action}
    </div>
    <div className="p-4 flex-1">{children}</div>
  </div>
);

// One frame for every widget: header + period filter + (list | chart | data point)
export const WidgetFrame = ({
  ed, view, title, icon, count, action, p, hint, loading,
  rows, total, money, numberLabel, isEmpty, emptyText, list,
}) => (
  <Card title={title} icon={icon} count={count} action={action} ed={ed}>
    <PeriodBar p={p} hint={hint} />
    {loading ? (
      <Loading />
    ) : view === 'list' ? (
      isEmpty ? <Empty text={emptyText} /> : list
    ) : (
      <ChartView view={view} rows={rows} total={total} money={money} numberLabel={numberLabel} />
    )}
  </Card>
);