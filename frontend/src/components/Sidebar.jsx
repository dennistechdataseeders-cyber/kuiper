// frontend/src/components/Sidebar.jsx

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
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
  RefreshCw,
  Target,
  Logs,
  ChartBar,
  Ticket,
  Bell,
  GitFork,
  FolderOpen,
  Calendar,
  Clock,
  BarChart3,
  Camera,
  X
} from 'lucide-react';

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
import { useSidebar } from '../context/SidebarContext';
import NotificationBell from './NotificationBell';
import API_BASE_URL from '../config';
import companyLogoVideo from '../assets/Company_Logo_mp4.mp4'; // Import the video

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // GLOBAL SIDEBAR STATE
  const { isCollapsed, toggleSidebar } = useSidebar();

  // LOCAL STATES
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // PROFILE IMAGE STATES
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const userRole = localStorage.getItem('role') || 'User';
  const userName = localStorage.getItem('userName') || 'User';
  const userId = localStorage.getItem('userId');

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

  // HANDLE RESIZE FOR MOBILE DETECTION
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-collapse on mobile
      if (mobile && !isCollapsed) {
        toggleSidebar();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, toggleSidebar]);

  // FETCH PROFILE IMAGE
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !userId) return;
        
        const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const user = res.data.find(u => u._id === userId);
        if (user && user.profileImage) {
          setProfileImage(user.profileImage);
        }
      } catch (error) {
        console.error('Error fetching profile image:', error);
      }
    };
    
    fetchProfileImage();
  }, [userId]);

  // FETCH OPEN TICKET COUNT
  useEffect(() => {
    const fetchOpenTicketCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const res = await axios.get(`${API_BASE_URL}/api/notifications/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setOpenTicketCount(res.data.openTicketCount || 0);
      } catch (error) {
        console.error('Error fetching open ticket count:', error);
      }
    };
    
    fetchOpenTicketCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchOpenTicketCount, 30000);
    return () => clearInterval(interval);
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

  // HANDLE FILE SELECTION
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setShowImageUploadModal(true);
  };

  // UPLOAD PROFILE IMAGE
  const uploadProfileImage = async () => {
    if (!selectedFile) return;
    
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('profileImage', selectedFile);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/admin/upload-profile-image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.success) {
        setProfileImage(res.data.profileImage);
        setShowImageUploadModal(false);
        setSelectedFile(null);
        setImagePreview(null);
        toast.success('Profile image updated successfully!');
        // Refresh to update the image in all components
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(res.data.message || 'Failed to upload profile image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to upload profile image';
      toast.error(errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  // REMOVE PROFILE IMAGE
  const removeProfileImage = async () => {
    if (!profileImage) return;
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`${API_BASE_URL}/api/admin/remove-profile-image`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setProfileImage(null);
        setShowImageUploadModal(false);
        toast.success('Profile image removed');
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(res.data.message || 'Failed to remove profile image');
      }
    } catch (error) {
      console.error('Remove error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to remove profile image';
      toast.error(errorMessage);
    }
  };

  // HANDLE VIDEO LOGO CLICK
  const handleVideoLogoClick = () => {
    window.open('https://techdataseeders.in/', '_blank');
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

  // Get role display name
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'Admin': return 'Admin';
      case 'Sales Manager': return 'Sales Manager';
      case 'Sales': return 'Sales';
      case 'Project Manager': return 'Project Manager';
      case 'Developer': return 'Developer';
      case 'Team Lead': return 'Team Lead';
      case 'HR': return 'HR';
      case 'Finance': return 'Finance';
      default: return role;
    }
  };

  // MENU ITEMS - UPDATED WITH HRMS ROUTES
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
      { path: '/hr', icon: <Users size={18} />, label: 'HR Dashboard' },
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
      { path: '/employee', icon: <User size={18} />, label: 'My Dashboard' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    'Team Lead': [
      { path: '/teamlead', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/teamlead/projects', icon: <FolderKanban size={18} />, label: 'Projects' },
      { path: '/teamlead/feeds', icon: <Activity size={18} />, label: 'Feed Management' },
      { path: '/teamlead/feed-status', icon: <Activity size={18} />, label: 'Feed Status' },
      { path: '/employee', icon: <User size={18} />, label: 'My Dashboard' },
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
      { path: '/employee', icon: <User size={18} />, label: 'My Dashboard' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
    ],

    Client: [
      { path: '/client', icon: <Activity size={18} />, label: 'Feed Delivery' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'My Tickets' },
      // { path: '/employee', icon: <User size={18} />, label: 'My Dashboard' },
    ],

    HR: [
      { path: '/hr', icon: <Users size={18} />, label: 'HR Dashboard' },
      { path: '/hr/attendance-sync', icon: <RefreshCw size={18} />, label: 'Attendance Sync' },
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
      { path: '/profile', icon: <User size={18} />, label: 'Profile' },
    ],
      
    Finance: [
      { path: '/tickets', icon: <Ticket size={18} />, label: 'Tickets' },
      { path: '/knowledge', icon: <FolderOpen size={18} />, label: 'One Knowledge' },
      { path: '/profile', icon: <User size={18} />, label: 'Profile' },
      { path: '/employee', icon: <User size={18} />, label: 'My Dashboard' },
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
    if (path === '/hr') return location.pathname === '/hr';
    if (path === '/employee') return location.pathname === '/employee';
    return location.pathname.startsWith(path);
  };

  // Helper to check if a menu item should show a badge
  const shouldShowBadge = (item) => {
    return item.label === 'Tickets' && openTicketCount > 0;
  };

  // Determine sidebar classes based on mobile state
  const getSidebarClasses = () => {
    const baseClasses = 'fixed top-0 left-0 h-screen bg-black text-slate-400 border-r border-slate-800 shadow-2xl transition-all duration-300 ease-in-out z-50';
    
    if (isMobile) {
      return `${baseClasses} ${isCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100 w-64'}`;
    }
    
    return `${baseClasses} ${isCollapsed ? 'w-[80px]' : 'w-[264px]'}`;
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside className={getSidebarClasses()}>
        {/* HEADER - Reduced padding on mobile */}
        <div
          className={`border-b border-slate-800 transition-all duration-300 ${
            isMobile ? 'p-3' : isCollapsed && !isMobile ? 'p-6 px-3' : 'p-6'
          }`}
        >
          <div className={`flex items-center ${isCollapsed && !isMobile ? 'justify-center' : ''}`}>
            <KuiperLogo isExpanded={!isCollapsed || isMobile} />
          </div>
        </div>

        {/* NOTIFICATIONS SECTION */}
        <div className={`${isCollapsed && !isMobile ? 'px-2' : 'px-3'} mt-3`}>
          <div className={`flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10`}>
            {(!isCollapsed || isMobile) && (
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.3em]">
                Notifications
              </span>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* NAVIGATION - Reduced padding on mobile */}
        <nav
          className={`p-2 space-y-1 overflow-y-auto overflow-x-visible no-scrollbar ${
            isCollapsed && !isMobile
              ? 'h-[calc(100vh-90px)]'
              : isMobile
              ? 'h-[calc(100vh-320px)]'
              : 'h-[calc(100vh-380px)]'
          }`}
        >
          {links.map((item) => {
            const active = isRouteActive(item.path);
            const showBadge = shouldShowBadge(item);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 p-1.5 rounded-xl transition-all duration-200 group ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'hover:bg-slate-800 hover:text-slate-200 text-slate-400'
                } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                title={isCollapsed && !isMobile ? item.label : ''}
                onClick={() => {
                  if (isMobile && !isCollapsed) {
                    toggleSidebar();
                  }
                }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {(!isCollapsed || isMobile) && (
                  <>
                    <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap flex-1">
                      {item.label}
                    </span>
                    {showBadge && (
                      <span className="ml-auto bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {openTicketCount > 99 ? '99+' : openTicketCount}
                      </span>
                    )}
                  </>
                )}
                {isCollapsed && !isMobile && showBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center shadow-md">
                    {openTicketCount > 99 ? '99+' : openTicketCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ACCOUNT SECTION - WITH VIDEO LOGO ABOVE */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-2 border-t border-slate-800 ${
            isCollapsed && !isMobile ? 'px-2' : ''
          }`}
          ref={menuRef}
        >
          {/* VIDEO LOGO - Clickable - Above Account Section */}
          {(!isCollapsed || isMobile) && (
            <div 
              className="flex items-center justify-center gap-2 mb-2 px-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleVideoLogoClick}
              title="Visit TechDataSeeders"
            >
              <div className="flex items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-black/80 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
                  <video
                    src={companyLogoVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Collapsed version - smaller video icon only - Clickable */}
          {isCollapsed && !isMobile && (
            <div 
              className="flex justify-center mb-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleVideoLogoClick}
              title="Visit TechDataSeeders"
            >
              <div className="w-8 h-8 rounded-full bg-black/80 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
                <video
                  src={companyLogoVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* USER MENU */}
          {showUserMenu && (
            <div
              className={`absolute bottom-full left-3 mb-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[180px] animate-in slide-in-from-bottom-4 duration-200 z-[60] ${
                isCollapsed && !isMobile ? 'left-1/2 -translate-x-1/2' : ''
              }`}
            >
              {/* Update Profile Picture Option */}
              <button
                onClick={() => {
                  setShowImageUploadModal(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 p-1.5 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <Camera size={13} className="text-blue-400" />
                <span>Update Profile Picture</span>
              </button>

              <button
                onClick={handleDownloadGuide}
                className="w-full flex items-center gap-2 p-1.5 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <FileText size={13} className="text-blue-400" />
                <span>User Guide</span>
              </button>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 p-1.5 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <Settings size={13} className="text-purple-400" />
                <span>Change Password</span>
              </button>

              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 p-1.5 text-slate-300 hover:bg-white/5 rounded-xl transition-all text-xs font-bold"
              >
                <Bell size={13} className="text-blue-400" />
                <span>Notification Settings</span>
              </button>

              <div className="h-px bg-white/5 my-1 mx-1" />

              <button
                onClick={() => {
                  setShowLogoutModal(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2 p-1.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-xs font-bold"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* ACCOUNT BUTTON - ENLARGED VERSION WITH PROFILE IMAGE */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
              showUserMenu
                ? 'bg-slate-800 border border-white/5 shadow-xl'
                : 'hover:bg-slate-800'
            } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
          >
            {/* User Avatar - Enlarged with Profile Image */}
            <div className="relative flex-shrink-0 group">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Camera size={14} className="text-white" />
              </div>
              {showUserMenu && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black" />
              )}
            </div>

            {/* Name and Role - Only when expanded - Enlarged text */}
            {(!isCollapsed || isMobile) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-white truncate">
                  {userName}
                </p>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${getRoleStyles(userRole).split(' ')[2] || 'text-slate-400'}`}>
                  {getRoleDisplayName(userRole)}
                </p>
              </div>
            )}

            {/* Chevron - Only when expanded - Enlarged */}
            {(!isCollapsed || isMobile) && (
              <ChevronUp
                size={14}
                className={`transition-transform duration-300 flex-shrink-0 ${
                  showUserMenu ? 'rotate-0' : 'rotate-180'
                } ${showUserMenu ? 'text-blue-400' : 'text-slate-500'}`}
              />
            )}
          </button>
        </div>
      </aside>

      {/* TOGGLE BUTTON - Hide on mobile */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          className={`fixed top-10 bg-blue-600 text-white rounded-full p-1.5 border-4 border-slate-900 hover:bg-blue-500 transition-all duration-300 z-[60] shadow-xl ${
            isCollapsed ? 'left-[68px]' : 'left-[252px]'
          }`}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* Mobile toggle button - smaller and more compact */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className={`fixed top-1 left-1 bg-blue-600 text-white rounded-lg p-2.5 border border-slate-700 hover:bg-blue-500 transition-all duration-300 z-[60] shadow-lg ${
            !isCollapsed ? 'hidden' : ''
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* PROFILE IMAGE UPLOAD MODAL */}
      {showImageUploadModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowImageUploadModal(false);
                setSelectedFile(null);
                setImagePreview(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Profile Picture</h3>

            {imagePreview ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-blue-500/30">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview(null);
                      fileInputRef.current.click();
                    }}
                    className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all"
                  >
                    Change Photo
                  </button>
                  <button
                    onClick={uploadProfileImage}
                    disabled={uploadingImage}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                {profileImage ? (
                  <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-blue-500/30">
                    <img
                      src={profileImage}
                      alt="Current profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                >
                  Choose Image
                </button>
                {profileImage && (
                  <button
                    onClick={removeProfileImage}
                    className="px-6 py-2 bg-red-600/20 text-red-400 rounded-xl font-bold text-sm hover:bg-red-600/30 transition-all"
                  >
                    Remove Photo
                  </button>
                )}
                <p className="text-xs text-slate-400 text-center">
                  Supported formats: JPEG, PNG, GIF, WEBP<br />
                  Max size: 5MB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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