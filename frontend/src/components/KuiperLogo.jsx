import React, { Suspense, lazy, useEffect, useState } from 'react';

const KuiperParticles = lazy(() => import('./KuiperParticles'));

// Load the particle effect only after the page is idle, and never with reduced motion.
const useDeferredParticles = (enabled) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => setReady(true), { timeout: 2500 });
    return () => cancel(id);
  }, [enabled, ready]);
  return ready;
};

const KuiperLogo = ({ isExpanded }) => {
  const showParticles = useDeferredParticles(isExpanded);
  return (
    <div className="relative flex items-center gap-3 mb-10 px-2 transition-all h-14">
      {/* 3D Particle Background - Resized for Sidebar */}
      {isExpanded && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-80" style={{ width: '210px', height: '110px', left: '-10x',top: '-20px' }}>
          {showParticles && (
            <Suspense fallback={null}>
              <KuiperParticles />
            </Suspense>
          )}
        </div>
      )}

      {/* Brand Icon */}
      <div className="relative z-10 shrink-0">
        <div className="relative w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center shadow-2xl backdrop-blur-md overflow-hidden">
          <img 
            src="/images/login_img.webp" 
            alt="logo" 
            className="w-full h-full object-contain p-1" 
          />
        </div>
      </div>

      {/* Text Branding */}
      {isExpanded && (
        <div className="flex flex-col leading-tight z-10 select-none">
          <span className="font-[Orbitron] text-xl tracking-tight bg-gradient-to-t from-violet-600 via-blue-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]">
            K U I P E R
          </span>
          <span className="text-xs md:text-[11px] text-slate-100 font-semibold tracking-tight whitespace-nowrap opacity-80">
            Engineered for Operations
          </span>
        </div>
      )}  
    </div>
  );
};

export default KuiperLogo;  