import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatServerDateTime, formatServerTime } from '../lib/datetime';

const getCurrentMonthValue = () => new Date().toISOString().slice(0, 7);

export const AdminAttendanceOverview = () => {
  const [summary, setSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/attendance/admin/summary', {
          params: { month: selectedMonth }
        });
        setSummary(response.data.summary);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load attendance overview');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedMonth]);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setError('');
      const response = await api.get('/attendance/admin/monthly-pdf', {
        params: { month: selectedMonth },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `attendance-${selectedMonth}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download attendance PDF');
    } finally {
      setDownloading(false);
    }
  };

  const cards = [
    { label: 'Checked In This Month', value: summary?.checkedInCount ?? 0, accent: 'linear-gradient(135deg, #1e63d4, #4b91ff)' },
    { label: 'Checked Out This Month', value: summary?.checkedOutCount ?? 0, accent: 'linear-gradient(135deg, #1f8f57, #45c47c)' },
    { label: 'Late This Month', value: summary?.lateCount ?? 0, accent: 'linear-gradient(135deg, #d4841e, #ffb24b)' }
  ];

  if (loading) return <div style={styles.loading}>Loading attendance...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Attendance Overview</h2>
          <p style={styles.subtitle}>
            Monitor monthly employee attendance and open previous months whenever needed.
          </p>
          <div style={styles.periodLabel}>
            Viewing: {summary?.period?.monthLabel || selectedMonth}
          </div>
        </div>

        <div style={styles.actions}>
          <label style={styles.monthField}>
            <span style={styles.monthFieldLabel}>Month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              style={styles.monthInput}
            />
          </label>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            style={styles.downloadButton}
          >
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
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
        <h3 style={styles.listTitle}>{summary?.period?.monthLabel || 'Selected Month'} Attendance Record</h3>
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
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
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
  periodLabel: {
    marginTop: '0.55rem',
    color: '#183153',
    fontWeight: 600
  },
  actions: {
    display: 'flex',
    gap: '0.8rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap'
  },
  monthField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  monthFieldLabel: {
    color: '#667892',
    fontSize: '0.9rem',
    fontWeight: 600
  },
  monthInput: {
    minWidth: '150px',
    padding: '0.75rem 0.85rem',
    borderRadius: '12px',
    border: '1px solid #d5deea',
    color: '#183153',
    background: '#fff'
  },
  downloadButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '0.82rem 1rem',
    background: '#183153',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 26px rgba(24, 49, 83, 0.16)'
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
