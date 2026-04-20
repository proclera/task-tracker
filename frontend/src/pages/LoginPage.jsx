import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');

    if (reason === 'expired') {
      setNotice('Your session expired. Please sign in again.');
    } else if (reason === 'logged-out') {
      setNotice('You have been logged out.');
    } else {
      setNotice('');
    }
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/employee');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Task Tracker</h1>
        <h2 style={styles.subtitle}>Sign In</h2>

        {error && <div style={styles.error}>{error}</div>}
        {notice && <div style={styles.notice}>{notice}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f5f5'
  },
  card: {
    background: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '0.5rem'
  },
  subtitle: {
    fontSize: '1.25rem',
    textAlign: 'center',
    color: '#666',
    marginBottom: '1.5rem'
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem'
  },
  notice: {
    background: '#eef6ff',
    color: '#0b5cab',
    padding: '0.75rem',
    borderRadius: '4px',
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
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  button: {
    padding: '0.75rem',
    fontSize: '1rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};
