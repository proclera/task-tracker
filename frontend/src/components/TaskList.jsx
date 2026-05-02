import { useState, useEffect } from 'react';
import { TaskManagementModal } from './TaskManagementModal';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatDateLabel, formatServerDateTime, isDateOverdue } from '../lib/datetime';
import { formatGoalCode, formatTaskCode } from '../lib/entityCodes';

export const TaskList = ({
  user,
  refreshToken = 0,
  endpoint,
  title,
  subtitle,
  emptyMessage = 'No tasks found',
  taskFilter,
  accent = 'blue'
}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const { showToast } = useToast();
  const hasManagementView = user.role === 'admin' || user.role === 'manager';

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError('');
      const resolvedEndpoint = endpoint || (hasManagementView ? '/tasks' : '/tasks/my');
      const response = await api.get(resolvedEndpoint);
      const fetchedTasks = response.data.tasks || [];
      setTasks(typeof taskFilter === 'function' ? fetchedTasks.filter(taskFilter) : fetchedTasks);
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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter((task) => {
    const matchesSearch = !normalizedSearch || [
      task.title,
      task.description,
      task.goal_title,
      task.created_by_name,
      task.assignee_names,
      task.assignee_name,
      task.latest_comment,
      task.latest_comment_by
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const overdue = task.due_date && task.status !== 'completed' && isDateOverdue(task.due_date);
    const matchesDue = dueFilter === 'all'
      || (dueFilter === 'overdue' && overdue)
      || (dueFilter === 'upcoming' && task.due_date && !overdue)
      || (dueFilter === 'none' && !task.due_date);

    return matchesSearch && matchesStatus && matchesPriority && matchesDue;
  });

  const statusCounts = tasks.reduce((counts, task) => {
    counts[task.status] = (counts[task.status] || 0) + 1;
    return counts;
  }, { pending: 0, in_progress: 0, completed: 0 });

  const updateTaskStatus = async (taskId, newStatus, comment = '') => {
    try {
      setError('');
      let nextComment = comment;

      if (newStatus === 'completed' && !nextComment.trim()) {
        const completionNote = window.prompt('Add a short completion note before marking this task as completed.');
        if (completionNote === null) {
          return;
        }

        nextComment = completionNote.trim();
        if (!nextComment) {
          const message = 'Completion note is required when marking a task as completed';
          setError(message);
          showToast(message, 'error');
          return;
        }
      }

      await api.patch(`/tasks/${taskId}/status`, { status: newStatus, comment: nextComment });
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
            <h2 style={{ ...styles.title, color: ACCENT_STYLES[accent]?.titleColor || styles.title.color }}>
              {title || (hasManagementView ? 'All Tasks' : 'My Tasks')}
            </h2>
            <p style={styles.subtitle}>Fetching the latest task activity.</p>
          </div>
          <div style={{ ...styles.loadingBadge, ...(ACCENT_STYLES[accent]?.loadingBadge || {}) }}>Syncing...</div>
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
          <h2 style={{ ...styles.title, color: ACCENT_STYLES[accent]?.titleColor || styles.title.color }}>
            {title || (hasManagementView ? 'All Tasks' : 'My Tasks')}
          </h2>
          <p style={styles.subtitle}>
            {subtitle || (hasManagementView
              ? 'Open any card to edit details, assign ownership, or delete work.'
              : 'Track your assigned work and update progress as you move.')}
          </p>
        </div>
        <div style={{ ...styles.countBadge, ...(ACCENT_STYLES[accent]?.countBadge || {}) }}>
          {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </div>
      </div>
      <div style={styles.counterRow}>
        <div style={styles.counterCard}>
          <span style={styles.counterLabel}>Pending</span>
          <span style={styles.counterValue}>{statusCounts.pending || 0}</span>
        </div>
        <div style={styles.counterCard}>
          <span style={styles.counterLabel}>In Progress</span>
          <span style={styles.counterValue}>{statusCounts.in_progress || 0}</span>
        </div>
        <div style={styles.counterCard}>
          <span style={styles.counterLabel}>Completed</span>
          <span style={styles.counterValue}>{statusCounts.completed || 0}</span>
        </div>
      </div>
      <div style={styles.filterBar}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, assignee, creator, or comment"
          style={{ ...styles.filterInput, ...styles.searchInput }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterInput}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={styles.filterInput}>
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} style={styles.filterInput}>
          <option value="all">All Dates</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">With Due Date</option>
          <option value="none">No Due Date</option>
        </select>
      </div>
      {error && <div style={styles.error}>{error}</div>}

      {visibleTasks.length === 0 ? (
        <div style={styles.empty}>{emptyMessage}</div>
      ) : (
        <div style={styles.grid}>
          {visibleTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              user={user}
              onStatusChange={updateTaskStatus}
              onClick={() => setSelectedTask(task)}
              accent={accent}
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

const ACCENT_STYLES = {
  blue: {
    titleColor: '#183153',
    countBadge: {
      background: 'linear-gradient(135deg, rgba(30, 99, 212, 0.12), rgba(105, 166, 255, 0.18))',
      color: '#1b4f9c'
    },
    loadingBadge: {
      background: 'rgba(30, 99, 212, 0.1)',
      color: '#1e63d4'
    },
    card: {
      border: '1px solid rgba(122, 145, 184, 0.16)',
      boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
    }
  },
  amber: {
    titleColor: '#7a4a00',
    countBadge: {
      background: 'linear-gradient(135deg, rgba(205, 127, 24, 0.14), rgba(255, 201, 107, 0.22))',
      color: '#8c5200'
    },
    loadingBadge: {
      background: 'rgba(205, 127, 24, 0.12)',
      color: '#b06400'
    },
    card: {
      border: '1px solid rgba(214, 163, 75, 0.24)',
      boxShadow: '0 18px 42px rgba(140, 82, 0, 0.12)'
    }
  }
};

const TaskCard = ({ task, user, onStatusChange, onClick, accent = 'blue' }) => {
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

  const canUpdateOwnProgress = Boolean(task.my_status);
  const isOverdue = task.due_date && task.status !== 'completed' && isDateOverdue(task.due_date);
  const latestCommentPreview = task.latest_comment
    ? task.latest_comment.length > 120
      ? `${task.latest_comment.slice(0, 120)}...`
      : task.latest_comment
    : '';
  const relationshipLabel = task.created_by === user.id
    ? 'Manager'
    : canUpdateOwnProgress
      ? 'Contributor'
      : '';
  const creatorRoleLabel = user.role === 'admin' && task.created_by_role === 'manager'
    ? 'Manager Created'
    : '';
  const taskCode = task.task_code || formatTaskCode(task.id);
  const goalCode = task.goal_id ? (task.goal_code || formatGoalCode(task.goal_id)) : '';

  return (
    <div
      style={{
        ...styles.card,
        ...(ACCENT_STYLES[accent]?.card || {}),
        ...(isOverdue ? styles.cardOverdue : {})
      }}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, background: statusColors[task.status] }}>
          {task.status.replace('_', ' ')}
        </span>
        {task.my_status && (
          <span style={{ ...styles.badge, background: statusColors[task.my_status] }}>
            me: {task.my_status.replace('_', ' ')}
          </span>
        )}
        {relationshipLabel && (
          <span style={{ ...styles.badge, ...(relationshipLabel === 'Manager' ? styles.roleBadgeManager : styles.roleBadgeContributor) }}>
            {relationshipLabel}
          </span>
        )}
        {creatorRoleLabel && (
          <span style={{ ...styles.badge, ...styles.roleBadgeManagerCreated }}>
            {creatorRoleLabel}
          </span>
        )}
        <span style={{ ...styles.badge, background: priorityColors[task.priority] }}>
          {task.priority}
        </span>
        {isOverdue && <span style={{ ...styles.badge, ...styles.overdueBadge }}>overdue</span>}
      </div>

      <div style={styles.codeLabel}>{taskCode}</div>
      <h3 style={styles.cardTitle}>{task.title}</h3>
      {task.description && <p style={styles.cardDesc}>{task.description}</p>}

      <div style={styles.metaStrip}>
        <span style={styles.metaChip}>Assigned: {task.assignee_names || task.assignee_name || 'Unassigned'}</span>
        {task.goal_title && (
          <span style={styles.metaChip}>Goal: {goalCode ? `${goalCode} - ${task.goal_title}` : task.goal_title}</span>
        )}
        {task.due_date && (
          <span style={{ ...styles.metaChip, ...(isOverdue ? styles.metaChipOverdue : {}) }}>
            Due: {formatDateLabel(task.due_date)}
          </span>
        )}
      </div>

      <div style={styles.cardMeta}>
        <span>Created by: {task.created_by_name}</span>
      </div>

      {latestCommentPreview && (
        <div style={styles.commentPreview}>
          <div style={styles.commentPreviewLabel}>
            Latest comment
            {task.latest_comment_by ? ` by ${task.latest_comment_by}` : ''}
            {task.latest_comment_at ? ` • ${formatServerDateTime(task.latest_comment_at)}` : ''}
          </div>
          <div style={styles.commentPreviewText}>{latestCommentPreview}</div>
        </div>
      )}

      {canUpdateOwnProgress && (
        <div style={styles.actions} onClick={e => e.stopPropagation()}>
          <select
            value={task.my_status || 'pending'}
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
  counterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.85rem',
    marginBottom: '1rem'
  },
  counterCard: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.95))',
    border: '1px solid rgba(122, 145, 184, 0.14)',
    borderRadius: '18px',
    padding: '0.9rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  counterLabel: {
    color: '#63748f',
    fontSize: '0.88rem',
    fontWeight: 700
  },
  counterValue: {
    color: '#183153',
    fontSize: '1.3rem',
    fontWeight: 800
  },
  filterBar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1.6fr) repeat(3, minmax(140px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  filterInput: {
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    background: 'white',
    fontSize: '0.92rem'
  },
  searchInput: {
    minWidth: 0
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
  cardOverdue: {
    border: '1px solid rgba(210, 73, 73, 0.42)',
    boxShadow: '0 18px 42px rgba(185, 67, 67, 0.16)'
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
  overdueBadge: {
    background: '#c43d3d',
    color: 'white'
  },
  roleBadgeManager: {
    background: '#214f9b',
    color: 'white'
  },
  roleBadgeContributor: {
    background: '#9a5b00',
    color: 'white'
  },
  roleBadgeManagerCreated: {
    background: '#6d28d9',
    color: 'white'
  },
  cardTitle: {
    fontSize: '1.14rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#183153'
  },
  codeLabel: {
    fontSize: '0.77rem',
    fontWeight: 800,
    color: '#4f6f98',
    letterSpacing: '0.06em',
    marginBottom: '0.35rem'
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
  commentPreview: {
    marginTop: '0.9rem',
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    background: 'rgba(240, 244, 251, 0.95)'
  },
  commentPreviewLabel: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#63748f',
    marginBottom: '0.32rem'
  },
  commentPreviewText: {
    color: '#4f617d',
    fontSize: '0.86rem',
    lineHeight: 1.45
  },
  metaChipOverdue: {
    background: '#fff0f0',
    color: '#b13a3a'
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
