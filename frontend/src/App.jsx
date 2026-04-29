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

const SessionManager = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run session checks if NOT on the login page
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

  // Case-insensitive check to avoid "sales" vs "Sales" issues
  if (allowedRoles && !allowedRoles.map(r => r.toLowerCase()).includes(userRole?.toLowerCase())) {
    const rolePaths = {
      'admin': '/admin',
      'sales manager': '/sales-manager',
      'sales': '/sales',
      'developer': '/developer',
      'project manager': '/admin/projects',
    };
    const redirectTo = rolePaths[userRole.toLowerCase()] || '/login';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

function AppContent() {
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  // useMemo prevents the landing path from changing constantly during renders
  const landingPath = useMemo(() => {
    if (!userRole) return '/login';
    const role = userRole.toLowerCase();
    if (role === 'admin') return '/admin';
    if (role === 'sales manager') return '/sales-manager';
    if (role === 'sales') return '/sales';
    if (role === 'project manager') return '/admin/projects';
    if (role === 'developer') return '/developer';
    return '/login';
  }, [userRole]);

  return (
    <SessionManager>
      <Routes>
        {/* If logged in, /login takes you to your dashboard */}
        <Route path="/login" element={token ? <Navigate to={landingPath} replace /> : <Login />} />
        
        {/* Standardized Dashboard Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="flex bg-[#f8fafc] min-h-screen">
              <Sidebar />
              <main className="flex-1 w-full overflow-x-hidden pl-20 lg:pl-0">
                <Routes>
                  {/* Root within the dashboard */}
                  <Route path="/" element={<Navigate to={landingPath} replace />} />

                  {/* Shared & Specific Routes */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/sales-manager" element={<ProtectedRoute allowedRoles={['Sales Manager']}><SalesManagerDashboard /></ProtectedRoute>} />
                  
                  {/* Sales Group: Ensure 'Sales' is explicitly listed */}
                  <Route path="/sales" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><SalesDashboard /></ProtectedRoute>} />
                  <Route path="/sales/add_org" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Organizations /></ProtectedRoute>} />
                  <Route path="/sales/lead_generation" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><LeadGeneration /></ProtectedRoute>} />
                  <Route path="/sales/prospects" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Prospects /></ProtectedRoute>} />

                  {/* Management */}
                  <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><ProjectManagement /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Sales Manager']}><UserManagement /></ProtectedRoute>} />

                  {/* Developer */}
                  <Route path="/developer" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperDashboard /></ProtectedRoute>} />
                  <Route path="/developer/project/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><ProjectDetailView /></ProtectedRoute>} />
                  <Route path="/developer/bucket" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperBucket /></ProtectedRoute>} />

                  {/* Analytics */}
                  <Route path="/view_analytics" element={<ProtectedRoute allowedRoles={['Admin', 'Sales', 'Project Manager', 'Sales Manager']}><ViewAnalytics /></ProtectedRoute>} />

                  {/* Internal Fallback to landing page instead of infinite /login redirect */}
                  <Route path="*" element={<Navigate to={landingPath} replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
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