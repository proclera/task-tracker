const { getDB, saveDB } = require('../config/database');

const mapRow = (columns, row) => {
  const obj = {};
  columns.forEach((col, i) => obj[col] = row[i]);
  return obj;
};

exports.getNotifications = async (req, res) => {
  try {
    const db = await getDB();
    const user_id = req.user.id;

    const result = db.exec(`SELECT * FROM notifications
                           WHERE user_id = ?
                           ORDER BY created_at DESC
                           LIMIT 50`, [user_id]);

    if (result.length === 0) {
      return res.json({ notifications: [] });
    }

    const notifications = result[0].values.map(row => mapRow(result[0].columns, row));
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

    const result = db.exec(`SELECT COUNT(*) as count FROM notifications
                           WHERE user_id = ? AND is_read = 0`, [user_id]);

    const count = result[0].values[0][0];
    res.json({ unreadCount: count });
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

    const existing = db.exec(`SELECT * FROM notifications WHERE id = ? AND user_id = ?`, [id, user_id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    saveDB();

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

    db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [user_id]);
    saveDB();

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

exports.createNotification = (db, user_id, title, message, type = 'info') => {
  db.run(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [user_id, title, message, type]);
};
