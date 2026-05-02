import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TaskList } from '../components/TaskList';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { NotificationBellModern } from '../components/NotificationBellModern';
import { OverdueTasksAlert } from '../components/OverdueTasksAlert';
import { AttendancePanel } from '../components/AttendancePanel';
import { ManagerAttendanceConfigPanel } from '../components/ManagerAttendanceConfigPanel';
import { AppBrand } from '../components/AppBrand';

export const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState('tasks');

  const handleTaskCreated = () => {
    setRefreshKey((current) => current + 1);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <AppBrand compact subtitle="Manager Dashboard" />
        <div style={styles.nav}>
          <button
            type="button"
            style={{ ...styles.navBtn, background: view === 'tasks' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('tasks')}
          >
            Tasks
          </button>
          <button
            type="button"
            style={{ ...styles.navBtn, background: view === 'attendance' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('attendance')}
          >
            Attendance
          </button>
        </div>
        <div style={styles.user}>
          <NotificationBellModern />
          <span>Welcome, {user.firstName}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        <OverdueTasksAlert user={user} endpoint={`/tasks?assignee_id=${user.id}`} />
        {view === 'attendance' ? (
          <>
            <AttendancePanel />
            <ManagerAttendanceConfigPanel />
          </>
        ) : (
          <>
            <CreateTaskForm onSuccess={handleTaskCreated} />
            <TaskList
              user={user}
              refreshToken={refreshKey}
              title="Managed Team Tasks"
              subtitle="These are the tasks you created for your team and the work currently visible under your lead."
              emptyMessage="No team tasks found yet."
              accent="blue"
            />
            <TaskList
              user={user}
              refreshToken={refreshKey}
              endpoint={`/tasks?assignee_id=${user.id}`}
              title="Assigned To Me"
              subtitle="These tasks are directly assigned to you, and you can update your own progress here."
              emptyMessage="No tasks are currently assigned to you."
              accent="amber"
            />
          </>
        )}
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
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flex: 1,
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  navBtn: {
    padding: '0.5rem 1.4rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
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
