// frontend/src/components/AccessBlockModal.jsx
// Block or restore a user's login (e.g. an employee who is leaving).
//   "Block now"                  → signed out at once and cannot log in
//   "After last working day"     → works normally until that day ends, blocked from 00:00 IST next day
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Ban, LockOpen, CalendarClock } from 'lucide-react';

const IST = 'Asia/Kolkata';
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: IST });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (d) =>
  new Date(d).toLocaleString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' });

// 'active' | 'blocked' | 'scheduled'
export const accessStatus = (user) => {
  if (!user) return 'active';
  if (user.isActive === false) return 'blocked';
  if (user.accessBlockedFrom) {
    return new Date(user.accessBlockedFrom) <= new Date() ? 'blocked' : 'scheduled';
  }
  return 'active';
};

// Last day the user can still log in (the day before the block starts, IST)
export const lastAccessDay = (user) =>
  user?.accessBlockedFrom ? fmt(new Date(new Date(user.accessBlockedFrom).getTime() - 1)) : '';

export const AccessBadge = ({ user }) => {
  const status = accessStatus(user);
  if (status === 'blocked') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[8px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
        title={user.accessBlockReason ? `Reason: ${user.accessBlockReason}` : 'Login blocked'}
      >
        <Ban size={8} /> Login blocked
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
        title={user.accessBlockReason ? `Reason: ${user.accessBlockReason}` : 'Login will be blocked'}
      >
        <CalendarClock size={8} /> Access until {lastAccessDay(user)}
      </span>
    );
  }
  return null;
};

const AccessBlockModal = ({ user, apiBase, authHeader, onClose, onDone }) => {
  const status = accessStatus(user);
  const [mode, setMode] = useState('after');
  const [lastWorkingDay, setLastWorkingDay] = useState(addDays(todayIST(), 1));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const send = async (body) => {
    setSaving(true);
    try {
      const res = await axios.patch(`${apiBase}/users/${user._id}/access`, body, authHeader);
      toast.success(body.action === 'unblock' ? `Login restored for ${user.name}` : res.data?.message || 'Access updated');
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not update access');
    } finally {
      setSaving(false);
    }
  };

  const submitBlock = () => {
    if (mode === 'after' && !lastWorkingDay) return toast.error('Pick the last working day');
    send({ action: 'block', mode, lastWorkingDay, reason });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-black text-slate-800">
              {status === 'active' ? 'Block login' : 'Login access'}
            </h3>
            <p className="text-xs text-slate-500">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {status !== 'active' && (
            <div className={`rounded-xl border p-3 text-xs ${status === 'blocked' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {status === 'blocked'
                ? 'This user cannot log in.'
                : `This user can log in until the end of ${lastAccessDay(user)}, then access is blocked.`}
              {user.accessBlockReason && <div className="mt-1 opacity-80">Reason: {user.accessBlockReason}</div>}
            </div>
          )}

          {status !== 'blocked' && (
            <>
              <div className="space-y-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === 'after' ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'}`}>
                  <input type="radio" className="mt-0.5" checked={mode === 'after'} onChange={() => setMode('after')} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-800">After last working day</div>
                    <div className="text-xs text-slate-500">Works normally until the end of this day, then is signed out and blocked.</div>
                    {mode === 'after' && (
                      <input
                        type="date"
                        value={lastWorkingDay}
                        min={todayIST()}
                        onChange={(e) => setLastWorkingDay(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === 'now' ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                  <input type="radio" className="mt-0.5" checked={mode === 'now'} onChange={() => setMode('now')} />
                  <div>
                    <div className="text-sm font-bold text-slate-800">Block now</div>
                    <div className="text-xs text-slate-500">Signed out immediately on every device.</div>
                  </div>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Reason (optional)</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Resigned, last day 17 Nov"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {status !== 'active' && (
            <button
              disabled={saving}
              onClick={() => send({ action: 'unblock' })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <LockOpen size={14} /> {status === 'scheduled' ? 'Cancel block' : 'Restore access'}
            </button>
          )}
          {status === 'scheduled' && (
            <button
              disabled={saving}
              onClick={() => send({ action: 'block', mode: 'now', reason: reason || user.accessBlockReason })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Ban size={14} /> Block now instead
            </button>
          )}
          {status === 'scheduled' ? null : status === 'active' ? (
            <button
              disabled={saving}
              onClick={submitBlock}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Ban size={14} /> {mode === 'now' ? 'Block now' : 'Schedule block'}
            </button>
          ) : (
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">Close</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessBlockModal;
