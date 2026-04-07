const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');

const TIME_ENTRY_SELECT = `
  SELECT te.*, t.title as task_title, u.first_name || ' ' || u.last_name as user_name
  FROM time_entries te
  INNER JOIN tasks t ON te.task_id = t.id
  INNER JOIN users u ON te.user_id = u.id
`;

const getTimeEntriesForTask = async (req, res) => {
  try {
    const db = await getDB();
    const { taskId } = req.params;

    const task = getRow(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const entries = getRows(
      db,
      `${TIME_ENTRY_SELECT} WHERE te.task_id = ? ORDER BY te.start_time DESC`,
      [taskId]
    );

    res.json({ timeEntries: entries });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

const getActiveTimeEntry = async (req, res) => {
  try {
    const db = await getDB();

    const activeEntry = getRow(
      db,
      `${TIME_ENTRY_SELECT} WHERE te.user_id = ? AND te.end_time IS NULL ORDER BY te.start_time DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({ activeEntry: activeEntry || null });
  } catch (error) {
    console.error('Get active time entry error:', error);
    res.status(500).json({ error: 'Failed to fetch active timer' });
  }
};

const startTimeEntry = async (req, res) => {
  try {
    const db = await getDB();
    const { task_id, note } = req.body;
    const userId = req.user.id;

    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required' });
    }

    const task = getRow(db, 'SELECT id, assignee_id FROM tasks WHERE id = ?', [task_id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.user.role !== 'admin' && task.assignee_id !== userId) {
      return res.status(403).json({ error: 'You can only track time for tasks assigned to you' });
    }

    const activeEntry = getRow(
      db,
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [userId]
    );

    if (activeEntry) {
      return res.status(409).json({ error: 'Stop your active timer before starting a new one' });
    }

    db.run(
      'INSERT INTO time_entries (task_id, user_id, start_time, note) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
      [task_id, userId, note?.trim() || null]
    );

    const result = db.exec('SELECT last_insert_rowid()');
    const entryId = result[0].values[0][0];
    saveDB();

    const timeEntry = getRow(db, `${TIME_ENTRY_SELECT} WHERE te.id = ?`, [entryId]);
    res.status(201).json({ timeEntry });
  } catch (error) {
    console.error('Start time entry error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
};

const stopTimeEntry = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.id;

    const entry = getRow(
      db,
      'SELECT * FROM time_entries WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!entry) {
      return res.status(404).json({ error: 'Active timer not found' });
    }

    if (entry.end_time) {
      return res.status(400).json({ error: 'This timer is already stopped' });
    }

    const startTime = new Date(entry.start_time);
    const endTime = new Date();
    const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));

    db.run(
      `UPDATE time_entries
       SET end_time = CURRENT_TIMESTAMP, duration_minutes = ?, note = ?
       WHERE id = ?`,
      [durationMinutes, note?.trim() || entry.note || null, id]
    );

    saveDB();

    const timeEntry = getRow(db, `${TIME_ENTRY_SELECT} WHERE te.id = ?`, [id]);
    res.json({ timeEntry });
  } catch (error) {
    console.error('Stop time entry error:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
};

module.exports = {
  getTimeEntriesForTask,
  getActiveTimeEntry,
  startTimeEntry,
  stopTimeEntry
};
