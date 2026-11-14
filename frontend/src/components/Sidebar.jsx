// frontend/src/components/Sidebar.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, FingerprintPattern,
  Users,
  File,
  Activity,
  LogOut,
  Briefcase,
  UserPlus,
  Mail,
  Layers,
  AlertTriangle,
  User,
  FileText,
  Settings,
  ChevronUp,
  ChevronDown,
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
  BarChart3,
  Camera,
  X,
  UsersRound,
  UserCog,
  UserCheck,
  Megaphone,
  CalendarDays,
  ListTodo,
  Video,
  Phone,
  Handshake,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

import {
  Contact, BookOpen, Gauge, BriefcaseBusiness, Rss, ChartPie, ChartColumn, HeartHandshake,
  CalendarHeart, CalendarOff, ClipboardList, Workflow, Tags, CodeXml, NotebookPen, FolderGit2,
  FileCode, GitBranch, LayoutGrid, PanelsTopLeft, ShieldCheck, FolderTree, Radio, Radar,
  SignalHigh, Truck, CalendarClock, Compass, Boxes, IdCard, Terminal, ClipboardCheck, Wrench, UsersRound as TeamIcon,
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
import { useSidebar } from '../context/SidebarContext';
import NotificationBell from './NotificationBell';
import API_BASE_URL from '../config';
import companyLogoVideo from '../assets/Company_Logo_mp4.mp4';
import io from 'socket.io-client';

// ============================================
// ONE ICON PER PAGE
// Every different page gets its own icon; the same page keeps the same icon
// in every role's menu. Anything not listed keeps the icon set below.
// ============================================
const ITEM_ICONS = {
  // Sales
  '/sales':                          PanelsTopLeft,
  '/sales-manager':                  Gauge,
  '/sales/leads':                    Target,
  '/sales/contacts':                 Contact,
  '/sales/accounts':                 Building2,
  '/sales/deals':                    Handshake,
  '/sales/activities/tasks':         ListTodo,
  '/sales/activities/meetings':      Video,
  '/sales/activities/calls':         Phone,
  // General
  '/tickets':                        Ticket,
  '/announcements':                  Megaphone,
  '/knowledge':                      BookOpen,
  '/employee':                       UserCog,
  // Admin
  '/admin':                          LayoutDashboard,
  '/view_analytics':                 TrendingUp,
  '/admin/users':                    Users,
  '/admin/customize':                SlidersHorizontal,
  '/admin/ticket-rules':             Workflow,
  '/admin/ticket-categories':        Tags,
  // Projects & feeds
  '/admin/projects':                 FolderKanban,
  '/admin/project-clients':          BriefcaseBusiness,
  '/pm/dashboard':                   LayoutGrid,
  '/pm/feeds':                       Rss,
  '/pm/feed-status':                 Activity,
  '/pm/resource-analytics':          ChartPie,
  '/pm/work-report':                 ChartColumn,
  '/pm/git-manager':                 GitFork,
  // Team lead
  '/teamlead':                       ShieldCheck,
  '/teamlead/projects':              FolderTree,
  '/teamlead/feeds':                 Radio,
  '/teamlead/feed-status':           Radar,
  '/teamlead/developers':            TeamIcon,
  // Developer
  '/developer':                      CodeXml,
  '/developer/worklog':              NotebookPen,
  '/developer/projects':             FolderGit2,
  '/developer/feeds':                FileCode,
  '/developer/git-feeds':            GitBranch,
  '/developer/feed-status':          SignalHigh,
  // Client
  '/client':                         Truck,
  // HR
  '/hr':                             HeartHandshake,
  '/hr/holidays':                    CalendarHeart,
  '/hr/leaves':                      CalendarOff,
  '/hr/attendance-sync':             RefreshCw,
  '/hr/employee-attendance':         UserCheck,
  '/hr/employee-attendance-report':  ClipboardList,
};

// Group headers (by group key) — also all different from each other and from the pages
const GROUP_ICONS = {
  sales:              Briefcase,
  'sales-activities': CalendarClock,
  activities:         Compass,
  general:            Compass,
  others:             FingerprintPattern,
  projects:           Boxes,
  hr:                 IdCard,
  developer:          Terminal,
  pm:                 ClipboardCheck,
  setup:              Wrench,
  team:               UserPlus,
};

const withUniqueIcons = (groups) =>
  groups.map((g) => {
    const GroupIcon = GROUP_ICONS[g.key];
    return {
      ...g,
      icon: g.icon && GroupIcon ? <GroupIcon size={18} /> : g.icon,
      items: (g.items || []).map((item) => {
        const ItemIcon = ITEM_ICONS[item.path];
        const size = g.icon ? 16 : 18; // flat "Home" items are a bit larger
        return ItemIcon ? { ...item, icon: <ItemIcon size={size} /> } : item;
      }),
    };
  });

// ============================================
// NAVIGATION GROUPS  (Zoho-style)
// ============================================
const buildMenuGroups = (role) => {
  const SALES_GROUP = {
    key: 'sales',
    label: 'Sales',
    icon: <Briefcase size={18} />,
    items: [
      { path: '/sales/leads', icon: <Target size={16} />, label: 'Leads' },
      { name: 'Contacts', path: '/sales/contacts', icon: <User size={18} />, label: 'Contacts' },
      { name: 'Accounts', path: '/sales/accounts', icon: <Building2 size={18} />, label: 'Accounts' },
      { path: '/sales/deals', icon: <Handshake size={16} />, label: 'Deals' },
    ],
  };

  const ACTIVITIES_GROUP = {
    key: 'activities',
    label: 'Activities',
    icon: <Activity size={18} />,
    items: [
      { path: '/tickets', icon: <Ticket size={16} />, label: 'Tickets' },
      { path: '/announcements', icon: <Megaphone size={16} />, label: 'Announcements' },
      { path: '/knowledge', icon: <FolderOpen size={16} />, label: 'Knowledge Base' },
    ],
  };

  const SALES_ACTIVITIES_GROUP = {
    key: 'sales-activities',
    label: 'Activities',
    icon: <Activity size={18} />,
    items: [
      { path: '/sales/activities/tasks', icon: <ListTodo size={16} />, label: 'Tasks' },
      { path: '/sales/activities/meetings', icon: <Video size={16} />, label: 'Meetings' },
      { path: '/sales/activities/calls', icon: <Phone size={16} />, label: 'Calls' },
    ],
  };

  const GENERAL_GROUP = { ...ACTIVITIES_GROUP, key: 'general', label: 'General' };

  const OTHERS_GROUP = {
    key: 'others',
    label: 'Attendence',
    icon: <FingerprintPattern size={18} />,
    items: [
      { path: '/employee', icon: <UserCog size={16} />, label: 'People Ops' },
    ],
  };

  // ---------------- Super Admin ----------------
  if (role === 'Super Admin') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
        { path: '/view_analytics', icon: <TrendingUp size={18} />, label: 'Analytics' },
      ]},
      { ...SALES_GROUP, items: [
        ...SALES_GROUP.items,
        { path: '/sales-manager', icon: <LayoutDashboard size={16} />, label: 'Sales Manager' },
      ]},
      SALES_ACTIVITIES_GROUP,
      {
        key: 'projects',
        label: 'Projects & Feeds',
        icon: <FolderKanban size={18} />,
        items: [
          { path: '/admin/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/admin/project-clients', icon: <Users size={16} />, label: 'Project Clients' },
          { path: '/pm/feeds', icon: <Logs size={16} />, label: 'Feed Management' },
          { path: '/pm/feed-status', icon: <Activity size={16} />, label: 'Feed Status' },
          { path: '/pm/resource-analytics', icon: <ChartBar size={16} />, label: 'Resource Analytics' },
          { path: '/pm/work-report', icon: <BarChart3 size={16} />, label: 'Work Report' },
        ],
      },
      {
        key: 'hr',
        label: 'HR',
        icon: <UsersRound size={18} />,
        items: [
          { path: '/hr', icon: <UsersRound size={16} />, label: 'HR Dashboard' },
          { path: '/hr/holidays', icon: <CalendarDays size={16} />, label: 'Holiday List' },
          { path: '/hr/leaves', icon: <Calendar size={16} />, label: 'Leave Management' },
          { path: '/hr/attendance-sync', icon: <RefreshCw size={16} />, label: 'Attendance Sync' },
          { path: '/hr/employee-attendance', icon: <UserCheck size={16} />, label: 'Employee Attendance' },
          { path: '/hr/employee-attendance-report', icon: <FileText size={16} />, label: 'Attendance Report' },
        ],
      },
      { ...GENERAL_GROUP, items: [
        ...GENERAL_GROUP.items,
        { path: '/admin/ticket-rules', icon: <Mail size={16} />, label: 'Ticket Rules' },
        { path: '/admin/ticket-categories', icon: <Layers size={16} />, label: 'Ticket Categories' },
      ]},
      {
        key: 'developer',
        label: 'Developer',
        icon: <LayoutDashboard size={18} />,
        items: [
          { path: '/developer', icon: <LayoutDashboard size={16} />, label: 'Dev Dashboard' },
          { path: '/developer/worklog', icon: <FileText size={16} />, label: 'Worklog' },
          { path: '/developer/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/developer/feeds', icon: <File size={16} />, label: 'Feeds' },
          { path: '/developer/git-feeds', icon: <GitFork size={16} />, label: 'Git Feeds' },
        ],
      },
      {
        key: 'pm',
        label: 'Project Manager',
        icon: <LayoutDashboard size={18} />,
        items: [
          { path: '/pm/dashboard', icon: <LayoutDashboard size={16} />, label: 'PM Dashboard' },
          { path: '/pm/git-manager', icon: <GitFork size={16} />, label: 'Git Manager' },
        ],
      },
      {
        key: 'setup',
        label: 'Setup',
        icon: <Settings size={18} />,
        items: [
          { path: '/admin/customize', icon: <SlidersHorizontal size={16} />, label: 'Customize Modules' },
        ],
      },
      OTHERS_GROUP,
    ];
  }

  // ---------------- Admin ----------------
  if (role === 'Admin') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
        { path: '/view_analytics', icon: <TrendingUp size={18} />, label: 'Analytics' },
      ]},
      SALES_GROUP,
      SALES_ACTIVITIES_GROUP,
      {
        key: 'projects',
        label: 'Projects',
        icon: <FolderKanban size={18} />,
        items: [
          { path: '/admin/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/admin/users', icon: <Users size={16} />, label: 'Users' },
          { path: '/admin/project-clients', icon: <Users size={16} />, label: 'Project Clients' },
          { path: '/pm/feeds', icon: <Logs size={16} />, label: 'Feed' },
          { path: '/pm/resource-analytics', icon: <ChartBar size={16} />, label: 'Resource Analytics' },
          { path: '/pm/work-report', icon: <BarChart3 size={16} />, label: 'Work Report' },
        ],
      },
      GENERAL_GROUP,
      {
        key: 'hr',
        label: 'HR',
        icon: <UsersRound size={18} />,
        items: [
          { path: '/hr', icon: <UsersRound size={16} />, label: 'HR Dashboard' },
          { path: '/hr/holidays', icon: <CalendarDays size={16} />, label: 'Holiday List' },
          { path: '/hr/attendance-sync', icon: <RefreshCw size={16} />, label: 'Attendance Sync' },
          { path: '/admin/ticket-rules', icon: <Mail size={16} />, label: 'Ticket Rules' },
          { path: '/admin/ticket-categories', icon: <Layers size={16} />, label: 'Ticket Categories' },
        ],
      },
      {
        key: 'setup',
        label: 'Setup',
        icon: <Settings size={18} />,
        items: [
          { path: '/admin/customize', icon: <SlidersHorizontal size={16} />, label: 'Customize Modules' },
        ],
      },
      OTHERS_GROUP,
    ];
  }

  // ---------------- Sales Manager ----------------
  if (role === 'Sales Manager') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/sales-manager', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      ]},
      SALES_GROUP,
      SALES_ACTIVITIES_GROUP,
      {
        key: 'team',
        label: 'Team',
        icon: <UserPlus size={18} />,
        items: [
          { path: '/admin/users', icon: <UserPlus size={16} />, label: 'Team' },
        ],
      },
      GENERAL_GROUP,
      {
        key: 'setup',
        label: 'Setup',
        icon: <Settings size={18} />,
        items: [
          { path: '/admin/customize', icon: <SlidersHorizontal size={16} />, label: 'Customize Modules' },
        ],
      },
      OTHERS_GROUP,
    ];
  }

  // ---------------- Sales ----------------
  if (role === 'Sales') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/sales', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      ]},
      SALES_GROUP,
      SALES_ACTIVITIES_GROUP,
      GENERAL_GROUP,
      {
        key: 'setup',
        label: 'Setup',
        icon: <Settings size={18} />,
        items: [
          { path: '/admin/customize', icon: <SlidersHorizontal size={16} />, label: 'Customize Modules' },
        ],
      },
      OTHERS_GROUP,
    ];
  }

  // ---------------- Project Manager ----------------
  if (role === 'Project Manager') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/pm/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      ]},
      {
        key: 'projects',
        label: 'Projects',
        icon: <FolderKanban size={18} />,
        items: [
          { path: '/admin/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/pm/feeds', icon: <Logs size={16} />, label: 'Feed' },
          { path: '/pm/feed-status', icon: <Activity size={16} />, label: 'Feed Status' },
          { path: '/pm/work-report', icon: <BarChart3 size={16} />, label: 'Work Report' },
          { path: '/pm/resource-analytics', icon: <ChartBar size={16} />, label: 'Resource Analytics' },
          { path: '/pm/git-manager', icon: <GitFork size={16} />, label: 'Git Manager' },
        ],
      },
      ACTIVITIES_GROUP,
      OTHERS_GROUP,
    ];
  }

  // ---------------- Team Lead ----------------
  if (role === 'Team Lead') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/teamlead', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      ]},
      {
        key: 'projects',
        label: 'Projects',
        icon: <FolderKanban size={18} />,
        items: [
          { path: '/teamlead/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/teamlead/feeds', icon: <Activity size={16} />, label: 'Feed Management' },
          { path: '/teamlead/feed-status', icon: <Activity size={16} />, label: 'Feed Status' },
          { path: '/teamlead/developers', icon: <Users size={16} />, label: 'Team' },
        ],
      },
      ACTIVITIES_GROUP,
      OTHERS_GROUP,
    ];
  }

  // ---------------- Developer ----------------
  if (role === 'Developer') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/developer', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      ]},
      {
        key: 'projects',
        label: 'Projects',
        icon: <FolderKanban size={18} />,
        items: [
          { path: '/developer/worklog', icon: <FileText size={16} />, label: 'Worklog' },
          { path: '/developer/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
          { path: '/developer/feeds', icon: <File size={16} />, label: 'Feeds' },
          { path: '/developer/git-feeds', icon: <GitFork size={16} />, label: 'Git Feeds' },
          { path: '/developer/feed-status', icon: <Activity size={16} />, label: 'Feed Status' },
        ],
      },
      ACTIVITIES_GROUP,
      OTHERS_GROUP,
    ];
  }

  // ---------------- Client ----------------
  if (role === 'Client') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/client', icon: <Activity size={18} />, label: 'Feed Delivery' },
        { path: '/tickets', icon: <Ticket size={18} />, label: 'My Tickets' },
      ]},
    ];
  }

  // ---------------- HR ----------------
  if (role === 'HR') {
    return [
      { key: 'main', label: 'Home', icon: null, items: [
        { path: '/hr', icon: <UsersRound size={18} />, label: 'Dashboard' },
      ]},
      {
        key: 'hr',
        label: 'HR Management',
        icon: <UsersRound size={18} />,
        items: [
          { path: '/admin/users', icon: <Users size={16} />, label: 'Users' },
          { path: '/hr/holidays', icon: <CalendarDays size={16} />, label: 'Holiday List' },
          { path: '/hr/leaves', icon: <Calendar size={16} />, label: 'Leave Management' },
          { path: '/hr/employee-attendance', icon: <UserCheck size={16} />, label: 'Employee Attendance' },
          { path: '/hr/employee-attendance-report', icon: <FileText size={16} />, label: 'Attendance Report' },
          { path: '/hr/attendance-sync', icon: <RefreshCw size={16} />, label: 'Attendance Sync' },
        ],
      },
      ACTIVITIES_GROUP,
    ];
  }

  // ---------------- Finance ----------------
  if (role === 'Finance') {
    return [
      ACTIVITIES_GROUP,
      OTHERS_GROUP,
    ];
  }

  return [];
};

