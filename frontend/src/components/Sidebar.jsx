import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, Users, FolderTree, Activity, LogOut, 
  Briefcase, UserPlus, ChevronLeft, ChevronRight, ShieldCheck, Inbox,
  X, AlertTriangle, User, FileText, Settings, ChevronUp,CircleUserRound
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('role') || 'User'; 
  const userName = localStorage.getItem('userName') || 'User';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    const itemsToClear = ['token', 'role', 'userName', 'userId', 'lastActive'];
    itemsToClear.forEach(item => localStorage.removeItem(item));
    window.location.href = '/login'; 
  };

  const handleDownloadGuide = () => {
    // Replace with the actual path to your PDF
    window.open('/user-guide.pdf', '_blank');
  };

  const getRoleStyles = (role) => {
    switch (role) {
      case 'Admin': return 'from-red-500/20 to-orange-500/20 text-orange-300 border-orange-400/20';
      case 'Sales Manager': return 'from-purple-500/20 to-blue-500/20 text-purple-300 border-purple-400/20';
      case 'Sales': return 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-400/20';
      default: return 'from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-400/20';
    }
  };

  const allMenuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20}/>, path: '/admin', roles: ['Admin'] },
    { name: 'Sales Manager', icon: <LayoutDashboard size={20}/>, path: '/sales-manager', roles: ['Sales Manager'] },
    { name: 'User Directory', icon: <ShieldCheck size={20}/>, path: '/admin/users', roles: ['Admin', 'Sales Manager'] },
    { name: 'Sales Board', icon: <Briefcase size={20}/>, path: '/sales', roles: ['Sales'] },
    { name: 'Add Organization', icon: <UserPlus size={20}/>, path: '/sales/add_org', roles: ['Admin','Sales','Sales Manager'] },
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
      <div className={`h-screen bg-black text-slate-400 fixed left-0 top-0 flex flex-col border-r border-slate-800 transition-all duration-300 z-50 ${isExpanded ? 'w-64 p-6' : 'w-20 p-4 items-center'}`}>
        
        <button onClick={() => setIsExpanded(!isExpanded)} className="absolute -right-3 top-10 bg-blue-600 text-white rounded-full p-1 border-4 border-slate-900 hover:bg-blue-500 transition-colors z-50">
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <KuiperLogo isExpanded={isExpanded} />

        <div className={`flex flex-col items-center justify-center text-center px-4 py-6 mb-8 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10 transition-all duration-500 ${isExpanded ? "opacity-100 scale-100" : "opacity-0 h-0 p-0 mb-0 scale-95"}`}>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Authenticated</p>
          <h4 className="text-sm font-bold text-white truncate max-w-[180px] mb-3">{userName}</h4>
          <span className={`inline-flex items-center justify-center min-w-[130px] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r border ${getRoleStyles(userRole)}`}>
            {userRole}
          </span>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto w-full no-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-slate-200'} ${!isExpanded && 'justify-center'}`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}>{item.icon}</span>
                {isExpanded && <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* --- USER ACCOUNT MENU SECTION --- */}
        <div className="mt-auto relative w-full" ref={menuRef}>
          {/* Popover Menu */}
          {showUserMenu && (
            <div className={`absolute bottom-full left-0 mb-4 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-2 min-w-[200px] animate-in slide-in-from-bottom-4 duration-200 z-[60] ${!isExpanded && 'left-1/2 -translate-x-1/2'}`}>
              <button 
                onClick={handleDownloadGuide}
                className="w-full flex items-center gap-3 p-3 text-slate-300 hover:bg-white/5 rounded-2xl transition-all text-sm font-bold"
              >
                <FileText size={18} className="text-blue-400" />
                <span>User Guide</span>
              </button>
              <button 
                onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 p-3 text-slate-300 hover:bg-white/5 rounded-2xl transition-all text-sm font-bold"
              >
                <Settings size={18} className="text-purple-400" />
                <span>Change Password</span>
              </button>
              <div className="h-px bg-white/5 my-1 mx-2" />
              <button 
                onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all text-sm font-bold"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* User Icon Toggle Button */}
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all w-full border border-transparent ${showUserMenu ? 'bg-slate-800 border-white/5 shadow-xl' : 'hover:bg-slate-800'} ${!isExpanded && 'justify-center'}`}
          >
            <div className="relative">
              <User size={20} className={showUserMenu ? 'text-blue-400' : 'text-slate-400'} />
              {showUserMenu && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />}
            </div>
            {isExpanded && (
              <div className="flex items-center justify-between flex-1">
                <span className="font-bold text-sm text-slate-200">Account</span>
                <ChevronUp size={14} className={`transition-transform duration-300 ${showUserMenu ? 'rotate-0' : 'rotate-180'}`} />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="p-4 bg-red-500/10 rounded-3xl mb-6 border border-red-500/20">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Confirm Logout</h2>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed px-4">
                Are you sure you want to exit? You will be required to authenticate again to access the portal.
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest border border-white/5">
                  Cancel
                </button>
                <button onClick={handleLogout} className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;