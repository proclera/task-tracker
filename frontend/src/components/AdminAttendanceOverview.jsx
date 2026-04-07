import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatServerDateTime, formatServerTime } from '../lib/datetime';

export const AdminAttendanceOverview = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/attendance/admin/summary');
        setSummary(response.data.summary);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load attendance overview');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const cards = [
    { label: 'Checked In Today', value: summary?.todayCheckedIn ?? 0, accent: 'linear-gradient(135deg, #1e63d4, #4b91ff)' },
    { label: 'Checked Out Today', value: summary?.checkedOutToday ?? 0, accent: 'linear-gradient(135deg, #1f8f57, #45c47c)' },
    { label: 'Late Today', value: summary?.lateToday ?? 0, accent: 'linear-gradient(135deg, #d4841e, #ffb24b)' }
  ];

  if (loading) return <div style={styles.loading}>Loading attendance...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Attendance Overview</h2>
          <p style={styles.subtitle}>Monitor daily employee presence and recent check-ins.</p>
        </div>
      </div>

      <div style={styles.grid}>
        {cards.map((card) => (
          <div key={card.label} style={{ ...styles.card, background: card.accent }}>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.listCard}>
        <h3 style={styles.listTitle}>This Month's Attendance Record</h3>
        {summary?.monthlyAttendance?.length ? (
          summary.monthlyAttendance.map((record) => (
            <div key={record.id} style={styles.record}>
              <div style={styles.recordBody}>
                <div style={styles.recordName}>{record.user_name}</div>
                <div style={styles.recordDate}>{record.attendance_date}</div>
                <div style={styles.recordTimes}>
                  <span>In: {formatServerTime(record.check_in_time)}</span>
                  <span>Out: {record.check_out_time ? formatServerTime(record.check_out_time) : 'In progress'}</span>
                  <span>{record.total_minutes || 0} min</span>
                </div>
                {record.work_summary && <div style={styles.recordSummary}>{record.work_summary}</div>}
              </div>
              <div style={styles.recordMeta}>
                <span>{record.status}</span>
                <span>{formatServerDateTime(record.check_in_time, { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.empty}>No attendance records yet</div>
        )}
      </div>
    </section>
  );
};

const styles = {
  section: {
    padding: '1rem'
  },
  header: {
    marginBottom: '1rem'
  },
  title: {
    margin: '0 0 0.35rem 0',
    color: '#183153',
    fontSize: '1.55rem'
  },
  subtitle: {
    margin: 0,
    color: '#667892'
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: '#667892'
  },
  error: {
    padding: '1rem',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fff1f1, #ffe5e5)',
    color: '#a22929'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
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
  },
  listCard: {
    background: 'white',
    padding: '1.25rem',
    borderRadius: '18px',
    boxShadow: '0 14px 36px rgba(31, 45, 76, 0.08)'
  },
  listTitle: {
    margin: '0 0 0.9rem 0',
    color: '#183153'
  },
  record: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '0.85rem 0',
    borderBottom: '1px solid #edf2f7'
  },
  recordBody: {
    flex: 1,
    minWidth: 0
  },
  recordName: {
    fontWeight: 700,
    color: '#183153',
    marginBottom: '0.25rem'
  },
  recordDate: {
    color: '#667892',
    fontSize: '0.9rem'
  },
  recordTimes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.8rem',
    color: '#667892',
    fontSize: '0.9rem',
    marginTop: '0.35rem'
  },
  recordSummary: {
    marginTop: '0.65rem',
    padding: '0.8rem 0.9rem',
    borderRadius: '12px',
    background: '#f4f7fb',
    color: '#54657f',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap'
  },
  recordMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    alignItems: 'flex-end',
    color: '#667892',
    fontSize: '0.9rem'
  },
  empty: {
    color: '#667892',
    textAlign: 'center',
    padding: '1rem'
  }
};
