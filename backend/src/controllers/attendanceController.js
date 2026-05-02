const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { isPlainObject, toPositiveInt } = require('../utils/validation');
const { awardPoints, refreshStreakFromAttendance, awardBadges } = require('../services/gamificationService');
const { createSimplePdf } = require('../utils/pdf');
const { getManagedUsers } = require('../utils/permissions');
const {
  ATTENDANCE_CHECKOUT_FIELDS,
  normalizeAssignedFieldKeys,
  validateCheckoutDetails
} = require('../utils/attendanceCheckout');

const ATTENDANCE_SELECT = `
  SELECT ar.*, u.first_name || ' ' || u.last_name as user_name, u.email
  FROM attendance_records ar
  INNER JOIN users u ON u.id = ar.user_id
`;

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const getMonthStartDate = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
const getCurrentMonthKey = () => getMonthStartDate().slice(0, 7);

const getMonthRange = (monthKey = getCurrentMonthKey()) => {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return null;
  }

  const [yearValue, monthValue] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(yearValue, monthValue - 1, 1));
  const nextMonth = new Date(Date.UTC(yearValue, monthValue, 1));

  return {
    key: monthKey,
    startDate: start.toISOString().slice(0, 10),
    endDateExclusive: nextMonth.toISOString().slice(0, 10),
    isCurrentMonth: monthKey === getCurrentMonthKey()
  };
};

