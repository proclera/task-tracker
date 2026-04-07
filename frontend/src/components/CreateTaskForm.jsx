import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

export const CreateTaskForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    due_date: ''
  });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await api.get('/employees');
      setEmployees(response.data.employees || []);
    } catch (err) {
      setError('Failed to load employees');
      showToast('Could not load employees for assignment', 'error');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/tasks', {
        ...formData,
        assignee_id: formData.assignee_id || null,
        due_date: formData.due_date || null
      });
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assignee_id: '',
        due_date: ''
      });
      showToast('Task created successfully', 'success');
      onSuccess();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create task';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.formCard}>
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.title}>Create New Task</h3>
          <p style={styles.subtitle}>Plan work, set priority, and assign ownership in one place.</p>
        </div>
        {loadingEmployees && <span style={styles.pill}>Loading team...</span>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          name="title"
          placeholder="Task title"
          value={formData.title}
          onChange={handleChange}
          style={styles.input}
          required
        />

        <textarea
          name="description"
          placeholder="Description (optional)"
          value={formData.description}
          onChange={handleChange}
          style={{ ...styles.input, minHeight: '80px' }}
        />

        <div style={styles.row}>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>

          <input
            type="date"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            style={styles.select}
          />
        </div>

        <select
          name="assignee_id"
          value={formData.assignee_id}
          onChange={handleChange}
          style={styles.select}
        >
          <option value="">Select Assignee (optional)</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Creating task...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};

const styles = {
  formCard: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,255,0.96))',
    padding: '1.6rem',
    borderRadius: '22px',
    border: '1px solid rgba(122, 145, 184, 0.18)',
    boxShadow: '0 18px 44px rgba(31, 45, 76, 0.08)',
    marginBottom: '1.5rem'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '1.28rem',
    fontWeight: 'bold',
    marginBottom: '0.35rem',
    color: '#183153'
  },
  subtitle: {
    color: '#62728c',
    maxWidth: '540px',
    lineHeight: 1.5
  },
  pill: {
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    background: 'rgba(30, 99, 212, 0.1)',
    color: '#1e63d4',
    fontSize: '0.82rem',
    fontWeight: 700
  },
  error: {
    background: 'linear-gradient(135deg, #fff1f1, #ffe2e2)',
    color: '#a22929',
    padding: '0.75rem',
    borderRadius: '12px',
    marginBottom: '1rem'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #d4dceb',
    borderRadius: '12px',
    width: '100%'
  },
  select: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #d4dceb',
    borderRadius: '12px',
    flex: 1
  },
  row: {
    display: 'flex',
    gap: '1rem'
  },
  button: {
    padding: '0.75rem',
    fontSize: '1rem',
    background: 'linear-gradient(135deg, #1e63d4, #3a82ff)',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 14px 28px rgba(30, 99, 212, 0.24)'
  }
};
