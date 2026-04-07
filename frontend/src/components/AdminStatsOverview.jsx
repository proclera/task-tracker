import { useEffect, useState } from 'react';
import api from '../lib/api';

export const AdminStatsOverview = ({ refreshToken = 0 }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/tasks/analytics');
        setStats(response.data.analytics);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [refreshToken]);

  const cards = [
    {
      label: 'Total Tasks',
      value: stats?.totalTasks ?? 0,
      accent: 'linear-gradient(135deg, #1e63d4, #4b91ff)'
    },
    {
      label: 'Completed Tasks',
      value: stats?.completedTasks ?? 0,
      accent: 'linear-gradient(135deg, #1f8f57, #45c47c)'
    },
    {
      label: 'Assigned Tasks',
      value: stats?.assignedTasks ?? 0,
      accent: 'linear-gradient(135deg, #e09a12, #ffc94a)'
    }
  ];

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Task Snapshot</h2>
          <p style={styles.subtitle}>A quick admin summary of workload and progress.</p>
        </div>
        {loading && <span style={styles.badge}>Refreshing...</span>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {cards.map((card) => (
          <div key={card.label} style={{ ...styles.card, background: card.accent }}>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const styles = {
  section: {
    marginBottom: '1.5rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    margin: '0 0 0.35rem 0',
    color: '#183153',
    fontSize: '1.55rem'
  },
  subtitle: {
    margin: 0,
    color: '#667892',
    lineHeight: 1.5
  },
  badge: {
    padding: '0.55rem 0.9rem',
    borderRadius: '999px',
    background: 'rgba(30, 99, 212, 0.1)',
    color: '#1e63d4',
    fontWeight: 700
  },
  error: {
    padding: '0.9rem 1rem',
    marginBottom: '1rem',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fff1f1, #ffe5e5)',
    color: '#a22929'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  card: {
    color: 'white',
    padding: '1.35rem',
    borderRadius: '22px',
    boxShadow: '0 18px 44px rgba(31, 45, 76, 0.14)'
  },
  cardValue: {
    fontSize: '2rem',
    fontWeight: 800,
    marginBottom: '0.35rem'
  },
  cardLabel: {
    opacity: 0.95,
    fontWeight: 600
  }
};