const formatMonthLabel = (monthKey) => {
  const range = getMonthRange(monthKey);

  if (!range) {
    return monthKey;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${range.startDate}T00:00:00.000Z`));
};

const calculateMinutes = (start, end) => {
  const startTime = new Date(start);
  const endTime = new Date(end);
  return Math.max(1, Math.round((endTime - startTime) / 60000));
};

const getMonthlyAttendanceRecords = async (db, monthRange, userId = null) => {
  const whereClause = userId
    ? 'WHERE ar.user_id = ? AND ar.attendance_date >= ? AND ar.attendance_date < ?'
    : 'WHERE ar.attendance_date >= ? AND ar.attendance_date < ?';
  const params = userId
    ? [userId, monthRange.startDate, monthRange.endDateExclusive]
    : [monthRange.startDate, monthRange.endDateExclusive];

  return getRows(
    db,
    `${ATTENDANCE_SELECT}
     ${whereClause}
     ORDER BY ar.attendance_date DESC, ar.check_in_time DESC`,
    params
  );
};

const getCheckoutAssignedFields = async (db, userId) => {
  const config = await getRow(
    db,
    `SELECT assigned_fields
     FROM attendance_checkout_configs
     WHERE employee_user_id = ?`,
    [userId]
  );

  return normalizeAssignedFieldKeys(config?.assigned_fields);
};

const getCheckoutConfigPayload = (assignedFields) => ({
  definitions: ATTENDANCE_CHECKOUT_FIELDS,
  assignedFields,
  requiresStructuredCheckout: assignedFields.length > 0
});

exports.getMyAttendanceToday = async (req, res) => {
  try {
    const db = await getDB();
    const attendanceDate = getTodayDate();
    const assignedFields = await getCheckoutAssignedFields(db, req.user.id);

    const attendance = await getRow(
      db,
      `${ATTENDANCE_SELECT} WHERE ar.user_id = ? AND ar.attendance_date = ?`,
      [req.user.id, attendanceDate]
    );

    res.json({
      attendance: attendance || null,
      checkoutConfig: getCheckoutConfigPayload(assignedFields)
    });
  } catch (error) {
    console.error('Get attendance today error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const db = await getDB();
    const attendanceDate = getTodayDate();

    const existing = await getRow(
      db,
      'SELECT id FROM attendance_records WHERE user_id = ? AND attendance_date = ?',
      [req.user.id, attendanceDate]
    );

    if (existing) {
      return res.status(409).json({ error: 'You are already checked in today' });
    }

    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
    const status = isLate ? 'late' : 'present';

    const result = await db.run(
      `INSERT INTO attendance_records (user_id, attendance_date, status)
       VALUES (?, ?, ?)
       RETURNING id`,
      [req.user.id, attendanceDate, status]
    );

    await awardPoints(db, req.user.id, {
      eventType: 'daily_checkin',
      points: status === 'late' ? 3 : 5,
      referenceType: 'attendance',
      referenceId: result.rows[0].id
    });
    await refreshStreakFromAttendance(db, req.user.id);
    await awardBadges(db, req.user.id);

    const recordId = result.rows[0].id;
    await saveDB();

    const attendance = await getRow(db, `${ATTENDANCE_SELECT} WHERE ar.id = ?`, [recordId]);
    res.status(201).json({ attendance });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

exports.checkOut = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const workSummary = String(req.body?.work_summary || '').trim();

    if (!id) {
      return res.status(400).json({ error: 'Invalid attendance id' });
    }

    const attendance = await getRow(
      db,
      `${ATTENDANCE_SELECT} WHERE ar.id = ? AND ar.user_id = ?`,
      [id, req.user.id]
    );

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (attendance.check_out_time) {
      return res.status(400).json({ error: 'You are already checked out' });
    }

    const assignedFields = await getCheckoutAssignedFields(db, req.user.id);
    let nextWorkSummary = workSummary;
    let checkoutDetails = null;

    if (assignedFields.length > 0) {
      const validated = validateCheckoutDetails(req.body?.checkout_details, assignedFields);

      if (validated.error) {
        return res.status(400).json({ error: validated.error });
      }

      checkoutDetails = validated.details;
      nextWorkSummary = validated.summaryText;
    } else {
      if (!workSummary) {
        return res.status(400).json({ error: 'Please add a short work summary before checking out' });
      }

      if (workSummary.length > 1000) {
        return res.status(400).json({ error: 'Work summary must be 1000 characters or less' });
      }
    }

    const now = new Date();
    const totalMinutes = calculateMinutes(attendance.check_in_time, now.toISOString());

    await db.run(
      `UPDATE attendance_records
       SET check_out_time = CURRENT_TIMESTAMP, total_minutes = ?, work_summary = ?, checkout_details = ?
       WHERE id = ?`,
      [totalMinutes, nextWorkSummary, checkoutDetails, id]
    );

    await saveDB();

    const updatedAttendance = await getRow(db, `${ATTENDANCE_SELECT} WHERE ar.id = ?`, [id]);
    res.json({ attendance: updatedAttendance });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

exports.getManagerCheckoutConfigs = async (req, res) => {
  try {
    const db = await getDB();
    const monthRange = getMonthRange(req.query.month || getCurrentMonthKey());

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const [managedUsers, configRows, recentRecords] = await Promise.all([
      getManagedUsers(db, req.user.id),
      getRows(
        db,
        `SELECT employee_user_id, assigned_fields
         FROM attendance_checkout_configs
         WHERE manager_id = ?`,
        [req.user.id]
      ),
      getRows(
        db,
        `${ATTENDANCE_SELECT}
         LEFT JOIN employee_profiles ep ON ep.user_id = ar.user_id
         WHERE (
           ar.user_id = ?
           OR ep.manager_id = ?
         )
         AND ar.attendance_date >= ?
         AND ar.attendance_date < ?
         ORDER BY ar.attendance_date DESC, ar.check_in_time DESC`,
        [req.user.id, req.user.id, monthRange.startDate, monthRange.endDateExclusive]
      )
    ]);

    const employees = [
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        first_name: req.user.firstName,
        last_name: req.user.lastName,
        isSelf: true
      },
      ...managedUsers.map((user) => ({
        ...user,
        isSelf: false
      }))
    ];

    const configMap = new Map(
      configRows.map((row) => [row.employee_user_id, normalizeAssignedFieldKeys(row.assigned_fields)])
    );

    res.json({
      definitions: ATTENDANCE_CHECKOUT_FIELDS,
      period: {
        month: monthRange.key,
        monthLabel: formatMonthLabel(monthRange.key)
      },
      employees: employees.map((employee) => ({
        ...employee,
        assignedFields: configMap.get(employee.id) || []
      })),
      recentRecords
    });
  } catch (error) {
    console.error('Get manager checkout configs error:', error);
    res.status(500).json({ error: 'Failed to fetch manager attendance setup' });
  }
};

exports.updateManagerCheckoutConfig = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const employeeId = toPositiveInt(req.params.employeeId);
    const assignedFields = normalizeAssignedFieldKeys(req.body?.assigned_fields);

    if (!employeeId) {
      return res.status(400).json({ error: 'Invalid employee id' });
    }

    const employee = await getRow(
      db,
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
              CASE WHEN u.id = ? THEN TRUE ELSE FALSE END as is_self
       FROM users u
       WHERE u.id = ?
         AND (
           u.id = ?
           OR EXISTS (
             SELECT 1
             FROM employee_profiles ep
             WHERE ep.user_id = u.id
               AND ep.manager_id = ?
           )
         )`,
      [req.user.id, employeeId, req.user.id, req.user.id]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Team member not found in your setup' });
    }

    await db.run(
      `INSERT INTO attendance_checkout_configs (employee_user_id, manager_id, assigned_fields, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (employee_user_id)
       DO UPDATE SET
         manager_id = EXCLUDED.manager_id,
         assigned_fields = EXCLUDED.assigned_fields,
         updated_at = CURRENT_TIMESTAMP`,
      [employeeId, req.user.id, JSON.stringify(assignedFields)]
    );

    await saveDB();

    res.json({
      employee: {
        ...employee,
        assignedFields
      },
      definitions: ATTENDANCE_CHECKOUT_FIELDS
    });
  } catch (error) {
    console.error('Update manager checkout config error:', error);
    res.status(500).json({ error: 'Failed to update employee attendance setup' });
  }
};

