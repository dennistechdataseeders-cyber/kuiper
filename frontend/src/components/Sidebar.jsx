import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, FolderTree, Activity, LogOut, 
  Briefcase, UserPlus, ChevronLeft, ChevronRight, ShieldCheck, Inbox,
  X, AlertTriangle // Added for modal
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal state
  const location = useLocation();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('role'); 
  const userName = localStorage.getItem('userName') || 'User';

  const handleLogout = () => {
    // Clear only auth-related items to prevent component crashes
    const itemsToClear = ['token', 'role', 'userName', 'userId', 'lastActive'];
    itemsToClear.forEach(item => localStorage.removeItem(item));
    
    // Force a window location change if navigate('/') isn't cleaning up the state
    window.location.href = '/login'; 
  };

  const allMenuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20}/>, path: '/admin', roles: ['Admin'] },
    { name: 'Sales Manager', icon: <LayoutDashboard size={20}/>, path: '/sales-manager', roles: ['Sales Manager'] },
    { name: 'User Directory', icon: <ShieldCheck size={20}/>, path: '/admin/users', roles: ['Admin', 'Sales Manager'] },
    { name: 'Sales Board', icon: <Briefcase size={20}/>, path: '/sales', roles: ['Sales'] },
    { name: 'Add Organization', icon: <UserPlus size={20}/>, path: '/sales/add_org', roles: ['Sales'] },
    { name: 'Lead Generation', icon: <UserPlus size={20}/>, path: '/sales/lead_generation', roles: ['Sales', 'Admin'] },
    { name: 'Prospects', icon: <Users size={20}/>, path: '/sales/prospects', roles: ['Sales', 'Admin', 'Sales Manager'] },
    { name: 'Projects', icon: <FolderTree size={20}/>, path: '/admin/projects', roles: ['Admin', 'Project Manager'] },
    { name: 'Dev Hub', icon: <Activity size={20}/>, path: '/developer', roles: ['Admin', 'Developer'] },
    { name: 'My Bucket', path: '/developer/bucket', icon: <Inbox size={20} />, roles: ['Developer'] },
    { name: 'Audit Trail', icon: <Activity size={20}/>, path: '/view_analytics', roles: ['Admin', 'Project Manager', 'Sales Manager'] },
  ];

  const filteredItems = allMenuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Sidebar Container */}
      <div className={`h-screen bg-black text-slate-400 fixed left-0 top-0 flex flex-col border-r border-slate-800 transition-all duration-300 z-50 ${isExpanded ? 'w-64 p-6' : 'w-20 p-4 items-center'}`}>
        <button onClick={() => setIsExpanded(!isExpanded)} className="absolute -right-3 top-10 bg-blue-600 text-white rounded-full p-1 border-4 border-slate-900 hover:bg-blue-500 transition-colors">
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <KuiperLogo isExpanded={isExpanded} />

        <div className={`px-4 py-4 mb-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.08)] transition-all duration-500 ease-in-out ${isExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 h-0 overflow-hidden p-0 mb-0"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">User : {userName}</p>
          <span className="inline-block text-[10px] px-10 py-1 rounded-lg font-semibold uppercase tracking-wide bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-400/20 shadow-[0_0_12px_rgba(59,130,246,0.2)] transition-all duration-300 hover:shadow-[0_0_18px_rgba(59,130,246,0.35)] hover:scale-105">
            {userRole}
          </span>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto w-full no-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-slate-200'} ${!isExpanded && 'justify-center'}`}>
                <span className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}>{item.icon}</span>
                {isExpanded && <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button triggers modal instead of immediate logout */}
        <button 
          onClick={() => setShowLogoutModal(true)} 
          className={`flex items-center gap-3 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all mt-auto font-bold text-sm ${!isExpanded && 'justify-center'}`}
        >
          <LogOut size={20} className="shrink-0" />
          {isExpanded && <span>Logout</span>}
        </button>
      </div>

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 blur-[80px] rounded-full" />
            
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="p-4 bg-red-500/10 rounded-3xl mb-6 border border-red-500/20">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Confirm Logout</h2>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed px-4">
                Are you sure you want to exit? You will be required to authenticate again to access the portal.
              </p>

              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all active:scale-95"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button 
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;