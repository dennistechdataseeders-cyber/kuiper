// frontend/src/App.jsx
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PageLayout from './components/PageLayout';
import { pageLoaders } from './pageLoaders';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
const ViewAnalytics = lazy(pageLoaders.ViewAnalytics);
const UserManagement = lazy(pageLoaders.UserManagement);
const ProjectManagement = lazy(pageLoaders.ProjectManagement);
const AdminDashboard = lazy(pageLoaders.AdminDashboard);
import Login from './pages/Login';
const SalesDashboard = lazy(pageLoaders.SalesDashboard);
const SalesManagerDashboard = lazy(pageLoaders.SalesManagerDashboard);
const LeadGeneration = lazy(pageLoaders.LeadGeneration);
const DeveloperDashboard = lazy(pageLoaders.DeveloperDashboard);
const Profile = lazy(pageLoaders.Profile);
const ProjectFeeds = lazy(pageLoaders.ProjectFeeds);
const Worklog = lazy(pageLoaders.Worklog);
const ResourceAnalytics = lazy(pageLoaders.ResourceAnalytics);
const TicketDashboard = lazy(pageLoaders.TicketDashboard);
const CreateTicket = lazy(pageLoaders.CreateTicket);
const TicketDetails = lazy(pageLoaders.TicketDetails);
const NotificationSettings = lazy(pageLoaders.NotificationSettings);
const GitManager = lazy(pageLoaders.GitManager);
const DeveloperGitFeeds = lazy(pageLoaders.DeveloperGitFeeds);
const AdminProjectClients = lazy(pageLoaders.AdminProjectClients);
const DeveloperProjects = lazy(pageLoaders.DeveloperProjects);
const DeveloperFeeds = lazy(pageLoaders.DeveloperFeeds);
const TeamLeadDashboard = lazy(pageLoaders.TeamLeadDashboard);
const TeamLeadProjects = lazy(pageLoaders.TeamLeadProjects);
const TeamLeadDevelopers = lazy(pageLoaders.TeamLeadDevelopers);
const TeamLeadFeeds = lazy(pageLoaders.TeamLeadFeeds);
const TicketAssignmentRules = lazy(pageLoaders.TicketAssignmentRules);
const TicketCategoriesManager = lazy(pageLoaders.TicketCategoriesManager);
const FeedDeliveryDashboard = lazy(pageLoaders.FeedDeliveryDashboard);
const ProjectFeedStatus = lazy(pageLoaders.ProjectFeedStatus);
const AttendanceSync = lazy(pageLoaders.AttendanceSync);
const KnowledgeBase = lazy(pageLoaders.KnowledgeBase);
const FeasibilityDashboard = lazy(pageLoaders.FeasibilityDashboard);
const PmFeasibilityDashboard = lazy(pageLoaders.PmFeasibilityDashboard);
const PmDashboard = lazy(pageLoaders.PmDashboard);
const EmployeeAttendanceDetail = lazy(pageLoaders.EmployeeAttendanceDetail);
const EmployeeAttendanceReport = lazy(pageLoaders.EmployeeAttendanceReport);
const Announcements = lazy(pageLoaders.Announcements);
const HolidayList = lazy(pageLoaders.HolidayList);
const WorkReport = lazy(pageLoaders.WorkReport);
const Leads = lazy(pageLoaders.Leads);
const Accounts = lazy(pageLoaders.Accounts);
const Contacts = lazy(pageLoaders.Contacts);
const CreateAccount = lazy(pageLoaders.CreateAccount);
const Deals = lazy(pageLoaders.Deals);
const AccountDetail = lazy(pageLoaders.AccountDetail);
const ContactDetail = lazy(pageLoaders.ContactDetail);
const DealDetail = lazy(pageLoaders.DealDetail);
const CustomizeModules = lazy(pageLoaders.CustomizeModules);

// ============================================
// ✅ ACTIVITIES IMPORTS (Notes feature shows inside Leads)
// ============================================
const ActivitiesTasks = lazy(pageLoaders.ActivitiesTasks);
const ActivitiesMeetings = lazy(pageLoaders.ActivitiesMeetings);
const ActivitiesCalls = lazy(pageLoaders.ActivitiesCalls);
const ActivityDetail = lazy(pageLoaders.ActivityDetail);

