// src/components/LoginBackground.jsx

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

extend({ UnrealBloomPass });

const ParticleSwarm = ({ isExiting }) => {
  const meshRef = useRef();
  // ✅ FIX: reduced from 20000 → 8000. Visually near-identical, ~60% cheaper.
  const count = 8000;

  const transitionProgress = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);

  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        )
      );
    }
    return pos;
  }, []);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffffff }),
    []
  );
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);
  const PARAMS = useMemo(
    () => ({ pull: 0.2, chaos: 0.02, speed: 0.03 }),
    []
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    transitionProgress.current = THREE.MathUtils.lerp(
      transitionProgress.current,
      isExiting ? 1 : 0,
      delta * 2
    );

    const currentSpeed = THREE.MathUtils.lerp(
      PARAMS.speed,
      PARAMS.speed * 12,
      transitionProgress.current
    );
    const currentPull = THREE.MathUtils.lerp(
      PARAMS.pull,
      0.9,
      transitionProgress.current
    );

    for (let i = 0; i < count; i++) {
      const { chaos } = PARAMS;
      const angle = i * 0.2 + time * currentSpeed;
      const baseRadius = 160;

      let x0 = Math.cos(angle) * baseRadius;
      let z0 = Math.sin(angle) * baseRadius;
      let y0 = (Math.random() - 0.5) * 12;

      const tiltX = Math.PI / 15;
      const tiltZ = Math.PI / 7;

      let x1 = x0 * Math.cos(tiltZ) - y0 * Math.sin(tiltZ);
      let y1 = x0 * Math.sin(tiltZ) + y0 * Math.cos(tiltZ);

      let yFinal = y1 * Math.cos(tiltX) - z0 * Math.sin(tiltX);
      let zFinal = y1 * Math.sin(tiltX) + z0 * Math.cos(tiltX);
      let xFinal = x1;

      xFinal += Math.sin(i * 12.98 + time * chaos) * 8;
      yFinal += Math.cos(i * 78.23 + time * chaos) * 8;
      zFinal += Math.sin(i * 45.16 + time * chaos) * 5;

      target.set(
        xFinal * (1 - currentPull),
        yFinal * (1 - currentPull),
        zFinal * (1 - currentPull)
      );

      const hue = 0.55 + Math.sin(angle * 0.5) * 0.1;
      pColor.setHSL(hue, 0.8, 0.6);

      const lerpFactor = THREE.MathUtils.lerp(
        0.1,
        0.03,
        transitionProgress.current
      );
      positions[i].lerp(target, lerpFactor);

      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />;
};

const LoginBackground = ({ isExiting }) => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <Canvas
      camera={{ position: [0, 0, 150], fov: 60 }}
      dpr={[1, 1.5]}          // ✅ FIX: cap DPR at 1.5 (was [1, 2])
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 50, 250]} />
      <ParticleSwarm isExiting={isExiting} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />
      <Effects disableGamma>
        <unrealBloomPass
          threshold={0}
          strength={isExiting ? 2.5 : 1.8}
          radius={0.4}
        />
      </Effects>
    </Canvas>
  </div>
);

export default LoginBackground;