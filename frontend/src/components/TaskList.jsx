import { useState, useEffect } from 'react';
import { TaskManagementModal } from './TaskManagementModal';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

export const TaskList = ({ user, refreshToken = 0 }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const { showToast } = useToast();

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = user.role === 'admin' ? '/tasks' : '/tasks/my';
      const response = await api.get(endpoint);
      setTasks(response.data.tasks || []);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to load tasks';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user.role, refreshToken]);

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      setError('');
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'success');
      fetchTasks();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update task';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleTaskUpdated = (updatedTask) => {
    fetchTasks();
    if (updatedTask) {
      setSelectedTask(updatedTask);
      return;
    }

    setSelectedTask(null);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>{user.role === 'admin' ? 'All Tasks' : 'My Tasks'}</h2>
            <p style={styles.subtitle}>Fetching the latest task activity.</p>
          </div>
          <div style={styles.loadingBadge}>Syncing...</div>
        </div>
        <div style={styles.grid}>
          {[1, 2, 3].map((item) => (
            <div key={item} style={{ ...styles.card, ...styles.skeletonCard }}>
              <div style={{ ...styles.skeletonLine, width: '34%' }} />
              <div style={{ ...styles.skeletonLine, width: '62%', height: '18px', marginTop: '1rem' }} />
              <div style={{ ...styles.skeletonLine, width: '100%', marginTop: '0.8rem' }} />
              <div style={{ ...styles.skeletonLine, width: '80%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>{user.role === 'admin' ? 'All Tasks' : 'My Tasks'}</h2>
          <p style={styles.subtitle}>
            {user.role === 'admin'
              ? 'Open any card to edit details, assign ownership, or delete work.'
              : 'Track your assigned work and update progress as you move.'}
          </p>
        </div>
        <div style={styles.countBadge}>{tasks.length} task{tasks.length === 1 ? '' : 's'}</div>
      </div>
      {error && <div style={styles.error}>{error}</div>}

      {tasks.length === 0 ? (
        <div style={styles.empty}>No tasks found</div>
      ) : (
        <div style={styles.grid}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              user={user}
              onStatusChange={updateTaskStatus}
              onClick={() => setSelectedTask(task)}
            />
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskManagementModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          user={user}
          onUpdate={handleTaskUpdated}
        />
      )}
    </div>
  );
};

const TaskCard = ({ task, user, onStatusChange, onClick }) => {
  const statusColors = {
    pending: '#ffc107',
    in_progress: '#17a2b8',
    completed: '#28a745'
  };

  const priorityColors = {
    low: '#6c757d',
    medium: '#17a2b8',
    high: '#ffc107',
    urgent: '#dc3545'
  };

  return (
    <div style={styles.card} onClick={onClick}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, background: statusColors[task.status] }}>
          {task.status.replace('_', ' ')}
        </span>
        <span style={{ ...styles.badge, background: priorityColors[task.priority] }}>
          {task.priority}
        </span>
      </div>

      <h3 style={styles.cardTitle}>{task.title}</h3>
      {task.description && <p style={styles.cardDesc}>{task.description}</p>}

      <div style={styles.metaStrip}>
        <span style={styles.metaChip}>Assigned: {task.assignee_name || 'Unassigned'}</span>
        {task.due_date && <span style={styles.metaChip}>Due: {task.due_date}</span>}
      </div>

      <div style={styles.cardMeta}>
        <span>Created by: {task.created_by_name}</span>
      </div>

      {user.role === 'employee' && (
        <div style={styles.actions} onClick={e => e.stopPropagation()}>
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            style={styles.select}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '1rem'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '1.7rem',
    marginBottom: '0.35rem',
    color: '#183153'
  },
  subtitle: {
    color: '#63748f',
    lineHeight: 1.5
  },
  loadingBadge: {
    padding: '0.55rem 0.9rem',
    borderRadius: '999px',
    background: 'rgba(30, 99, 212, 0.1)',
    color: '#1e63d4',
    fontWeight: 700
  },
  countBadge: {
    padding: '0.6rem 0.95rem',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, rgba(30, 99, 212, 0.12), rgba(105, 166, 255, 0.18))',
    color: '#1b4f9c',
    fontWeight: 700
  },
  error: {
    padding: '1rem',
    background: 'linear-gradient(135deg, #fff1f1, #ffe5e5)',
    color: '#a22929',
    borderRadius: '14px',
    marginBottom: '1rem'
  },
  empty: {
    padding: '2.4rem',
    textAlign: 'center',
    color: '#5f7089',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,248,253,0.95))',
    borderRadius: '22px',
    border: '1px solid rgba(122, 145, 184, 0.18)',
    boxShadow: '0 18px 44px rgba(31, 45, 76, 0.08)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem'
  },
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.95))',
    padding: '1.1rem',
    borderRadius: '22px',
    border: '1px solid rgba(122, 145, 184, 0.16)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease'
  },
  skeletonCard: {
    minHeight: '170px',
    cursor: 'default'
  },
  skeletonLine: {
    height: '12px',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, rgba(226,232,244,0.9), rgba(210,220,238,0.55), rgba(226,232,244,0.9))'
  },
  metaStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.9rem'
  },
  metaChip: {
    padding: '0.38rem 0.7rem',
    borderRadius: '999px',
    background: '#eef4ff',
    color: '#496383',
    fontSize: '0.8rem',
    fontWeight: 600
  },
  cardHeader: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  badge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: 'white',
    textTransform: 'capitalize'
  },
  cardTitle: {
    fontSize: '1.14rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#183153'
  },
  cardDesc: {
    color: '#5e6f89',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
    lineHeight: 1.5
  },
  cardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.8rem',
    color: '#8190a8',
    marginTop: '0.5rem'
  },
  actions: {
    marginTop: '1rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #e8edf6'
  },
  select: {
    padding: '0.7rem',
    borderRadius: '12px',
    border: '1px solid #d4dceb',
    width: '100%'
  }
};