// ============================================
// HRMS IMPORTS
// ============================================
const HrDashboard = lazy(pageLoaders.HrDashboard);
const EmployeeDashboard = lazy(pageLoaders.EmployeeDashboard);

// ============================================
// LEAVE MANAGEMENT IMPORTS - KEPT FOR HR
// ============================================
const HrLeaveDashboard = lazy(pageLoaders.HrLeaveDashboard);

// Import the Notification component
import NotificationBell from './components/NotificationBell';

// ✅ NEW: Import the SalesNotifier component
import SalesNotifier from './components/SalesNotifier';

import { AnimatePresence } from 'framer-motion';
import API_BASE_URL from './config';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { PM_ROLES } from './utils/roles';

const SessionManager = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/login') return;

    const token = localStorage.getItem('token');
    const lastActive = localStorage.getItem('lastActive');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const currentTime = Date.now();
    const expirationTime = 12 * 60 * 60 * 1000; // 12 Hours

    // Safely parse lastActive
    let lastActiveTime = 0;
    if (lastActive) {
      const parsed = parseInt(lastActive);
      if (!isNaN(parsed)) {
        lastActiveTime = parsed;
      }
    }

    if (lastActiveTime && currentTime - lastActiveTime > expirationTime) {
      localStorage.clear();
      navigate('/login', { replace: true });
    } else {
      localStorage.setItem('lastActive', currentTime.toString());
    }
  }, [location.pathname, navigate]);

  return children;
};

// ============================================
// ✅ FIXED: ProtectedRoute with Super Admin support
// ============================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" replace />;

  // ✅ Super Admin has access to ALL routes
  if (userRole === 'Super Admin') {
    return children;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    const rolePaths = {
      'Super Admin': '/admin',
      'Admin': '/admin',
      'Sales Manager': '/sales-manager',
      'Sales': '/sales',
      'Developer': '/developer',
      'Project Manager': '/admin/projects',
      'Project Coordinator': '/admin/projects',
      'Client': '/client', 
      'Team Lead': '/teamlead',
      'HR': '/hr',
      'Finance': '/tickets',
    };
    
    const fallbackPath = rolePaths[userRole] || '/login';
    return <Navigate to={fallbackPath} replace />;
  }
  return children;
};

