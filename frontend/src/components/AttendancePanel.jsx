import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatServerDateTime, formatServerTime } from '../lib/datetime';
import {
  ATTENDANCE_CHECKOUT_FIELDS,
  createEmptyCheckoutDetails,
  formatCheckoutDetailsEntries,
  getAssignedCheckoutFields
} from '../lib/attendanceCheckout';

const getInitialCheckoutConfig = () => ({
  definitions: ATTENDANCE_CHECKOUT_FIELDS,
  assignedFields: [],
  requiresStructuredCheckout: false
});

const getCheckoutValidationError = (fields, details, workSummary) => {
  if (fields.length === 0) {
    return workSummary.trim() ? '' : 'Please add a short work summary before checking out';
  }

  for (const field of fields) {
    const value = details[field.key];

    if (field.type === 'number') {
      const parsed = Number(String(value ?? '').trim());

      if (!Number.isInteger(parsed) || parsed < field.min || parsed > field.max) {
        return `${field.label} must be a number between ${field.min} and ${field.max}`;
      }

      continue;
    }

    if (field.type === 'decimal') {
      const parsed = Number(String(value ?? '').trim());

      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
        return `${field.label} must be a valid number ${field.min} or greater`;
      }

      continue;
    }

    if (field.type === 'boolean_choice') {
      if (!field.options.includes(String(value ?? '').trim().toLowerCase())) {
        return `${field.label} must be either yes or no`;
      }

      continue;
    }

    if (field.type === 'text') {
      const normalized = String(value ?? '').trim();

      if (!normalized) {
        return `${field.label} is required`;
      }

      if (normalized.length > field.maxLength) {
        return `${field.label} must be ${field.maxLength} characters or less`;
      }
    }
  }

  return '';
};

const CheckoutDetailsSummary = ({ details, definitions }) => {
  const entries = formatCheckoutDetailsEntries(details, definitions);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div style={styles.summaryGrid}>
      {entries.map((entry) => (
        <div key={entry.key} style={styles.summaryItem}>
          <div style={styles.summaryItemLabel}>{entry.label}</div>
          <div style={styles.summaryItemValue}>{entry.value}</div>
        </div>
      ))}
    </div>
  );
};

export const AttendancePanel = () => {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [workSummary, setWorkSummary] = useState('');
  const [checkoutConfig, setCheckoutConfig] = useState(getInitialCheckoutConfig());
  const [checkoutDetails, setCheckoutDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const assignedFields = useMemo(
    () => getAssignedCheckoutFields(checkoutConfig.assignedFields, checkoutConfig.definitions),
    [checkoutConfig]
  );
  const checkoutValidationError = useMemo(
    () => getCheckoutValidationError(assignedFields, checkoutDetails, workSummary),
    [assignedFields, checkoutDetails, workSummary]
  );

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const [todayResponse, historyResponse] = await Promise.all([
        api.get('/attendance/me/today'),
        api.get('/attendance/me/history')
      ]);

      const nextConfig = todayResponse.data.checkoutConfig || getInitialCheckoutConfig();

      setToday(todayResponse.data.attendance || null);
      setHistory(historyResponse.data.records || []);
      setCheckoutConfig(nextConfig);
      setWorkSummary('');
      setCheckoutDetails(createEmptyCheckoutDetails(nextConfig.assignedFields || []));
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
      const response = await api.post('/attendance/check-in', {});
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

  const handleDetailChange = (key, value) => {
    setCheckoutDetails((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleCheckOut = async () => {
    if (!today || checkoutValidationError) return;

    try {
      setSubmitting(true);
      setError('');
      const response = await api.patch(`/attendance/${today.id}/check-out`, {
        work_summary: workSummary.trim(),
        checkout_details: checkoutDetails
      });
      setToday(response.data.attendance);
      setWorkSummary('');
      setCheckoutDetails(createEmptyCheckoutDetails(checkoutConfig.assignedFields || []));
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
            {today?.check_out_time && (
              <>
                <CheckoutDetailsSummary
                  details={today.checkout_details}
                  definitions={checkoutConfig.definitions}
                />
                {!today.checkout_details && today.work_summary && (
                  <div style={styles.summaryBox}>
                    <div style={styles.summaryLabel}>Today's work summary</div>
                    <div style={styles.summaryText}>{today.work_summary}</div>
                  </div>
                )}
              </>
            )}
            {today && !today.check_out_time && assignedFields.length > 0 && (
              <div style={styles.formGrid}>
                {assignedFields.map((field) => (
                  <div key={field.key} style={styles.fieldBlock}>
                    <label style={styles.summaryLabel} htmlFor={`checkout-${field.key}`}>
                      {field.label}
                    </label>
                    {field.type === 'number' || field.type === 'decimal' ? (
                      <input
                        id={`checkout-${field.key}`}
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.type === 'decimal' ? '0.01' : '1'}
                        inputMode="numeric"
                        value={checkoutDetails[field.key] || ''}
                        onChange={(e) => handleDetailChange(field.key, e.target.value)}
                        style={styles.inlineInput}
                        placeholder={field.type === 'decimal' ? '0.00' : `${field.min}-${field.max}`}
                      />
                    ) : field.type === 'boolean_choice' ? (
                      <div style={styles.choiceRow}>
                        {field.options.map((option) => (
                          <label key={option} style={styles.choiceLabel}>
                            <input
                              type="radio"
                              name={field.key}
                              value={option}
                              checked={checkoutDetails[field.key] === option}
                              onChange={(e) => handleDetailChange(field.key, e.target.value)}
                            />
                            <span style={styles.choiceText}>{option.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        id={`checkout-${field.key}`}
                        value={checkoutDetails[field.key] || ''}
                        onChange={(e) => handleDetailChange(field.key, e.target.value)}
                        style={styles.summaryInput}
                        rows={3}
                        maxLength={field.maxLength}
                        placeholder="Add notes"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {today && !today.check_out_time && assignedFields.length === 0 && (
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
              disabled={submitting || Boolean(checkoutValidationError)}
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
        {today && !today.check_out_time && checkoutValidationError && (
          <div style={styles.helperError}>{checkoutValidationError}</div>
        )}
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
              {record.checkout_details ? (
                <CheckoutDetailsSummary
                  details={record.checkout_details}
                  definitions={checkoutConfig.definitions}
                />
              ) : (
                record.work_summary && <div style={styles.recordSummary}>{record.work_summary}</div>
              )}
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
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.9rem',
    marginTop: '1rem'
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem'
  },
  inlineInput: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid #d4dceb',
    padding: '0.8rem 0.9rem',
    fontSize: '0.95rem',
    color: '#183153'
  },
  choiceRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem'
  },
  choiceLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.75rem 0.9rem',
    borderRadius: '12px',
    background: '#f4f7fb',
    color: '#183153'
  },
  choiceText: {
    fontWeight: 700
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
  helperError: {
    marginTop: '0.9rem',
    color: '#b42318',
    fontWeight: 600
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
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.75rem',
    marginTop: '0.9rem'
  },
  summaryItem: {
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    background: 'rgba(238, 244, 255, 0.95)'
  },
  summaryItemLabel: {
    fontSize: '0.82rem',
    color: '#667892',
    marginBottom: '0.25rem'
  },
  summaryItemValue: {
    color: '#183153',
    fontWeight: 700
  }
};
