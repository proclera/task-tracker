import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatDateLabel, formatServerDateTime, formatServerTime } from '../lib/datetime';
import { formatCheckoutDetailsEntries } from '../lib/attendanceCheckout';

const getCurrentMonthValue = () => new Date().toISOString().slice(0, 7);

const formatAttendanceDate = (value) =>
  formatDateLabel(value, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }) || value;

const getStatusStyle = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'late') {
    return { ...styles.statusBadge, ...styles.statusLate };
  }

  return { ...styles.statusBadge, ...styles.statusPresent };
};

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
              <div style={styles.recordHeader}>
                <div style={styles.recordIdentity}>
                  <div style={styles.recordName}>{record.user_name}</div>
                  <div style={styles.recordDate}>{formatAttendanceDate(record.attendance_date)}</div>
                </div>
                <div style={styles.recordMeta}>
                  <span style={getStatusStyle(record.status)}>{record.status}</span>
                  <span style={styles.recordCheckInDate}>
                    {formatServerDateTime(record.check_in_time, {
                      day: '2-digit',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              <div style={styles.recordBody}>
                <div style={styles.recordTimes}>
                  <span style={styles.timePill}>
                    <strong style={styles.timeLabel}>In</strong>
                    {formatServerTime(record.check_in_time)}
                  </span>
                  <span style={styles.timePill}>
                    <strong style={styles.timeLabel}>Out</strong>
                    {record.check_out_time ? formatServerTime(record.check_out_time) : 'In progress'}
                  </span>
                  <span style={styles.timePill}>
                    <strong style={styles.timeLabel}>Total</strong>
                    {record.total_minutes || 0} min
                  </span>
                </div>
                {record.checkout_details ? (
                  <div style={styles.detailGrid}>
                    {formatCheckoutDetailsEntries(record.checkout_details).map((entry) => (
                      <div key={entry.key} style={styles.detailItem}>
                        <div style={styles.detailLabel}>{entry.label}</div>
                        <div style={styles.detailValue}>{entry.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  record.work_summary && <div style={styles.recordSummary}>{record.work_summary}</div>
                )}
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
    padding: '1.15rem',
    borderRadius: '18px',
    boxShadow: '0 14px 36px rgba(31, 45, 76, 0.08)'
  },
  listTitle: {
    margin: '0 0 0.9rem 0',
    color: '#183153'
  },
  record: {
    padding: '1rem',
    border: '1px solid #e7eef8',
    borderRadius: '14px',
    background: '#fbfdff',
    boxShadow: '0 8px 18px rgba(24, 49, 83, 0.04)',
    marginBottom: '0.85rem'
  },
  recordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap'
  },
  recordIdentity: {
    minWidth: '210px'
  },
  recordBody: {
    minWidth: 0
  },
  recordName: {
    fontWeight: 700,
    color: '#183153',
    marginBottom: '0.3rem',
    fontSize: '1rem'
  },
  recordDate: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.55rem',
    borderRadius: '999px',
    background: '#eef4ff',
    color: '#365a89',
    fontSize: '0.84rem',
    fontWeight: 700
  },
  recordTimes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
    color: '#667892',
    fontSize: '0.9rem'
  },
  timePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    minHeight: '34px',
    padding: '0.45rem 0.65rem',
    borderRadius: '10px',
    background: '#f3f7fc',
    color: '#415875',
    border: '1px solid #e6edf7'
  },
  timeLabel: {
    color: '#183153'
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
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.7rem',
    marginTop: '0.65rem'
  },
  detailItem: {
    padding: '0.75rem 0.85rem',
    borderRadius: '12px',
    background: '#f3f7fc',
    border: '1px solid #e6edf7'
  },
  detailLabel: {
    color: '#667892',
    fontSize: '0.82rem',
    marginBottom: '0.2rem'
  },
  detailValue: {
    color: '#183153',
    fontWeight: 700
  },
  recordMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    alignItems: 'flex-end',
    color: '#667892',
    fontSize: '0.9rem'
  },
  recordCheckInDate: {
    color: '#536987',
    whiteSpace: 'nowrap'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '28px',
    padding: '0.3rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 800,
    textTransform: 'capitalize'
  },
  statusPresent: {
    background: '#e7f7ef',
    color: '#13784a'
  },
  statusLate: {
    background: '#fff4df',
    color: '#a65b00'
  },
  empty: {
    color: '#667892',
    textAlign: 'center',
    padding: '1rem'
  }
};
