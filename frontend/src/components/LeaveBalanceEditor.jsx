// frontend/src/components/LeaveBalanceEditor.jsx
//
// The "Edit Paid Leave Balance" functionality, embedded inside the
// "Review Leave Request" modal so HR can adjust the employee's balance
// right before approving / rejecting.
//
// It uses the same endpoint as the Edit Paid Leaves tab:
//   PATCH /api/leave-bucket/employee/:userId/adjust  { newBalance, reason }
// (saves immediately, logs to adjustment history, emails the employee).
// Approve / Reject then work on the updated balance as usual.

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, Loader2, Minus, Pencil, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

// Same rule as the backend (leaveBucketService.calculateDays)
const getLeaveDays = (leave) => {
  if (!leave) return 0;
  if (leave.isHalfDay) return 0.5;
  const diff = Math.abs(new Date(leave.endDate) - new Date(leave.startDate));
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

const LeaveBalanceEditor = ({ leave }) => {
  const employee = leave?.employeeId;
  const employeeId = employee?._id || employee;

  const [currentBalance, setCurrentBalance] = useState(null);
  const [newBalance, setNewBalance] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const loadBalance = async () => {
    const res = await axios.get(
      `${API_BASE_URL}/api/leave-bucket/employee/${employeeId}/summary`,
      authHeader()
    );
    const bal = res.data?.data?.totalBalance ?? 0;
    setCurrentBalance(bal);
    setNewBalance(bal);
    return bal;
  };

  useEffect(() => {
    if (!employeeId) return;
    setCurrentBalance(null);
    setReason('');
    loadBalance().catch((err) => {
      console.error('Could not load leave balance:', err);
      toast.error('Failed to load leave balance');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (newBalance < 0) {
      toast.error('Leave balance cannot be negative');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }
    setSaving(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/leave-bucket/employee/${employeeId}/adjust`,
        { newBalance, reason: reason.trim() },
        authHeader()
      );
      toast.success(`Paid Leave balance updated for ${employee?.name || 'employee'}`);
      setReason('');
      await loadBalance();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update leave balance');
    } finally {
      setSaving(false);
    }
  };

  const days = getLeaveDays(leave);
  const isPaid = leave?.leaveType === 'Paid Leave';
  const dirty = currentBalance !== null && newBalance !== currentBalance;
  const tooLow = isPaid && currentBalance !== null && currentBalance < days;

  return (
    <form
      onSubmit={handleSave}
      className="rounded-xl border border-slate-200 p-4 space-y-4"
    >
      <h3 className="section-title flex items-center gap-2">
        <Pencil size={16} className="text-blue-600" /> Edit Paid Leave Balance
      </h3>

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={16} className="text-blue-600" />
          <p className="text-xs font-semibold text-slate-700">Current Balance</p>
        </div>
        {currentBalance === null ? (
          <Loader2 size={18} className="animate-spin text-slate-400" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">{currentBalance}</span>
            <span className="text-sm text-slate-500">days</span>
          </div>
        )}
        {employee?.isProbationary && (
          <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> On probation — can only use Unpaid Leave, but
            the Paid Leave balance still accrues/can be adjusted.
          </p>
        )}
        {isPaid && currentBalance !== null && (
          <p
            className={`text-xs font-semibold mt-2 ${
              tooLow ? 'text-red-600' : 'text-slate-500'
            }`}
          >
            This request needs {days} day{days === 1 ? '' : 's'}
            {tooLow ? ' — balance is too low to approve.' : '.'}
          </p>
        )}
      </div>

      <div>
        <label className="label block mb-1.5">
          New Balance (days) *
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.5"
            min="0"
            required
            value={newBalance}
            onChange={(e) => setNewBalance(parseFloat(e.target.value) || 0)}
            className="input pr-24 bg-slate-50"
          />
          <div className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              type="button"
              onClick={() => setNewBalance(Math.max(0, newBalance - 0.5))}
              className="btn-icon bg-slate-200 text-slate-600 hover:bg-slate-300"
            >
              <Minus size={12} />
            </button>
            <button
              type="button"
              onClick={() => setNewBalance(newBalance + 0.5)}
              className="btn-icon bg-slate-200 text-slate-600 hover:bg-slate-300"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Half-day increments (0.5 days). Set below current balance to penalize,
          above to reward.
        </p>
      </div>

      <div>
        <label className="label block mb-1.5">
          Reason for Change *
        </label>
        <textarea
          required
          rows={2}
          placeholder="e.g., Reward for extra hours worked, Penalty for unapproved absence, Carry forward balance, etc."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input bg-slate-50 resize-none"
        />
      </div>

      {dirty && (
        <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
          <AlertCircle size={12} /> Not saved yet — click Save Balance before
          approving or rejecting.
        </p>
      )}

      <button
        type="submit"
        disabled={saving || currentBalance === null || !dirty}
        className="btn btn-md w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Save size={14} /> Save Balance
          </>
        )}
      </button>
    </form>
  );
};

export default LeaveBalanceEditor;
