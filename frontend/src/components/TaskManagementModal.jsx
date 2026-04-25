import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatServerDateTime } from '../lib/datetime';

const createAdminFormState = (task) => ({
  title: task.title || '',
  description: task.description || '',
  status: task.status || 'pending',
  priority: task.priority || 'medium',
  assignee_ids: Array.isArray(task.assignee_ids) ? task.assignee_ids : [],
  due_date: task.due_date || ''
});

const getStatusColor = (status) => {
  const colors = { pending: '#ffc107', in_progress: '#17a2b8', completed: '#28a745' };
  return colors[status] || '#6c757d';
};

const getPriorityColor = (priority) => {
  const colors = { low: '#6c757d', medium: '#17a2b8', high: '#ffc107', urgent: '#dc3545' };
  return colors[priority] || '#6c757d';
};

export const TaskManagementModal = ({ task, onClose, user, onUpdate }) => {
  const [taskData, setTaskData] = useState(task);
  const [adminForm, setAdminForm] = useState(createAdminFormState(task));
  const [employees, setEmployees] = useState([]);
  const [comments, setComments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTimeEntry, setActiveTimeEntry] = useState(null);
  const [timeLoading, setTimeLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [savingOwnProgress, setSavingOwnProgress] = useState(false);
  const [ownStatus, setOwnStatus] = useState(task.my_status || 'pending');
  const [statusComment, setStatusComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [timeError, setTimeError] = useState('');
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const canUpdateOwnProgress = Boolean(taskData.my_status);
  const canManageTask = isAdmin || (isManager && taskData.created_by === user.id);
  const showAdminEditor = canManageTask;
  const { showToast } = useToast();

  useEffect(() => {
    setTaskData(task);
    setAdminForm(createAdminFormState(task));
    setOwnStatus(task.my_status || 'pending');
    setStatusComment('');
    setTaskError('');
    setCommentError('');
    setTimeError('');
    fetchComments(task.id);
    fetchTimeEntries(task.id);
    fetchActiveTimeEntry();

    if (isAdmin || isManager) {
      fetchEmployees();
    }
  }, [task, isAdmin, isManager]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data.employees || []);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to load employees';
      setTaskError(message);
      showToast(message, 'error');
    }
  };

  const fetchComments = async (taskId) => {
    try {
      const response = await api.get(`/comments?task_id=${taskId}`);
      setComments(response.data.comments || []);
    } catch (err) {
      setCommentError(err.response?.data?.error || 'Failed to fetch comments');
    }
  };

  const fetchTimeEntries = async (taskId) => {
    try {
      const response = await api.get(`/time-entries/task/${taskId}`);
      setTimeEntries(response.data.timeEntries || []);
    } catch (err) {
      setTimeError(err.response?.data?.error || 'Failed to fetch time entries');
    }
  };

  const fetchActiveTimeEntry = async () => {
    try {
      const response = await api.get('/time-entries/active');
      setActiveTimeEntry(response.data.activeEntry || null);
    } catch (err) {
      setTimeError(err.response?.data?.error || 'Failed to fetch active timer');
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommentError('');
    setCommentLoading(true);
    try {
      const response = await api.post('/comments', {
        task_id: taskData.id,
        content: newComment.trim()
      });
      setComments((currentComments) => [...currentComments, response.data.comment]);
      setNewComment('');
      showToast('Comment added', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to add comment';
      setCommentError(message);
      showToast(message, 'error');
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      setCommentError('');
      await api.delete(`/comments/${commentId}`);
      setComments((currentComments) => currentComments.filter((comment) => comment.id !== commentId));
      showToast('Comment deleted', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete comment';
      setCommentError(message);
      showToast(message, 'error');
    }
  };

  const handleAdminFieldChange = (e) => {
    const { name, value } = e.target;
    setAdminForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const toggleAdminAssignee = (employeeId) => {
    setAdminForm((currentForm) => {
      const selected = currentForm.assignee_ids.includes(employeeId);

      return {
        ...currentForm,
        assignee_ids: selected
          ? currentForm.assignee_ids.filter((id) => id !== employeeId)
          : [...currentForm.assignee_ids, employeeId]
      };
    });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    setTaskError('');
    setSavingTask(true);

    try {
      const updateResponse = await api.put(`/tasks/${taskData.id}`, {
        title: adminForm.title,
        description: adminForm.description,
        status: adminForm.status,
        priority: adminForm.priority,
        assignee_ids: adminForm.assignee_ids,
        due_date: adminForm.due_date || null
      });
      const updatedTask = updateResponse.data.task;
      setTaskData(updatedTask);
      setAdminForm(createAdminFormState(updatedTask));
      showToast('Task updated successfully', 'success');
      onUpdate(updatedTask);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update task';
      setTaskError(message);
      showToast(message, 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = async () => {
    const confirmed = window.confirm(`Delete "${taskData.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setTaskError('');
    setDeletingTask(true);

    try {
      await api.delete(`/tasks/${taskData.id}`);
      showToast('Task deleted', 'success');
      onUpdate(null);
      onClose();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete task';
      setTaskError(message);
      showToast(message, 'error');
    } finally {
      setDeletingTask(false);
    }
  };

  const handleStartTimer = async () => {
    try {
      setTimeError('');
      setTimeLoading(true);
      const response = await api.post('/time-entries/start', {
        task_id: taskData.id
      });
      setActiveTimeEntry(response.data.timeEntry);
      showToast('Timer started', 'success');
      fetchTimeEntries(taskData.id);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to start timer';
      setTimeError(message);
      showToast(message, 'error');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimeEntry) return;

    try {
      setTimeError('');
      setTimeLoading(true);
      const response = await api.patch(`/time-entries/${activeTimeEntry.id}/stop`, {});
      setActiveTimeEntry(null);
      showToast(`Timer stopped at ${response.data.timeEntry.duration_minutes} minutes`, 'success');
      fetchTimeEntries(taskData.id);
      fetchActiveTimeEntry();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to stop timer';
      setTimeError(message);
      showToast(message, 'error');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleOwnStatusUpdate = async (e) => {
    e.preventDefault();
    setTaskError('');
    setSavingOwnProgress(true);

    try {
      const response = await api.patch(`/tasks/${taskData.id}/status`, {
        status: ownStatus,
        comment: statusComment.trim()
      });
      const updatedTask = response.data.task;
      setTaskData(updatedTask);
      setOwnStatus(updatedTask.my_status || ownStatus);
      setStatusComment('');
      showToast('Your task progress was updated', 'success');
      onUpdate(updatedTask);
      fetchComments(taskData.id);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update your progress';
      setTaskError(message);
      showToast(message, 'error');
    } finally {
      setSavingOwnProgress(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={styles.closeBtn} onClick={onClose}>x</button>

        <div style={styles.header}>
          <h2 style={styles.title}>{taskData.title}</h2>
          <p style={styles.subtitle}>
            {showAdminEditor
              ? 'Refine task details, reassign ownership, and manage progress in one place.'
              : 'Review the task details, update your progress, and share issues through comments.'}
          </p>
          <div style={styles.badges}>
            <span style={{ ...styles.badge, background: getStatusColor(taskData.status) }}>
              {taskData.status.replace('_', ' ')}
            </span>
            {taskData.my_status && (
              <span style={{ ...styles.badge, background: getStatusColor(taskData.my_status) }}>
                my progress: {taskData.my_status.replace('_', ' ')}
              </span>
            )}
            <span style={{ ...styles.badge, background: getPriorityColor(taskData.priority) }}>
              {taskData.priority}
            </span>
          </div>
        </div>

        <div style={styles.body}>
          {taskError && <div style={styles.error}>{taskError}</div>}

          {showAdminEditor && (
            <form onSubmit={handleSaveTask} style={styles.section}>
              <h4 style={styles.sectionTitle}>Edit Task</h4>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Title</span>
                  <input
                    name="title"
                    value={adminForm.title}
                    onChange={handleAdminFieldChange}
                    style={styles.input}
                    required
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Priority</span>
                  <select
                    name="priority"
                    value={adminForm.priority}
                    onChange={handleAdminFieldChange}
                    style={styles.input}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>

                <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <span style={styles.fieldLabel}>Description</span>
                  <textarea
                    name="description"
                    value={adminForm.description}
                    onChange={handleAdminFieldChange}
                    style={{ ...styles.input, minHeight: '96px', resize: 'vertical' }}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Status</span>
                  <select
                    name="status"
                    value={adminForm.status}
                    onChange={handleAdminFieldChange}
                    style={styles.input}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <span style={styles.helperText}>
                    Changing this status will update the assigned users&apos; progress as well.
                  </span>
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Due date</span>
                  <input
                    type="date"
                    name="due_date"
                    value={adminForm.due_date || ''}
                    onChange={handleAdminFieldChange}
                    style={styles.input}
                  />
                </label>

                <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <span style={styles.fieldLabel}>Assignees</span>
                  <div style={styles.assignmentPanel}>
                    <div style={styles.assignmentSummary}>
                      {adminForm.assignee_ids.length} selected
                    </div>
                    <div style={styles.assignmentGrid}>
                      {employees.map((employee) => {
                        const selected = adminForm.assignee_ids.includes(employee.id);

                        return (
                          <label
                            key={employee.id}
                            style={{
                              ...styles.assignmentOption,
                              ...(selected ? styles.assignmentOptionSelected : {})
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleAdminAssignee(employee.id)}
                            />
                            <span>{employee.first_name} {employee.last_name} ({employee.role})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </label>
              </div>

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                  disabled={deletingTask || savingTask}
                >
                  {deletingTask ? 'Deleting...' : 'Delete Task'}
                </button>
                <button
                  type="submit"
                  style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                  disabled={savingTask || deletingTask}
                >
                  {savingTask ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Description</h4>
            <p style={styles.description}>{taskData.description || 'No description'}</p>
          </div>

          <div style={styles.meta}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Assigned to:</span>
              <span>{taskData.assignee_names || taskData.assignee_name || 'Unassigned'}</span>
            </div>
            {Array.isArray(taskData.assignee_statuses) && taskData.assignee_statuses.length > 0 && (
              <div style={styles.statusList}>
                {taskData.assignee_statuses.map((assignee) => (
                  <div key={assignee.user_id} style={styles.statusRow}>
                    <span>{assignee.name}</span>
                    <span style={{ ...styles.inlineStatus, background: getStatusColor(assignee.status) }}>
                      {assignee.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Created by:</span>
              <span>{taskData.created_by_name}</span>
            </div>
            {taskData.due_date && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Due date:</span>
                <span>{taskData.due_date}</span>
              </div>
            )}
          </div>

          {canUpdateOwnProgress && (
            <form onSubmit={handleOwnStatusUpdate} style={styles.section}>
              <h4 style={styles.sectionTitle}>My Progress</h4>
              <div style={styles.progressPanel}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Status</span>
                  <select
                    value={ownStatus}
                    onChange={(e) => setOwnStatus(e.target.value)}
                    style={styles.input}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <span style={styles.fieldLabel}>Comment / issue note</span>
                  <textarea
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    placeholder="Agar koi issue, update, ya completion note share karna ho to yahan likhein."
                    style={{ ...styles.input, minHeight: '92px', resize: 'vertical' }}
                  />
                </label>
              </div>
              <div style={styles.inlineActionRow}>
                <button
                  type="submit"
                  style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                  disabled={savingOwnProgress}
                >
                  {savingOwnProgress ? 'Updating...' : 'Update My Progress'}
                </button>
              </div>
            </form>
          )}

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Time Tracking</h4>
            {timeError && <div style={styles.error}>{timeError}</div>}

            <div style={styles.timerPanel}>
              <div>
                <div style={styles.timerLabel}>
                  {activeTimeEntry?.task_id === taskData.id
                    ? 'Timer is active for this task'
                    : activeTimeEntry
                      ? `Another task is active: ${activeTimeEntry.task_title}`
                      : 'No active timer'}
                </div>
                {activeTimeEntry?.task_id === taskData.id && (
                  <div style={styles.timerMeta}>
                    Started: {formatServerDateTime(activeTimeEntry.start_time)}
                  </div>
                )}
              </div>

              {activeTimeEntry?.task_id === taskData.id ? (
                <button
                  type="button"
                  style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                  onClick={handleStopTimer}
                  disabled={timeLoading}
                >
                  {timeLoading ? 'Stopping...' : 'Stop Timer'}
                </button>
              ) : (
                <button
                  type="button"
                  style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                  onClick={handleStartTimer}
                  disabled={timeLoading || Boolean(activeTimeEntry)}
                >
                  {timeLoading ? 'Starting...' : 'Start Timer'}
                </button>
              )}
            </div>

            <div style={styles.timeEntriesList}>
              {timeEntries.length === 0 ? (
                <div style={styles.noComments}>No time entries yet</div>
              ) : (
                timeEntries.map((entry) => (
                  <div key={entry.id} style={styles.timeEntryCard}>
                    <div style={styles.timeEntryTitle}>{entry.user_name}</div>
                    <div style={styles.timeEntryMeta}>
                      <span>Start: {formatServerDateTime(entry.start_time)}</span>
                      <span>
                        End: {entry.end_time ? formatServerDateTime(entry.end_time) : 'In progress'}
                      </span>
                      <span>{entry.duration_minutes || 0} min</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Comments</h4>
            {commentError && <div style={styles.error}>{commentError}</div>}

            <div style={styles.commentsList}>
              {comments.length === 0 ? (
                <div style={styles.noComments}>No comments yet</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} style={styles.comment}>
                    <div style={styles.commentHeader}>
                      <span style={styles.commentAuthor}>{comment.user_name}</span>
                      <span style={styles.commentTime}>
                        {formatServerDateTime(comment.created_at)}
                      </span>
                      {(user.role === 'admin' || user.role === 'manager' || comment.user_id === user.id) && (
                        <button
                          type="button"
                          style={styles.deleteCommentBtn}
                          onClick={() => deleteComment(comment.id)}
                        >
                          x
                        </button>
                      )}
                    </div>
                    <div style={styles.commentContent}>{comment.content}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={addComment} style={styles.commentForm}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                style={styles.commentInput}
                rows={3}
              />
              <button
                type="submit"
                style={{ ...styles.actionBtn, ...styles.primaryBtn, alignSelf: 'flex-end' }}
                disabled={commentLoading || !newComment.trim()}
              >
                {commentLoading ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(18, 27, 46, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,255,0.97))',
    borderRadius: '24px',
    width: '90%',
    maxWidth: '760px',
    maxHeight: '90vh',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(122, 145, 184, 0.18)',
    boxShadow: '0 24px 70px rgba(19, 28, 50, 0.24)'
  },
  closeBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer'
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #eee'
  },
  title: {
    margin: '0 0 0.35rem 0',
    color: '#183153'
  },
  subtitle: {
    margin: '0 0 1rem 0',
    color: '#63748f',
    lineHeight: 1.5
  },
  badges: {
    display: 'flex',
    gap: '0.5rem'
  },
  badge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: 'white',
    textTransform: 'capitalize'
  },
  body: {
    padding: '1.5rem',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 100px)'
  },
  error: {
    background: 'linear-gradient(135deg, #fff1f1, #ffe5e5)',
    color: '#a22929',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1rem'
  },
  section: {
    marginBottom: '1.5rem'
  },
  sectionTitle: {
    marginBottom: '0.5rem',
    fontSize: '1rem',
    color: '#333'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem'
  },
  progressPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '16px',
    background: '#eef4ff'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem'
  },
  fieldLabel: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#555'
  },
  helperText: {
    fontSize: '0.78rem',
    color: '#667892'
  },
  assignmentPanel: {
    border: '1px solid #d4dceb',
    borderRadius: '14px',
    background: '#f8fbff',
    padding: '0.9rem'
  },
  assignmentSummary: {
    marginBottom: '0.75rem',
    color: '#63748f',
    fontSize: '0.86rem',
    fontWeight: 600
  },
  assignmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.6rem'
  },
  assignmentOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.7rem 0.8rem',
    borderRadius: '12px',
    background: 'white',
    border: '1px solid #d4dceb',
    cursor: 'pointer'
  },
  assignmentOptionSelected: {
    borderColor: '#3a82ff',
    boxShadow: '0 0 0 1px rgba(58, 130, 255, 0.18)'
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #d4dceb',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit'
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    marginTop: '1rem'
  },
  inlineActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem'
  },
  actionBtn: {
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #1e63d4, #3a82ff)',
    boxShadow: '0 14px 28px rgba(30, 99, 212, 0.24)'
  },
  deleteBtn: {
    background: 'linear-gradient(135deg, #cb3a3a, #e85a5a)',
    boxShadow: '0 14px 28px rgba(203, 58, 58, 0.22)'
  },
  description: {
    color: '#666',
    lineHeight: 1.5
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#eef4ff',
    borderRadius: '16px'
  },
  metaItem: {
    display: 'flex',
    gap: '0.5rem'
  },
  statusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    paddingTop: '0.25rem'
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(255,255,255,0.65)',
    borderRadius: '12px',
    padding: '0.6rem 0.75rem'
  },
  inlineStatus: {
    padding: '0.22rem 0.55rem',
    borderRadius: '999px',
    color: 'white',
    fontSize: '0.74rem',
    textTransform: 'capitalize'
  },
  metaLabel: {
    fontWeight: 'bold',
    color: '#666'
  },
  timerPanel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#eef4ff',
    borderRadius: '16px',
    marginBottom: '1rem'
  },
  timerLabel: {
    fontWeight: 700,
    color: '#183153',
    marginBottom: '0.25rem'
  },
  timerMeta: {
    color: '#667892',
    fontSize: '0.9rem'
  },
  timeEntriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  timeEntryCard: {
    padding: '0.9rem 1rem',
    borderRadius: '14px',
    background: 'rgba(240, 244, 251, 0.95)'
  },
  timeEntryTitle: {
    fontWeight: 700,
    color: '#183153',
    marginBottom: '0.35rem'
  },
  timeEntryMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    color: '#667892',
    fontSize: '0.88rem'
  },
  commentsList: {
    marginBottom: '1rem',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  noComments: {
    padding: '1rem',
    textAlign: 'center',
    color: '#666',
    background: '#f4f7fb',
    borderRadius: '14px'
  },
  comment: {
    padding: '0.75rem',
    background: 'rgba(240, 244, 251, 0.95)',
    borderRadius: '14px',
    marginBottom: '0.5rem'
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem'
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: '0.9rem'
  },
  commentTime: {
    fontSize: '0.75rem',
    color: '#999',
    flex: 1
  },
  deleteCommentBtn: {
    background: 'none',
    border: 'none',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  commentContent: {
    fontSize: '0.9rem',
    lineHeight: 1.4
  },
  commentForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  commentInput: {
    padding: '0.75rem',
    border: '1px solid #d4dceb',
    borderRadius: '12px',
    resize: 'vertical',
    fontFamily: 'inherit'
  }
};
