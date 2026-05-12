import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import { Eye, EyeOff } from 'lucide-react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';
import API_BASE_URL from '../config';
import { motion, AnimatePresence } from 'framer-motion';

extend({ UnrealBloomPass });

// --- 3D BACKGROUND COMPONENTS ---

const ParticleSwarm = ({ isExiting }) => {
  const meshRef = useRef();
  const count = 20000;
  
  // Use a ref to track the transition progress (0 to 1) for smoothness
  const transitionProgress = useRef(0);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  
  const positions = useMemo(() => {
     const pos = [];
     for(let i=0; i<count; i++) {
       pos.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
     }
     return pos;
  }, []);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);
  const PARAMS = useMemo(() => ({"pull": 0.2, "chaos": 0.02, "speed": 0.03}), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const time = state.clock.elapsedTime;

    // Smoothly ramp up the transition progress instead of a boolean jump
    transitionProgress.current = THREE.MathUtils.lerp(
      transitionProgress.current, 
      isExiting ? 1 : 0, 
      delta * 2 // Speed of the transition ramp
    );

    const currentSpeed = THREE.MathUtils.lerp(PARAMS.speed, PARAMS.speed * 12, transitionProgress.current);
    const currentPull = THREE.MathUtils.lerp(PARAMS.pull, 0.9, transitionProgress.current);

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
        
        target.set(xFinal * (1 - currentPull), yFinal * (1 - currentPull), zFinal * (1 - currentPull));
        
        const hue = 0.55 + (Math.sin(angle * 0.5) * 0.1); 
        pColor.setHSL(hue, 0.8, 0.6);

        // Lerp factor becomes more aggressive as we exit
        const lerpFactor = THREE.MathUtils.lerp(0.1, 0.03, transitionProgress.current);
        positions[i].lerp(target, lerpFactor);
        
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

const BackgroundScene = ({ isExiting }) => (
  <div className="absolute inset-0 z-0 overflow-hidden">
    <Canvas camera={{ position: [0, 0, 150], fov: 60 }} dpr={[1, 2]}>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 50, 250]} />
      <ParticleSwarm isExiting={isExiting} />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      <Effects disableGamma>
        <unrealBloomPass threshold={0} strength={isExiting ? 2.5 : 1.8} radius={0.4} />
      </Effects>
    </Canvas>
  </div>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false); 
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      const { token, user } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userId', user.id); 
      localStorage.setItem('lastActive', Date.now().toString());
      
      toast.success(`Welcome back, ${user.name}!`);
      
      // TRIGGER ANIMATION
      setIsExiting(true);

      const role = user.role.toLowerCase();
      let targetRoute = role === 'admin' ? '/admin' : 
                        role === 'developer' ? '/developer' : 
                        role === 'sales' ? '/sales' : '/login';

      // Wait for the smooth lerp and warp to peak before navigating
      setTimeout(() => navigate(targetRoute, { replace: true }), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen relative overflow-hidden">
      {/* Background stays mounted to avoid abrupt Canvas disposal */}
      <BackgroundScene isExiting={isExiting} />

      <AnimatePresence>
        {!isExiting && (
          <motion.div 
            key="login-ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              opacity: 0, 
              y: -20, 
              filter: "blur(10px)",
              transition: { duration: 0.8, ease: "easeInOut" } 
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
                    <img src="/images/login_img.png" alt="logo" className="w-full h-full object-contain" />
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
                  <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2">Credential Email</label>
                  <input 
                    type="email" 
                    required
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2 ml-2">Secure Key</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white pr-12 transition-all"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 "
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  className={`w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest mt-4 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? "Syncing..." : "Login"}
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