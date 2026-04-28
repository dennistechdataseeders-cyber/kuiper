import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import { Eye, EyeOff } from 'lucide-react'; // Using Lucide icons for a clean look
import API_BASE_URL from '../config';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // NEW STATE
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await axios.post( `${API_BASE_URL}/api/auth/login`, { email, password });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userId', user.id); 
      localStorage.setItem('lastActive', Date.now().toString());

      toast.success(`Welcome back, ${user.name}!`);

      setTimeout(() => {
        if (user.role === 'Admin') {
          window.location.replace('/admin');
        } else if (user.role === 'Project Manager') {
          window.location.replace('/admin/projects');
        } else if (user.role === 'Sales') {
          window.location.replace('/sales');
        } else {
          window.location.replace('/developer');
        }
      }, 50);

    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form 
        onSubmit={handleLogin} 
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100"
      >
        <div className="mb-8">
          <h2 className="text-4xl font-black mb-2 text-slate-900 tracking-tight">Welcome Back</h2>
          <p className="text-slate-500 font-medium">Please enter your details to sign in.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              required
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
            <div className="relative"> {/* Relative container for the icon */}
              <input 
                type={showPassword ? "text" : "password"} // TOGGLE TYPE
                placeholder="••••••••" 
                required
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium pr-12"
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* Toggle Button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            disabled={isSubmitting}
            className={`w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all uppercase tracking-widest mt-4 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400 font-medium">
            System version 2.1.0 • {new Date().getFullYear()}
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;