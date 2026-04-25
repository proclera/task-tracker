import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

const createInitialGoal = () => ({
  title: '',
  description: '',
  period_type: 'weekly',
  metric_type: 'completed_tasks',
  target_count: 10,
  start_date: '',
  end_date: ''
});

const statusStyles = {
  completed: { background: '#e7f8ec', color: '#177c3d' },
  on_track: { background: '#e9f2ff', color: '#1d5ec9' },
  off_track: { background: '#fff3df', color: '#9a5b00' },
  missed: { background: '#ffe7e7', color: '#b23636' },
  upcoming: { background: '#eef2f7', color: '#5b6d84' },
  inactive: { background: '#f0f0f0', color: '#666' }
};

export const AdminGoalsPanel = () => {
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState(createInitialGoal());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/goals');
      setGoals(response.data.goals || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setGoalForm((current) => ({
      ...current,
      [name]: name === 'target_count' ? Number(value) : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!goalForm.title || !goalForm.start_date || !goalForm.end_date) {
      showToast('Please complete the goal form first', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.post('/goals', goalForm);
      showToast('Goal created successfully', 'success');
      setGoalForm(createInitialGoal());
      fetchGoals();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create goal';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goal) => {
    const confirmed = window.confirm(`Delete the goal "${goal.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(goal.id);
      await api.delete(`/goals/${goal.id}`);
      showToast('Goal deleted', 'success');
      fetchGoals();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete goal';
      showToast(message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading goals...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <div>
          <h2 style={styles.title}>Admin Goals</h2>
          <p style={styles.subtitle}>
            Weekly, monthly, and yearly targets track admin-assigned work automatically from task assignments and completions.
          </p>
        </div>
        <button type="button" style={styles.refreshBtn} onClick={fetchGoals}>
          Refresh Progress
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        <form onSubmit={handleSubmit} style={styles.formCard}>
          <h3 style={styles.sectionTitle}>Create Goal</h3>

          <input
            name="title"
            placeholder="Goal title"
            value={goalForm.title}
            onChange={handleChange}
            style={styles.input}
            required
          />

          <textarea
            name="description"
            placeholder="Description (optional)"
            value={goalForm.description}
            onChange={handleChange}
            style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }}
          />

          <div style={styles.row}>
            <select name="period_type" value={goalForm.period_type} onChange={handleChange} style={styles.input}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <select name="metric_type" value={goalForm.metric_type} onChange={handleChange} style={styles.input}>
              <option value="completed_tasks">Completed Assignments</option>
              <option value="assigned_tasks">Assigned Tasks</option>
            </select>
          </div>

          <div style={styles.row}>
            <input
              type="number"
              min="1"
              name="target_count"
              value={goalForm.target_count}
              onChange={handleChange}
              style={styles.input}
              required
            />
            <div style={styles.metricHint}>Target count</div>
          </div>

          <div style={styles.row}>
            <input
              type="date"
              name="start_date"
              value={goalForm.start_date}
              onChange={handleChange}
              style={styles.input}
              required
            />
            <input
              type="date"
              name="end_date"
              value={goalForm.end_date}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <button type="submit" style={styles.primaryBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Create Goal'}
          </button>
        </form>

        <div style={styles.listCard}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Live Progress</h3>
            <span style={styles.goalCount}>{goals.length} goal{goals.length === 1 ? '' : 's'}</span>
          </div>

          {goals.length === 0 ? (
            <div style={styles.empty}>No goals created yet.</div>
          ) : (
            <div style={styles.goalList}>
              {goals.map((goal) => (
                <div key={goal.id} style={styles.goalCard}>
                  <div style={styles.goalHeader}>
                    <div>
                      <div style={styles.goalTitle}>{goal.title}</div>
                      <div style={styles.goalMeta}>
                        {goal.period_type} • {goal.metric_type === 'completed_tasks' ? 'completed assignments' : 'assigned tasks'}
                      </div>
                    </div>
                    <span style={{ ...styles.statusBadge, ...(statusStyles[goal.status] || statusStyles.inactive) }}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </div>

                  {goal.description && <p style={styles.goalDescription}>{goal.description}</p>}

                  <div style={styles.progressRow}>
                    <span>{goal.progress_count} / {goal.target_count}</span>
                    <span>{goal.completion_percent}%</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${goal.completion_percent}%` }} />
                  </div>

                  <div style={styles.goalFootnote}>
                    <span>{goal.start_date} to {goal.end_date}</span>
                    <span>Created by {goal.created_by_name}</span>
                  </div>

                  <div style={styles.goalFootnote}>
                    <span>Expected by now: {goal.expected_progress}</span>
                    <span>Remaining: {goal.remaining_count}</span>
                  </div>

                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={() => handleDelete(goal)}
                    disabled={deletingId === goal.id}
                  >
                    {deletingId === goal.id ? 'Deleting...' : 'Delete Goal'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '1rem'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '1.5rem',
    marginBottom: '0.35rem',
    color: '#183153'
  },
  subtitle: {
    color: '#62728c',
    lineHeight: 1.5,
    maxWidth: '720px'
  },
  refreshBtn: {
    padding: '0.7rem 1rem',
    borderRadius: '12px',
    border: '1px solid #cfd9ea',
    background: 'white',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#183153'
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: '#666'
  },
  error: {
    padding: '0.9rem 1rem',
    borderRadius: '14px',
    background: '#ffeaea',
    color: '#b23636',
    marginBottom: '1rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)',
    gap: '1rem'
  },
  formCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '1.2rem',
    boxShadow: '0 18px 40px rgba(31, 45, 76, 0.08)',
    border: '1px solid rgba(122, 145, 184, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem'
  },
  listCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '1.2rem',
    boxShadow: '0 18px 40px rgba(31, 45, 76, 0.08)',
    border: '1px solid rgba(122, 145, 184, 0.16)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.8rem'
  },
  sectionTitle: {
    fontSize: '1.08rem',
    margin: 0,
    color: '#183153'
  },
  goalCount: {
    color: '#667892',
    fontSize: '0.86rem',
    fontWeight: 700
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    alignItems: 'center'
  },
  input: {
    padding: '0.8rem 0.9rem',
    borderRadius: '12px',
    border: '1px solid #d3d9e4',
    fontSize: '0.95rem',
    fontFamily: 'inherit'
  },
  metricHint: {
    padding: '0.8rem 0.9rem',
    borderRadius: '12px',
    background: '#f4f7fb',
    color: '#667892',
    fontWeight: 700,
    textAlign: 'center'
  },
  primaryBtn: {
    padding: '0.85rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #1e63d4, #3a82ff)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: '#667892',
    background: '#f4f7fb',
    borderRadius: '16px'
  },
  goalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem'
  },
  goalCard: {
    borderRadius: '18px',
    padding: '1rem',
    background: '#f9fbff',
    border: '1px solid #e1e7f0'
  },
  goalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.8rem'
  },
  goalTitle: {
    fontWeight: 800,
    color: '#183153',
    marginBottom: '0.25rem'
  },
  goalMeta: {
    fontSize: '0.84rem',
    color: '#667892',
    textTransform: 'capitalize'
  },
  statusBadge: {
    padding: '0.32rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.76rem',
    fontWeight: 800,
    textTransform: 'capitalize'
  },
  goalDescription: {
    marginTop: '0.7rem',
    color: '#53647d',
    lineHeight: 1.5
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.8rem',
    marginBottom: '0.4rem',
    color: '#183153',
    fontWeight: 700
  },
  progressTrack: {
    height: '10px',
    borderRadius: '999px',
    background: '#dde7f5',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1e63d4, #4f95ff)'
  },
  goalFootnote: {
    marginTop: '0.7rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    fontSize: '0.82rem',
    color: '#667892'
  },
  deleteBtn: {
    marginTop: '0.85rem',
    padding: '0.65rem 0.9rem',
    borderRadius: '12px',
    border: 'none',
    background: '#d94a4a',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  }
};
