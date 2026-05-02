import { useAuth } from '../context/AuthContext';
import { TaskList } from '../components/TaskList';
import { NotificationBellModern } from '../components/NotificationBellModern';
import { AttendancePanel } from '../components/AttendancePanel';
import { GamificationPanel } from '../components/GamificationPanel';
import { OverdueTasksAlert } from '../components/OverdueTasksAlert';
import { AppBrand } from '../components/AppBrand';

export const EmployeeDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <AppBrand compact subtitle="Employee Dashboard" />
        <div style={styles.user}>
          <NotificationBellModern />
          <span>Welcome, {user.firstName}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>
      <main style={styles.main}>
        <OverdueTasksAlert user={user} endpoint="/tasks/my" />
        <AttendancePanel />
        <GamificationPanel />
        <TaskList user={user} />
      </main>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5'
  },
  header: {
    background: 'white',
    padding: '1rem clamp(1rem, 3vw, 2rem)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  main: {
    padding: 'clamp(1rem, 3vw, 2rem)',
    maxWidth: '1200px',
    margin: '0 auto'
  }
};
