import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Activity,
  LogOut,
  Briefcase,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Inbox,
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
  ChartBar
} from 'lucide-react';

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
import { useSidebar } from '../context/SidebarContext';

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

      default:
        return 'from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-400/20';
    }
  };

  // MENU ITEMS
  const menuItems = {
    Admin: [
      {
        path: '/admin',
        icon: <LayoutDashboard size={20} />,
        label: 'Dashboard',
      },
      {
        path: '/admin/projects',
        icon: <FolderKanban size={20} />,
        label: 'Projects',
      },
      {
        path: '/admin/users',
        icon: <Users size={20} />,
        label: 'Users',
      },
      {
        path: '/view_analytics',
        icon: <TrendingUp size={20} />,
        label: 'Analytics',
      },
      {
        path: '/sales/add_org',
        icon: <Building2 size={20} />,
        label: 'Organizations',
      },
      {
        path: '/sales/lead_generation',
        icon: <Briefcase size={20} />,
        label: 'Lead Generation',
      },
      {
        path: '/pm/feeds',
        icon: <Logs size={20} />,
        label: 'Feed Explorer',
      },
      {
        path: '/pm/task-progress',
        icon: <Activity size={20} />,
        label: 'Task Progress',
      },
      {
        path: '/pm/resource-analytics',
        icon: <ChartBar size={20} />,
        label: 'Resource Analytics',
      },
      // {
      //   path: '/sales/email-trigger',
      //   icon: <Inbox size={20} />,
      //   label: 'Email Trigger',
      // },
    ],

    'Sales Manager': [
      {
        path: '/sales-manager',
        icon: <LayoutDashboard size={20} />,
        label: 'Dashboard',
      },
      {
        path: '/admin/users',
        icon: <UserPlus size={20} />,
        label: 'Team',
      },
      {
        path: '/sales/prospects',
        icon: <Target size={20} />,
        label: 'Prospects',
      },
      {
        path: '/view_analytics',
        icon: <TrendingUp size={20} />,
        label: 'Analytics',
      },
      {
        path: '/sales/add_org',
        icon: <Building2 size={20} />,
        label: 'Organizations',
      },
      // {
      //   path: '/sales/email-trigger',
      //   icon: <Inbox size={20} />,
      //   label: 'Email Trigger',
      // },
    ],

    Sales: [
      {
        path: '/sales',
        icon: <LayoutDashboard size={20} />,
        label: 'Dashboard',
      },
      {
        path: '/sales/prospects',
        icon: <Target size={20} />,
        label: 'Prospects',
      },
      {
        path: '/sales/add_org',
        icon: <Building2 size={20} />,
        label: 'Organizations',
      },
      {
        path: '/sales/lead_generation',
        icon: <Briefcase size={20} />,
        label: 'Lead Generation',
      },
      {
        path: '/view_analytics',
        icon: <TrendingUp size={20} />,
        label: 'Analytics',
      },
      // {
      //   path: '/sales/email-trigger',
      //   icon: <Inbox size={20} />,
      //   label: 'Email Trigger',
      // },
    ],

    'Project Manager': [
      {
        path: '/admin/projects',
        icon: <FolderKanban size={20} />,
        label: 'Projects',
      },
      {
        path: '/pm/feeds',
        icon: <Logs size={20} />,
        label: 'Feed Explorer',
      },
      {
        path: '/pm/task-progress',
        icon: <Activity size={20} />,
        label: 'Task Progress',
      },
      {
        path: '/pm/resource-analytics',
        icon: <ChartBar size={20} />,
        label: 'Resource Analytics',
      },
      {
        path: '/view_analytics',
        icon: <TrendingUp size={20} />,
        label: 'Analytics',
      },
    ],

    Developer: [
      {
        path: '/developer',
        icon: <LayoutDashboard size={20} />,
        label: 'Dashboard',
      },
      {
        path: '/developer/bucket',
        icon: <FolderTree size={20} />,
        label: 'My Bucket',
      },
      {
        path: '/developer/worklog',
        icon: <FileText size={20} />,
        label: 'Worklog',
      },
    ],
  };

  const links = menuItems[userRole] || [];

  // FIXED ACTIVE ROUTE LOGIC
  const isRouteActive = (path) => {
    if (path === '/sales') {
      return location.pathname === '/sales';
    }

    if (path === '/sales-manager') {
      return location.pathname === '/sales-manager';
    }

    if (path === '/developer') {
      return location.pathname === '/developer';
    }

    if (path === '/admin') {
      return location.pathname === '/admin';
    }

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
          <div
            className={`flex items-center gap-3 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <KuiperLogo isExpanded={!isCollapsed} />
          </div>
        </div>

        {/* USER CARD */}
        {!isCollapsed && (
          <div className="px-4 mt-4">
            <div className="flex flex-col items-center justify-center text-center px-4 py-6 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10 transition-all duration-500">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">
                Authenticated
              </p>

              <h4 className="text-sm font-bold text-white truncate max-w-[180px] mb-3">
                {userName}
              </h4>

              <span
                className={`inline-flex items-center justify-center min-w-[130px] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r border ${getRoleStyles(
                  userRole
                )}`}
              >
                {userRole}
              </span>
            </div>
          </div>
        )}

        {/* NAVIGATION */}
       {/* NAVIGATION */}
<nav
  className={`p-4 space-y-2 overflow-y-auto no-scrollbar ${
    isCollapsed
      ? 'h-[calc(100vh-180px)]'
      : 'h-[calc(100vh-340px)]'
  }`}
>
  {links.map((item) => {
    const active = isRouteActive(item.path);

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group ${
          active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
            : 'hover:bg-slate-800 hover:text-slate-200 text-slate-400'
        } ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? item.label : ''}
      >
        <span>{item.icon}</span>

        {!isCollapsed && (
          <span className="font-bold text-sm tracking-tight whitespace-nowrap">
            {item.label}
          </span>
        )}
      </NavLink>
    );
  })}
</nav>

        {/* ACCOUNT SECTION */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 ${
            isCollapsed ? 'px-2' : ''
          }`}
          ref={menuRef}
        >
          {/* USER MENU */}
          {showUserMenu && (
            <div
              className={`absolute bottom-full left-4 mb-4 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-2 min-w-[220px] animate-in slide-in-from-bottom-4 duration-200 z-[60] ${
                isCollapsed ? 'left-1/2 -translate-x-1/2' : ''
              }`}
            >
              <button
                onClick={handleDownloadGuide}
                className="w-full flex items-center gap-3 p-3 text-slate-300 hover:bg-white/5 rounded-2xl transition-all text-sm font-bold"
              >
                <FileText size={18} className="text-blue-400" />
                <span>User Guide</span>
              </button>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 text-slate-300 hover:bg-white/5 rounded-2xl transition-all text-sm font-bold"
              >
                <Settings size={18} className="text-purple-400" />
                <span>Change Password</span>
              </button>

              <div className="h-px bg-white/5 my-1 mx-2" />

              <button
                onClick={() => {
                  setShowLogoutModal(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all text-sm font-bold"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* ACCOUNT BUTTON */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center gap-3 w-full p-3 rounded-2xl transition-all ${
              showUserMenu
                ? 'bg-slate-800 border border-white/5 shadow-xl'
                : 'hover:bg-slate-800'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="relative">
              <User
                size={20}
                className={
                  showUserMenu ? 'text-blue-400' : 'text-slate-400'
                }
              />

              {showUserMenu && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />
              )}
            </div>

            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span className="font-bold text-sm text-slate-200">
                  Account
                </span>

                <ChevronUp
                  size={14}
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
        {isCollapsed ? (
          <ChevronRight size={16} />
        ) : (
          <ChevronLeft size={16} />
        )}
      </button>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="p-4 bg-red-500/10 rounded-3xl mb-6 border border-red-500/20">
                <AlertTriangle size={32} className="text-red-500" />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                Confirm Logout
              </h2>

              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed px-4">
                Are you sure you want to exit? You will be required to
                authenticate again to access the portal.
              </p>

              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest border border-white/5"
                >
                  Cancel
                </button>

                <button
                  onClick={handleLogout}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95"
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