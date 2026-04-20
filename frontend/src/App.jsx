import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastViewport } from './components/ToastViewport';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingOrb} />
        <h1 style={styles.loadingTitle}>Task Tracker</h1>
        <p style={styles.loadingText}>Loading your workspace...</p>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} /> : <LoginPage />}
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
          path="/employee"
          element={
            <ProtectedRoute roles={['employee']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/employee') : '/login'} />} />
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
  loadingOrb: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1e63d4, #69a6ff)',
    boxShadow: '0 18px 40px rgba(30, 99, 212, 0.28)',
    animation: 'pulse 1.4s ease-in-out infinite'
  },
  loadingTitle: {
    fontSize: '1.8rem',
    margin: 0
  },
  loadingText: {
    margin: 0,
    color: '#53647d'
  }
};
