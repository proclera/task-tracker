import { useEffect, useState } from 'react';
import api from '../lib/api';

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);

  const toInputValue = (value) => value.toISOString().slice(0, 10);

  return {
    start_date: toInputValue(start),
    end_date: toInputValue(end)
  };
};

const normalizeReportFilters = (value) => ({
  start_date: value?.start_date || value?.startDate || getDefaultRange().start_date,
  end_date: value?.end_date || value?.endDate || getDefaultRange().end_date
});

const formatMinutes = (minutes) => {
  if (!minutes) {
    return '0h 0m';
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value || 0));

const parseReportDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00.000Z`)
    : new Date(normalized);

  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
};

const formatShortDate = (value) => {
  const parsed = parseReportDate(value);

  if (!parsed) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(parsed);
};

const downloadCsv = (report, filters) => {
  const header = [
    'Employee',
    'Email',
    'Role',
    'Assigned Tasks',
    'Completed Tasks',
    'Tracked Minutes',
    'Time Entries',
    'Attendance Days',
    'Late Days',
    "Today's Order",
    'Order Processed',
    "Today's Spending",
    "Today's Earning"
  ];

  const rows = report.teamPerformance.map((employee) => ([
    employee.name,
    employee.email,
    employee.role,
    employee.assignedTasks,
    employee.completedTasks,
    employee.trackedMinutes,
    employee.timeEntries,
    employee.attendanceDays,
    employee.lateDays,
    employee.todaysOrders,
    employee.ordersProcessed,
    employee.todaysSpending,
    employee.todaysEarning
  ]));

  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `task-tracker-report-${filters.start_date}-to-${filters.end_date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const AdminReports = () => {
  const [filters, setFilters] = useState(getDefaultRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('team');

  const fetchReport = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/reports/summary', { params: nextFilters });
      setReport(response.data.report);
      setFilters(normalizeReportFilters(response.data.filters));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(filters);
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchReport(filters);
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  };

  if (loading) {
    return <div style={styles.loading}>Building report...</div>;
  }

  return (
    <section style={styles.container}>
      <div style={styles.hero}>
        <div>
          <h2 style={styles.title}>Reports</h2>
          <p style={styles.subtitle}>
            Review team performance and monthly order-finance movement from one admin workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.filterBar}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Start date</span>
            <input
              type="date"
              value={filters.start_date}
              onChange={(event) => updateFilter('start_date', event.target.value)}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>End date</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(event) => updateFilter('end_date', event.target.value)}
              style={styles.input}
            />
          </label>
          <button type="submit" style={styles.primaryButton}>Refresh</button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => report && downloadCsv(report, filters)}
            disabled={!report}
          >
            Export CSV
          </button>
        </form>
      </div>

      <div style={styles.subnav}>
        <button
          type="button"
          style={{ ...styles.subnavButton, ...(activeView === 'team' ? styles.subnavButtonActive : {}) }}
          onClick={() => setActiveView('team')}
        >
          Team Reports
        </button>
        <button
          type="button"
          style={{ ...styles.subnavButton, ...(activeView === 'finance' ? styles.subnavButtonActive : {}) }}
          onClick={() => setActiveView('finance')}
        >
          Monthly Order and Finance Trend
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {report && activeView === 'team' && (
        <>
          <div style={styles.cardGrid}>
            <MetricCard label="Tasks Created" value={report.summary.tasksCreated} accent="#1d4ed8" />
            <MetricCard label="Completed Tasks" value={report.summary.completedTasks} accent="#0f9f6e" />
            <MetricCard label="Overdue Tasks" value={report.summary.overdueTasks} accent="#d97706" />
            <MetricCard label="Tracked Time" value={formatMinutes(report.summary.totalTrackedMinutes)} accent="#7c3aed" />
            <MetricCard label="Attendance Days" value={report.summary.attendanceDays} accent="#0f766e" />
            <MetricCard label="Late Check-ins" value={report.summary.lateDays} accent="#be123c" />
          </div>

          <div style={styles.twoColumn}>
            <Panel title="Task Status Breakdown">
              <BreakdownList items={report.tasksByStatus} />
            </Panel>
            <Panel title="Task Priority Breakdown">
              <BreakdownList items={report.tasksByPriority} />
            </Panel>
          </div>

          <Panel title="Team Performance">
            {report.teamPerformance.length === 0 ? (
              <div style={styles.empty}>No employee data in this range.</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.tableHead}>Employee</th>
                      <th style={styles.tableHead}>Role</th>
                      <th style={styles.tableHead}>Tasks</th>
                      <th style={styles.tableHead}>Completed</th>
                      <th style={styles.tableHead}>Tracked Time</th>
                      <th style={styles.tableHead}>Attendance</th>
                      <th style={styles.tableHead}>Late</th>
                      <th style={styles.tableHead}>Today's Order</th>
                      <th style={styles.tableHead}>Processed</th>
                      <th style={styles.tableHead}>Spending</th>
                      <th style={styles.tableHead}>Earning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.teamPerformance.map((employee) => (
                      <tr key={employee.id}>
                        <td style={styles.tableCell}>
                          <div style={styles.employeeName}>{employee.name}</div>
                          <div style={styles.employeeEmail}>{employee.email}</div>
                        </td>
                        <td style={styles.tableCell}>{employee.role}</td>
                        <td style={styles.tableCell}>{employee.assignedTasks}</td>
                        <td style={styles.tableCell}>{employee.completedTasks}</td>
                        <td style={styles.tableCell}>
                          {formatMinutes(employee.trackedMinutes)}
                          <div style={styles.tableHint}>{employee.timeEntries} entries</div>
                        </td>
                        <td style={styles.tableCell}>{employee.attendanceDays} days</td>
                        <td style={styles.tableCell}>{employee.lateDays}</td>
                        <td style={styles.tableCell}>{employee.todaysOrders}</td>
                        <td style={styles.tableCell}>{employee.ordersProcessed}</td>
                        <td style={styles.tableCell}>{formatCurrency(employee.todaysSpending)}</td>
                        <td style={styles.tableCell}>{formatCurrency(employee.todaysEarning)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Recent Activity">
            {report.recentActivity.length === 0 ? (
              <div style={styles.empty}>No report activity found for this range.</div>
            ) : (
              <div style={styles.activityList}>
                {report.recentActivity.map((item) => (
                  <div key={`${item.activity_type}-${item.id}`} style={styles.activityItem}>
                    <div>
                      <div style={styles.activityTitle}>{item.title}</div>
                      <div style={styles.activityMeta}>{item.actor_name}</div>
                    </div>
                    <div style={styles.activityRight}>
                      <div style={styles.activityBadge}>{item.activity_type.replace('_', ' ')}</div>
                      <div style={styles.activityMeta}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {report && activeView === 'finance' && (
        <>
          <div style={styles.financeHero}>
            <div>
              <h3 style={styles.financeTitle}>Monthly Order and Finance Trend</h3>
              <p style={styles.financeSubtitle}>
                Read daily movement more clearly with focused cards for orders, processed work, spending, and earning.
              </p>
            </div>
            <div style={styles.rangeBadge}>
              {formatShortDate(filters.start_date)} - {formatShortDate(filters.end_date)}
            </div>
          </div>

          <div style={styles.financeSummaryGrid}>
            <FinanceSummaryCard label="Today's Order" value={report.summary.todaysOrders} accent="#2563eb" />
            <FinanceSummaryCard label="Order Processed" value={report.summary.ordersProcessed} accent="#0f9f6e" />
            <FinanceSummaryCard label="Today's Spending" value={formatCurrency(report.summary.todaysSpending)} accent="#ea580c" />
            <FinanceSummaryCard label="Today's Earning" value={formatCurrency(report.summary.todaysEarning)} accent="#059669" />
          </div>

          {report.checkoutMetrics?.dailySeries?.length ? (
            <div style={styles.financeChartsGrid}>
              <TrendPanel
                title="Today's Order"
                accent="#2563eb"
                items={report.checkoutMetrics.dailySeries.map((item) => ({
                  label: formatShortDate(item.date),
                  value: item.todaysOrders
                }))}
              />
              <TrendPanel
                title="Order Processed"
                accent="#0f9f6e"
                items={report.checkoutMetrics.dailySeries.map((item) => ({
                  label: formatShortDate(item.date),
                  value: item.ordersProcessed
                }))}
              />
              <TrendPanel
                title="Today's Spending"
                accent="#ea580c"
                formatter={formatCurrency}
                items={report.checkoutMetrics.dailySeries.map((item) => ({
                  label: formatShortDate(item.date),
                  value: item.todaysSpending
                }))}
              />
              <TrendPanel
                title="Today's Earning"
                accent="#059669"
                formatter={formatCurrency}
                items={report.checkoutMetrics.dailySeries.map((item) => ({
                  label: formatShortDate(item.date),
                  value: item.todaysEarning
                }))}
              />
            </div>
          ) : (
            <div style={styles.empty}>No checkout metric data in this range.</div>
          )}
        </>
      )}
    </section>
  );
};

const MetricCard = ({ label, value, accent }) => (
  <div style={{ ...styles.metricCard, borderTop: `4px solid ${accent}` }}>
    <div style={styles.metricLabel}>{label}</div>
    <div style={styles.metricValue}>{value}</div>
  </div>
);

const FinanceSummaryCard = ({ label, value, accent }) => (
  <div style={styles.financeSummaryCard}>
    <div style={{ ...styles.financeAccent, background: accent }} />
    <div style={styles.financeSummaryLabel}>{label}</div>
    <div style={styles.financeSummaryValue}>{value}</div>
  </div>
);

const Panel = ({ title, children }) => (
  <div style={styles.panel}>
    <h3 style={styles.panelTitle}>{title}</h3>
    {children}
  </div>
);

const BreakdownList = ({ items }) => {
  if (!items.length) {
    return <div style={styles.empty}>No data for this range.</div>;
  }

  return (
    <div style={styles.breakdownList}>
      {items.map((item) => (
        <div key={item.label} style={styles.breakdownItem}>
          <span style={styles.breakdownLabel}>{item.label.replace('_', ' ')}</span>
          <span style={styles.breakdownCount}>{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const TrendPanel = ({ title, items, accent, formatter = (value) => value }) => {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div style={styles.trendPanel}>
      <div style={styles.trendPanelTop}>
        <h4 style={styles.trendTitle}>{title}</h4>
        <span style={{ ...styles.trendDot, background: accent }} />
      </div>
      <div style={styles.trendRows}>
        {items.map((item) => (
          <div key={`${title}-${item.label}`} style={styles.trendRow}>
            <div style={styles.trendDate}>{item.label}</div>
            <div style={styles.trendBarTrack}>
              <div
                style={{
                  ...styles.trendBarFill,
                  background: accent,
                  width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0)}%`
                }}
              />
            </div>
            <div style={styles.trendValue}>{formatter(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1rem'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap'
  },
  title: {
    fontSize: '1.8rem',
    margin: 0,
    color: '#172554'
  },
  subtitle: {
    margin: '0.45rem 0 0',
    color: '#52607a',
    maxWidth: '680px',
    lineHeight: 1.5
  },
  subnav: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  subnavButton: {
    padding: '0.8rem 1.1rem',
    borderRadius: '14px',
    border: '1px solid #d3dff3',
    background: '#f8fbff',
    color: '#35506f',
    fontWeight: 700,
    cursor: 'pointer'
  },
  subnavButtonActive: {
    background: 'linear-gradient(135deg, #173a74, #1d4ed8)',
    color: 'white',
    borderColor: '#1d4ed8',
    boxShadow: '0 14px 28px rgba(29, 78, 216, 0.22)'
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.85rem',
    alignItems: 'flex-end',
    padding: '1rem',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(241,245,255,0.95), rgba(230,238,252,0.92))',
    border: '1px solid rgba(107, 135, 187, 0.16)'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  fieldLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#41556f'
  },
  input: {
    minWidth: '170px',
    padding: '0.72rem 0.85rem',
    borderRadius: '12px',
    border: '1px solid #cdd8ea',
    background: 'white'
  },
  primaryButton: {
    padding: '0.78rem 1.1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#1d4ed8',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryButton: {
    padding: '0.78rem 1.1rem',
    borderRadius: '12px',
    border: '1px solid #c6d3ee',
    background: 'white',
    color: '#274067',
    fontWeight: 700,
    cursor: 'pointer'
  },
  error: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fff1f1, #ffe4e4)',
    color: '#9d1c1c'
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: '#52607a'
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem'
  },
  metricCard: {
    padding: '1.1rem',
    borderRadius: '18px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.95))',
    border: '1px solid rgba(122, 145, 184, 0.16)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
  },
  metricLabel: {
    fontSize: '0.85rem',
    color: '#66758b',
    marginBottom: '0.45rem',
    fontWeight: 700
  },
  metricValue: {
    fontSize: '1.6rem',
    color: '#13233f',
    fontWeight: 800
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem'
  },
  financeHero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1.25rem',
    borderRadius: '22px',
    background: 'linear-gradient(135deg, #112c57, #1b4f95)',
    color: 'white'
  },
  financeTitle: {
    margin: 0,
    fontSize: '1.5rem'
  },
  financeSubtitle: {
    margin: '0.45rem 0 0',
    color: 'rgba(255,255,255,0.88)',
    maxWidth: '640px',
    lineHeight: 1.5
  },
  rangeBadge: {
    padding: '0.65rem 0.9rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.14)',
    fontWeight: 700
  },
  financeSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '1rem'
  },
  financeSummaryCard: {
    position: 'relative',
    padding: '1.15rem 1.15rem 1.2rem',
    borderRadius: '20px',
    background: 'white',
    border: '1px solid rgba(122, 145, 184, 0.14)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)',
    overflow: 'hidden'
  },
  financeAccent: {
    position: 'absolute',
    inset: '0 auto 0 0',
    width: '5px'
  },
  financeSummaryLabel: {
    marginLeft: '0.35rem',
    color: '#61748f',
    fontWeight: 700,
    fontSize: '0.9rem'
  },
  financeSummaryValue: {
    marginLeft: '0.35rem',
    marginTop: '0.7rem',
    fontSize: '2rem',
    color: '#163051',
    fontWeight: 800
  },
  financeChartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem'
  },
  trendPanel: {
    padding: '1.15rem',
    borderRadius: '22px',
    background: 'white',
    border: '1px solid rgba(122, 145, 184, 0.14)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
  },
  trendPanelTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  trendTitle: {
    margin: 0,
    color: '#183153'
  },
  trendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  },
  trendRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  trendRow: {
    display: 'grid',
    gridTemplateColumns: '78px 1fr 78px',
    gap: '0.85rem',
    alignItems: 'center'
  },
  trendDate: {
    color: '#667892',
    fontSize: '0.82rem',
    fontWeight: 700
  },
  trendBarTrack: {
    width: '100%',
    height: '12px',
    background: '#e9eff8',
    borderRadius: '999px',
    overflow: 'hidden'
  },
  trendBarFill: {
    height: '100%',
    borderRadius: '999px'
  },
  trendValue: {
    textAlign: 'right',
    color: '#183153',
    fontWeight: 800,
    fontSize: '0.85rem'
  },
  panel: {
    padding: '1.2rem',
    borderRadius: '22px',
    background: 'white',
    border: '1px solid rgba(122, 145, 184, 0.14)',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.08)'
  },
  panelTitle: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#183153'
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem'
  },
  breakdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 0.95rem',
    borderRadius: '14px',
    background: '#f5f8ff'
  },
  breakdownLabel: {
    textTransform: 'capitalize',
    color: '#3d536f',
    fontWeight: 600
  },
  breakdownCount: {
    color: '#1d4ed8',
    fontWeight: 800
  },
  tableWrap: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHead: {
    textAlign: 'left',
    fontSize: '0.82rem',
    color: '#64748b',
    padding: '0 0 0.75rem',
    borderBottom: '1px solid #e4eaf5'
  },
  tableCell: {
    padding: '0.95rem 0',
    borderBottom: '1px solid #edf2f9',
    color: '#25364f',
    verticalAlign: 'top'
  },
  employeeName: {
    fontWeight: 700
  },
  employeeEmail: {
    color: '#728199',
    fontSize: '0.82rem',
    marginTop: '0.2rem'
  },
  tableHint: {
    color: '#728199',
    fontSize: '0.78rem',
    marginTop: '0.2rem'
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem'
  },
  activityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '0.95rem 1rem',
    borderRadius: '16px',
    background: '#f7faff'
  },
  activityTitle: {
    fontWeight: 700,
    color: '#203554'
  },
  activityMeta: {
    marginTop: '0.2rem',
    color: '#6a7b92',
    fontSize: '0.84rem'
  },
  activityRight: {
    textAlign: 'right'
  },
  activityBadge: {
    display: 'inline-block',
    padding: '0.34rem 0.6rem',
    borderRadius: '999px',
    background: '#dbe8ff',
    color: '#1d4ed8',
    textTransform: 'capitalize',
    fontSize: '0.78rem',
    fontWeight: 700
  },
  empty: {
    padding: '1rem',
    textAlign: 'center',
    color: '#708096',
    background: '#f7faff',
    borderRadius: '14px'
  }
};
