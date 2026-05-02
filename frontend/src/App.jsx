import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastViewport } from './components/ToastViewport';
import { AppBrand } from './components/AppBrand';

const getDashboardRoute = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/employee';
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <AppBrand centered subtitle="Loading your workspace..." />
        <p style={styles.loadingText}>Please wait a moment.</p>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={getDashboardRoute(user.role)} /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={<Navigate to="/login" replace />}
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={['manager']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee"
          element={
            <ProtectedRoute roles={['employee']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={user ? getDashboardRoute(user.role) : '/login'} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ToastViewport />
    </>
  );
}

export default App;

const styles = {
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    background: 'radial-gradient(circle at top, rgba(222, 233, 255, 0.95), #f4f7fb 48%, #eef2f6 100%)',
    color: '#173053'
  },
  loadingText: {
    margin: 0,
    color: '#53647d'
  }
};
