import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TaskList } from '../components/TaskList';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { NotificationBellModern } from '../components/NotificationBellModern';
import { AdminAnalytics } from '../components/AdminAnalytics';
import { AdminStatsOverview } from '../components/AdminStatsOverview';
import { AdminAttendanceOverview } from '../components/AdminAttendanceOverview';
import { AdminReports } from '../components/AdminReports';
import { AdminGamification } from '../components/AdminGamification';
import { AdminGoalsPanel } from '../components/AdminGoalsPanel';
import { AdminIdeasBoard } from '../components/AdminIdeasBoard';
import { OverdueTasksAlert } from '../components/OverdueTasksAlert';
import { AppBrand } from '../components/AppBrand';

export const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState('tasks');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  ));

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobileView(mobile);
      if (!mobile) {
        setMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const navItems = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'goals', label: 'Goals' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'reports', label: 'Reports' },
    { key: 'ideas', label: 'Ideas' },
    { key: 'gamification', label: 'Gamification' }
  ];

  const handleTaskCreated = () => {
    setRefreshKey(k => k + 1);
  };

  const handleViewChange = (nextView) => {
    setView(nextView);
    if (isMobileView) {
      setMenuOpen(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={{ ...styles.header, ...(isMobileView ? styles.headerMobile : {}) }}>
        <div style={styles.brandSection}>
          <AppBrand compact subtitle="Admin Dashboard" />
          {isMobileView ? (
            <button
              type="button"
              style={styles.menuBtn}
              onClick={() => setMenuOpen(current => !current)}
            >
              {menuOpen ? 'Close Menu' : 'Menu'}
            </button>
          ) : null}
        </div>
        {!isMobileView ? (
          <div style={styles.nav}>
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                style={{
                  ...styles.navBtn,
                  background: view === item.key ? '#007bff' : '#6c757d'
                }}
                onClick={() => handleViewChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ ...styles.user, ...(isMobileView ? styles.userMobile : {}) }}>
          <NotificationBellModern />
          <span style={styles.welcomeText}>Welcome, {user.firstName}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
        {isMobileView && menuOpen ? (
          <div style={styles.mobileMenuPanel}>
            <div style={styles.mobileNav}>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    ...styles.mobileNavBtn,
                    background: view === item.key ? '#007bff' : '#eef3fb',
                    color: view === item.key ? 'white' : '#173053'
                  }}
                  onClick={() => handleViewChange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
              title="Manager Team Tasks"
              subtitle="These are tasks managers created for their teams, so you can review them from admin side and guide managers where needed."
              taskFilter={(task) => task.created_by_role === 'manager'}
              emptyMessage="No manager-created team tasks found yet."
              accent="amber"
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
        ) : view === 'ideas' ? (
          <AdminIdeasBoard />
        ) : view === 'goals' ? (
          <AdminGoalsPanel />
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
    padding: '1rem clamp(1rem, 3vw, 2rem)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  headerMobile: {
    alignItems: 'stretch'
  },
  brandSection: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flex: '1 1 260px'
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flex: 1,
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  mobileMenuPanel: {
    width: '100%',
    background: '#f7faff',
    border: '1px solid #d6e3f5',
    borderRadius: '18px',
    padding: '0.9rem',
    boxShadow: '0 14px 28px rgba(23, 48, 83, 0.08)'
  },
  mobileNav: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '0.75rem'
  },
  navBtn: {
    padding: '0.5rem 1.5rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  mobileNavBtn: {
    padding: '0.85rem 1rem',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    boxShadow: '0 8px 20px rgba(23, 48, 83, 0.08)'
  },
  menuBtn: {
    padding: '0.75rem 1rem',
    minWidth: '116px',
    background: '#173053',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 10px 24px rgba(23, 48, 83, 0.18)'
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  userMobile: {
    width: '100%',
    justifyContent: 'space-between'
  },
  welcomeText: {
    color: '#173053',
    fontWeight: 600
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
