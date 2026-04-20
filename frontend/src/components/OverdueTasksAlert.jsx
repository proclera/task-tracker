import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { formatDateLabel, isDateOverdue } from '../lib/datetime';
import { useToast } from '../context/ToastContext';

const buildStorageKey = (userId, overdueTasks) => {
  const taskIds = overdueTasks.map((task) => task.id).sort((a, b) => a - b).join(',');
  const today = new Date().toISOString().slice(0, 10);
  return `overdue-alert:${userId}:${today}:${taskIds}`;
};

export const OverdueTasksAlert = ({ user, endpoint }) => {
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;

    const fetchOverdueTasks = async () => {
      try {
        setLoading(true);
        const response = await api.get(endpoint);
        const tasks = Array.isArray(response.data.tasks) ? response.data.tasks : [];
        const nextOverdueTasks = tasks.filter((task) => {
          const ownStatus = task.my_status || task.status;
          return task.due_date && ownStatus !== 'completed' && isDateOverdue(task.due_date);
        });

        if (active) {
          setOverdueTasks(nextOverdueTasks);
        }
      } catch (error) {
        if (active) {
          setOverdueTasks([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchOverdueTasks();

    return () => {
      active = false;
    };
  }, [endpoint]);

  useEffect(() => {
    if (loading || overdueTasks.length === 0) {
      return;
    }

    const storageKey = buildStorageKey(user.id, overdueTasks);
    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    const summary = overdueTasks.length === 1
      ? `1 overdue task needs your attention: ${overdueTasks[0].title}`
      : `${overdueTasks.length} overdue tasks need your attention.`;

    showToast(summary, 'error');
    sessionStorage.setItem(storageKey, 'shown');
  }, [loading, overdueTasks, showToast, user.id]);

  const overdueSummary = useMemo(() => overdueTasks.slice(0, 3), [overdueTasks]);

  if (loading || overdueTasks.length === 0) {
    return null;
  }

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Action Required</div>
          <h2 style={styles.title}>
            You have {overdueTasks.length} overdue task{overdueTasks.length === 1 ? '' : 's'}
          </h2>
          <p style={styles.subtitle}>
            Please review these items and update progress so nothing important gets missed.
          </p>
        </div>
        <div style={styles.countBadge}>{overdueTasks.length}</div>
      </div>

      <div style={styles.grid}>
        {overdueSummary.map((task) => (
          <article key={task.id} style={styles.card}>
            <div style={styles.cardTitle}>{task.title}</div>
            <div style={styles.cardMeta}>Due: {formatDateLabel(task.due_date)}</div>
            <div style={styles.cardMeta}>Status: {(task.my_status || task.status).replace('_', ' ')}</div>
          </article>
        ))}
      </div>

      {overdueTasks.length > overdueSummary.length && (
        <div style={styles.footerNote}>
          +{overdueTasks.length - overdueSummary.length} more overdue task{overdueTasks.length - overdueSummary.length === 1 ? '' : 's'}
        </div>
      )}
    </section>
  );
};

const styles = {
  panel: {
    marginBottom: '1.25rem',
    padding: '1.2rem',
    borderRadius: '24px',
    border: '1px solid rgba(196, 61, 61, 0.24)',
    background: 'linear-gradient(135deg, rgba(255, 244, 244, 0.98), rgba(255, 235, 228, 0.95))',
    boxShadow: '0 18px 42px rgba(177, 58, 58, 0.12)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  kicker: {
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#b13a3a',
    marginBottom: '0.35rem'
  },
  title: {
    margin: 0,
    color: '#7e2525',
    fontSize: '1.35rem'
  },
  subtitle: {
    margin: '0.45rem 0 0',
    color: '#965353',
    lineHeight: 1.5
  },
  countBadge: {
    minWidth: '54px',
    height: '54px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#c43d3d',
    color: 'white',
    fontWeight: 800,
    fontSize: '1.1rem',
    boxShadow: '0 12px 28px rgba(196, 61, 61, 0.24)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.85rem'
  },
  card: {
    padding: '0.95rem 1rem',
    borderRadius: '18px',
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(196, 61, 61, 0.16)'
  },
  cardTitle: {
    fontWeight: 800,
    color: '#7e2525',
    marginBottom: '0.4rem'
  },
  cardMeta: {
    color: '#8d5555',
    fontSize: '0.88rem',
    lineHeight: 1.45
  },
  footerNote: {
    marginTop: '0.9rem',
    color: '#8d5555',
    fontWeight: 700
  }
};
