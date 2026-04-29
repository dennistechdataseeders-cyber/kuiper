import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import API_BASE_URL from '../config';

const AsteroidField = () => {
  const asteroids = Array.from({ length: 40 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,58,138,0.2)_0%,_rgba(2,6,23,1)_80%)]" />
      {asteroids.map((_, i) => {
        const size = Math.random() * 25 + 2; 
        const duration = Math.random() * 40 + 20;
        const delay = Math.random() * 30;
        const top = Math.random() * 100;
        
        return (
          <div
            key={i}
            className="absolute bg-gradient-to-br from-slate-400 to-slate-700 opacity-20 animate-asteroid"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              top: `${top}%`,
              left: `-5%`,
              animationDuration: `${duration}s`,
              animationDelay: `-${delay}s`,
              borderRadius: `${Math.random()*40+20}% ${Math.random()*40+30}% ${Math.random()*40+20}% ${Math.random()*40+30}%`
            }}
          />
        );
      })}
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate(); // Added for smoother navigation

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      const { token, user } = res.data;
      
      // 1. Store session data
      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userId', user.id); 
      localStorage.setItem('lastActive', Date.now().toString());
      
      toast.success(`Welcome back, ${user.name}!`);
      
      // 2. Routing Logic - Matches App.jsx Landing Paths exactly
      const role = user.role;
      let targetRoute = '/login';

      if (role === 'Admin') {
        targetRoute = '/admin';
      } else if (role === 'Sales Manager') {
        targetRoute = '/sales-manager';
      } else if (role === 'Sales') {
        targetRoute = '/sales';
      } else if (role === 'Project Manager') {
        targetRoute = '/admin/projects';
      } else if (role === 'Developer') {
        targetRoute = '/developer';
      }

      // Small delay to allow the toast to be seen and localStorage to settle
      setTimeout(() => {
        navigate(targetRoute, { replace: true });
      }, 100);

    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 overflow-hidden relative font-sans">
      <AsteroidField />
      
      <form 
        onSubmit={handleLogin} 
        className="relative z-10 bg-white/10 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-md border border-white/10"
      >
        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-blue-500/10 backdrop-blur-md">
            <ShieldCheck size={40} className="text-blue-400" />
          </div>
          <h2 className="text-4xl font-black mb-3 text-white tracking-tight">KUIPER</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em]">Command Center</p>
        </div>

        <div className="space-y-6">
          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2 group-focus-within:text-blue-400 transition-colors">Credential Email</label>
            <input 
              type="email" 
              placeholder="operator@kuiper.com" 
              required
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/10 transition-all font-bold text-white placeholder:text-slate-600"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2 group-focus-within:text-blue-400 transition-colors">Secure Key</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                required
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/10 transition-all font-bold text-white placeholder:text-slate-600 pr-12"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            disabled={isSubmitting}
            className={`w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all uppercase tracking-widest mt-4 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? "Syncing..." : "Initialize Session"}
          </button>
        </div>

        <div className="mt-12 text-center border-t border-white/5 pt-8">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">
            Precision Intelligence Hub
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;