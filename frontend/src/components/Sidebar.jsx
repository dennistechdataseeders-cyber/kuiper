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
  SignalHigh, Truck, CalendarClock, Compass, Boxes, IdCard, Terminal, ClipboardCheck, Wrench, Lightbulb, FlaskConical, FileSearch, UsersRound as TeamIcon,
  UserPen,
} from 'lucide-react';
import UpdateProfileModal from './UpdateProfileModal';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import KuiperLogo from './KuiperLogo';
import { useSidebar } from '../context/SidebarContext';
import NotificationBell from './NotificationBell';
import API_BASE_URL from '../config';
import companyLogoVideo from '../assets/Company_Logo_mp4.mp4';
import companyLogoPoster from '../assets/company_logo_poster.webp';

// Company logo: a 4 KB poster frame. The ~900 KB video is only fetched and played while
// the logo is hovered.
const LogoVideo = () => {
  const [play, setPlay] = useState(false);
  return (
    <span className="block w-full h-full" onMouseEnter={() => setPlay(true)} onMouseLeave={() => setPlay(false)}>
      {play
        ? <video src={companyLogoVideo} poster={companyLogoPoster} autoPlay loop muted playsInline className="w-full h-full object-cover" />
        : <img src={companyLogoPoster} alt="" className="w-full h-full object-cover" />}
    </span>
  );
};
import io from 'socket.io-client';
import { isPMRole } from '../utils/roles';
import usePolling from '../utils/usePolling';
import useIsMobile from '../utils/useIsMobile';

