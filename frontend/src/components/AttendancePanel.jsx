import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatServerDateTime, formatServerTime } from '../lib/datetime';

export const AttendancePanel = () => {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [workSummary, setWorkSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const [todayResponse, historyResponse] = await Promise.all([
        api.get('/attendance/me/today'),
        api.get('/attendance/me/history')
      ]);

      setToday(todayResponse.data.attendance || null);
      setHistory(historyResponse.data.records || []);
      setWorkSummary(todayResponse.data.attendance?.check_out_time ? '' : '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      setError('');
      const response = await api.post('/attendance/check-in');
      setToday(response.data.attendance);
      showToast('Checked in successfully', 'success');
      loadAttendance();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to check in';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!today) return;

    try {
      setSubmitting(true);
      setError('');
      const response = await api.patch(`/attendance/${today.id}/check-out`, {
        work_summary: workSummary.trim()
      });
      setToday(response.data.attendance);
      setWorkSummary('');
      showToast('Checked out successfully', 'success');
      loadAttendance();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to check out';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Attendance</h2>
          <p style={styles.subtitle}>Track your workday and review recent attendance records.</p>
        </div>
        {loading && <span style={styles.badge}>Refreshing...</span>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.statusRow}>
          <div style={styles.statusContent}>
            <div style={styles.statusLabel}>Today's status</div>
            <div style={styles.statusValue}>
              {today ? (today.check_out_time ? 'Checked Out' : 'Checked In') : 'Not Checked In'}
            </div>
            {today && (
              <div style={styles.metaText}>
                Check-in: {formatServerDateTime(today.check_in_time)}
                {today.check_out_time ? ` | Check-out: ${formatServerDateTime(today.check_out_time)}` : ''}
              </div>
            )}
            {today?.check_out_time && today.work_summary && (
              <div style={styles.summaryBox}>
                <div style={styles.summaryLabel}>Today's work summary</div>
                <div style={styles.summaryText}>{today.work_summary}</div>
              </div>
            )}
            {today && !today.check_out_time && (
              <div style={styles.summaryForm}>
                <label style={styles.summaryLabel} htmlFor="checkout-summary">
                  What did you complete today?
                </label>
                <textarea
                  id="checkout-summary"
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="e.g., mention tasks completed, progress made, and key outcomes."
                  style={styles.summaryInput}
                  rows={4}
                />
              </div>
            )}
          </div>

          {today && !today.check_out_time ? (
            <button
              type="button"
              style={{ ...styles.actionBtn, ...styles.checkoutBtn }}
              onClick={handleCheckOut}
              disabled={submitting || !workSummary.trim()}
            >
              {submitting ? 'Checking out...' : 'Check Out'}
            </button>
          ) : (
            <button
              type="button"
              style={{ ...styles.actionBtn, ...styles.checkinBtn }}
              onClick={handleCheckIn}
              disabled={submitting || Boolean(today)}
            >
              {submitting ? 'Checking in...' : 'Check In'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.historyCard}>
        <h3 style={styles.historyTitle}>Recent Attendance</h3>
        {history.length === 0 ? (
          <div style={styles.empty}>No attendance records yet</div>
        ) : (
          history.map((record) => (
            <div key={record.id} style={styles.record}>
              <div style={styles.recordDate}>{record.attendance_date}</div>
              <div style={styles.recordMeta}>
                <span>{record.status}</span>
                <span>In: {formatServerTime(record.check_in_time)}</span>
                <span>
                  Out: {record.check_out_time ? formatServerTime(record.check_out_time) : 'In progress'}
                </span>
                <span>{record.total_minutes || 0} min</span>
              </div>
              {record.work_summary && <div style={styles.recordSummary}>{record.work_summary}</div>}
            </div>
          ))
        )}
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
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.95))',
    padding: '1.35rem',
    borderRadius: '22px',
    border: '1px solid rgba(122, 145, 184, 0.16)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)',
    marginBottom: '1rem'
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem'
  },
  statusContent: {
    flex: 1,
    minWidth: 0
  },
  statusLabel: {
    color: '#667892',
    marginBottom: '0.25rem'
  },
  statusValue: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#183153',
    marginBottom: '0.3rem'
  },
  metaText: {
    color: '#667892'
  },
  summaryForm: {
    marginTop: '0.9rem'
  },
  summaryBox: {
    marginTop: '0.9rem',
    padding: '0.9rem 1rem',
    borderRadius: '14px',
    background: 'rgba(238, 244, 255, 0.95)'
  },
  summaryLabel: {
    display: 'block',
    color: '#183153',
    fontWeight: 700,
    marginBottom: '0.45rem'
  },
  summaryInput: {
    width: '100%',
    borderRadius: '14px',
    border: '1px solid #d4dceb',
    padding: '0.85rem 0.95rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    color: '#183153'
  },
  summaryText: {
    color: '#54657f',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap'
  },
  actionBtn: {
    padding: '0.8rem 1.1rem',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 700
  },
  checkinBtn: {
    background: 'linear-gradient(135deg, #1e63d4, #3a82ff)'
  },
  checkoutBtn: {
    background: 'linear-gradient(135deg, #cb3a3a, #e85a5a)'
  },
  historyCard: {
    background: 'white',
    padding: '1.25rem',
    borderRadius: '18px',
    boxShadow: '0 14px 36px rgba(31, 45, 76, 0.08)'
  },
  historyTitle: {
    margin: '0 0 0.9rem 0',
    color: '#183153'
  },
  empty: {
    color: '#667892',
    textAlign: 'center',
    padding: '1rem'
  },
  record: {
    padding: '0.85rem 0',
    borderBottom: '1px solid #edf2f7'
  },
  recordDate: {
    fontWeight: 700,
    color: '#183153',
    marginBottom: '0.3rem'
  },
  recordMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.8rem',
    color: '#667892',
    fontSize: '0.9rem'
  },
  recordSummary: {
    marginTop: '0.55rem',
    padding: '0.75rem 0.9rem',
    borderRadius: '12px',
    background: '#f4f7fb',
    color: '#54657f',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap'
  }
};
