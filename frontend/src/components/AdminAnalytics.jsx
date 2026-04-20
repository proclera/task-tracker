import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const { showToast } = useToast();
  const { user } = useAuth();

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
      `Delete ${employee.first_name} ${employee.last_name} (${employee.role})? Assigned tasks will be unassigned and attendance/history records for this user will be removed.`
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

  const handleRoleChange = async (employeeId, nextRole) => {
    try {
      setUpdatingRoleId(employeeId);
      await api.patch(`/employees/${employeeId}/role`, { role: nextRole });
      showToast(`Role updated to ${nextRole}`, 'success');
      fetchAnalytics();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update role';
      showToast(message, 'error');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      showToast('Please fill all user fields', 'error');
      return;
    }

    if (newUser.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      setCreatingUser(true);
      await api.post('/employees', newUser);
      showToast(`${newUser.role === 'admin' ? 'Admin' : 'Employee'} account created`, 'success');
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'employee'
      });
      fetchAnalytics();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create user';
      showToast(message, 'error');
    } finally {
      setCreatingUser(false);
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
          <h3 style={styles.sectionTitle}>User Management</h3>
          <form onSubmit={handleCreateUser} style={styles.createUserForm}>
            <div style={styles.createUserRow}>
              <input
                type="text"
                value={newUser.firstName}
                onChange={(event) => setNewUser((current) => ({ ...current, firstName: event.target.value }))}
                placeholder="First name"
                style={styles.formInput}
                required
              />
              <input
                type="text"
                value={newUser.lastName}
                onChange={(event) => setNewUser((current) => ({ ...current, lastName: event.target.value }))}
                placeholder="Last name"
                style={styles.formInput}
                required
              />
            </div>
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email address"
              style={styles.formInput}
              required
            />
            <div style={styles.createUserRow}>
              <input
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                placeholder="Temporary password"
                style={styles.formInput}
                required
              />
              <select
                value={newUser.role}
                onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
                style={styles.formInput}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" style={styles.createBtn} disabled={creatingUser}>
              {creatingUser ? 'Creating...' : 'Create User'}
            </button>
          </form>
          <div style={styles.employeeList}>
            {employees.length === 0 ? (
              <div style={styles.empty}>No users yet</div>
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
                        <div style={styles.employeeEmail}>
                          {employee.email} ({employee.role})
                        </div>
                      </div>
                      {employee.id !== user.id && (
                        <select
                          value={employee.role}
                          onChange={(event) => handleRoleChange(employee.id, event.target.value)}
                          style={styles.roleSelect}
                          disabled={updatingRoleId === employee.id}
                        >
                          <option value="employee">employee</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                      {employee.id !== user.id && (
                        <button
                          type="button"
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteEmployee(employee)}
                          disabled={deletingEmployeeId === employee.id}
                        >
                          {deletingEmployeeId === employee.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
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
                  <span>{task.assignee_names || task.assignee_name || 'Unassigned'}</span>
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
  createUserForm: {
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem'
  },
  createUserRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem'
  },
  formInput: {
    padding: '0.6rem 0.7rem',
    borderRadius: '8px',
    border: '1px solid #d3d9e4'
  },
  createBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#007bff',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer'
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
  roleSelect: {
    padding: '0.45rem 0.6rem',
    border: '1px solid #d3d9e4',
    borderRadius: '8px',
    background: 'white'
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