// ============================================
// SIDEBAR STYLES - every state in one place (contrast on the black sidebar)
// ============================================
const SB = {
  // one row: same height, padding and text size for every item, sub-item and group heading
  row: 'relative w-full h-10 flex items-center gap-2.5 px-3 rounded-lg text-sm transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-inset',
  item: 'text-slate-100 font-medium hover:bg-white/15 hover:text-white focus-visible:ring-blue-400',       // 19:1
  subItem: 'text-slate-200 font-medium hover:bg-white/15 hover:text-white focus-visible:ring-blue-400',    // 17:1
  active: 'bg-blue-600 text-white font-semibold focus-visible:ring-white',                                 // 5.3:1
  activeBar: 'absolute left-0 inset-y-2 w-1 rounded-r-full bg-white',
  icon: 'shrink-0 text-slate-300 group-hover:text-white',                                                  // 14:1
  iconActive: 'shrink-0 text-white',
  label: 'flex-1 min-w-0 truncate text-left',
  // group headings
  group: 'text-slate-300 hover:bg-white/15 hover:text-white focus-visible:ring-blue-400',                  // 14:1
  groupActive: 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 focus-visible:ring-blue-400',            // 10:1
  groupLabel: 'flex-1 min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wider',
  groupIcon: 'shrink-0',
  subList: 'mt-1 ml-5 pl-2 border-l border-white/20 space-y-1',
  badge: 'shrink-0 bg-red-600 text-white ring-1 ring-white/70 text-xs leading-none font-semibold px-1.5 py-1 rounded-full min-w-5 text-center tabular-nums', // 4.8:1
  iconButton: 'shrink-0 flex items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/15 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400',
  // account menu
  menuItem: 'w-full min-h-10 flex items-center gap-2.5 px-2.5 rounded-lg transition-colors text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400',
  menuItemNormal: 'text-slate-100 hover:bg-white/15 hover:text-white',
  menuItemLogout: 'text-red-300 hover:text-red-200 hover:bg-red-500/10',
};

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
  // Feasibility
  '/feasibility':                    FlaskConical,
  '/pm/feasibility':                 FileSearch,
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
  feasibility:        Lightbulb,
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
          { path: '/admin/users', icon: <Users size={16} />, label: 'Users' },
          { path: '/admin/project-clients', icon: <Users size={16} />, label: 'Project Clients' },
          { path: '/pm/feeds', icon: <Logs size={16} />, label: 'Feed Management' },
          { path: '/pm/feed-status', icon: <Activity size={16} />, label: 'Feed Status' },
          { path: '/pm/resource-analytics', icon: <ChartBar size={16} />, label: 'Resource Analytics' },
          { path: '/pm/work-report', icon: <BarChart3 size={16} />, label: 'Work Report' },
        ],
      },
      {
        key: 'feasibility',
        label: 'Feasibility',
        icon: <FileText size={18} />,
        items: [
          { path: '/feasibility', icon: <FileText size={16} />, label: 'Feasibility' },
          { path: '/pm/feasibility', icon: <FileText size={16} />, label: 'PM Feasibility' },
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
      {
        key: 'feasibility',
        label: 'Feasibility',
        icon: <FileText size={18} />,
        items: [
          { path: '/feasibility', icon: <FileText size={16} />, label: 'Feasibility' },
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

  // ---------------- Project Manager ----------------
  if (isPMRole(role)) {
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
          { path: '/pm/feasibility', icon: <FileText size={16} />, label: 'Feasibility' },
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

  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobile } = useSidebar();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const isMobile = useIsMobile();

  // PROFILE IMAGE
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); // "Edit Details" (personal info)
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

  // MOBILE DRAWER: close on every route change and when the window grows to desktop size
  useEffect(() => {
    closeMobile();
  }, [location.pathname, isMobile, closeMobile]);

  // MOBILE DRAWER: Escape closes it; the page behind does not scroll while it is open
  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMobileOpen, closeMobile]);

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
  // Ticket badge: count of the user's non-closed tickets (server-side count, not the whole list)
  usePolling(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/tickets/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTicketCount(res.data.notClosed || 0);
    } catch (error) {
      console.error('Error fetching ticket count:', error);
    }
  }, 30000);

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
    const interval = setInterval(() => { if (!document.hidden) fetchAnnouncementCount(); }, 30000);
    const onVisible = () => { if (!document.hidden) fetchAnnouncementCount(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
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
      case 'Project Manager':
      case 'Project Coordinator': return 'from-cyan-500/20 to-sky-500/20 text-cyan-300 border-cyan-400/20';
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
    const base = 'fixed top-0 left-0 h-dvh flex flex-col bg-black text-slate-200 border-r border-white/20 shadow-2xl transition-[width,transform,opacity,visibility] duration-300 ease-in-out';
    if (isMobile) {
      // off-canvas drawer; "invisible" also takes its links out of the tab order while closed
      return `${base} z-[70] w-[264px] max-w-[85vw] ${isMobileOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 invisible pointer-events-none'}`;
    }
    return `${base} z-50 w-[var(--sidebar-w)]`;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65]"
          onClick={closeMobile}
        />
      )}

      <aside className={getSidebarClasses()}>
       {/* HEADER — logo, then one row: notifications + collapse button (right) */}
        <div
          className={`shrink-0 border-b border-white/20 transition-all duration-300 ${
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
                className={`w-8 h-8 ${SB.iconButton}`}
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center justify-between pl-3 pr-1.5 py-1 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-xl border border-white/20">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide truncate">
                  Notifications
                </span>
                <NotificationBell />
              </div>
              <button
                type="button"
                onClick={isMobile ? closeMobile : toggleSidebar}
                aria-label={isMobile ? 'Close menu' : 'Collapse sidebar'}
                title={isMobile ? 'Close menu' : 'Collapse sidebar'}
                className={`w-10 h-10 md:w-9 md:h-9 bg-white/5 border border-white/20 ${SB.iconButton}`}
              >
                {isMobile ? <X size={18} /> : <PanelLeftClose size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* NAVIGATION (GROUPED) */}
        <nav className="flex-1 min-h-0 p-2 space-y-1 overflow-y-auto overflow-x-visible no-scrollbar">
          {menuGroups.map((group) => {
            // A "Home" pseudo-group has null icon — render items flat
            if (!group.icon) {
              return group.items.map((item) => {
                const active = isRouteActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`${SB.row} ${active ? SB.active : SB.item} ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                    title={isCollapsed && !isMobile ? item.label : ''}
                    onClick={closeMobile}
                  >
                    {active && <span className={SB.activeBar} />}
                    <span className={active ? SB.iconActive : SB.icon}>{item.icon}</span>
                    {(!isCollapsed || isMobile) && (
                      <span className={SB.label}>
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
              <div key={group.key}>
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
                  className={`${SB.row} ${
                    // collapsed: the active page itself is hidden, so its group icon shows the active state
                    anyActive ? (isCollapsed && !isMobile ? SB.active : SB.groupActive) : SB.group
                  } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                  title={isCollapsed && !isMobile ? group.label : ''}
                >
                  {isCollapsed && !isMobile && anyActive && <span className={SB.activeBar} />}
                  <span className={SB.groupIcon}>{group.icon}</span>
                  {(!isCollapsed || isMobile) && (
                    <>
                      <span className={SB.groupLabel}>
                        {group.label}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </>
                  )}
                </button>

                {/* Group items */}
                {isOpen && (!isCollapsed || isMobile) && (
                  <div className={`${SB.subList} animate-in slide-in-from-top-1 duration-200`}>
                    {group.items.map((item) => {
                      const active = isRouteActive(item.path);
                      const showBadge = shouldShowBadge(item.label);
                      const showAnnBadge = shouldShowAnnouncementBadge(item.label);

                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={`${SB.row} ${active ? SB.active : SB.subItem}`}
                          onClick={() => {
                            closeMobile();
                            if (item.label === 'Announcements') setAnnouncementCount(0);
                          }}
                        >
                          {/* Left accent bar for active sub-item */}
                          {active && (
                            <span className={SB.activeBar} />
                          )}
                          <span className={active ? SB.iconActive : SB.icon}>{item.icon}</span>
                          <span className={SB.label}>
                            {item.label}
                          </span>
                          {showBadge && (
                            <span className={SB.badge}>
                              {ticketCount > 99 ? '99+' : ticketCount}
                            </span>
                          )}
                          {showAnnBadge && (
                            <span className={SB.badge}>
                              {announcementCount > 99 ? '99+' : announcementCount}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </nav>

        {/* ACCOUNT */}
        <div className={`relative shrink-0 p-2 border-t border-white/20 ${
          isCollapsed && !isMobile ? 'px-2' : ''
        }`} ref={menuRef}>
          {/* VIDEO LOGO */}
          {(!isCollapsed || isMobile) ? (
            <div className="flex items-center justify-center gap-2 mb-2 px-2 cursor-pointer" title="Visit TechDataSeeders">
              <div className="flex items-center gap-2" onClick={handleVideoLogoClick}>
                <div className="w-15 h-15 rounded-full bg-black/80 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
                  <LogoVideo />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-2 cursor-pointer hover:opacity-80" onClick={handleVideoLogoClick} title="Visit TechDataSeeders">
              <div className="w-8 h-8 rounded-full bg-black/80 border border-blue-500/20 overflow-hidden">
                <LogoVideo />
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

          {/* USER MENU */}
          {showUserMenu && (
            <div className={`absolute bottom-full left-3 mb-3 bg-slate-900 border border-white/20 rounded-xl shadow-2xl p-2 min-w-[180px] max-h-[60dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 z-[60] ${
              isCollapsed && !isMobile ? 'left-1/2 -translate-x-1/2' : ''
            }`}>
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setShowUserMenu(false);
                }}
                className={`${SB.menuItem} ${SB.menuItemNormal}`}
              >
                <UserPen size={16} className="shrink-0 text-emerald-300" />
                <span>Edit Details</span>
              </button>

              <button
                onClick={() => {
                  setShowImageUploadModal(true);
                  setShowUserMenu(false);
                }}
                className={`${SB.menuItem} ${SB.menuItemNormal}`}
              >
                <Camera size={16} className="shrink-0 text-blue-300" />
                <span>Update Profile Picture</span>
              </button>

              <button
                onClick={handleDownloadGuide}
                className={`${SB.menuItem} ${SB.menuItemNormal}`}
              >
                <FileText size={16} className="shrink-0 text-blue-300" />
                <span>User Guide</span>
              </button>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className={`${SB.menuItem} ${SB.menuItemNormal}`}
              >
                <Settings size={16} className="shrink-0 text-purple-300" />
                <span>Change Password</span>
              </button>

              <button
                onClick={() => {
                  navigate('/notifications');
                  setShowUserMenu(false);
                }}
                className={`${SB.menuItem} ${SB.menuItemNormal}`}
              >
                <Bell size={16} className="shrink-0 text-blue-300" />
                <span>Notification Settings</span>
              </button>

              <div className="h-px bg-white/20 my-1 mx-1" />

              <button
                onClick={() => {
                  setShowLogoutModal(true);
                  setShowUserMenu(false);
                }}
                className={`${SB.menuItem} ${SB.menuItemLogout}`}
              >
                <LogOut size={16} className="shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* ACCOUNT BUTTON */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Account: edit details, profile picture, password, logout"
            className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all border outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              showUserMenu
                ? 'bg-slate-800 border-blue-400/60 ring-2 ring-blue-500/30 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                : 'bg-slate-800/60 border-blue-500/30 ring-1 ring-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.18)] hover:bg-slate-800 hover:border-blue-400/60 hover:shadow-[0_0_18px_rgba(59,130,246,0.35)]'
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
                <p className={`text-xs font-semibold uppercase tracking-wide truncate ${getRoleStyles(userRole).split(' ')[2] || 'text-slate-200'}`}>
                  {getRoleDisplayName(userRole)}
                </p>
              </div>
            )}

            {(!isCollapsed || isMobile) && (
              <ChevronUp
                size={14}
                className={`transition-transform duration-300 flex-shrink-0 ${
                  showUserMenu ? 'rotate-0 text-blue-300' : 'rotate-180 text-slate-200'
                }`}
              />
            )}
          </button>
        </div>
      </aside>

      {/* PROFILE IMAGE UPLOAD MODAL */}
      {showImageUploadModal && (
        <div className="modal-backdrop bg-slate-950/80 backdrop-blur-md">
          <div className="modal-panel block !overflow-y-auto max-w-md p-4 sm:p-6 bg-slate-900 border border-white/10 relative">
            <button
              onClick={() => {
                setShowImageUploadModal(false);
                setSelectedFile(null);
                setImagePreview(null);
              }}
              className="btn-icon absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="section-title text-white mb-4">Profile Picture</h3>

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
                    className="btn btn-md flex-1 bg-slate-800 text-white hover:bg-slate-700"
                  >
                    Change Photo
                  </button>
                  <button
                    onClick={uploadProfileImage}
                    disabled={uploadingImage}
                    className="btn btn-md flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
                  className="btn btn-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Choose Image
                </button>
                {profileImage && (
                  <button
                    onClick={removeProfileImage}
                    className="btn btn-md bg-red-600/20 text-red-400 hover:bg-red-600/30"
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

      {/* EDIT DETAILS (personal info) MODAL */}
      {showProfileModal && (
        <UpdateProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userId={userId}
          currentImage={profileImage}
        />
      )}

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="modal-backdrop bg-slate-950/80 backdrop-blur-md">
          <div className="modal-panel block max-w-sm p-4 sm:p-6 bg-slate-900 border border-white/10 relative">
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="p-3 bg-red-500/10 rounded-xl mb-4 border border-red-500/20">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="section-title text-white mb-2">Confirm Logout</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed px-3">
                Are you sure you want to exit? You will need to authenticate again.
              </p>
              <div className="flex w-full gap-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="btn btn-md flex-1 bg-slate-800 text-slate-300 border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="btn btn-md flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/20 active:scale-95"
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