// ============================================
// SIDEBAR COMPONENT
// ============================================
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isCollapsed, toggleSidebar } = useSidebar();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // PROFILE IMAGE
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // ============================================
  // EXPANDED GROUP STATE
  // ============================================
  const menuGroups = useMemo(
    () => withUniqueIcons(buildMenuGroups(localStorage.getItem('role') || 'User')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localStorage.getItem('role')]
  );

  // Accordion: only ONE menu group is open at a time.
  // The group that holds the current page opens by itself; opening another
  // group closes the rest.
  const activeGroupKey = useMemo(() => {
    const hit = menuGroups.find(
      (group) =>
        group.icon &&
        group.items.some(
          (item) =>
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + '/')
        )
    );
    return hit ? hit.key : null;
  }, [location.pathname, menuGroups]);

  const [openGroups, setOpenGroups] = useState(() => (activeGroupKey ? { [activeGroupKey]: true } : {}));

  // moving to a page in another group → open that group, close the others
  useEffect(() => {
    if (activeGroupKey) setOpenGroups({ [activeGroupKey]: true });
  }, [activeGroupKey]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => (prev[key] ? {} : { [key]: true }));
  };

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);

  const userRole = localStorage.getItem('role') || 'User';
  const userName = localStorage.getItem('userName') || 'User';
  const userId = localStorage.getItem('userId');

  // CLOSE USER MENU ON OUTSIDE CLICK
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HANDLE RESIZE
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !isCollapsed) toggleSidebar();
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
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data.find((u) => u._id === userId);
        if (user && user.profileImage) setProfileImage(user.profileImage);
      } catch (error) {
        console.error('Error fetching profile image:', error);
      }
    };
    fetchProfileImage();
  }, [userId]);

  // FETCH TICKET COUNT
  useEffect(() => {
    const fetchTicketCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const nonClosedTickets = res.data.filter((t) => t.status !== 'Closed');
        setTicketCount(nonClosedTickets.length);
      } catch (error) {
        console.error('Error fetching ticket count:', error);
      }
    };
    fetchTicketCount();
    const interval = setInterval(fetchTicketCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // FETCH ANNOUNCEMENT COUNT
  useEffect(() => {
    const fetchAnnouncementCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/announcements/unviewed/count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAnnouncementCount(res.data.count || 0);
      } catch (error) {
        setAnnouncementCount(0);
      }
    };
    fetchAnnouncementCount();
    const interval = setInterval(fetchAnnouncementCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // SOCKET
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-user-room', userId);
    });
    socketRef.current.on('new_announcement', () => {
      setAnnouncementCount((prev) => prev + 1);
    });
    socketRef.current.on('announcement_count_update', (data) => {
      setAnnouncementCount(data.count || 0);
    });
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [userId]);

  // LOGOUT
  const handleLogout = () => {
    ['token', 'role', 'userName', 'userId', 'lastActive'].forEach((i) =>
      localStorage.removeItem(i)
    );
    navigate('/login');
  };

  const handleDownloadGuide = () => {
    window.open(
      'https://res.cloudinary.com/dhcwcyqke/image/upload/v1789479854/KUIPER_Client_User_Guide_cmyt08.pdf',
      '_blank'
    );
  };

  // FILE SELECT
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    setShowImageUploadModal(true);
  };

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
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data.success) {
        setProfileImage(res.data.profileImage);
        setShowImageUploadModal(false);
        setSelectedFile(null);
        setImagePreview(null);
        toast.success('Profile image updated!');
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(res.data.message || 'Upload failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeProfileImage = async () => {
    if (!profileImage) return;
    if (!window.confirm('Remove your profile picture?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`${API_BASE_URL}/api/admin/remove-profile-image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setProfileImage(null);
        setShowImageUploadModal(false);
        toast.success('Profile image removed');
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Remove failed');
    }
  };

  const handleVideoLogoClick = () => {
    window.open('https://techdataseeders.com/', '_blank');
  };

  // ROLE BADGE STYLES
  const getRoleStyles = (role) => {
    switch (role) {
      case 'Super Admin': return 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/20';
      case 'Admin': return 'from-red-500/20 to-orange-500/20 text-orange-300 border-orange-400/20';
      case 'Sales Manager': return 'from-purple-500/20 to-blue-500/20 text-purple-300 border-purple-400/20';
      case 'Sales': return 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-400/20';
      case 'Project Manager': return 'from-cyan-500/20 to-sky-500/20 text-cyan-300 border-cyan-400/20';
      case 'Developer': return 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-400/20';
      case 'Team Lead': return 'from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-400/20';
      case 'HR': return 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-400/20';
      case 'Finance': return 'from-green-500/20 to-emerald-500/20 text-green-300 border-green-400/20';
      default: return 'from-blue-500/20 to-purple-500/20 text-blue-300 border-blue-400/20';
    }
  };

  const getRoleDisplayName = (role) => role;

  // BADGE HELPERS
  const shouldShowBadge = (label) => label === 'Tickets' && ticketCount > 0;
  const shouldShowAnnouncementBadge = (label) =>
    label === 'Announcements' && announcementCount > 0;

  const isRouteActive = (path) => {
    if (path === '/sales' || path === '/sales-manager' || path === '/admin' || path === '/hr' ||
        path === '/pm/dashboard' || path === '/teamlead' || path === '/developer' ||
        path === '/client' || path === '/tickets') {
      return location.pathname === path;
    }
    return (
      location.pathname === path ||
      location.pathname.startsWith(path + '/')
    );
  };

  const getSidebarClasses = () => {
    const base = 'fixed top-0 left-0 h-screen bg-black text-slate-400 border-r border-slate-800 shadow-2xl transition-[width,transform,opacity] duration-300 ease-in-out z-50';
    if (isMobile) {
      return `${base} ${isCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100 w-64'}`;
    }
    return `${base} ${isCollapsed ? 'w-[80px]' : 'w-[264px]'}`;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={toggleSidebar}
        />
      )}

      <aside className={getSidebarClasses()}>
       {/* HEADER — logo, then one row: notifications + collapse button (right) */}
        <div
          className={`border-b border-slate-800 transition-all duration-300 ${
            isMobile ? 'px-3 pt-3 pb-3' : isCollapsed ? 'px-2 pt-5 pb-3' : 'px-4 pt-4 pb-3'
          }`}
        >
          <div className={isCollapsed && !isMobile ? 'flex justify-center' : ''}>
            <KuiperLogo isExpanded={!isCollapsed || isMobile} />
          </div>

          {isCollapsed && !isMobile ? (
            // collapsed: expand button and bell side by side, tight
            <div className="mt-3 flex items-center justify-center gap-1">
              <div className="shrink-0 flex items-center justify-center">
                <NotificationBell />
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center justify-between pl-3 pr-1.5 py-1 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/10">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] truncate">
                  Notifications
                </span>
                <NotificationBell />
              </div>
              {!isMobile && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-slate-800 border border-white/10 transition-colors"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* NAVIGATION (GROUPED) */}
        <nav
          className={`p-2 space-y-1 overflow-y-auto overflow-x-visible no-scrollbar ${
            isCollapsed && !isMobile
              ? 'h-[calc(100vh-160px)]'
              : isMobile
              ? 'h-[calc(100vh-320px)]'
              : 'h-[calc(100vh-316px)]'
          }`}
        >
          {menuGroups.map((group) => {
            // A "Home" pseudo-group has null icon — render items flat
            if (!group.icon) {
              return group.items.map((item) => {
                const active = isRouteActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-2 p-2 rounded-xl transition-all duration-200 group ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40'
                        : 'hover:bg-slate-800/70 hover:text-slate-200 text-slate-400'
                    } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                    title={isCollapsed && !isMobile ? item.label : ''}
                    onClick={() => isMobile && toggleSidebar()}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {(!isCollapsed || isMobile) && (
                      <span className="text-[12px] font-semibold tracking-tight whitespace-nowrap flex-1">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
              });
            }

            const isOpen = openGroups[group.key];
            const anyActive = group.items.some((i) => isRouteActive(i.path));

            return (
              <div key={group.key} className="pb-1">
                {/* Group header (clickable) */}
                <button
                  onClick={() => {
                    if (isCollapsed && !isMobile) {
                      // collapsed: expand the sidebar and show this group (never close it)
                      toggleSidebar();
                      setOpenGroups({ [group.key]: true });
                      return;
                    }
                    toggleGroup(group.key);
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all duration-200 group ${
                    anyActive
                      ? 'text-blue-300 bg-slate-800/60'
                      : 'hover:bg-slate-800/70 hover:text-slate-200 text-slate-400'
                  } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                  title={isCollapsed && !isMobile ? group.label : ''}
                >
                  <span className="flex-shrink-0">{group.icon}</span>
                  {(!isCollapsed || isMobile) && (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap flex-1 text-left text-slate-500 group-hover:text-slate-300">
                        {group.label}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 flex-shrink-0 text-slate-500 ${
                          isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </>
                  )}
                </button>

                {/* Group items */}
                {isOpen && (!isCollapsed || isMobile) && (
                  <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    {group.items.map((item) => {
                      const active = isRouteActive(item.path);
                      const showBadge = shouldShowBadge(item.label);
                      const showAnnBadge = shouldShowAnnouncementBadge(item.label);

                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                            active
                              ? 'bg-blue-600/90 text-white shadow-md shadow-blue-900/30'
                              : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-100'
                          }`}
                          onClick={() => {
                            if (isMobile) toggleSidebar();
                            if (item.label === 'Announcements') setAnnouncementCount(0);
                          }}
                        >
                          {/* Left accent bar for active sub-item */}
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-blue-400" />
                          )}
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className="text-[11.5px] font-semibold tracking-tight whitespace-nowrap flex-1">
                            {item.label}
                          </span>
                          {showBadge && (
                            <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center tabular-nums">
                              {ticketCount > 99 ? '99+' : ticketCount}
                            </span>
                          )}
                          {showAnnBadge && (
                            <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center animate-pulse tabular-nums">
                              {announcementCount > 99 ? '99+' : announcementCount}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed-mode active dot */}
                {isCollapsed && !isMobile && anyActive && (
                  <div className="flex justify-center mt-0.5">
                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ACCOUNT */}
        <div className={`absolute bottom-0 left-0 right-0 p-2 border-t border-slate-800 ${
          isCollapsed && !isMobile ? 'px-2' : ''
        }`} ref={menuRef}>
          {/* VIDEO LOGO */}
          {(!isCollapsed || isMobile) ? (
            <div className="flex items-center justify-center gap-2 mb-2 px-2 cursor-pointer" title="Visit TechDataSeeders">
              <div className="flex items-center gap-2" onClick={handleVideoLogoClick}>
                <div className="w-15 h-15 rounded-full bg-black/80 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
                  <video src={companyLogoVideo} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-2 cursor-pointer hover:opacity-80" onClick={handleVideoLogoClick} title="Visit TechDataSeeders">
              <div className="w-8 h-8 rounded-full bg-black/80 border border-blue-500/20 overflow-hidden">
                <video src={companyLogoVideo} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

          {/* USER MENU */}
          {showUserMenu && (
            <div className={`absolute bottom-full left-3 mb-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[180px] animate-in slide-in-from-bottom-4 duration-200 z-[60] ${
              isCollapsed && !isMobile ? 'left-1/2 -translate-x-1/2' : ''
            }`}>
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

          {/* ACCOUNT BUTTON */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
              showUserMenu
                ? 'bg-slate-800 border border-white/5 shadow-xl'
                : 'hover:bg-slate-800'
            } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
          >
            <div className="relative flex-shrink-0 group">
              {profileImage ? (
                <img src={profileImage} alt={userName} className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Camera size={14} className="text-white" />
              </div>
              {showUserMenu && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black" />
              )}
            </div>

            {(!isCollapsed || isMobile) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${getRoleStyles(userRole).split(' ')[2] || 'text-slate-400'}`}>
                  {getRoleDisplayName(userRole)}
                </p>
              </div>
            )}

            {(!isCollapsed || isMobile) && (
              <ChevronUp
                size={14}
                className={`transition-transform duration-300 flex-shrink-0 ${
                  showUserMenu ? 'rotate-0 text-blue-400' : 'rotate-180 text-slate-500'
                }`}
              />
            )}
          </button>
        </div>
      </aside>

      {/* TOGGLE BUTTON - MOBILE (unchanged) */}
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
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview(null);
                      fileInputRef.current.click();
                    }}
                    className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700"
                  >
                    Change Photo
                  </button>
                  <button
                    onClick={uploadProfileImage}
                    disabled={uploadingImage}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                {profileImage ? (
                  <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-blue-500/30">
                    <img src={profileImage} alt="Current profile" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700"
                >
                  Choose Image
                </button>
                {profileImage && (
                  <button
                    onClick={removeProfileImage}
                    className="px-6 py-2 bg-red-600/20 text-red-400 rounded-xl font-bold text-sm hover:bg-red-600/30"
                  >
                    Remove Photo
                  </button>
                )}
                <p className="text-xs text-slate-400 text-center">
                  Supported formats: JPEG, PNG, GIF, WEBP<br />Max size: 5MB
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
              <h2 className="text-xl font-black text-white mb-2 tracking-tight">Confirm Logout</h2>
              <p className="text-slate-400 text-xs font-medium mb-6 leading-relaxed px-3">
                Are you sure you want to exit? You will need to authenticate again.
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