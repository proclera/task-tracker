const { getDB, saveDB } = require('../config/database');

const mapRow = (columns, row) => {
  const obj = {};
  columns.forEach((col, i) => obj[col] = row[i]);
  return obj;
};

exports.getComments = async (req, res) => {
  try {
    const db = await getDB();
    const { task_id } = req.query;

    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required' });
    }

    const result = db.exec(`SELECT c.*, u.first_name || ' ' || u.last_name as user_name
                           FROM comments c
                           LEFT JOIN users u ON c.user_id = u.id
                           WHERE c.task_id = ?
                           ORDER BY c.created_at ASC`, [task_id]);

    if (result.length === 0) {
      return res.json({ comments: [] });
    }

    const comments = result[0].values.map(row => mapRow(result[0].columns, row));
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
    const taskCheck = db.exec(`SELECT id FROM tasks WHERE id = ?`, [task_id]);
    if (taskCheck.length === 0 || taskCheck[0].values.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.run(`INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)`, [task_id, user_id, content]);

    const result = db.exec('SELECT last_insert_rowid()');
    const commentId = result[0].values[0][0];
    saveDB();

    // Get the created comment with user name
    const commentResult = db.exec(`SELECT c.*, u.first_name || ' ' || u.last_name as user_name
                                  FROM comments c
                                  LEFT JOIN users u ON c.user_id = u.id
                                  WHERE c.id = ?`, [commentId]);

    const comment = mapRow(commentResult[0].columns, commentResult[0].values[0]);
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

    const existing = db.exec(`SELECT * FROM comments WHERE id = ?`, [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only comment owner or admin can delete
    const columns = existing[0].columns;
    const comment = mapRow(columns, existing[0].values[0]);

    if (comment.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    db.run(`DELETE FROM comments WHERE id = ?`, [id]);
    saveDB();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};
