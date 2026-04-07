const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');

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
    const { id } = req.params;
    const user_id = req.user.id;

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
