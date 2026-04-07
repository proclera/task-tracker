const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');

exports.getComments = async (req, res) => {
  try {
    const db = await getDB();
    const { task_id } = req.query;

    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required' });
    }

    const comments = await getRows(
      db,
      `SELECT c.*, u.first_name || ' ' || u.last_name as user_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [task_id]
    );

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const db = await getDB();
    const { task_id, content } = req.body;
    const user_id = req.user.id;

    if (!task_id || !content) {
      return res.status(400).json({ error: 'task_id and content are required' });
    }

    // Verify task exists
    const taskCheck = await getRow(db, `SELECT id FROM tasks WHERE id = ?`, [task_id]);
    if (!taskCheck) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const insertResult = await db.run(
      `INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?) RETURNING id`,
      [task_id, user_id, content]
    );
    const commentId = insertResult.rows[0].id;
    await saveDB();

    // Get the created comment with user name
    const comment = await getRow(
      db,
      `SELECT c.*, u.first_name || ' ' || u.last_name as user_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );
    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const user_id = req.user.id;

    const comment = await getRow(db, `SELECT * FROM comments WHERE id = ?`, [id]);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await db.run(`DELETE FROM comments WHERE id = ?`, [id]);
    await saveDB();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};