exports.getMyAttendanceHistory = async (req, res) => {
  try {
    const db = await getDB();
    const monthRange = getMonthRange(req.query.month || getCurrentMonthKey());

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const records = await getMonthlyAttendanceRecords(db, monthRange, req.user.id);

    res.json({
      filters: {
        month: monthRange.key,
        monthLabel: formatMonthLabel(monthRange.key)
      },
      records
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const db = await getDB();
    const monthRange = getMonthRange(req.query.month || getCurrentMonthKey());

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const [checkedInCount, lateCount, checkedOutCount, monthlyAttendance] = await Promise.all([
      getRow(
        db,
        `SELECT COUNT(*)::int as count
         FROM attendance_records
         WHERE attendance_date >= ? AND attendance_date < ?`,
        [monthRange.startDate, monthRange.endDateExclusive]
      ),
      getRow(
        db,
        `SELECT COUNT(*)::int as count
         FROM attendance_records
         WHERE attendance_date >= ? AND attendance_date < ? AND status = 'late'`,
        [monthRange.startDate, monthRange.endDateExclusive]
      ),
      getRow(
        db,
        `SELECT COUNT(*)::int as count
         FROM attendance_records
         WHERE attendance_date >= ? AND attendance_date < ? AND check_out_time IS NOT NULL`,
        [monthRange.startDate, monthRange.endDateExclusive]
      ),
      getMonthlyAttendanceRecords(db, monthRange)
    ]);

    res.json({
      summary: {
        checkedInCount: checkedInCount?.count || 0,
        lateCount: lateCount?.count || 0,
        checkedOutCount: checkedOutCount?.count || 0,
        period: {
          month: monthRange.key,
          monthLabel: formatMonthLabel(monthRange.key),
          isCurrentMonth: monthRange.isCurrentMonth
        },
        monthlyAttendance
      }
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
};

exports.downloadAttendanceMonthlyPdf = async (req, res) => {
  try {
    const db = await getDB();
    const monthRange = getMonthRange(req.query.month || getCurrentMonthKey());

    if (!monthRange) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const records = await getMonthlyAttendanceRecords(db, monthRange);
    const monthLabel = formatMonthLabel(monthRange.key);
    const lines = [
      `Task Tracker Attendance Report`,
      `Month: ${monthLabel}`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      `Total records: ${records.length}`,
      ''
    ];

    if (records.length === 0) {
      lines.push('No attendance records found for this month.');
    } else {
      records.forEach((record, index) => {
        lines.push(`${index + 1}. ${record.user_name}`);
        lines.push(`   Date: ${record.attendance_date}`);
        lines.push(`   Status: ${record.status}`);
        lines.push(`   Check in: ${record.check_in_time || '-'}`);
        lines.push(`   Check out: ${record.check_out_time || 'In progress'}`);
        lines.push(`   Total minutes: ${record.total_minutes || 0}`);

        if (record.work_summary) {
          lines.push(`   Work summary: ${record.work_summary.replace(/\r?\n/g, ' ')}`);
        }

        lines.push('');
      });
    }

    const pdfBuffer = createSimplePdf(lines);
    const fileName = `attendance-${monthRange.key}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download attendance PDF error:', error);
    res.status(500).json({ error: 'Failed to download attendance PDF' });
  }
};
