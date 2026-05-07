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
    <div className="p-8 max-w-xl mx-auto relative">
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white border border-emerald-100 shadow-[0_20px_50px_rgba(16,185,129,0.2)] px-10 py-12 rounded-[3rem] flex flex-col items-center text-center max-w-xs pointer-events-auto">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Updated!</h3>
              <p className="text-sm font-bold text-slate-400 mt-2">Your password has been securely changed.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 relative overflow-hidden transition-all duration-500 ${isSuccess ? 'blur-sm grayscale' : ''}`}>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">User Security</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update your authentication credentials</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block tracking-widest">Current Password</label>
              <div className="relative">
                <input 
                  type={showPass.current ? "text" : "password"} 
                  required 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium pr-12"
                  value={data.currentPassword}
                  onChange={(e) => setData({...data, currentPassword: e.target.value})}
                />
                <button 
                  type="button"
                  onClick={() => toggleVisibility('current')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPass.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* New Password */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block tracking-widest">New Password</label>
                <div className="relative">
                  <input 
                    type={showPass.new ? "text" : "password"} 
                    required 
                    className={`w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 outline-none transition-all font-medium pr-12 ${isOldPassword ? 'ring-2 ring-red-100' : 'focus:ring-blue-100'}`}
                    value={data.newPassword}
                    onChange={(e) => setData({...data, newPassword: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => toggleVisibility('new')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showPass.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block tracking-widest">Confirm New</label>
                <div className="relative">
                  <input 
                    type={showPass.confirm ? "text" : "password"} 
                    required 
                    className={`w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 outline-none transition-all font-medium pr-12 ${!passwordsMatch && data.confirmPassword ? 'ring-2 ring-red-100' : 'focus:ring-blue-100'}`}
                    value={data.confirmPassword}
                    onChange={(e) => setData({...data, confirmPassword: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => toggleVisibility('confirm')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
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
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-2">
                    {isOldPassword && (
                      <div className="flex items-center gap-2 text-red-600 text-[11px] font-bold uppercase tracking-wider">
                        <AlertCircle size={14} />
                        <span>New password cannot be the same as current</span>
                      </div>
                    )}
                    {!passwordsMatch && data.confirmPassword && (
                      <div className="flex items-center gap-2 text-red-600 text-[11px] font-bold uppercase tracking-wider">
                        <AlertCircle size={14} />
                        <span>Passwords do not match yet</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={loading || (data.newPassword !== '' && !canSubmit)}
              className={`w-full py-5 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 ${
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