const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { isPlainObject, toPositiveInt, normalizeOptionalText } = require('../utils/validation');
const { createNotification } = require('./notificationController');

const canUserAccessTask = async (db, taskId, user) => {
  if (user.role === 'admin') {
    return true;
  }

  const assignment = await getRow(
    db,
    `SELECT 1
     FROM task_assignments
     WHERE task_id = ? AND user_id = ?
     LIMIT 1`,
    [taskId, user.id]
  );

  return Boolean(assignment);
};

exports.getComments = async (req, res) => {
  try {
    const db = await getDB();
    const taskId = toPositiveInt(req.query.task_id);

    if (!taskId) {
      return res.status(400).json({ error: 'task_id is required' });
    }

    if (!(await canUserAccessTask(db, taskId, req.user))) {
      return res.status(403).json({ error: 'Not authorized to view comments for this task' });
    }

    const comments = await getRows(
      db,
      `SELECT c.*, u.first_name || ' ' || u.last_name as user_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

exports.addComment = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const taskId = toPositiveInt(req.body.task_id);
    const contentCheck = normalizeOptionalText(req.body.content, { maxLength: 1000 });
    const user_id = req.user.id;

    if (contentCheck.error) {
      return res.status(400).json({ error: contentCheck.error });
    }

    if (!taskId || !contentCheck.value) {
      return res.status(400).json({ error: 'task_id and content are required' });
    }

    // Verify task exists
    const taskCheck = await getRow(
      db,
      `SELECT id, title, created_by FROM tasks WHERE id = ?`,
      [taskId]
    );
    if (!taskCheck) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await canUserAccessTask(db, taskId, req.user))) {
      return res.status(403).json({ error: 'Not authorized to comment on this task' });
    }

    const insertResult = await db.run(
      `INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?) RETURNING id`,
      [taskId, user_id, contentCheck.value]
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

    const assignees = await getRows(
      db,
      `SELECT user_id FROM task_assignments WHERE task_id = ?`,
      [taskId]
    );
    const notifyUserIds = new Set();

    if (taskCheck.created_by && taskCheck.created_by !== user_id) {
      notifyUserIds.add(taskCheck.created_by);
    }

    assignees.forEach((assignee) => {
      if (assignee.user_id !== user_id) {
        notifyUserIds.add(assignee.user_id);
      }
    });

    for (const recipientId of notifyUserIds) {
      await createNotification(
        db,
        recipientId,
        'New Task Comment',
        `${comment.user_name} commented on "${taskCheck.title}": ${contentCheck.value.slice(0, 120)}`,
        'mention'
      );
    }

    await saveDB();

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const user_id = req.user.id;

    if (!id) {
      return res.status(400).json({ error: 'Invalid comment id' });
    }

    const comment = await getRow(db, `SELECT * FROM comments WHERE id = ?`, [id]);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (!(await canUserAccessTask(db, comment.task_id, req.user))) {
      return res.status(403).json({ error: 'Not authorized to modify comments for this task' });
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
