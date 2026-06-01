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
      'Client': '/client',  // ADD THIS LINE
    };
    
    const fallbackPath = rolePaths[userRole] || '/login';
    return <Navigate to={fallbackPath} replace />;
  }
  return children;
};

function AppContent() {
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const location = useLocation(); // Required for AnimatePresence to track key changes

const landingPath = useMemo(() => {
  if (!userRole) return '/login';
  if (userRole === 'Admin') return '/admin';
  if (userRole === 'Sales Manager') return '/sales-manager';
  if (userRole === 'Sales') return '/sales';
  if (userRole === 'Project Manager') return '/admin/projects';
  if (userRole === 'Developer') return '/developer';
  if (userRole === 'Client') return '/client';  // ADD THIS LINE
  return '/login';
}, [userRole]);

  return (
    <SessionManager>
      {/* 
          AnimatePresence must be given the current location and a unique key 
          (usually location.pathname) so it knows when a route change occurs.
      */}
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

                    {/* Dashboards */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/sales-manager" element={<ProtectedRoute allowedRoles={['Sales Manager']}><SalesManagerDashboard /></ProtectedRoute>} />
                    <Route path="/sales" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><SalesDashboard /></ProtectedRoute>} />
                    
                    {/* Sales Routes */}
                    <Route path="/sales/add_org" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Organizations /></ProtectedRoute>} />
                    <Route path="/sales/lead_generation" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><LeadGeneration /></ProtectedRoute>} />
                    <Route path="/sales/prospects" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Prospects /></ProtectedRoute>} />
                    <Route
                      path="/sales/email-trigger"
                      element={
                        <ProtectedRoute
                          allowedRoles={[
                            'Sales',
                            'Admin',
                            'Sales Manager'
                          ]}
                        >
                          <EmailTrigger />
                        </ProtectedRoute>
                      }
                    />
                    {/* Management */}
                    <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><ProjectManagement /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Sales Manager']}><UserManagement /></ProtectedRoute>} />
                    <Route path="/pm/feeds" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <ProjectFeeds />
                      </ProtectedRoute>
                    } />
                    <Route path="/pm/task-progress" element={<PMTaskProgress />}/>
                    <Route path="/pm/resource-analytics"  element={    <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><ResourceAnalytics /></ProtectedRoute>  }/>

                    {/* Developer */}
                    <Route path="/developer" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperDashboard /></ProtectedRoute>} />
                    <Route path="/developer/project/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><ProjectDetailView /></ProtectedRoute>} />
                    <Route path="/developer/bucket" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperBucket /></ProtectedRoute>} />
                    <Route path="/developer/worklog" element={ <ProtectedRoute allowedRoles={['Developer', 'Admin']}> <Worklog /></ProtectedRoute>}/>    
                    {/*Client routes*/}
                    <Route path="/client" element={<ProtectedRoute allowedRoles={['Admin', 'Client']}><ClientDashboard /></ProtectedRoute>} />

                    {/* Shared */}
                    <Route path="/tickets" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Client']}><TicketDashboard /></ProtectedRoute>} />
                    <Route path="/tickets/create" element={<ProtectedRoute allowedRoles={['Client', 'Admin', 'Project Manager']}><CreateTicket /></ProtectedRoute>} />
                    <Route path="/tickets/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Client']}><TicketDetails /></ProtectedRoute>} />
                    
                    <Route path="/view_analytics" element={<ProtectedRoute allowedRoles={['Admin', 'Sales', 'Project Manager', 'Sales Manager']}><ViewAnalytics /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to={landingPath} replace />} />
                    <Route path="/notifications" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Developer', 'Client']}>
                        <NotificationSettings />
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