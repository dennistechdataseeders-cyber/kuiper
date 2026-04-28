import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ViewAnalytics from './pages/ViewAnalytics';
import UserManagement from './pages/UserManagement';
import ProjectManagement from './pages/ProjectManagement';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Organizations from './pages/Organizations';
import SalesDashboard from './pages/SalesDashboard';
import SalesManagerDashboard from './pages/SalesManagerDashboard'; // New Import
import LeadGeneration from './pages/LeadGeneration';
import Prospects from './pages/Prospects';
import DeveloperDashboard from './pages/DeveloperDashboard';
import ProjectDetailView from './pages/ProjectDetailView';
import DeveloperBucket from './components/DeveloperBucket';

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
    const expirationTime = 12 * 60 * 60 * 1000;
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
    };
    const redirectTo = rolePaths[userRole] || '/login';
    return <Navigate to={redirectTo} replace />;
  }
  return children;
};

function AppContent() {
  const userRole = localStorage.getItem('role');

  const landingPath =
    userRole === 'Admin'           ? '/admin'           :
    userRole === 'Sales Manager'   ? '/sales-manager'   :
    userRole === 'Sales'           ? '/sales'           :
    userRole === 'Project Manager' ? '/admin/projects' :
    userRole === 'Developer'       ? '/developer'       : '/login';

  return (
    <SessionManager>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="flex bg-[#f8fafc] min-h-screen">
              <Sidebar />
              <main className="flex-1 w-full overflow-x-hidden pl-20 lg:pl-0"> 
                {/* pl-20 added to offset fixed sidebar on small screens if not using ml */}
                <Routes>
                  <Route path="/" element={<Navigate to={landingPath} replace />} />

                  {/* Admin & Sales Manager Dashboard */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/sales-manager" element={<ProtectedRoute allowedRoles={['Sales Manager']}><SalesManagerDashboard /></ProtectedRoute>} />

                  {/* Project & User Management */}
                  <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager']}><ProjectManagement /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Sales Manager']}><UserManagement /></ProtectedRoute>} />

                  {/* Sales Routes */}
                  <Route path="/sales" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><SalesDashboard /></ProtectedRoute>} />
                  <Route path="/sales/add_org" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Organizations /></ProtectedRoute>} />
                  <Route path="/sales/lead_generation" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><LeadGeneration /></ProtectedRoute>} />
                  <Route path="/sales/prospects" element={<ProtectedRoute allowedRoles={['Sales', 'Admin', 'Sales Manager']}><Prospects /></ProtectedRoute>} />

                  {/* Developer Routes */}
                  <Route path="/developer" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperDashboard /></ProtectedRoute>} />
                  <Route path="/developer/project/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><ProjectDetailView /></ProtectedRoute>} />
                  <Route path="/developer/bucket" element={<ProtectedRoute allowedRoles={['Admin', 'Developer']}><DeveloperBucket /></ProtectedRoute>} />

                  {/* Analytics */}
                  <Route path="/view_analytics" element={<ProtectedRoute allowedRoles={['Admin', 'Sales', 'Project Manager', 'Sales Manager']}><ViewAnalytics /></ProtectedRoute>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
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