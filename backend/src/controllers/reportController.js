const { getDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');

const DEFAULT_RANGE_DAYS = 30;

const CHECKOUT_METRIC_KEYS = {
  todays_orders: "Today's Order",
  orders_processed: 'Order Processed',
  todays_spending: "Today's Spending",
  todays_earning: "Today's Earning"
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value) => Number(value.toFixed(2));

const getCheckoutMetricRows = async (db, startDate, endDate) => getRows(
  db,
  `SELECT
     ar.user_id,
     ar.attendance_date,
     ar.checkout_details,
     u.first_name,
     u.last_name,
     u.email
   FROM attendance_records ar
   INNER JOIN users u ON u.id = ar.user_id
   WHERE ar.attendance_date BETWEEN ? AND ?
     AND ar.checkout_details IS NOT NULL
   ORDER BY ar.attendance_date ASC, u.first_name ASC, u.last_name ASC`,
  [startDate, endDate]
);

const buildCheckoutMetrics = (rows) => {
  const totals = {
    todaysOrders: 0,
    ordersProcessed: 0,
    todaysSpending: 0,
    todaysEarning: 0
  };
  const byEmployee = new Map();
  const byDate = new Map();

  rows.forEach((row) => {
    const details = row.checkout_details || {};
    const values = {
      todaysOrders: toNumber(details.todays_orders),
      ordersProcessed: toNumber(details.orders_processed),
      todaysSpending: toNumber(details.todays_spending),
      todaysEarning: toNumber(details.todays_earning)
    };

    totals.todaysOrders += values.todaysOrders;
    totals.ordersProcessed += values.ordersProcessed;
    totals.todaysSpending += values.todaysSpending;
    totals.todaysEarning += values.todaysEarning;

    if (!byEmployee.has(row.user_id)) {
      byEmployee.set(row.user_id, {
        todaysOrders: 0,
        ordersProcessed: 0,
        todaysSpending: 0,
        todaysEarning: 0
      });
    }

    const employeeMetrics = byEmployee.get(row.user_id);
    employeeMetrics.todaysOrders += values.todaysOrders;
    employeeMetrics.ordersProcessed += values.ordersProcessed;
    employeeMetrics.todaysSpending += values.todaysSpending;
    employeeMetrics.todaysEarning += values.todaysEarning;

    if (!byDate.has(row.attendance_date)) {
      byDate.set(row.attendance_date, {
        date: row.attendance_date,
        todaysOrders: 0,
        ordersProcessed: 0,
        todaysSpending: 0,
        todaysEarning: 0
      });
    }

    const dateMetrics = byDate.get(row.attendance_date);
    dateMetrics.todaysOrders += values.todaysOrders;
    dateMetrics.ordersProcessed += values.ordersProcessed;
    dateMetrics.todaysSpending += values.todaysSpending;
    dateMetrics.todaysEarning += values.todaysEarning;
  });

  return {
    totals: {
      todaysOrders: totals.todaysOrders,
      ordersProcessed: totals.ordersProcessed,
      todaysSpending: roundMoney(totals.todaysSpending),
      todaysEarning: roundMoney(totals.todaysEarning)
    },
    byEmployee,
    dailySeries: [...byDate.values()].map((entry) => ({
      ...entry,
      todaysSpending: roundMoney(entry.todaysSpending),
      todaysEarning: roundMoney(entry.todaysEarning)
    }))
  };
};

const isValidDateInput = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeDateRange = (startDate, endDate) => {
  if (startDate && !isValidDateInput(startDate)) {
    return { error: 'start_date must be in YYYY-MM-DD format' };
  }

  if (endDate && !isValidDateInput(endDate)) {
    return { error: 'end_date must be in YYYY-MM-DD format' };
  }

  const today = new Date();
  const end = endDate ? new Date(`${endDate}T00:00:00.000Z`) : new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));
  const start = startDate
    ? new Date(`${startDate}T00:00:00.000Z`)
    : new Date(end.getTime() - ((DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid report date range' };
  }

  if (start > end) {
    return { error: 'start_date cannot be after end_date' };
  }

  const toDateString = (date) => date.toISOString().slice(0, 10);

  return {
    startDate: toDateString(start),
    endDate: toDateString(end)
  };
};

const getSummary = async (db, startDate, endDate) => {
  const summary = await getRow(
    db,
    `SELECT
       COUNT(*)::int as tasks_created,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed_tasks,
       COALESCE(SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END), 0)::int as open_tasks,
       COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE AND status != 'completed' THEN 1 ELSE 0 END), 0)::int as overdue_tasks
     FROM tasks
     WHERE DATE(created_at) BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const timeSummary = await getRow(
    db,
    `SELECT
       COALESCE(SUM(duration_minutes), 0)::int as total_minutes,
       COUNT(*)::int as total_entries,
       COUNT(DISTINCT DATE(start_time))::int as active_days
     FROM time_entries
     WHERE DATE(start_time) BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const attendanceSummary = await getRow(
    db,
    `SELECT
       COUNT(*)::int as attendance_days,
       COALESCE(SUM(total_minutes), 0)::int as attendance_minutes,
       COALESCE(SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END), 0)::int as late_days
     FROM attendance_records
     WHERE attendance_date BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const activeTimers = await getRow(
    db,
    `SELECT COUNT(*)::int as count FROM time_entries WHERE end_time IS NULL`
  );

  const checkoutMetrics = buildCheckoutMetrics(await getCheckoutMetricRows(db, startDate, endDate));

  return {
    tasksCreated: summary?.tasks_created || 0,
    completedTasks: summary?.completed_tasks || 0,
    openTasks: summary?.open_tasks || 0,
    overdueTasks: summary?.overdue_tasks || 0,
    totalTrackedMinutes: timeSummary?.total_minutes || 0,
    totalTimeEntries: timeSummary?.total_entries || 0,
    activeTrackingDays: timeSummary?.active_days || 0,
    attendanceDays: attendanceSummary?.attendance_days || 0,
    attendanceMinutes: attendanceSummary?.attendance_minutes || 0,
    lateDays: attendanceSummary?.late_days || 0,
    activeTimers: activeTimers?.count || 0,
    todaysOrders: checkoutMetrics.totals.todaysOrders,
    ordersProcessed: checkoutMetrics.totals.ordersProcessed,
    todaysSpending: checkoutMetrics.totals.todaysSpending,
    todaysEarning: checkoutMetrics.totals.todaysEarning
  };
};

const getBreakdowns = async (db, startDate, endDate) => {
  const [tasksByStatus, tasksByPriority, teamPerformance, recentActivity, checkoutMetricRows] = await Promise.all([
    getRows(
      db,
      `SELECT status as label, COUNT(*)::int as count
       FROM tasks
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY status
       ORDER BY count DESC, label ASC`,
      [startDate, endDate]
    ),
    getRows(
      db,
      `SELECT priority as label, COUNT(*)::int as count
       FROM tasks
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY priority
       ORDER BY count DESC, label ASC`,
      [startDate, endDate]
    ),
    getRows(
      db,
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.role,
         COALESCE(task_stats.assigned_tasks, 0)::int as assigned_tasks,
         COALESCE(task_stats.completed_tasks, 0)::int as completed_tasks,
         COALESCE(time_stats.tracked_minutes, 0)::int as tracked_minutes,
         COALESCE(time_stats.entries_count, 0)::int as entries_count,
         COALESCE(attendance_stats.days_present, 0)::int as days_present,
         COALESCE(attendance_stats.late_days, 0)::int as late_days
       FROM users u
       LEFT JOIN (
         SELECT
           ta.user_id,
           COUNT(*)::int as assigned_tasks,
           COALESCE(SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed_tasks
         FROM task_assignments ta
         INNER JOIN tasks t ON t.id = ta.task_id
         WHERE DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY ta.user_id
       ) task_stats ON task_stats.user_id = u.id
       LEFT JOIN (
         SELECT
           user_id,
           COALESCE(SUM(duration_minutes), 0)::int as tracked_minutes,
           COUNT(*)::int as entries_count
         FROM time_entries
         WHERE DATE(start_time) BETWEEN ? AND ?
         GROUP BY user_id
       ) time_stats ON time_stats.user_id = u.id
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*)::int as days_present,
           COALESCE(SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END), 0)::int as late_days
         FROM attendance_records
         WHERE attendance_date BETWEEN ? AND ?
         GROUP BY user_id
       ) attendance_stats ON attendance_stats.user_id = u.id
       WHERE u.role IN ('employee', 'manager')
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [startDate, endDate, startDate, endDate, startDate, endDate]
    ),
    getRows(
      db,
      `SELECT * FROM (
         SELECT
           'task_completed' as activity_type,
           t.id,
           t.title,
           u.first_name || ' ' || u.last_name as actor_name,
           ta.updated_at as activity_at,
           'Assignee marked work completed' as detail
         FROM task_assignments ta
         INNER JOIN tasks t ON t.id = ta.task_id
         INNER JOIN users u ON u.id = ta.user_id
         WHERE ta.status = 'completed'
           AND DATE(ta.updated_at) BETWEEN ? AND ?

         UNION ALL

         SELECT
           'time_logged' as activity_type,
           te.id,
           t.title,
           u.first_name || ' ' || u.last_name as actor_name,
           COALESCE(te.end_time, te.start_time) as activity_at,
           CONCAT(te.duration_minutes, ' minutes logged') as detail
         FROM time_entries te
         INNER JOIN tasks t ON t.id = te.task_id
         INNER JOIN users u ON u.id = te.user_id
         WHERE DATE(te.start_time) BETWEEN ? AND ?

         UNION ALL

         SELECT
           'attendance' as activity_type,
           ar.id,
           'Attendance' as title,
           u.first_name || ' ' || u.last_name as actor_name,
           COALESCE(ar.check_out_time, ar.check_in_time) as activity_at,
           CASE WHEN ar.status = 'late' THEN 'Checked in late' ELSE 'Attendance recorded' END as detail
         FROM attendance_records ar
         INNER JOIN users u ON u.id = ar.user_id
         WHERE ar.attendance_date BETWEEN ? AND ?
       ) activity_feed
       ORDER BY activity_at DESC
       LIMIT 12`,
      [startDate, endDate, startDate, endDate, startDate, endDate]
    )
  ]);

  const checkoutMetrics = buildCheckoutMetrics(checkoutMetricRows);

  return {
    tasksByStatus,
    tasksByPriority,
    teamPerformance: teamPerformance.map((employee) => ({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      email: employee.email,
      role: employee.role,
      assignedTasks: employee.assigned_tasks,
      completedTasks: employee.completed_tasks,
      trackedMinutes: employee.tracked_minutes,
      timeEntries: employee.entries_count,
      attendanceDays: employee.days_present,
      lateDays: employee.late_days,
      todaysOrders: checkoutMetrics.byEmployee.get(employee.id)?.todaysOrders || 0,
      ordersProcessed: checkoutMetrics.byEmployee.get(employee.id)?.ordersProcessed || 0,
      todaysSpending: roundMoney(checkoutMetrics.byEmployee.get(employee.id)?.todaysSpending || 0),
      todaysEarning: roundMoney(checkoutMetrics.byEmployee.get(employee.id)?.todaysEarning || 0)
    })),
    recentActivity,
    checkoutMetrics: {
      definitions: CHECKOUT_METRIC_KEYS,
      dailySeries: checkoutMetrics.dailySeries
    }
  };
};

const getReportSummary = async (req, res) => {
  try {
    const range = normalizeDateRange(req.query.start_date, req.query.end_date);

    if (range.error) {
      return res.status(400).json({ error: range.error });
    }

    const db = await getDB();
    const [summary, breakdowns] = await Promise.all([
      getSummary(db, range.startDate, range.endDate),
      getBreakdowns(db, range.startDate, range.endDate)
    ]);

    res.json({
      filters: range,
      report: {
        summary,
        ...breakdowns
      }
    });
  } catch (error) {
    console.error('Get report summary error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

module.exports = {
  getReportSummary
};
