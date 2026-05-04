import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import API_BASE_URL from '../config';

const SetPassword = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/set-password`, {
        token,
        password
      });
      toast.success("Password set successfully! Please login.");
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || "Link expired or invalid");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen flex items-center justify-center p-4">
      <form 
        onSubmit={handleSubmit}
        className="bg-white/5 backdrop-blur-3xl p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <Lock className="text-blue-400" size={32} />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">Set Your Password</h2>
          <p className="text-slate-400 text-xs font-bold tracking-widest mt-2">KUIPER ACCOUNT ACTIVATION</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-2">New Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-2">Confirm Password</label>
            <input 
              type="password" 
              required
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button 
            disabled={isSubmitting}
            className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Processing..." : "Activate Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SetPassword;