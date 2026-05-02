import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { formatServerDateTime } from '../lib/datetime';
import {
  ATTENDANCE_CHECKOUT_FIELDS,
  formatCheckoutDetailsEntries
} from '../lib/attendanceCheckout';

export const ManagerAttendanceConfigPanel = () => {
  const [employees, setEmployees] = useState([]);
  const [definitions, setDefinitions] = useState(ATTENDANCE_CHECKOUT_FIELDS);
  const [recentRecords, setRecentRecords] = useState([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const loadSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/attendance/manager/checkout-configs');
      setEmployees(response.data.employees || []);
      setDefinitions(response.data.definitions || ATTENDANCE_CHECKOUT_FIELDS);
      setRecentRecords(response.data.recentRecords || []);
      setPeriodLabel(response.data.period?.monthLabel || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team attendance setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSetup();
  }, []);

  const toggleField = (employeeId, fieldKey) => {
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== employeeId) {
        return employee;
      }

      const assignedFields = employee.assignedFields || [];
      const nextFields = assignedFields.includes(fieldKey)
        ? assignedFields.filter((key) => key !== fieldKey)
        : [...assignedFields, fieldKey];

      return {
        ...employee,
        assignedFields: nextFields
      };
    }));
  };

  const saveEmployeeConfig = async (employee) => {
    try {
      setSavingId(employee.id);
      setError('');
      await api.put(`/attendance/manager/checkout-configs/${employee.id}`, {
        assigned_fields: employee.assignedFields || []
      });
      showToast(`Attendance fields updated for ${employee.first_name}`, 'success');
      loadSetup();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update attendance fields';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Team Attendance Setup</h2>
          <p style={styles.subtitle}>
            Choose which checkout fields each team member, including you, must fill before check out.
          </p>
        </div>
        {loading && <span style={styles.badge}>Refreshing...</span>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Assigned Checkout Fields</h3>
        {employees.length === 0 ? (
          <div style={styles.empty}>No attendance members found.</div>
        ) : (
          <div style={styles.employeeGrid}>
            {employees.map((employee) => (
              <div key={employee.id} style={styles.employeeCard}>
                <div style={styles.employeeHeader}>
                  <div>
                    <div style={styles.employeeName}>
                      {employee.first_name} {employee.last_name}
                      {employee.isSelf && <span style={styles.selfBadge}>You</span>}
                    </div>
                    <div style={styles.employeeMeta}>{employee.email}</div>
                  </div>
                  <button
                    type="button"
                    style={styles.saveBtn}
                    onClick={() => saveEmployeeConfig(employee)}
                    disabled={savingId === employee.id}
                  >
                    {savingId === employee.id ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <div style={styles.fieldGrid}>
                  {definitions.map((field) => (
                    <label key={field.key} style={styles.fieldOption}>
                      <input
                        type="checkbox"
                        checked={(employee.assignedFields || []).includes(field.key)}
                        onChange={() => toggleField(employee.id, field.key)}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Recent Checkouts{periodLabel ? ` - ${periodLabel}` : ''}</h3>
        {recentRecords.length === 0 ? (
          <div style={styles.empty}>No team attendance records yet.</div>
        ) : (
          recentRecords.map((record) => {
            const detailEntries = formatCheckoutDetailsEntries(record.checkout_details, definitions);

            return (
              <div key={record.id} style={styles.record}>
                <div style={styles.recordTop}>
                  <div>
                    <div style={styles.recordName}>{record.user_name}</div>
                    <div style={styles.recordMeta}>
                      {record.attendance_date} | In {formatServerDateTime(record.check_in_time)}
                    </div>
                  </div>
                  <div style={styles.recordMinutes}>{record.total_minutes || 0} min</div>
                </div>

                {detailEntries.length > 0 ? (
                  <div style={styles.detailGrid}>
                    {detailEntries.map((entry) => (
                      <div key={entry.key} style={styles.detailItem}>
                        <div style={styles.detailLabel}>{entry.label}</div>
                        <div style={styles.detailValue}>{entry.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  record.work_summary && <div style={styles.summary}>{record.work_summary}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

const styles = {
  section: {
    display: 'grid',
    gap: '1.25rem',
    marginTop: '1.25rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem'
  },
  title: {
    margin: '0 0 0.35rem 0',
    color: '#183153',
    fontSize: '1.45rem'
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
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fff1f1, #ffe5e5)',
    color: '#a22929'
  },
  card: {
    background: 'white',
    padding: '1.25rem',
    borderRadius: '18px',
    boxShadow: '0 14px 36px rgba(31, 45, 76, 0.08)'
  },
  cardTitle: {
    margin: '0 0 1rem 0',
    color: '#183153'
  },
  empty: {
    color: '#667892',
    textAlign: 'center',
    padding: '1rem'
  },
  employeeGrid: {
    display: 'grid',
    gap: '1rem'
  },
  employeeCard: {
    border: '1px solid #e1e8f4',
    borderRadius: '16px',
    padding: '1rem'
  },
  employeeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.9rem'
  },
  employeeName: {
    color: '#183153',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  selfBadge: {
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    background: '#e9f2ff',
    color: '#1e63d4',
    fontSize: '0.78rem',
    fontWeight: 700
  },
  employeeMeta: {
    color: '#667892',
    fontSize: '0.9rem'
  },
  saveBtn: {
    padding: '0.65rem 1rem',
    border: 'none',
    borderRadius: '12px',
    background: '#1e63d4',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem'
  },
  fieldOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.85rem 0.9rem',
    borderRadius: '12px',
    background: '#f6f9ff',
    color: '#183153'
  },
  record: {
    padding: '1rem 0',
    borderBottom: '1px solid #edf2f7'
  },
  recordTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.85rem'
  },
  recordName: {
    color: '#183153',
    fontWeight: 800
  },
  recordMeta: {
    color: '#667892',
    fontSize: '0.9rem'
  },
  recordMinutes: {
    color: '#183153',
    fontWeight: 700
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.75rem'
  },
  detailItem: {
    padding: '0.8rem 0.9rem',
    borderRadius: '14px',
    background: '#f6f9ff'
  },
  detailLabel: {
    color: '#667892',
    fontSize: '0.82rem',
    marginBottom: '0.25rem'
  },
  detailValue: {
    color: '#183153',
    fontWeight: 700
  },
  summary: {
    padding: '0.8rem 0.9rem',
    borderRadius: '12px',
    background: '#f4f7fb',
    color: '#54657f',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap'
  }
};
