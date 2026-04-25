const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { isPlainObject, toPositiveInt, normalizeOptionalText } = require('../utils/validation');
const { awardPoints, awardBadges } = require('../services/gamificationService');
const { canUserAccessTask } = require('../utils/permissions');

const TIME_ENTRY_SELECT = `
  SELECT te.*, t.title as task_title, u.first_name || ' ' || u.last_name as user_name
  FROM time_entries te
  INNER JOIN tasks t ON te.task_id = t.id
  INNER JOIN users u ON te.user_id = u.id
`;

const getTimeEntriesForTask = async (req, res) => {
  try {
    const db = await getDB();
    const taskId = toPositiveInt(req.params.taskId);

    if (!taskId) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const task = await getRow(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await canUserAccessTask(db, taskId, req.user))) {
      return res.status(403).json({ error: 'Not authorized to view time entries for this task' });
    }

    const entries = await getRows(
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

    const activeEntry = await getRow(
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
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const task_id = toPositiveInt(req.body.task_id);
    const noteCheck = normalizeOptionalText(req.body.note, { maxLength: 500 });
    const userId = req.user.id;

    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required' });
    }

    if (noteCheck.error) {
      return res.status(400).json({ error: noteCheck.error });
    }

    const task = await getRow(
      db,
      `SELECT t.id,
              EXISTS(
                SELECT 1
                FROM task_assignments ta
                WHERE ta.task_id = t.id AND ta.user_id = ?
              ) as is_assigned
       FROM tasks t
       WHERE t.id = ?`,
      [userId, task_id]
    );
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.user.role !== 'admin' && !task.is_assigned) {
      return res.status(403).json({ error: 'You can only track time for tasks assigned to you' });
    }

    const activeEntry = await getRow(
      db,
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [userId]
    );

    if (activeEntry) {
      return res.status(409).json({ error: 'Stop your active timer before starting a new one' });
    }

    const result = await db.run(
      'INSERT INTO time_entries (task_id, user_id, note) VALUES (?, ?, ?) RETURNING id',
      [task_id, userId, noteCheck.value ?? null]
    );

    const entryId = result.rows[0].id;
    await saveDB();

    const timeEntry = await getRow(db, `${TIME_ENTRY_SELECT} WHERE te.id = ?`, [entryId]);
    res.status(201).json({ timeEntry });
  } catch (error) {
    console.error('Start time entry error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
};

const stopTimeEntry = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const noteCheck = normalizeOptionalText(req.body.note, { maxLength: 500 });
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: 'Invalid time entry id' });
    }

    if (noteCheck.error) {
      return res.status(400).json({ error: noteCheck.error });
    }

    const entry = await getRow(
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

    await db.run(
      `UPDATE time_entries
       SET end_time = CURRENT_TIMESTAMP, duration_minutes = ?, note = ?
       WHERE id = ?`,
      [durationMinutes, (noteCheck.value ?? entry.note) || null, id]
    );

    if (durationMinutes >= 30) {
      await awardPoints(db, userId, {
        eventType: 'focus_session',
        points: 2,
        referenceType: 'time_entry',
        referenceId: id
      });
      await awardBadges(db, userId);
    }

    await saveDB();

    const timeEntry = await getRow(db, `${TIME_ENTRY_SELECT} WHERE te.id = ?`, [id]);
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
