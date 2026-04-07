const { getDB, saveDB } = require('../config/database');
const { createNotification } = require('./notificationController');
const { getRow, getRows } = require('../utils/sql');
const {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateTaskPayload,
  validateAssignmentPayload
} = require('../utils/taskValidation');

const TASK_SELECT = `SELECT t.*, u.first_name || ' ' || u.last_name as assignee_name,
                            c.first_name || ' ' || c.last_name as created_by_name
                     FROM tasks t
                     LEFT JOIN users u ON t.assignee_id = u.id
                     LEFT JOIN users c ON t.created_by = c.id`;

const getTaskByIdFromDb = async (db, id) => getRow(db, `${TASK_SELECT} WHERE t.id = ?`, [id]);

const getAssignableEmployee = async (db, assigneeId) => {
  if (assigneeId === null || assigneeId === undefined) {
    return null;
  }

  return getRow(
    db,
    `SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 'employee'`,
    [assigneeId]
  );
};

const validateAssignee = async (db, assigneeId) => {
  if (assigneeId === null || assigneeId === undefined) {
    return { employee: null };
  }

  const employee = await getAssignableEmployee(db, assigneeId);
  if (!employee) {
    return { error: 'Assigned user must be an existing employee' };
  }

  return { employee };
};

exports.getAllTasks = async (req, res) => {
  try {
    const db = await getDB();
    const { status, priority, assignee_id } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority filter' });
    }

    let query = `${TASK_SELECT} WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (assignee_id) {
      query += ` AND t.assignee_id = ?`;
      params.push(assignee_id);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tasks = await getRows(db, query, params);
    if (tasks.length === 0) {
      return res.json({ tasks: [] });
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const task = await getTaskByIdFromDb(db, id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const db = await getDB();
    const { errors, task } = validateTaskPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const { error: assigneeError } = await validateAssignee(db, task.assignee_id);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    const created_by = req.user.id;

    const result = await db.run(
      `INSERT INTO tasks (title, description, status, priority, assignee_id, created_by, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [task.title, task.description, task.status, task.priority, task.assignee_id, created_by, task.due_date]
    );

    const taskId = result.rows[0].id;

    // Create notification for assignee
    if (task.assignee_id) {
      await createNotification(
        db,
        task.assignee_id,
        'New Task Assigned',
        `You have been assigned a new task: ${task.title}`,
        'task'
      );
    }

    await saveDB();

    const createdTask = await getTaskByIdFromDb(db, taskId);
    res.status(201).json({ task: createdTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const current = await getRow(db, `SELECT * FROM tasks WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { errors, task } = validateTaskPayload(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const nextTask = {
      title: task.title ?? current.title,
      description: task.description ?? current.description,
      status: task.status ?? current.status,
      priority: task.priority ?? current.priority,
      assignee_id: task.assignee_id !== undefined ? task.assignee_id : current.assignee_id,
      due_date: task.due_date !== undefined ? task.due_date : current.due_date
    };

    const { error: assigneeError } = await validateAssignee(db, nextTask.assignee_id);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    await db.run(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextTask.title, nextTask.description, nextTask.status, nextTask.priority, nextTask.assignee_id, nextTask.due_date, id]
    );

    // Notify if assignee changed
    if (nextTask.assignee_id && nextTask.assignee_id !== current.assignee_id) {
      await createNotification(
        db,
        nextTask.assignee_id,
        'New Task Assigned',
        `You have been assigned a task: ${nextTask.title}`,
        'task'
      );
    }

    // Notify if status changed
    if (nextTask.status !== current.status && nextTask.assignee_id) {
      await createNotification(
        db,
        nextTask.assignee_id,
        'Task Status Updated',
        `Your task "${nextTask.title}" status changed to ${nextTask.status}`,
        'update'
      );
    }

    await saveDB();

    const updatedTask = await getTaskByIdFromDb(db, id);
    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

exports.assignTask = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { errors, assignment } = validateAssignmentPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const current = await getRow(db, `SELECT * FROM tasks WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { error: assigneeError } = await validateAssignee(db, assignment.assignee_id);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    await db.run(
      `UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [assignment.assignee_id, id]
    );

    if (assignment.assignee_id && assignment.assignee_id !== current.assignee_id) {
      await createNotification(
        db,
        assignment.assignee_id,
        'New Task Assigned',
        `You have been assigned a task: ${current.title}`,
        'task'
      );
    }

    await saveDB();

    const task = await getTaskByIdFromDb(db, id);
    res.json({ task });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const existing = await getRow(db, `SELECT id FROM tasks WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
    await saveDB();

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const db = await getDB();
    const userId = req.user.id;
    const { status } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    let query = `${TASK_SELECT} WHERE t.assignee_id = ?`;
    const params = [userId];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tasks = await getRows(db, query, params);
    if (tasks.length === 0) {
      return res.json({ tasks: [] });
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.updateMyTaskStatus = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if task exists and is assigned to this user
    const current = await getRow(db, `SELECT * FROM tasks WHERE id = ? AND assignee_id = ?`, [id, userId]);
    if (!current) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }

    await db.run(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);

    // Notify task creator about status change
    if (current.created_by && current.created_by !== userId) {
      await createNotification(
        db,
        current.created_by,
        'Task Status Updated',
        `Task "${current.title}" status changed to ${status} by assignee`,
        'update'
      );
    }

    await saveDB();

    const task = await getTaskByIdFromDb(db, id);
    res.json({ task });
  } catch (error) {
    console.error('Update my task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
};

// Analytics endpoints
exports.getAnalytics = async (req, res) => {
  try {
    const db = await getDB();

    // Total tasks
    const totalTasks = await getRow(db, `SELECT COUNT(*)::int as count FROM tasks`);
    const assignedTasks = await getRow(db, `SELECT COUNT(*)::int as count FROM tasks WHERE assignee_id IS NOT NULL`);
    const pendingTasks = await getRow(db, `SELECT COUNT(*)::int as count FROM tasks WHERE status = 'pending'`);
    const inProgressTasks = await getRow(db, `SELECT COUNT(*)::int as count FROM tasks WHERE status = 'in_progress'`);
    const completedTasks = await getRow(db, `SELECT COUNT(*)::int as count FROM tasks WHERE status = 'completed'`);

    // Tasks by priority
    const tasksByPriority = await getRows(db, `SELECT priority, COUNT(*)::int as count FROM tasks GROUP BY priority`);

    // Tasks per employee
    const tasksPerEmployee = await getRows(
      db,
      `SELECT u.id, u.first_name || ' ' || u.last_name as name,
              COUNT(t.id)::int as total_tasks,
              COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed
       FROM users u
       LEFT JOIN tasks t ON u.id = t.assignee_id
       WHERE u.role = 'employee'
       GROUP BY u.id
       ORDER BY name ASC`
    );

    // Recent activity
    const recentTasks = await getRows(
      db,
      `SELECT t.*, u.first_name || ' ' || u.last_name as assignee_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       ORDER BY t.updated_at DESC LIMIT 10`
    );

    const analytics = {
      totalTasks: totalTasks?.count || 0,
      assignedTasks: assignedTasks?.count || 0,
      pendingTasks: pendingTasks?.count || 0,
      inProgressTasks: inProgressTasks?.count || 0,
      completedTasks: completedTasks?.count || 0,
      tasksByPriority,
      tasksPerEmployee: tasksPerEmployee.map((employee) => ({
        id: employee.id,
        name: employee.name,
        totalTasks: employee.total_tasks,
        completed: employee.completed
      })),
      recentTasks
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
