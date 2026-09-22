// src/pages/Login.jsx

import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  Suspense,
  lazy
} from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import API_BASE_URL from '../config';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// ✅ FIX: Lazy-load the heavy 3D background so it never blocks
// the initial paint of the login form.
// ============================================================
const BackgroundScene = lazy(() => import('../components/LoginBackground'));

// ============================================================
// ✅ FIX: Detect whether the device can/should render the 3D bg
// ============================================================
function shouldLoad3DBackground() {
  // 1. Respect reduced-motion preference
  if (typeof window === 'undefined') return false;
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return false;

  // 2. Skip on small screens (phones) — it's a battery/CPU hog
  const isSmallScreen = window.innerWidth < 768;
  if (isSmallScreen) return false;

  // 3. Skip if the device reports few CPU cores
  const cores = navigator.hardwareConcurrency || 4;
  if (cores < 4) return false;

  // 4. Skip if the network is slow
  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (conn) {
    if (conn.saveData) return false;
    if (
      conn.effectiveType &&
      ['slow-2g', '2g', '3g'].includes(conn.effectiveType)
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================
// ✅ FIX: Lightweight CSS-only fallback background — renders
// instantly, no bundle download required. Always visible under
// the 3D scene (which fades in on top when ready).
// ============================================================
const StaticBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
    {/* Radial gradient glow */}
    <div
      className="absolute inset-0 opacity-70"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.20) 0%, rgba(2,6,23,1) 70%)'
      }}
    />
    {/* Subtle drifting dots (pure CSS, cheap) */}
    <div className="absolute inset-0 animate-[drift_60s_linear_infinite] opacity-40">
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cyan-300/60"
          style={{
            width: `${1 + (i % 3)}px`,
            height: `${1 + (i % 3)}px`,
            top: `${(i * 37) % 100}%`,
            left: `${(i * 53) % 100}%`,
            animation: `pulse ${3 + (i % 4)}s ease-in-out ${i * 0.1}s infinite`
          }}
        />
      ))}
    </div>
    <style>{`
      @keyframes drift {
        from { transform: translate3d(0, 0, 0); }
        to   { transform: translate3d(-40px, -60px, 0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.15; }
        50%      { opacity: 0.7; }
      }
    `}</style>
  </div>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  // ============================================================
  // ✅ FIX: Mount the 3D canvas only after the page is idle and
  // we've confirmed the device can handle it.
  // ============================================================
  const [mount3D, setMount3D] = useState(false);

  useEffect(() => {
    if (!shouldLoad3DBackground()) return;

    // Defer until the browser is idle so the form paints first
    const idle =
      window.requestIdleCallback ||
      function (cb) {
        return setTimeout(cb, 1200);
      };
    const cancelIdle =
      window.cancelIdleCallback ||
      function (id) {
        clearTimeout(id);
      };

    const id = idle(() => setMount3D(true), { timeout: 2500 });

    return () => cancelIdle(id);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('lastActive', Date.now().toString());

      toast.success(`Welcome , ${user.name}!`);

      setIsExiting(true);

      const role = user.role.toLowerCase();
      const targetRoute =
        role === 'super admin' || role === 'admin'
          ? '/admin'
          : role === 'developer'
          ? '/developer'
          : role === 'sales'
          ? '/sales'
          : role === 'sales manager'
          ? '/sales-manager'
          : role === 'project manager'
          ? '/admin/projects'
          : role === 'team lead'
          ? '/teamlead'
          : role === 'client'
          ? '/client'
          : '/login';

      setTimeout(() => navigate(targetRoute, { replace: true }), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen relative overflow-hidden">
      {/* ✅ FIX: Static CSS background renders instantly */}
      <StaticBackground />

      {/* ✅ FIX: 3D background is lazy + deferred + conditionally mounted */}
      {mount3D && (
        <Suspense fallback={null}>
          <BackgroundScene isExiting={isExiting} />
        </Suspense>
      )}

      <AnimatePresence>
        {!isExiting && (
          <motion.div
            key="login-ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              y: -20,
              filter: 'blur(10px)',
              transition: { duration: 0.8, ease: 'easeInOut' }
            }}
            className="min-h-screen flex items-center justify-center p-4 relative z-10"
          >
            <form
              onSubmit={handleLogin}
              className="bg-white/5 backdrop-blur-3xl p-8 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/10"
            >
              <div className="mb-10 text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 blur-xl opacity-40 animate-pulse" />
                  <div className="relative w-full h-full bg-blue-600/20 border border-blue-500/30 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md overflow-hidden">
                    <img
                      src="/images/login_img.png"
                      alt="logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <span className="font-[Orbitron] text-3xl tracking-tight bg-gradient-to-t to-white via-blue-400 from-cyan-400 bg-clip-text text-transparent">
                  K U I P E R
                </span>
                <p className="text-slate-400 font-bold text-xs tracking-[0.3em] mt-2">
                  Engineered for Operations
                </p>
              </div>

              <div className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2">
                    Credential Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2">
                    Secure Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white pr-12 transition-all"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  disabled={isSubmitting}
                  className={`w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest mt-4 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Syncing...' : 'Login'}
                </button>

                <div className="justify-center mt-3 text-[11px] font-semibold tracking-[0.25em] uppercase text-slate-400 flex items-center gap-2">
                  <span className="opacity-60">Powered by</span>
                  <span className="relative font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent animate-pulse">
                    TECHDATASEEDERS
                  </span>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;