function AppContent() {
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const location = useLocation();
  const userId = localStorage.getItem('userId');
  const socketRef = useRef(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // ✅ FIXED: Added Super Admin to path mapping
  const landingPath = useMemo(() => {
    if (!userRole) return '/login';
    const pathMap = {
      'Super Admin': '/admin',
      'Admin': '/admin',
      'Sales Manager': '/sales-manager',
      'Sales': '/sales',
      'Project Manager': '/admin/projects',
      'Project Coordinator': '/admin/projects',
      'Developer': '/developer',
      'Client': '/client',
      'Team Lead': '/teamlead',
      'HR': '/hr',
      'Finance': '/tickets',
    };
    return pathMap[userRole] || '/login';
  }, [userRole]);

  // ============================================
  // ✅ GLOBAL SOCKET CONNECTION FOR ANNOUNCEMENTS & REAL-TIME EVENTS
  // ============================================
  useEffect(() => {
    // Only connect if user is logged in
    if (!token || !userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
      return;
    }

    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    }

    console.log('🔌 Setting up global socket connection...');

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    socketRef.current = socket;

    // ============================================
    // SOCKET EVENT HANDLERS
    // ============================================

    socket.on('connect', () => {
      console.log('🔌 Global socket connected successfully');
      setSocketConnected(true);
      
      // Join user's personal room for targeted notifications
      socket.emit('join-user-room', userId);
      console.log(`👤 Joined user room: ${userId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Global socket disconnected: ${reason}`);
      setSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Global socket connection error:', error.message);
      setSocketConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔌 Global socket reconnected after ${attemptNumber} attempts`);
      setSocketConnected(true);
      
      // Re-join user room after reconnection
      if (socket) {
        socket.emit('join-user-room', userId);
      }
    });

    // ============================================
    // ✅ ANNOUNCEMENT EVENTS - GLOBAL TOAST NOTIFICATIONS
    // ============================================
    
    socket.on('new_announcement', (data) => {
      console.log('📢 App received new announcement:', data);
      
      // Show toast notification (visible even when notification bell is closed)
      toast.success(`📢 ${data.title}`, {
        duration: 6000,
        icon: '📢',
        style: {
          background: '#1a1a2e',
          color: '#fff',
          border: '1px solid #7c3aed',
        }
      });
    });

    socket.on('announcement_count_update', (data) => {
      console.log('📢 Announcement count update in App:', data);
      // This will be handled by NotificationBell component
    });

    // ============================================
    // TICKET EVENTS
    // ============================================
    
    socket.on('ticket_created', (ticket) => {
      console.log('🎫 New ticket created in App:', ticket.ticketNumber);
      // NotificationBell handles this with toast
    });

    socket.on('ticket_updated', (ticket) => {
      console.log('🔄 Ticket updated in App:', ticket.ticketNumber);
    });

    socket.on('ticket_assigned', (ticket) => {
      console.log('📋 Ticket assigned in App:', ticket.ticketNumber);
      
      // Show toast if ticket is assigned to current user
      if (ticket.assignedTo?._id === userId || ticket.assignedTo === userId) {
        toast(`📋 Ticket assigned to you: ${ticket.ticketNumber} - ${ticket.title}`, {
          duration: 5000,
          icon: '📋'
        });
      }
    });

    socket.on('ticket_commented', (ticket) => {
      console.log('💬 Ticket commented in App:', ticket.ticketNumber);
    });

    // ============================================
    // LEAVE EVENTS
    // ============================================
    
    socket.on('leave_approved', (data) => {
      console.log('✅ Leave approved in App for:', data.userId);
      if (data.userId === userId) {
        toast.success(`✅ Your leave request has been approved!`, {
          duration: 5000,
          icon: '✅'
        });
      }
    });

    socket.on('leave_rejected', (data) => {
      console.log('❌ Leave rejected in App for:', data.userId);
      if (data.userId === userId) {
        toast.error(`❌ Your leave request has been rejected`, {
          duration: 5000,
          icon: '❌'
        });
      }
    });

    // ============================================
    // FEED EVENTS
    // ============================================
    
    socket.on('feed_status_updated', (data) => {
      console.log('📊 Feed status updated in App:', data.feed_name);
    });

    socket.on('feed_assigned', (data) => {
      console.log('📋 Feed assigned in App:', data.feed?.name);
      if (data.message) {
        toast(`📋 ${data.message}`, {
          duration: 5000,
          icon: '📋'
        });
      }
    });

    // ============================================
    // ATTENDANCE EVENTS
    // ============================================
    
    socket.on('attendance_updated', (data) => {
      console.log('📊 Attendance updated in App for:', data.employeeId);
      if (data.employeeId === userId) {
        toast.success(`🔄 Your attendance has been updated`, {
          duration: 3000,
          icon: '🔄'
        });
      }
    });

    socket.on('attendance_sync_complete', (data) => {
      console.log('📊 Attendance sync complete in App:', data);
      if (data.updatedUsers && data.updatedUsers > 0) {
        toast.success(`✅ Attendance sync complete! ${data.updatedUsers} users updated`, {
          duration: 5000,
          icon: '✅'
        });
      }
    });

    // ============================================
    // CLEANUP
    // ============================================
    
    return () => {
      console.log('🔌 Cleaning up global socket...');
      if (socketRef.current) {
        socketRef.current.emit('leave-user-room', userId);
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
    };
  }, [token, userId]);

  return (
    <SessionManager>
      {/* ✅ NEW: Mount the SalesNotifier component globally */}
      <SalesNotifier />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname === '/login' ? 'login' : 'app'}>
          <Route 
            path="/login" 
            element={token ? <Navigate to={landingPath} replace /> : <Login />} 
          />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <PageLayout>
                  {/* A crash in one page shows its message here; the sidebar keeps working. Cleared on route change. */}
                  <ErrorBoundary inline resetKey={location.pathname}>
                  <Suspense fallback={<PageLoader />}>
                  <Routes key={location.pathname}>
                    <Route path="/" element={<Navigate to={landingPath} replace />} />

                    {/* ============================================
                        ADMIN DASHBOARDS
                        ============================================ */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/ticket-rules" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
                        <TicketAssignmentRules />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/ticket-categories" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
                        <TicketCategoriesManager />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/project-clients" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
                        <AdminProjectClients />
                      </ProtectedRoute>
                    } />

                    {/* ✅ NEW: CUSTOMIZE MODULES ROUTE */}
                    <Route path="/admin/customize" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Sales', 'Sales Manager']}>
                        <CustomizeModules />
                      </ProtectedRoute>
                    } />
                    
                    {/* ============================================
                        SALES MANAGER
                        ============================================ */}
                    <Route path="/sales-manager" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales Manager']}><SalesManagerDashboard /></ProtectedRoute>} />
                    
                    {/* ============================================
                        SALES
                        ============================================ */}
                    <Route path="/sales" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><SalesDashboard /></ProtectedRoute>} />
                    <Route path="/sales/leads" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><Leads /></ProtectedRoute>} />
                    <Route path="/sales/lead_generation" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><LeadGeneration /></ProtectedRoute>} />
                    <Route path="/sales/accounts" element={<Accounts />} />
                    <Route path="/sales/deals" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><Deals /></ProtectedRoute>} />   
                    <Route path="/sales/accounts/new" element={<CreateAccount />} />
                    <Route path="/sales/contacts" element={<Contacts />} />
                    <Route path="/sales/accounts/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><AccountDetail /></ProtectedRoute>} />
                    <Route path="/sales/contacts/:accountId/:pocId" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><ContactDetail /></ProtectedRoute>} />
                    <Route path="/sales/deals/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}><DealDetail /></ProtectedRoute>} />

                    {/* ============================================
                        ✅ ACTIVITIES (NOTES FEATURE — ZOHO STYLE)
                        ============================================ */}
                    <Route path="/sales/activities/tasks" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}>
                        <ActivitiesTasks />
                      </ProtectedRoute>
                    } />
                    <Route path="/sales/activities/meetings" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}>
                        <ActivitiesMeetings />
                      </ProtectedRoute>
                    } />
                    <Route path="/sales/activity/:id" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}>
                        <ActivityDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="/sales/activities/calls" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Sales', 'Admin', 'Sales Manager']}>
                        <ActivitiesCalls />
                      </ProtectedRoute>
                    } />
                    
                    {/* ============================================
                        PROJECT MANAGEMENT
                        ============================================ */}
                    
                    <Route path="/pm/dashboard" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <PmDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}><ProjectManagement /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Sales Manager', 'HR']}><UserManagement /></ProtectedRoute>} />
                    
                    {/* PM Routes */}
                    <Route path="/pm/feeds" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <ProjectFeeds />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/resource-analytics" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <ResourceAnalytics />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/git-manager" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <GitManager />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/feed-status" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/work-report" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES]}>
                        <WorkReport  />
                      </ProtectedRoute>
                    } />
                    {/* PM FEASIBILITY ROUTE */}
                    <Route path="/pm/feasibility" element={
                      <ProtectedRoute allowedRoles={['Super Admin', ...PM_ROLES]}>
                        <PmFeasibilityDashboard />
                      </ProtectedRoute>
                    } />

                    {/* ============================================
                        DEVELOPER ROUTES
                        ============================================ */}
                    <Route path="/developer" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}><DeveloperDashboard /></ProtectedRoute>} />
                    <Route path="/developer/worklog" element={<ProtectedRoute allowedRoles={['Super Admin', 'Developer', 'Admin']}><Worklog /></ProtectedRoute>} />    
                    <Route path="/developer/git-feeds" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}><DeveloperGitFeeds /></ProtectedRoute>} />
                    <Route path="/developer/projects" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}><DeveloperProjects /></ProtectedRoute>} />
                    <Route path="/developer/feeds" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}><DeveloperFeeds /></ProtectedRoute>} />
                    <Route path="/developer/feed-status" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/developer/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />

                    {/* ============================================
                        TEAM LEAD ROUTES
                        ============================================ */}
                    <Route path="/teamlead" element={<ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}><TeamLeadDashboard /></ProtectedRoute>} />
                    <Route path="/teamlead/projects" element={<ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}><TeamLeadProjects /></ProtectedRoute>} />
                    <Route path="/teamlead/developers" element={<ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}><TeamLeadDevelopers /></ProtectedRoute>} />
                    <Route path="/teamlead/feeds" element={<ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}><TeamLeadFeeds /></ProtectedRoute>} />
                    <Route path="/teamlead/feed-status" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/teamlead/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Team Lead']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />

                    {/* ============================================
                        CLIENT ROUTES
                        ============================================ */}
                    <Route path="/client" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Client']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/client/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Client']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />
                    
                    {/* ============================================
                        TICKETS ROUTES - UPDATED WITH HR, FINANCE & SALES
                        ============================================ */}
                    
                    {/* Ticket Dashboard - HR & Finance can view all their tickets */}
                    <Route path="/tickets" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Developer', 'Team Lead', 'Client', 'HR', 'Finance', 'Sales', 'Sales Manager']}>
                        <TicketDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Create Ticket - HR & Finance can create tickets */}
                    <Route path="/tickets/create" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Client', 'Admin', ...PM_ROLES, 'Developer', 'Team Lead', 'HR', 'Finance', 'Sales', 'Sales Manager']}>
                        <CreateTicket />
                      </ProtectedRoute>
                    } />
                    
                    {/* Ticket Details - HR & Finance can view ticket details */}
                    <Route path="/tickets/:id" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Developer', 'Team Lead', 'Client', 'HR', 'Finance', 'Sales', 'Sales Manager']}>
                        <TicketDetails />
                      </ProtectedRoute>
                    } />

                    {/* ============================================
                        HRMS ROUTES - People Ops
                        ============================================ */}
                    
                    {/* HR Dashboard - HR and Admin only */}
                    <Route path="/hr" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                        <HrDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* HR Leave Management - HR and Admin only */}
                    <Route path="/hr/leaves" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                        <HrLeaveDashboard />
                      </ProtectedRoute>
                    } />
                   
                    {/* ============================================
                        PEOPLE OPS - Employee Dashboard
                        ============================================ */}
                    {/* This page contains both Leave and Attendance management */}
                    <Route path="/employee" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Developer', 'Team Lead', 'Sales','Sales Manager', ...PM_ROLES, 'Client', 'Finance']}>
                        <EmployeeDashboard />
                      </ProtectedRoute>
                    } />
      
                    {/* ============================================
                        SHARED ROUTES
                        ============================================ */}
                    <Route path="/view_analytics" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Sales', ...PM_ROLES, 'Sales Manager', 'Team Lead']}><ViewAnalytics /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/notifications" element={
                      <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Developer', 'Client', 'HR', 'Finance','Sales Manager','Team Lead']}>
                        <NotificationSettings />
                      </ProtectedRoute>
                    } />
                    <Route path="/knowledge" element={
                        <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Developer', 'Team Lead', 'HR', 'Finance','Sales','Sales Manager']}>
                          <KnowledgeBase />
                        </ProtectedRoute>
                      } />
                    <Route path="/hr/attendance-sync" element={
                        <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                          <AttendanceSync />
                        </ProtectedRoute>
                      } />
                    <Route path="/feasibility" element={
                        <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Sales']}>
                          <FeasibilityDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/hr/employee-attendance" element={
                        <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                          <EmployeeAttendanceDetail />
                        </ProtectedRoute>
                      } />
                      <Route path="/hr/employee-attendance-report" element={
                        <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                          <EmployeeAttendanceReport />
                        </ProtectedRoute>
                      } />
                      <Route path="/announcements" element={
                          <ProtectedRoute allowedRoles={['Super Admin', 'Admin', ...PM_ROLES, 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance']}>
                            <Announcements />
                          </ProtectedRoute>
                        } />
                      <Route path="/hr/holidays" element={
                          <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}>
                              <HolidayList />
                          </ProtectedRoute>
                      } />
                    <Route path="*" element={<Navigate to={landingPath} replace />} />
                  </Routes>
                  </Suspense>
                  </ErrorBoundary>
                                </PageLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AnimatePresence>
    </SessionManager>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}