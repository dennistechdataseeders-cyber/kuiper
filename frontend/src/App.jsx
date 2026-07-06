// frontend/src/App.jsx
import { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ViewAnalytics from './pages/ViewAnalytics';
import UserManagement from './pages/UserManagement';
import ProjectManagement from './pages/ProjectManagement';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Organizations from './pages/Organizations';
import SalesDashboard from './pages/SalesDashboard';
import SalesManagerDashboard from './pages/SalesManagerDashboard';
import LeadGeneration from './pages/LeadGeneration';
import Prospects from './pages/Prospects';
import DeveloperDashboard from './pages/DeveloperDashboard';
import ProjectDetailView from './pages/ProjectDetailView';
import DeveloperBucket from './components/DeveloperBucket';
import Profile from './pages/Profile';
import ProjectFeeds from './pages/ProjectFeeds';  
import PMTaskProgress from './pages/PMTaskProgress';
import Worklog from './pages/Worklog';
import ResourceAnalytics from './pages/ResourceAnalytics';
import EmailTrigger from './pages/EmailTrigger';
import TicketDashboard from './pages/TicketDashboard';
import CreateTicket from './pages/CreateTicket';
import TicketDetails from './pages/TicketDetails';
import ClientDashboard from './pages/ClientDashboard';
import NotificationSettings from './pages/NotificationSettings';
import GitManager from './pages/GitManager';
import DeveloperGitFeeds from './pages/DeveloperGitFeeds';
import AdminProjectClients from './pages/AdminProjectClients';  
import DeveloperProjects from './pages/DeveloperProjects';
import DeveloperFeeds from './pages/DeveloperFeeds';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import TeamLeadProjects from './pages/TeamLeadProjects';
import TeamLeadDevelopers from './pages/TeamLeadDevelopers';
import TeamLeadFeeds from './pages/TeamLeadFeeds';
import TicketAssignmentRules from './pages/TicketAssignmentRules';
import FeedDeliveryDashboard from './pages/FeedDeliveryDashboard';
import ProjectFeedStatus from './pages/ProjectFeedStatus';
import ClientFeedDetails from './pages/ClientFeedDetails';
import KnowledgeBase from './pages/KnowledgeBase';

// Import the new Notification component
import NotificationBell from './components/NotificationBell';

import { AnimatePresence } from 'framer-motion';

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

    if (lastActive && currentTime - parseInt(lastActive) > expirationTime) {
      localStorage.clear();
      navigate('/login', { replace: true });
    } else {
      localStorage.setItem('lastActive', currentTime.toString());
    }
  }, [location.pathname, navigate]);

  return children;
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    const rolePaths = {
      'Admin': '/admin',
      'Sales Manager': '/sales-manager',
      'Sales': '/sales',
      'Developer': '/developer',
      'Project Manager': '/admin/projects',
      'Client': '/client', 
      'Team Lead': '/teamlead',
      'HR': '/tickets',
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

  const landingPath = useMemo(() => {
      if (!userRole) return '/login';
      const pathMap = {
        'Admin': '/admin',
        'Sales Manager': '/sales-manager',
        'Sales': '/sales',
        'Project Manager': '/admin/projects',
        'Developer': '/developer',
        'Client': '/client',
        'Team Lead': '/teamlead',
        'HR': '/tickets',
        'Finance': '/tickets',
      };
      return pathMap[userRole] || '/login';
    }, [userRole]);
  
  return (
    <SessionManager>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route 
            path="/login" 
            element={token ? <Navigate to={landingPath} replace /> : <Login />} 
          />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="flex bg-[#f8fafc] min-h-screen">
                <Sidebar />
                <main className="flex-1 w-full overflow-x-hidden pl-20 lg:pl-0">
                  <Routes>
                    <Route path="/" element={<Navigate to={landingPath} replace />} />

                    {/* Admin Dashboards */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/ticket-rules" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <TicketAssignmentRules />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/project-clients" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <AdminProjectClients />
                      </ProtectedRoute>
                    } />
                    
                    {/* Sales Manager */}
                    <Route path="/sales-manager" element={<ProtectedRoute allowedRoles={['Sales Manager']}><SalesManagerDashboard /></ProtectedRoute>} />
                    
                    {/* Sales */}
                    <Route path="/sales" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><SalesDashboard /></ProtectedRoute>} />
                    <Route path="/sales/add_org" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Organizations /></ProtectedRoute>} />
                    <Route path="/sales/lead_generation" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><LeadGeneration /></ProtectedRoute>} />
                    <Route path="/sales/prospects" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Prospects /></ProtectedRoute>} />
                    <Route path="/sales/email-trigger" element={
                      <ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}>
                        <EmailTrigger />
                      </ProtectedRoute>
                    } />
                    
                    {/* Project Management */}
                    <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><ProjectManagement /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Sales Manager']}><UserManagement /></ProtectedRoute>} />
                    
                    {/* PM Routes */}
                    <Route path="/pm/feeds" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <ProjectFeeds />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/task-progress" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><PMTaskProgress /></ProtectedRoute>} />
                    <Route path="/pm/resource-analytics" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <ResourceAnalytics />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/git-manager" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <GitManager />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/feed-status" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />

                    {/* Developer Routes */}
                    <Route path="/developer" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperDashboard /></ProtectedRoute>} />
                    <Route path="/developer/project/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><ProjectDetailView /></ProtectedRoute>} />
                    <Route path="/developer/bucket" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperBucket /></ProtectedRoute>} />
                    <Route path="/developer/worklog" element={<ProtectedRoute allowedRoles={['Developer', 'Admin']}><Worklog /></ProtectedRoute>} />    
                    <Route path="/developer/git-feeds" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperGitFeeds /></ProtectedRoute>} />
                    <Route path="/developer/projects" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperProjects /></ProtectedRoute>} />
                    <Route path="/developer/feeds" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperFeeds /></ProtectedRoute>} />
                    <Route path="/developer/feed-status" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Developer']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/developer/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Developer']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />

                    {/* Team Lead Routes */}
                    <Route path="/teamlead" element={<ProtectedRoute allowedRoles={['Team Lead']}><TeamLeadDashboard /></ProtectedRoute>} />
                    <Route path="/teamlead/projects" element={<ProtectedRoute allowedRoles={['Team Lead']}><TeamLeadProjects /></ProtectedRoute>} />
                    <Route path="/teamlead/developers" element={<ProtectedRoute allowedRoles={['Team Lead']}><TeamLeadDevelopers /></ProtectedRoute>} />
                    <Route path="/teamlead/feeds" element={<ProtectedRoute allowedRoles={['Team Lead']}><TeamLeadFeeds /></ProtectedRoute>} />
                    <Route path="/teamlead/feed-status" element={
                      <ProtectedRoute allowedRoles={['Team Lead']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/teamlead/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Team Lead']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />

                    {/* Client Routes */}
                    <Route path="/client" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Client']}>
                        <FeedDeliveryDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/client/projects/:projectId/feeds" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Client']}>
                        <ProjectFeedStatus />
                      </ProtectedRoute>
                    } />
                    <Route path="/client/feeds/:feedId" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Client']}>
                        <ClientFeedDetails />
                      </ProtectedRoute>
                    } />
                    
                    {/* ============================================
                        TICKETS ROUTES - UPDATED WITH HR & FINANCE
                        ============================================ */}
                    
                    {/* Ticket Dashboard - HR & Finance can view all their tickets */}
                    <Route path="/tickets" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Team Lead', 'Client', 'HR', 'Finance']}>
                        <TicketDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Create Ticket - HR & Finance can create tickets */}
                    <Route path="/tickets/create" element={
                      <ProtectedRoute allowedRoles={['Client', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'HR', 'Finance']}>
                        <CreateTicket />
                      </ProtectedRoute>
                    } />
                    
                    {/* Ticket Details - HR & Finance can view ticket details */}
                    <Route path="/tickets/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Team Lead', 'Client', 'HR', 'Finance']}>
                        <TicketDetails />
                      </ProtectedRoute>
                    } />
              
                    {/* Shared */}
                    <Route path="/view_analytics" element={<ProtectedRoute allowedRoles={['Admin', 'Sales', 'Project Manager', 'Sales Manager', 'Team Lead']}><ViewAnalytics /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/notifications" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Client', 'HR', 'Finance']}>
                        <NotificationSettings />
                      </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to={landingPath} replace />} />
                    <Route path="/knowledge" element={
                        <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Team Lead','HR', 'Finance']}>
                          <KnowledgeBase />
                        </ProtectedRoute>
                      } />
                  </Routes>
                  
                </main>
              </div>
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