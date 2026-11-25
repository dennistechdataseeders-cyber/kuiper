import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShieldCheck, Lock, RefreshCcw, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE_URL from '../config';

const Profile = () => {
  const [data, setData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation Logic
  const passwordsMatch = data.newPassword === data.confirmPassword;
  const isOldPassword = data.currentPassword !== '' && data.currentPassword === data.newPassword;
  const canSubmit = data.newPassword.length > 0 && passwordsMatch && !isOldPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordsMatch) return toast.error("New passwords do not match");
    if (isOldPassword) return toast.error("New password cannot be the same as current password");

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/change-password`, 
        { currentPassword: data.currentPassword, newPassword: data.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsSuccess(true);
      setData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = (field) => {
    setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="page relative">
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white border border-emerald-100 shadow-[0_20px_50px_rgba(16,185,129,0.2)] px-6 sm:px-10 py-8 sm:py-12 rounded-xl flex flex-col items-center text-center max-w-xs pointer-events-auto">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center animate-bounce shrink-0 mb-4 sm:mb-6">
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </div>
              <h3 className="section-title">Updated!</h3>
              <p className="text-sm font-bold text-slate-400 mt-2">Your password has been securely changed.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`max-w-xl mx-auto bg-white rounded-xl p-4 sm:p-8 shadow-xl border border-slate-100 relative overflow-hidden transition-all duration-500 ${isSuccess ? 'blur-sm grayscale' : ''}`}>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="section-title">User Security</h2>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Update your authentication credentials</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div className="relative">
              <label className="label block mb-1.5">Current Password</label>
              <div className="relative">
                <input 
                  type={showPass.current ? "text" : "password"} 
                  required 
                  className="input bg-slate-50 pr-12"
                  value={data.currentPassword}
                  onChange={(e) => setData({...data, currentPassword: e.target.value})}
                />
                <button 
                  type="button"
                  onClick={() => toggleVisibility('current')}
                  className="btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                >
                  {showPass.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* New Password */}
              <div>
                <label className="label block mb-1.5">New Password</label>
                <div className="relative">
                  <input 
                    type={showPass.new ? "text" : "password"} 
                    required 
                    className={`input bg-slate-50 pr-12 ${isOldPassword ? 'ring-2 ring-red-100' : 'focus:ring-blue-100'}`}
                    value={data.newPassword}
                    onChange={(e) => setData({...data, newPassword: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => toggleVisibility('new')}
                    className="btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                  >
                    {showPass.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="label block mb-1.5">Confirm New</label>
                <div className="relative">
                  <input 
                    type={showPass.confirm ? "text" : "password"} 
                    required 
                    className={`input bg-slate-50 pr-12 ${!passwordsMatch && data.confirmPassword ? 'ring-2 ring-red-100' : 'focus:ring-blue-100'}`}
                    value={data.confirmPassword}
                    onChange={(e) => setData({...data, confirmPassword: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => toggleVisibility('confirm')}
                    className="btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                  >
                    {showPass.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* --- VALIDATION NOTES --- */}
            <AnimatePresence>
              {(isOldPassword || (!passwordsMatch && data.confirmPassword)) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl space-y-2">
                    {isOldPassword && (
                      <div className="flex items-center gap-2 text-red-600 text-xs font-semibold uppercase tracking-wide">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>New password cannot be the same as current</span>
                      </div>
                    )}
                    {!passwordsMatch && data.confirmPassword && (
                      <div className="flex items-center gap-2 text-red-600 text-xs font-semibold uppercase tracking-wide">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>Passwords do not match yet</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={loading || (data.newPassword !== '' && !canSubmit)}
              className={`btn btn-md w-full text-white ${
                !canSubmit && data.newPassword !== '' 
                ? 'bg-slate-200 cursor-not-allowed text-slate-400' 
                : 'bg-slate-900 hover:bg-blue-600'
              }`}
            >
              {loading ? <RefreshCcw className="animate-spin" size={16}/> : <Lock size={16}/>}
              {loading ? "Processing..." : "Update Credentials"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;