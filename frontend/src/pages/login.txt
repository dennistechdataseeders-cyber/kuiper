import React, { useRef, useEffect } from 'react';

const KuiperLogo = ({ isExpanded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isExpanded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    const createParticles = () => {
      particles = [];
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          color: Math.random() > 0.5 ? '#3b82f6' : '#22d3ee', // Blue and Cyan
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        // Swarm logic: Slight pull to center
        p.speedX += (canvas.width / 2 - p.x) * 0.0001;
        p.speedY += (canvas.height / 2 - p.y) * 0.0001;

        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

        ctx.fillStyle = p.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    canvas.width = 180;
    canvas.height = 60;
    createParticles();
    animate();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isExpanded]);

  return (
    <div className="relative flex items-center gap-3 mb-10 px-2 transition-all">
      {/* Particle Canvas Background */}
      {isExpanded && (
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
        />
      )}

      {/* Image with subtle aura */}
      <div className="relative z-10 shrink-0">
        <div className="absolute -inset-1 bg-blue-500/20 rounded-2xl blur-md animate-pulse" />
        <img 
          src="/images/login_img.png" 
          alt="logo" 
          className="relative w-10 h-12 object-cover rounded-2xl border border-white/10" 
        />
      </div>

      {isExpanded && (
        <div className="flex flex-col leading-tight z-10 select-none">
          <span className="font-[Orbitron] text-xl tracking-tight bg-gradient-to-t to-slate-100 via-blue-400 from-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            K U I P E R
          </span>
          <span className="text-[7px] text-blue-400/60 tracking-widest font-bold">
            ENGINEERED FOR OPERATIONS
          </span>
        </div>
      )}
    </div>
  );
};

export default KuiperLogo;