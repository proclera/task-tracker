const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');

const ATTENDANCE_SELECT = `
  SELECT ar.*, u.first_name || ' ' || u.last_name as user_name, u.email
  FROM attendance_records ar
  INNER JOIN users u ON u.id = ar.user_id
`;

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const getMonthStartDate = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

const calculateMinutes = (start, end) => {
  const startTime = new Date(start);
  const endTime = new Date(end);
  return Math.max(1, Math.round((endTime - startTime) / 60000));
};

exports.getMyAttendanceToday = async (req, res) => {
  try {
    const db = await getDB();
    const attendanceDate = getTodayDate();

    const attendance = getRow(
      db,
      `${ATTENDANCE_SELECT} WHERE ar.user_id = ? AND ar.attendance_date = ?`,
      [req.user.id, attendanceDate]
    );

    res.json({ attendance: attendance || null });
  } catch (error) {
    console.error('Get attendance today error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const db = await getDB();
    const attendanceDate = getTodayDate();

    const existing = getRow(
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

    db.run(
      `INSERT INTO attendance_records (user_id, attendance_date, check_in_time, status)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
      [req.user.id, attendanceDate, status]
    );

    const result = db.exec('SELECT last_insert_rowid()');
    const recordId = result[0].values[0][0];
    saveDB();

    const attendance = getRow(db, `${ATTENDANCE_SELECT} WHERE ar.id = ?`, [recordId]);
    res.status(201).json({ attendance });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const workSummary = String(req.body?.work_summary || '').trim();

    const attendance = getRow(
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

    if (!workSummary) {
      return res.status(400).json({ error: 'Please add a short work summary before checking out' });
    }

    if (workSummary.length > 1000) {
      return res.status(400).json({ error: 'Work summary must be 1000 characters or less' });
    }

    const now = new Date();
    const totalMinutes = calculateMinutes(attendance.check_in_time, now.toISOString());

    db.run(
      `UPDATE attendance_records
       SET check_out_time = CURRENT_TIMESTAMP, total_minutes = ?, work_summary = ?
       WHERE id = ?`,
      [totalMinutes, workSummary, id]
    );

    saveDB();

    const updatedAttendance = getRow(db, `${ATTENDANCE_SELECT} WHERE ar.id = ?`, [id]);
    res.json({ attendance: updatedAttendance });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

exports.getMyAttendanceHistory = async (req, res) => {
  try {
    const db = await getDB();
    const monthStart = getMonthStartDate();

    const records = getRows(
      db,
      `${ATTENDANCE_SELECT}
       WHERE ar.user_id = ? AND ar.attendance_date >= ?
       ORDER BY ar.attendance_date DESC, ar.check_in_time DESC`,
      [req.user.id, monthStart]
    );

    res.json({ records });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const db = await getDB();
    const attendanceDate = getTodayDate();
    const monthStart = getMonthStartDate();

    const todayCheckedIn = db.exec(
      `SELECT COUNT(*) as count FROM attendance_records WHERE attendance_date = ?`,
      [attendanceDate]
    );
    const lateToday = db.exec(
      `SELECT COUNT(*) as count FROM attendance_records WHERE attendance_date = ? AND status = 'late'`,
      [attendanceDate]
    );
    const checkedOutToday = db.exec(
      `SELECT COUNT(*) as count FROM attendance_records WHERE attendance_date = ? AND check_out_time IS NOT NULL`,
      [attendanceDate]
    );
    const recentAttendance = getRows(
      db,
      `${ATTENDANCE_SELECT} ORDER BY ar.attendance_date DESC, ar.check_in_time DESC LIMIT 10`
    );
    const monthlyAttendance = getRows(
      db,
      `${ATTENDANCE_SELECT}
       WHERE ar.attendance_date >= ?
       ORDER BY ar.attendance_date DESC, ar.check_in_time DESC`,
      [monthStart]
    );

    res.json({
      summary: {
        todayCheckedIn: todayCheckedIn[0]?.values[0]?.[0] || 0,
        lateToday: lateToday[0]?.values[0]?.[0] || 0,
        checkedOutToday: checkedOutToday[0]?.values[0]?.[0] || 0,
        recentAttendance,
        monthlyAttendance
      }
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
};
