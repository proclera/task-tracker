import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TaskList } from '../components/TaskList';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { NotificationBellModern } from '../components/NotificationBellModern';
import { AdminAnalytics } from '../components/AdminAnalytics';
import { AdminStatsOverview } from '../components/AdminStatsOverview';
import { AdminAttendanceOverview } from '../components/AdminAttendanceOverview';
import { AdminReports } from '../components/AdminReports';
import { AdminGamification } from '../components/AdminGamification';
import { OverdueTasksAlert } from '../components/OverdueTasksAlert';

export const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState('tasks');

  const handleTaskCreated = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Admin Dashboard</h1>
        <div style={styles.nav}>
          <button
            style={{ ...styles.navBtn, background: view === 'tasks' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('tasks')}
          >
            Tasks
          </button>
          <button
            style={{ ...styles.navBtn, background: view === 'analytics' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
          <button
            style={{ ...styles.navBtn, background: view === 'attendance' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('attendance')}
          >
            Attendance
          </button>
          <button
            style={{ ...styles.navBtn, background: view === 'reports' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('reports')}
          >
            Reports
          </button>
          <button
            style={{ ...styles.navBtn, background: view === 'gamification' ? '#007bff' : '#6c757d' }}
            onClick={() => setView('gamification')}
          >
            Gamification
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
        {view === 'tasks' ? (
          <>
            <AdminStatsOverview refreshToken={refreshKey} />
            <CreateTaskForm onSuccess={handleTaskCreated} />
            <TaskList
              user={user}
              refreshToken={refreshKey}
              title="Managed Tasks"
              subtitle="These are the tasks you created and currently manage."
              taskFilter={(task) => task.created_by === user.id}
              emptyMessage="No managed tasks found yet."
              accent="blue"
            />
            <TaskList
              user={user}
              refreshToken={refreshKey}
              endpoint={`/tasks?assignee_id=${user.id}`}
              title="Assigned To Me"
              subtitle="These are the tasks assigned to you where you can update progress and share comments."
              emptyMessage="No tasks are currently assigned to you."
              accent="amber"
            />
          </>
        ) : view === 'analytics' ? (
          <AdminAnalytics />
        ) : view === 'reports' ? (
          <AdminReports />
        ) : view === 'gamification' ? (
          <AdminGamification />
        ) : (
          <AdminAttendanceOverview />
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
    padding: '1rem 2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '2rem'
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flex: 1,
    justifyContent: 'center'
  },
  navBtn: {
    padding: '0.5rem 1.5rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
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
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto'
  }
};
