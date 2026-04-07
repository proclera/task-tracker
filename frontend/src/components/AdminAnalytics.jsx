import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

export const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const [analyticsResponse, employeesResponse] = await Promise.all([
        api.get('/tasks/analytics'),
        api.get('/employees')
      ]);
      setAnalytics(analyticsResponse.data.analytics);
      setEmployees(employeesResponse.data.employees || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      `Delete ${employee.first_name} ${employee.last_name}? Assigned tasks will be unassigned and attendance/history records for this employee will be removed.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingEmployeeId(employee.id);
      await api.delete(`/employees/${employee.id}`);
      showToast('Employee deleted successfully', 'success');
      fetchAnalytics();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete employee';
      showToast(message, 'error');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  if (loading) return <div style={styles.loading}>Loading analytics...</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!analytics) return null;

  const completionRate = analytics.totalTasks > 0
    ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100)
    : 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Analytics Dashboard</h2>

      <div style={styles.summary}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{analytics.totalTasks}</div>
          <div style={styles.statLabel}>Total Tasks</div>
        </div>
        <div style={{ ...styles.statCard, background: '#f59f00' }}>
          <div style={styles.statNumber}>{analytics.assignedTasks ?? 0}</div>
          <div style={styles.statLabel}>Assigned</div>
        </div>
        <div style={{ ...styles.statCard, background: '#ffc107' }}>
          <div style={styles.statNumber}>{analytics.pendingTasks}</div>
          <div style={styles.statLabel}>Pending</div>
        </div>
        <div style={{ ...styles.statCard, background: '#28a745' }}>
          <div style={styles.statNumber}>{analytics.completedTasks}</div>
          <div style={styles.statLabel}>Completed</div>
        </div>
      </div>

      <div style={styles.progressSection}>
        <h3 style={styles.sectionTitle}>Completion Rate</h3>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${completionRate}%` }}>
            {completionRate}%
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Tasks by Priority</h3>
          <div style={styles.priorityList}>
            {analytics.tasksByPriority.map(p => (
              <div key={p.priority} style={styles.priorityItem}>
                <span style={{ textTransform: 'capitalize' }}>{p.priority}</span>
                <span style={styles.priorityCount}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Employee Management</h3>
          <div style={styles.employeeList}>
            {employees.length === 0 ? (
              <div style={styles.empty}>No employees yet</div>
            ) : (
              employees.map((employee) => {
                const performance = analytics.tasksPerEmployee.find((item) => item.id === employee.id);
                const totalTasks = performance?.totalTasks || 0;
                const completedTasks = performance?.completed || 0;
                const completionRateForEmployee = totalTasks > 0
                  ? Math.round((completedTasks / totalTasks) * 100)
                  : 0;

                return (
                  <div key={employee.id} style={styles.employeeItem}>
                    <div style={styles.employeeHeader}>
                      <div>
                        <div style={styles.employeeName}>
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div style={styles.employeeEmail}>{employee.email}</div>
                      </div>
                      <button
                        type="button"
                        style={styles.deleteBtn}
                        onClick={() => handleDeleteEmployee(employee)}
                        disabled={deletingEmployeeId === employee.id}
                      >
                        {deletingEmployeeId === employee.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <div style={styles.employeeStats}>
                      <span>Total: {totalTasks}</span>
                      <span>Completed: {completedTasks}</span>
                      <span>Rate: {completionRateForEmployee}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent Activity</h3>
        <div style={styles.activityList}>
          {analytics.recentTasks.length === 0 ? (
            <div style={styles.empty}>No recent activity</div>
          ) : (
            analytics.recentTasks.map(task => (
              <div key={task.id} style={styles.activityItem}>
                <div style={styles.activityTitle}>{task.title}</div>
                <div style={styles.activityMeta}>
                  <span style={{
                    ...styles.statusBadge,
                    background: getStatusColor(task.status)
                  }}>{task.status}</span>
                  <span>{task.assignee_name || 'Unassigned'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  const colors = { pending: '#ffc107', in_progress: '#17a2b8', completed: '#28a745' };
  return colors[status] || '#6c757d';
};

const styles = {
  container: {
    padding: '1rem'
  },
  title: {
    fontSize: '1.5rem',
    marginBottom: '1.5rem'
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: '#666'
  },
  error: {
    padding: '1rem',
    background: '#fee',
    color: '#c00',
    borderRadius: '4px'
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statCard: {
    background: '#007bff',
    color: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    textAlign: 'center'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 'bold'
  },
  statLabel: {
    fontSize: '0.9rem',
    opacity: 0.9
  },
  progressSection: {
    marginBottom: '1.5rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem'
  },
  progressBar: {
    height: '30px',
    background: '#e9ecef',
    borderRadius: '15px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #28a745, #34ce57)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '10px',
    color: 'white',
    fontWeight: 'bold',
    transition: 'width 0.3s'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
    marginBottom: '1.5rem'
  },
  section: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  priorityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  priorityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
    background: '#f5f5f5',
    borderRadius: '4px'
  },
  priorityCount: {
    fontWeight: 'bold'
  },
  employeeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  empty: {
    padding: '1rem',
    textAlign: 'center',
    color: '#666'
  },
  employeeItem: {
    padding: '0.75rem',
    background: '#f5f5f5',
    borderRadius: '8px'
  },
  employeeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.35rem'
  },
  employeeName: {
    fontWeight: 'bold',
    marginBottom: '0.25rem'
  },
  employeeEmail: {
    fontSize: '0.85rem',
    color: '#666'
  },
  employeeStats: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.85rem',
    color: '#666'
  },
  deleteBtn: {
    padding: '0.45rem 0.8rem',
    border: 'none',
    borderRadius: '8px',
    background: '#dc3545',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  activityItem: {
    padding: '0.75rem',
    background: '#f5f5f5',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  activityTitle: {
    fontWeight: 'bold'
  },
  activityMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.85rem',
    color: '#666'
  },
  statusBadge: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.75rem',
    textTransform: 'capitalize'
  }
};
