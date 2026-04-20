const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { toPositiveInt } = require('../utils/validation');

const buildOverdueNotificationContent = (task) => ({
  title: 'Task Overdue',
  message: `Task "${task.title}" was due on ${task.due_date}. Please update your progress.`
});

exports.getNotifications = async (req, res) => {
  try {
    const db = await getDB();
    const user_id = req.user.id;

    const notifications = await getRows(
      db,
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [user_id]
    );
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const db = await getDB();
    const user_id = req.user.id;

    const result = await getRow(
      db,
      `SELECT COUNT(*)::int as count FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [user_id]
    );

    res.json({ unreadCount: result?.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const user_id = req.user.id;

    if (!id) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const existing = await getRow(db, `SELECT * FROM notifications WHERE id = ? AND user_id = ?`, [id, user_id]);
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    await saveDB();

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const db = await getDB();
    const user_id = req.user.id;

    await db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [user_id]);
    await saveDB();

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

exports.createNotification = async (db, user_id, title, message, type = 'info') => {
  await db.run(
    `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [user_id, title, message, type]
  );
};

exports.ensureOverdueNotifications = async (db, userId) => {
  const overdueTasks = await getRows(
    db,
    `SELECT DISTINCT t.id, t.title, t.due_date
     FROM tasks t
     INNER JOIN task_assignments ta ON ta.task_id = t.id
     WHERE ta.user_id = ?
       AND ta.status != 'completed'
       AND t.due_date IS NOT NULL
       AND t.due_date < CURRENT_DATE
     ORDER BY t.due_date ASC, t.id ASC`,
    [userId]
  );

  let createdCount = 0;

  for (const task of overdueTasks) {
    const { title, message } = buildOverdueNotificationContent(task);
    const existing = await getRow(
      db,
      `SELECT id
       FROM notifications
       WHERE user_id = ?
         AND type = 'overdue'
         AND title = ?
         AND message = ?
         AND created_at::date = CURRENT_DATE
       LIMIT 1`,
      [userId, title, message]
    );

    if (!existing) {
      await exports.createNotification(db, userId, title, message, 'overdue');
      createdCount += 1;
    }
  }

  if (createdCount > 0) {
    await saveDB();
  }

  return {
    overdueCount: overdueTasks.length,
    createdCount
  };
};
