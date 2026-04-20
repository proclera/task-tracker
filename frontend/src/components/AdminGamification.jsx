import { useEffect, useState } from 'react';
import api from '../lib/api';

export const AdminGamification = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/gamification/leaderboard', { params: { limit: 20 } });
      setLeaderboard(response.data.leaderboard || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading leaderboard...</div>;
  }

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Gamification Leaderboard</h2>
          <p style={styles.subtitle}>Recognize high momentum performers across the team.</p>
        </div>
        <button type="button" style={styles.refreshBtn} onClick={loadLeaderboard}>Refresh</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {leaderboard.length === 0 ? (
        <div style={styles.empty}>No gamification data yet.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rank</th>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Points</th>
                <th style={styles.th}>Current Streak</th>
                <th style={styles.th}>Longest Streak</th>
                <th style={styles.th}>Completed Tasks</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.userId}>
                  <td style={styles.td}>#{entry.rank}</td>
                  <td style={styles.td}>{entry.name}</td>
                  <td style={styles.td}>{entry.totalPoints}</td>
                  <td style={styles.td}>{entry.currentStreak} days</td>
                  <td style={styles.td}>{entry.longestStreak} days</td>
                  <td style={styles.td}>{entry.completedTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const styles = {
  section: {
    padding: '1rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    margin: 0,
    color: '#173053'
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: '#60738f'
  },
  refreshBtn: {
    border: '1px solid #cfdcf0',
    borderRadius: '12px',
    background: 'white',
    padding: '0.65rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: '#22456f'
  },
  loading: {
    padding: '1rem',
    color: '#60738f'
  },
  error: {
    padding: '0.85rem',
    borderRadius: '12px',
    marginBottom: '1rem',
    background: '#ffe7e7',
    color: '#9f2323'
  },
  empty: {
    padding: '1rem',
    borderRadius: '12px',
    background: '#f4f8ff',
    color: '#60738f'
  },
  tableWrap: {
    overflowX: 'auto',
    background: 'white',
    border: '1px solid #dce5f3',
    borderRadius: '16px',
    padding: '0.5rem'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    color: '#60738f',
    padding: '0.7rem',
    borderBottom: '1px solid #ebf1fb',
    fontSize: '0.85rem'
  },
  td: {
    padding: '0.7rem',
    borderBottom: '1px solid #f1f5fc',
    color: '#173053'
  }
};
