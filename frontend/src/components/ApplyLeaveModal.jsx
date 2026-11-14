// frontend/src/components/ApplyLeaveModal.jsx
//
// One-shot leave request.
//   1. pick From / To
//   2. for every working day choose Full / 1st half / 2nd half / Skip
//   3. KUIPER uses paid leave first (up to the available balance) and the rest
//      becomes unpaid — shown live, together with the monthly limit check
//   4. one Submit → one request for HR
//
// Backend: POST /api/leave-bucket/request/preview   (live split, nothing saved)
//          POST /api/leave-bucket/request           (submit)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Send, AlertCircle, Info, CalendarDays, Wallet, Gauge } from 'lucide-react';
import API_BASE_URL from '../config';

const PORTIONS = [
  { id: 'full', label: 'Full', title: 'Full day' },
  { id: 'first', label: '1st ½', title: 'First half' },
  { id: 'second', label: '2nd ½', title: 'Second half' },
  { id: 'none', label: 'Skip', title: 'Not taking leave this day' },
];

const TYPES = [
  { id: 'auto', label: 'Auto', title: 'Paid if balance is left, otherwise unpaid' },
  { id: 'paid', label: 'Paid', title: 'Use paid leave balance for this day' },
  { id: 'unpaid', label: 'Unpaid', title: 'Take this day as unpaid leave' },
];
const TYPE_ACTIVE = {
  auto: 'bg-white text-slate-700 shadow-sm',
  paid: 'bg-blue-600 text-white shadow-sm',
  unpaid: 'bg-indigo-600 text-white shadow-sm',
};

const pad = (n) => String(n).padStart(2, '0');
const ymdLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return ymdLocal(d); };
const dayLabel = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtDays = (n) => `${n} day${n === 1 ? '' : 's'}`;

