import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';
import { motion } from 'framer-motion';
extend({ UnrealBloomPass });

// --- 3D PARTICLE SWARM (OPTIMIZED FOR SIDEBAR) ---
const ParticleSwarm = () => {
  const meshRef = useRef();
  const count = 5000; // Reduced for sidebar performance
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push(new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50));
    }
    return pos;
  }, []);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.15), []); // Slightly smaller particles

  const PARAMS = useMemo(() => ({ "pull": 0.2, "chaos": 0.02, "speed": 0.1 }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const { pull, chaos, speed } = PARAMS;
      const angle = i * 0.2 + time * speed;
      const baseRadius = 55; // Smaller radius to fit sidebar width

      // 1. Base Disk Math (Synced with Login logic)
      let x0 = Math.cos(angle) * baseRadius;
      let z0 = Math.sin(angle) * baseRadius;
      let y0 = (Math.random() - 0.5) * 8;

      // 2. Diagonal Tilt (Synced with Login logic)
      const tiltX = Math.PI / 15;
      const tiltZ = Math.PI / 15;

      let x1 = x0 * Math.cos(tiltZ) - y0 * Math.sin(tiltZ);
      let y1 = x0 * Math.sin(tiltZ) + y0 * Math.cos(tiltZ);
      let yFinal = y1 * Math.cos(tiltX) - z0 * Math.sin(tiltX);
      let zFinal = y1 * Math.sin(tiltX) + z0 * Math.cos(tiltX);
      let xFinal = x1;

      // 3. Chaos Noise
      xFinal += Math.sin(i * 12.98 + time * chaos) * 4;
      yFinal += Math.cos(i * 78.23 + time * chaos) * 4;
      zFinal += Math.sin(i * 45.16 + time * chaos) * 2;

      target.set(xFinal * (1 - pull), yFinal * (1 - pull), zFinal * (1 - pull));

      const hue = 0.55 + (Math.sin(angle * 0.5) * 0.1);
      pColor.setHSL(hue, 0.8, 0.6);

      positions[i].lerp(target, 0.1);
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />;
};

const KuiperLogo = ({ isExpanded }) => {
  return (
    <div className="relative flex items-center gap-3 mb-10 px-2 transition-all h-14">
      {/* 3D Particle Background - Resized for Sidebar */}
      {isExpanded && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-80" style={{ width: '210px', height: '110px', left: '-10x',top: '-20px' }}>
          <Canvas camera={{ position: [0, 0, 80], fov: 45 }} dpr={[1, 2]}>
            <ParticleSwarm />
            <Effects disableGamma>
              <unrealBloomPass threshold={0} strength={1.4} radius={0.5} />
            </Effects>
          </Canvas>
        </div>
      )}

      {/* Brand Icon */}
      <div className="relative z-10 shrink-0">
        <div className="relative w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md overflow-hidden">
          <img 
            src="/images/login_img.png" 
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
          <span className="text-[5.5px] text-slate-100 font-bold tracking-[0.3em] uppercase opacity-80">
            Engineered for Operations
          </span>
        </div>
      )}  
    </div>
  );
};

export default KuiperLogo;