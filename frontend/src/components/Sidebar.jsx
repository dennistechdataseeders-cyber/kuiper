import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, FolderTree, Activity, LogOut, 
  Briefcase, UserPlus, ChevronLeft, ChevronRight, ShieldCheck, Inbox
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('role'); 
  const userName = localStorage.getItem('userName') || 'User';

  const handleLogout = () => {
    localStorage.clear(); 
    navigate('/login');
  };

  const allMenuItems = [
    // Admin & Sales Manager Dashboards
    { name: 'Dashboard', icon: <LayoutDashboard size={20}/>, path: '/admin', roles: ['Admin'] },
    { name: 'Sales Manager', icon: <LayoutDashboard size={20}/>, path: '/sales-manager', roles: ['Sales Manager'] },
    
    // User Management (SM sees Sales Reps, Admin sees everyone)
    { name: 'User Directory', icon: <ShieldCheck size={20}/>, path: '/admin/users', roles: ['Admin', 'Sales Manager'] },
    
    // Sales Operations
    { name: 'Sales Board', icon: <Briefcase size={20}/>, path: '/sales', roles: ['Sales'] },
    { name: 'Add Organization', icon: <UserPlus size={20}/>, path: '/sales/add_org', roles: ['Sales'] },
    { name: 'Lead Generation', icon: <UserPlus size={20}/>, path: '/sales/lead_generation', roles: ['Sales', 'Admin'] },
    { name: 'Prospects', icon: <Users size={20}/>, path: '/sales/prospects', roles: ['Sales', 'Admin', 'Sales Manager'] },
    
    // Delivery & Projects
    { name: 'Projects', icon: <FolderTree size={20}/>, path: '/admin/projects', roles: ['Admin', 'Project Manager'] },
    { name: 'Dev Hub', icon: <Activity size={20}/>, path: '/developer', roles: ['Admin', 'Developer'] },
    { name: 'My Bucket', path: '/developer/bucket', icon: <Inbox size={20} />, roles: ['Developer'] },
    
    // Analytics
    { name: 'Audit Trail', icon: <Activity size={20}/>, path: '/view_analytics', roles: ['Admin', 'Project Manager', 'Sales Manager'] },
  ];

  const filteredItems = allMenuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className={`h-screen bg-slate-900 text-slate-400 fixed left-0 top-0 flex flex-col border-r border-slate-800 transition-all duration-300 z-50 ${isExpanded ? 'w-64 p-6' : 'w-20 p-4 items-center'}`}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="absolute -right-3 top-10 bg-blue-600 text-white rounded-full p-1 border-4 border-slate-900 hover:bg-blue-500 transition-colors">
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className={`flex items-center gap-3 mb-10 px-2 transition-all ${!isExpanded && 'justify-center'}`}>
        <img src="/images/org_logo.png" alt="logo" className="w-10 h-10 object-cover rounded-lg shrink-0" />
        {isExpanded && <span className="text-white font-black text-xl tracking-tighter whitespace-nowrap"><span className="text-blue-500">KUI</span>PER</span>}
      </div>

      <div className={`mb-8 px-2 overflow-hidden transition-all ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 mb-0'}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Account</p>
        <p className="text-white font-bold truncate">{userName}</p>
        <span className="text-[10px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded-md font-bold uppercase">{userRole}</span>
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

      <button onClick={handleLogout} className={`flex items-center gap-3 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all mt-auto font-bold text-sm ${!isExpanded && 'justify-center'}`}>
        <LogOut size={20} className="shrink-0" />
        {isExpanded && <span>Logout Session</span>}
      </button>
    </div>
  );
};

export default Sidebar;