export default function ApplyLeaveModal({ open, onClose, onSubmitted, authHeader }) {
  const today = ymdLocal(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [portions, setPortions] = useState({}); // date → portion (only what the user changed)
  const [types, setTypes] = useState({});       // date → 'auto' | 'paid' | 'unpaid'
  const [usePaid, setUsePaid] = useState(true);
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reqId = useRef(0);

  // reset each time it opens
  useEffect(() => {
    if (!open) return;
    setFrom(today); setTo(today); setPortions({}); setTypes({}); setUsePaid(true); setReason(''); setPlan(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep To ≥ From
  useEffect(() => { if (to < from) setTo(from); }, [from, to]);

  // live preview (debounced)
  useEffect(() => {
    if (!open || !from || !to || to < from) return undefined;
    const id = ++reqId.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/api/leave-bucket/request/preview`,
          { startDate: from, endDate: to, days: portions, types, usePaid }, authHeader);
        if (id === reqId.current) setPlan(res.data?.data || null);
      } catch (err) {
        if (id === reqId.current) setPlan({ errors: [err.response?.data?.error || 'Could not check this request'], warnings: [], dates: [], pieces: [] });
      } finally {
        if (id === reqId.current) setPreviewing(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, from, to, portions, types, usePaid, authHeader]);

  const dates = plan?.dates || [];
  const totals = plan?.totals || { totalDays: 0, paidDays: 0, unpaidDays: 0 };
  const balance = plan?.balance;
  const monthly = plan?.monthly;
  const errors = plan?.errors || [];
  const warnings = (plan?.warnings || []).filter((w) => !w.startsWith('Only ')); // the bar already shows this
  const canSubmit = !!plan && !previewing && !submitting && errors.length === 0 && totals.totalDays > 0 && reason.trim().length > 0;

  const setAll = (p) => {
    const next = {};
    dates.forEach((d) => { if (!d.off) next[d.date] = p; });
    setPortions(next);
  };
  const setAllTypes = (t) => {
    const next = {};
    dates.forEach((d) => { if (!d.off) next[d.date] = t; });
    setTypes(next);
  };
  const onProbation = !!balance?.isProbationary;

  const submit = async () => {
    if (!canSubmit) {
      if (!reason.trim()) toast.error('Please add a reason');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`${API_BASE_URL}/api/leave-bucket/request`,
        { startDate: from, endDate: to, days: portions, types, usePaid, reason: reason.trim() }, authHeader);
      toast.success(`Leave request for ${fmtDays(totals.totalDays)} sent to HR`);
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit leave');
      if (err.response?.data?.plan) setPlan(err.response.data.plan);
    } finally {
      setSubmitting(false);
    }
  };

  const paidPct = totals.totalDays ? (totals.paidDays / totals.totalDays) * 100 : 0;
  const quick = useMemo(() => ([
    { label: 'Today', f: today, t: today },
    { label: 'Tomorrow', f: addDays(today, 1), t: addDays(today, 1) },
    { label: 'Next 2 days', f: addDays(today, 1), t: addDays(today, 2) },
  ]), [today]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Apply for Leave</h2>
            <p className="text-xs text-slate-500 mt-0.5">One request for all your days. Choose Paid or Unpaid per day, or leave it on Auto (paid first, then unpaid). Weekends and holidays are not counted.</p>
          </div>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        {/* balance strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Wallet size={15} /></span>
            <div>
              <p className="text-sm font-black text-slate-800">{balance ? (balance.isProbationary ? 'On probation' : fmtDays(balance.availablePaid)) : '—'}</p>
              <p className="text-[11px] text-slate-500">
                Paid leave available{balance?.pendingPaid ? ` (${balance.pendingPaid} in pending requests)` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"><Gauge size={15} /></span>
            <div>
              <p className="text-sm font-black text-slate-800">{monthly ? `${monthly.remaining} of ${monthly.limit} left` : '—'}</p>
              <p className="text-[11px] text-slate-500">This month{monthly ? ` · ${monthly.used} used${monthly.pending ? `, ${monthly.pending} pending` : ''}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><CalendarDays size={15} /></span>
            <div>
              <p className="text-sm font-black text-slate-800">{fmtDays(totals.totalDays)}</p>
              <p className="text-[11px] text-slate-500">This request</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-5">
          {/* left: dates + days */}
          <div className="md:col-span-3 p-6 md:border-r border-slate-100 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-[140px]">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">From</span>
                <input type="date" value={from} min={addDays(today, -60)} onChange={(e) => { setFrom(e.target.value); setPortions({}); setTypes({}); }} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="flex-1 min-w-[140px]">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">To</span>
                <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPortions({}); setTypes({}); }} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="flex gap-1.5">
                {quick.map((q) => (
                  <button key={q.label} onClick={() => { setFrom(q.f); setTo(q.t); setPortions({}); setTypes({}); }}
                    className={`h-10 px-3 rounded-lg border text-xs font-bold ${from === q.f && to === q.t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Days</p>
                {dates.filter((d) => !d.off).length > 1 && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400 mr-1">Set all:</span>
                    {PORTIONS.slice(0, 3).map((p) => (
                      <button key={p.id} onClick={() => setAll(p.id)} title={p.title} className="px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600">{p.label}</button>
                    ))}
                    <span className="w-px h-4 bg-slate-200 mx-1" />
                    {TYPES.filter((t) => !(onProbation && t.id === 'paid')).map((t) => (
                      <button key={t.id} onClick={() => setAllTypes(t.id)} title={t.title} className="px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600">{t.label}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {dates.length === 0 && (
                  <div className="py-8 flex justify-center text-slate-400">{previewing ? <Loader2 size={18} className="animate-spin" /> : <span className="text-xs">Pick dates above</span>}</div>
                )}
                {dates.map((d) => {
                  const piece = (plan?.pieces || []).filter((p) => p.startDate <= d.date && p.endDate >= d.date);
                  const tag = piece.length === 0 ? null
                    : piece.every((p) => p.leaveType === 'Paid Leave') ? 'Paid'
                    : piece.every((p) => p.leaveType === 'Unpaid Leave') ? 'Unpaid' : '½ Paid + ½ Unpaid';
                  return (
                    <div key={d.date} className={`flex items-center gap-3 px-3 py-2 ${d.off ? 'bg-slate-50' : ''}`}>
                      <div className="min-w-[96px] shrink-0">
                        <p className={`text-sm font-bold ${d.off ? 'text-slate-400' : 'text-slate-800'}`}>{dayLabel(d.date)}</p>
                        {tag && (
                          <p className={`text-[10px] font-black uppercase tracking-wide ${tag === 'Paid' ? 'text-blue-600' : tag === 'Unpaid' ? 'text-slate-500' : 'text-violet-600'}`}>{tag}</p>
                        )}
                      </div>
                      {d.off ? (
                        <span className="text-xs font-semibold text-slate-400 italic">{d.off} — not counted</span>
                      ) : (
                        <div className="flex items-center gap-2 ml-auto">
                          <div className="flex p-0.5 rounded-lg bg-slate-100">
                            {PORTIONS.map((p) => (
                              <button
                                key={p.id}
                                title={p.title}
                                onClick={() => setPortions((m) => ({ ...m, [d.date]: p.id }))}
                                className={`px-2 py-1 rounded-md text-xs font-bold transition ${
                                  d.portion === p.id
                                    ? p.id === 'none' ? 'bg-white text-slate-500 shadow-sm' : 'bg-white text-blue-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          {d.amount > 0 && (
                            <div className="flex p-0.5 rounded-lg bg-slate-100">
                              {TYPES.map((t) => {
                                const disabled = onProbation && t.id === 'paid';
                                const active = (types[d.date] || 'auto') === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    title={disabled ? 'Not available during probation' : t.title}
                                    disabled={disabled}
                                    onClick={() => setTypes((m) => ({ ...m, [d.date]: t.id }))}
                                    className={`px-2 py-1 rounded-md text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed ${
                                      active ? TYPE_ACTIVE[t.id] : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* right: split + reason */}
          <div className="md:col-span-2 p-6 space-y-4 bg-white">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">How it will be counted</p>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900">{totals.totalDays}</span>
                  <span className="text-xs font-semibold text-slate-500">{previewing ? 'checking…' : 'day(s) of leave'}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden mt-3 flex">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs font-bold">
                  <span className="text-blue-700">{totals.paidDays} paid</span>
                  <span className="text-slate-500">{totals.unpaidDays} unpaid</span>
                </div>
                <label className={`flex items-center gap-2 mt-3 text-xs font-semibold ${balance?.isProbationary ? 'text-slate-400' : 'text-slate-600 cursor-pointer'}`}>
                  <input type="checkbox" checked={usePaid && !balance?.isProbationary} disabled={balance?.isProbationary} onChange={(e) => setUsePaid(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  Use paid balance for <b className="font-bold">Auto</b> days
                </label>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 space-y-1">
                {errors.map((e) => (
                  <p key={e} className="text-xs text-red-700 flex gap-1.5"><AlertCircle size={13} className="shrink-0 mt-0.5" /> {e}</p>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1">
                {warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-800 flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> {w}</p>
                ))}
              </div>
            )}

            <label className="block">
              <span className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Reason</span>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Family function in my hometown"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-white">
          <p className="text-xs text-slate-500">
            {totals.totalDays > 0
              ? <>Sending <b className="text-slate-800">{fmtDays(totals.totalDays)}</b>{totals.paidDays && totals.unpaidDays ? <> ({totals.paidDays} paid + {totals.unpaidDays} unpaid)</> : totals.unpaidDays ? ' (unpaid)' : ' (paid)'} for approval</>
              : 'Select at least one working day'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
