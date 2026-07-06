// frontend/src/components/Sidebar.jsx

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  File,
  FolderTree,
  Activity,
  LogOut,
  Briefcase,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  AlertTriangle,
  User,
  FileText,
  Settings,
  ChevronUp,
  FolderKanban,
  TrendingUp,
  Building2,
  Target,
  Logs,
  ChartBar,
  Ticket,
  Bell,
  GitFork,
  FolderOpen
} from 'lucide-react';

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
import { useSidebar } from '../context/SidebarContext';
import NotificationBell from './NotificationBell';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // GLOBAL SIDEBAR STATE
  const { isCollapsed, toggleSidebar } = useSidebar();

  // LOCAL STATES
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const menuRef = useRef(null);

  const userRole = localStorage.getItem('role') || 'User';
  const userName = localStorage.getItem('userName') || 'User';

  // CLOSE MENU ON OUTSIDE CLICK
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // LOGOUT
  const handleLogout = () => {
    const itemsToClear = [
      'token',
      'role',
      'userName',
      'userId',
      'lastActive',
    ];

    itemsToClear.forEach((item) => localStorage.removeItem(item));

    navigate('/login');
  };

  // DOWNLOAD GUIDE
  const handleDownloadGuide = () => {
    window.open(
      'https://res.cloudinary.com/dhcwcyqke/image/upload/v1778510161/Future_Feature_Office_File_bhznye.pdf',
      '_blank'
    );
  };

  // ROLE BADGE COLORS
  const getRoleStyles = (role) => {
    switch (role) {
      case 'Admin':
        return 'from-red-500/20 to-orange-500/20 text-orange-300 border-orange-400/20';
      case 'Sales Manager':
        return 'from-purple-500/20 to-blue-500/20 text-purple-300 border-purple-400/20';
      case 'Sales':
        return 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-400/20';
      case 'Project Manager':
        return 'from-cyan-500/20 to-sky-500/20 text-cyan-300 border-cyan-400/20';
      case 'Developer':
        return 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-400/20';
      case 'Team Lead':
        return 'from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-400/20';
      case 'HR':
        return 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-400/20';
      case 'Finance':
        return 'from-green-500/20 to-emerald-500/20 text-green-300 border-green-400/20';
      default:
        return 'from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-400/20';
    }
  };

  // MENU ITEMS
  const menuItems = {
    Admin: [
      { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/admin/projects', icon: <FolderKanban size={18} />, label: 'Projects' },
      { path: '/admin/users', icon: <Users size={18} />, label: 'Users' },
      { path: '/view_analytics', icon: <TrendingUp size={18} />, label: 'Analytics' },
      { path: '/sales/add_org', icon: <Building2 size={18} />, label: 'Organizations' },
      { path: '/sales/lead_generation', icon: <Briefcase size={18} />, label: 'Lead Generation' },
      { path: '/pm/feeds', icon: <Logs size={18} />, label: 'Feed' },
      { path: '/admin/project-clients', icon: <Users size={18} />, label: 'Project Clients' }, 
      { path: '/pm/resource-analytics', icon: <ChartBar size={18} />, label: 'Resource Analytics' },
      { path: '/admin/ticket-rules', icon: <Mail size={18} />, label: 'Ticket Rules' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' }
    ],

    'Sales Manager': [
      { path: '/sales-manager', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/admin/users', icon: <UserPlus size={18} />, label: 'Team' },
      { path: '/sales/prospects', icon: <Target size={18} />, label: 'Prospects' },
      { path: '/sales/add_org', icon: <Building2 size={18} />, label: 'Organizations' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    Sales: [
      { path: '/sales', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/sales/prospects', icon: <Target size={18} />, label: 'Prospects' },
      { path: '/sales/add_org', icon: <Building2 size={18} />, label: 'Organizations' },
      { path: '/sales/lead_generation', icon: <Briefcase size={18} />, label: 'Lead Generation' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    'Project Manager': [
      { path: '/admin/projects', icon: <FolderKanban size={18} />, label: 'Projects' },
      { path: '/pm/feeds', icon: <Logs size={18} />, label: 'Feed' },
      { path: '/pm/git-manager', icon: <GitFork size={18} />, label: 'Git Manager' },
      { path: '/pm/resource-analytics', icon: <ChartBar size={18} />, label: 'Resource Analytics' },
      { path: '/pm/feed-status', icon: <Activity size={18} />, label: 'Feed Status' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    'Team Lead': [
      { path: '/teamlead', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/teamlead/projects', icon: <FolderKanban size={18} />, label: 'Projects' },
      { path: '/teamlead/feeds', icon: <Activity size={18} />, label: 'Feed Management' },
      { path: '/teamlead/feed-status', icon: <Activity size={18} />, label: 'Feed Status' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/teamlead/developers', icon: <Users size={18} />, label: 'Team' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    Developer: [
      { path: '/developer', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/developer/worklog', icon: <FileText size={18} />, label: 'Worklog' },
      { path: '/developer/projects', icon: <FolderKanban size={18} />, label: 'Projects' },
      { path: '/developer/feeds', icon: <File size={18} />, label: 'Feeds' },
      { path: '/developer/git-feeds', icon: <GitFork size={18} />, label: 'Git Feeds' },
      { path: '/developer/feed-status', icon: <Activity size={18} />, label: 'Feed Status' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    Client: [
      { path: '/client', icon: <Activity size={18} />, label: 'Feed Delivery' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'My Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    HR: [
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
      { path: '/profile', icon: <User size={18} />, label: 'Profile' },
    ],
      
    Finance: [
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
      { path: '/profile', icon: <User size={18} />, label: 'Profile' },
    ],
  };

  const links = menuItems[userRole] || [];

  // FIXED ACTIVE ROUTE LOGIC
  const isRouteActive = (path) => {
    if (path === '/sales') return location.pathname === '/sales';
    if (path === '/sales-manager') return location.pathname === '/sales-manager';
    if (path === '/developer') return location.pathname === '/developer';
    if (path === '/admin') return location.pathname === '/admin';
    if (path === '/teamlead') return location.pathname === '/teamlead';
    if (path === '/knowledge') return location.pathname === '/knowledge';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-black text-slate-400 border-r border-slate-800 shadow-2xl transition-all duration-300 ease-in-out z-50 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* HEADER */}
        <div
          className={`p-6 border-b border-slate-800 transition-all duration-300 ${
            isCollapsed ? 'px-3' : ''
          }`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
            <KuiperLogo isExpanded={!isCollapsed} />
          </div>
        </div>

        {/* NOTIFICATIONS SECTION */}
        <div className={`${isCollapsed ? 'px-2' : 'px-4'} mt-4`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10`}>
            {!isCollapsed && (
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">
                Notifications
              </span>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* USER CARD - Only when expanded - SMALLER SIZE */}
        {!isCollapsed && (
          <div className="px-4 mt-3">
            <div className="flex flex-col items-center justify-center text-center px-3 py-3 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10 transition-all duration-500">
              <p className="text-[7px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">
                Authenticated
              </p>
              <h4 className="text-[11px] font-bold text-white truncate max-w-[160px] mb-2">
                {userName}
              </h4>
              <span
                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-gradient-to-r border ${getRoleStyles(
                  userRole
                )}`}
              >
                {userRole}
              </span>
            </div>
          </div>
        )}

        {/* NAVIGATION - Adjust height based on collapsed state */}
        <nav
          className={`p-3 space-y-1.5 overflow-y-auto overflow-x-visible no-scrollbar ${
            isCollapsed
              ? 'h-[calc(100vh-100px)]'
              : 'h-[calc(100vh-380px)]'
          }`}
        >
          {links.map((item) => {
            const active = isRouteActive(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200 group ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'hover:bg-slate-800 hover:text-slate-200 text-slate-400'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <span className="text-[12px] font-semibold tracking-tight whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ACCOUNT SECTION */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 ${
            isCollapsed ? 'px-2' : ''
          }`}
          ref={menuRef}
        >
          {/* USER MENU */}
          {showUserMenu && (
            <div
              className={`absolute bottom-full left-4 mb-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[200px] animate-in slide-in-from-bottom-4 duration-200 z-[60] ${
                isCollapsed ? 'left-1/2 -translate-x-1/2' : ''
              }`}
            >
              <button
                onClick={handleDownloadGuide}
                className="w-full flex items-center gap-2.5 p-2 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <FileText size={14} className="text-blue-400" />
                <span>User Guide</span>
              </button>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <Settings size={14} className="text-purple-400" />
                <span>Change Password</span>
              </button>

              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <Bell size={14} className="text-blue-400" />
                <span>Notification Settings</span>
              </button>

              <div className="h-px bg-white/5 my-1 mx-1" />

              <button
                onClick={() => {
                  setShowLogoutModal(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-xs font-bold"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* ACCOUNT BUTTON */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center gap-2.5 w-full p-2 rounded-xl transition-all ${
              showUserMenu
                ? 'bg-slate-800 border border-white/5 shadow-xl'
                : 'hover:bg-slate-800'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="relative">
              <User
                size={16}
                className={showUserMenu ? 'text-blue-400' : 'text-slate-400'}
              />
              {showUserMenu && (
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full border border-black" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-[11px] font-semibold text-slate-200">
                  Account
                </span>
                <ChevronUp
                  size={12}
                  className={`transition-transform duration-300 ${
                    showUserMenu ? 'rotate-0' : 'rotate-180'
                  }`}
                />
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* TOGGLE BUTTON */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-10 bg-blue-600 text-white rounded-full p-1.5 border-4 border-slate-900 hover:bg-blue-500 transition-all duration-300 z-[60] shadow-xl ${
          isCollapsed ? 'left-[68px]' : 'left-[244px]'
        }`}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="p-3 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-white mb-2 tracking-tight">
                Confirm Logout
              </h2>
              <p className="text-slate-400 text-xs font-medium mb-6 leading-relaxed px-3">
                Are you sure you want to exit? You will be required to
                authenticate again to access the portal.
              </p>
              <div className="flex w-full gap-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95"
                >
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