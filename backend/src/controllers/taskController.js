const { getDB, saveDB } = require('../config/database');
const { createNotification } = require('./notificationController');
const { awardPoints, awardBadges } = require('../services/gamificationService');
const {
  sendTaskAssignmentEmail,
  sendTaskUpdateEmail,
  sendTaskProgressEmail
} = require('../services/emailService');
const { getRow, getRows } = require('../utils/sql');
const {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateTaskPayload,
  validateAssignmentPayload
} = require('../utils/taskValidation');
const { isPlainObject, toPositiveInt, normalizeOptionalText } = require('../utils/validation');

const TASK_SELECT = `
  SELECT
    t.*,
    COALESCE(assignments.assignee_ids, ARRAY[]::INTEGER[]) as assignee_ids,
    COALESCE(assignments.assignee_names, '') as assignee_names,
    NULLIF(COALESCE(assignments.assignee_names, ''), '') as assignee_name,
    COALESCE(assignments.assignee_statuses, '[]'::json) as assignee_statuses,
    c.first_name || ' ' || c.last_name as created_by_name,
    latest_comments.latest_comment,
    latest_comments.latest_comment_at,
    latest_comments.latest_comment_by
  FROM tasks t
  LEFT JOIN (
    SELECT
      ta.task_id,
      ARRAY_AGG(ta.user_id ORDER BY ta.user_id) as assignee_ids,
      STRING_AGG(u.first_name || ' ' || u.last_name, ', ' ORDER BY u.first_name, u.last_name) as assignee_names,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'user_id', ta.user_id,
          'name', u.first_name || ' ' || u.last_name,
          'status', ta.status
        )
        ORDER BY u.first_name, u.last_name
      ) as assignee_statuses
    FROM task_assignments ta
    INNER JOIN users u ON u.id = ta.user_id
    GROUP BY ta.task_id
  ) assignments ON assignments.task_id = t.id
  LEFT JOIN users c ON t.created_by = c.id
  LEFT JOIN (
    SELECT
      latest.task_id,
      latest.content as latest_comment,
      latest.created_at as latest_comment_at,
      u.first_name || ' ' || u.last_name as latest_comment_by
    FROM (
      SELECT DISTINCT ON (c.task_id)
        c.task_id,
        c.content,
        c.created_at,
        c.user_id
      FROM comments c
      ORDER BY c.task_id, c.created_at DESC, c.id DESC
    ) latest
    LEFT JOIN users u ON u.id = latest.user_id
  ) latest_comments ON latest_comments.task_id = t.id
`;

const getTaskByIdFromDb = async (db, id) => getRow(db, `${TASK_SELECT} WHERE t.id = ?`, [id]);
const getTaskAssignmentRows = async (db, taskId) => getRows(
  db,
  `SELECT ta.user_id, ta.status
   FROM task_assignments ta
   WHERE ta.task_id = ?
   ORDER BY ta.user_id`,
  [taskId]
);
const getUserDisplayName = async (db, userId) => {
  const user = await getRow(
    db,
    `SELECT first_name, last_name FROM users WHERE id = ?`,
    [userId]
  );

  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Admin';
};

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

const getAssignableUsers = async (db, assigneeIds) => {
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    return [];
  }

  return getRows(
    db,
    `SELECT id, first_name, last_name
     FROM users
     WHERE id = ANY(?::int[])
     ORDER BY first_name ASC, last_name ASC`,
    [assigneeIds]
  );
};

const getAssigneeContacts = async (db, assigneeIds) => {
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    return [];
  }

  return getRows(
    db,
    `SELECT id, email, first_name, last_name
     FROM users
     WHERE id = ANY(?::int[])
     ORDER BY first_name ASC, last_name ASC`,
    [assigneeIds]
  );
};

const getUserContacts = async (db, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  return getRows(
    db,
    `SELECT id, email, first_name, last_name, role
     FROM users
     WHERE id = ANY(?::int[])
     ORDER BY first_name ASC, last_name ASC`,
    [userIds]
  );
};

const validateAssignees = async (db, assigneeIds) => {
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    return { users: [] };
  }

  const users = await getAssignableUsers(db, assigneeIds);
  if (users.length !== assigneeIds.length) {
    return { error: 'Assigned users must be existing users' };
  }

  return { users };
};

const syncTaskAssignments = async (db, taskId, assigneeIds) => {
  const existingAssignments = await getRows(
    db,
    `SELECT user_id, status FROM task_assignments WHERE task_id = ?`,
    [taskId]
  );
  const statusByUserId = new Map(existingAssignments.map((row) => [row.user_id, row.status]));

  await db.run(`DELETE FROM task_assignments WHERE task_id = ?`, [taskId]);
  for (const userId of assigneeIds) {
    await db.run(
      `INSERT INTO task_assignments (task_id, user_id, status, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (task_id, user_id) DO NOTHING`,
      [taskId, userId, statusByUserId.get(userId) || 'pending']
    );
  }
};

const syncAssignmentStatuses = async (db, taskId, status) => {
  await db.run(
    `UPDATE task_assignments
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`,
    [status, taskId]
  );
};

const notifyUsers = async (db, userIds, title, message, type = 'info') => {
  for (const userId of userIds) {
    await createNotification(db, userId, title, message, type);
  }
};

const emailUsersAboutAssignment = async (db, userIds, taskTitle, dueDate, assignedByName) => {
  const contacts = await getAssigneeContacts(db, userIds);

  await Promise.all(
    contacts.map(async (contact) => {
      try {
        await sendTaskAssignmentEmail({
          to: contact.email,
          assigneeName: `${contact.first_name} ${contact.last_name}`.trim(),
          taskTitle,
          dueDate,
          assignedByName
        });
      } catch (error) {
        console.error(`Task assignment email failed for ${contact.email}:`, error.message);
      }
    })
  );
};

const emailUsersAboutTaskUpdate = async (db, userIds, taskTitle, dueDate, updatedByName, status, changeSummary) => {
  const contacts = await getUserContacts(db, userIds);

  await Promise.all(
    contacts.map(async (contact) => {
      try {
        await sendTaskUpdateEmail({
          to: contact.email,
          recipientName: `${contact.first_name} ${contact.last_name}`.trim(),
          taskTitle,
          updatedByName,
          status,
          dueDate,
          changeSummary
        });
      } catch (error) {
        console.error(`Task update email failed for ${contact.email}:`, error.message);
      }
    })
  );
};

const emailUsersAboutTaskProgress = async (
  db,
  userIds,
  taskTitle,
  actorName,
  assigneeStatus,
  overallStatus,
  comment
) => {
  const contacts = await getUserContacts(db, userIds);

  await Promise.all(
    contacts.map(async (contact) => {
      try {
        await sendTaskProgressEmail({
          to: contact.email,
          recipientName: `${contact.first_name} ${contact.last_name}`.trim(),
          taskTitle,
          actorName,
          assigneeStatus,
          overallStatus,
          comment
        });
      } catch (error) {
        console.error(`Task progress email failed for ${contact.email}:`, error.message);
      }
    })
  );
};

const buildTaskChangeSummary = (current, nextTask, newAssigneeIds, removedAssigneeIds, nextStatus) => {
  const changes = [];

  if (current.title !== nextTask.title) {
    changes.push(`Title: ${current.title} -> ${nextTask.title}`);
  }
  if ((current.description || '') !== (nextTask.description || '')) {
    changes.push('Description updated');
  }
  if (current.priority !== nextTask.priority) {
    changes.push(`Priority: ${current.priority} -> ${nextTask.priority}`);
  }
  if ((current.due_date || '') !== (nextTask.due_date || '')) {
    changes.push(`Due date: ${current.due_date || 'Not set'} -> ${nextTask.due_date || 'Not set'}`);
  }
  if (current.status !== nextStatus) {
    changes.push(`Status: ${current.status} -> ${nextStatus}`);
  }
  if (newAssigneeIds.length > 0) {
    changes.push(`${newAssigneeIds.length} assignee(s) added`);
  }
  if (removedAssigneeIds.length > 0) {
    changes.push(`${removedAssigneeIds.length} assignee(s) removed`);
  }

  return changes[0] || 'Task details were updated';
};

const normalizeTaskAssignees = (task) => ({
  ...task,
  assignee_ids: Array.isArray(task.assignee_ids) ? task.assignee_ids : [],
  assignee_statuses: Array.isArray(task.assignee_statuses) ? task.assignee_statuses : [],
  my_status: task.my_status || null
});

const normalizeTaskForViewer = (task, viewerId) => {
  const normalizedTask = normalizeTaskAssignees(task);

  if (!normalizedTask.my_status && viewerId) {
    const ownAssignment = normalizedTask.assignee_statuses.find((assignee) => assignee.user_id === viewerId);
    normalizedTask.my_status = ownAssignment?.status || null;
  }

  return normalizedTask;
};

const deriveTaskStatus = (assignmentRows, fallbackStatus = 'pending') => {
  if (!assignmentRows.length) {
    return fallbackStatus;
  }

  const statuses = assignmentRows.map((row) => row.status);
  if (statuses.every((status) => status === 'completed')) {
    return 'completed';
  }

  if (statuses.every((status) => status === 'pending')) {
    return 'pending';
  }

  return 'in_progress';
};

const syncTaskDerivedStatus = async (db, taskId, fallbackStatus = 'pending') => {
  const assignmentRows = await getTaskAssignmentRows(db, taskId);
  const nextStatus = deriveTaskStatus(assignmentRows, fallbackStatus);
  const primaryAssigneeId = assignmentRows[0]?.user_id || null;

  await db.run(
    `UPDATE tasks
     SET status = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStatus, primaryAssigneeId, taskId]
  );

  return nextStatus;
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
      query += ` AND EXISTS (
        SELECT 1 FROM task_assignments ta
        WHERE ta.task_id = t.id AND ta.user_id = ?
      )`;
      params.push(assignee_id);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tasks = await getRows(db, query, params);
    if (tasks.length === 0) {
      return res.json({ tasks: [] });
    }

    res.json({ tasks: tasks.map((task) => normalizeTaskForViewer(task, req.user.id)) });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const db = await getDB();
    const id = toPositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const task = await getTaskByIdFromDb(db, id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await canUserAccessTask(db, id, req.user))) {
      return res.status(403).json({ error: 'Not authorized to view this task' });
    }

    res.json({ task: normalizeTaskForViewer(task, req.user.id) });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

exports.createTask = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const { errors, task } = validateTaskPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const { error: assigneeError } = await validateAssignees(db, task.assignee_ids);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    const created_by = req.user.id;
    const assignedByName = await getUserDisplayName(db, req.user.id);

    const initialStatus = task.assignee_ids.length > 0 ? deriveTaskStatus(
      task.assignee_ids.map((userId) => ({ user_id: userId, status: 'pending' })),
      task.status
    ) : task.status;

    const result = await db.run(
      `INSERT INTO tasks (title, description, status, priority, assignee_id, created_by, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [task.title, task.description, initialStatus, task.priority, task.assignee_id, created_by, task.due_date]
    );

    const taskId = result.rows[0].id;
    await syncTaskAssignments(db, taskId, task.assignee_ids);
    await syncTaskDerivedStatus(db, taskId, initialStatus);

    if (task.assignee_ids.length > 0) {
      await notifyUsers(
        db,
        task.assignee_ids,
        'New Task Assigned',
        `You have been assigned a new task: ${task.title}`,
        'task'
      );
      await emailUsersAboutAssignment(db, task.assignee_ids, task.title, task.due_date, assignedByName);
    }

    await saveDB();

    const createdTask = await getTaskByIdFromDb(db, taskId);
    res.status(201).json({ task: normalizeTaskForViewer(createdTask, req.user.id) });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const id = toPositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

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
      assignee_ids: task.assignee_ids !== undefined
        ? task.assignee_ids
        : (await getRows(db, `SELECT user_id FROM task_assignments WHERE task_id = ? ORDER BY user_id`, [id]))
          .map((row) => row.user_id),
      assignee_id: task.assignee_ids !== undefined
        ? (task.assignee_ids[0] ?? null)
        : (task.assignee_id !== undefined ? task.assignee_id : current.assignee_id),
      due_date: task.due_date !== undefined ? task.due_date : current.due_date
    };

    if (task.assignee_id !== undefined && task.assignee_ids === undefined) {
      nextTask.assignee_ids = nextTask.assignee_id ? [nextTask.assignee_id] : [];
    }

    const currentAssigneeRows = await getRows(
      db,
      `SELECT user_id FROM task_assignments WHERE task_id = ? ORDER BY user_id`,
      [id]
    );
    const currentAssigneeIds = currentAssigneeRows.map((row) => row.user_id);

    const { error: assigneeError } = await validateAssignees(db, nextTask.assignee_ids);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    const isStatusManuallyUpdated = task.status !== undefined;
    const fallbackStatus = isStatusManuallyUpdated ? nextTask.status : current.status;

    await db.run(
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextTask.title, nextTask.description, nextTask.priority, nextTask.due_date, id]
    );
    await syncTaskAssignments(db, id, nextTask.assignee_ids);
    if (nextTask.assignee_ids.length > 0 && isStatusManuallyUpdated) {
      await syncAssignmentStatuses(db, id, nextTask.status);
    }
    const derivedStatus = await syncTaskDerivedStatus(db, id, fallbackStatus);

    const newAssigneeIds = nextTask.assignee_ids.filter((assigneeId) => !currentAssigneeIds.includes(assigneeId));
    const removedAssigneeIds = currentAssigneeIds.filter((assigneeId) => !nextTask.assignee_ids.includes(assigneeId));
    const assignedByName = await getUserDisplayName(db, req.user.id);
    const recipientsForUpdateEmail = nextTask.assignee_ids.filter((assigneeId) => !newAssigneeIds.includes(assigneeId));
    const changeSummary = buildTaskChangeSummary(
      current,
      nextTask,
      newAssigneeIds,
      removedAssigneeIds,
      derivedStatus
    );

    if (newAssigneeIds.length > 0) {
      await notifyUsers(
        db,
        newAssigneeIds,
        'New Task Assigned',
        `You have been assigned a task: ${nextTask.title}`,
        'task'
      );
      await emailUsersAboutAssignment(db, newAssigneeIds, nextTask.title, nextTask.due_date, assignedByName);
    }

    if (recipientsForUpdateEmail.length > 0) {
      await emailUsersAboutTaskUpdate(
        db,
        recipientsForUpdateEmail,
        nextTask.title,
        nextTask.due_date,
        assignedByName,
        derivedStatus,
        changeSummary
      );
    }

    if (derivedStatus !== current.status && nextTask.assignee_ids.length > 0) {
      await notifyUsers(
        db,
        nextTask.assignee_ids,
        'Task Status Updated',
        `Your task "${nextTask.title}" status changed to ${derivedStatus}`,
        'update'
      );
    }

    await saveDB();

    const updatedTask = await getTaskByIdFromDb(db, id);
    res.json({ task: normalizeTaskForViewer(updatedTask, req.user.id) });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

exports.assignTask = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const { errors, assignment } = validateAssignmentPayload(req.body);

    if (!id) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const current = await getRow(db, `SELECT * FROM tasks WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentAssigneeRows = await getRows(
      db,
      `SELECT user_id FROM task_assignments WHERE task_id = ? ORDER BY user_id`,
      [id]
    );
    const currentAssigneeIds = currentAssigneeRows.map((row) => row.user_id);

    const { error: assigneeError } = await validateAssignees(db, assignment.assignee_ids);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    await syncTaskAssignments(db, id, assignment.assignee_ids);
    await syncTaskDerivedStatus(db, id, current.status);

    const newAssigneeIds = assignment.assignee_ids.filter((assigneeId) => !currentAssigneeIds.includes(assigneeId));
    const assignedByName = await getUserDisplayName(db, req.user.id);
    if (newAssigneeIds.length > 0) {
      await notifyUsers(
        db,
        newAssigneeIds,
        'New Task Assigned',
        `You have been assigned a task: ${current.title}`,
        'task'
      );
      await emailUsersAboutAssignment(db, newAssigneeIds, current.title, current.due_date, assignedByName);
    }

    await saveDB();

    const task = await getTaskByIdFromDb(db, id);
    res.json({ task: normalizeTaskForViewer(task, req.user.id) });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const db = await getDB();
    const id = toPositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

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

    let query = `
      SELECT task_view.*, my_assignments.status as my_status
      FROM (${TASK_SELECT}) task_view
      INNER JOIN task_assignments my_assignments ON my_assignments.task_id = task_view.id
      WHERE my_assignments.user_id = ?`;
    const params = [userId];

    if (status) {
      query += ` AND my_assignments.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY task_view.created_at DESC`;

    const tasks = await getRows(db, query, params);
    if (tasks.length === 0) {
      return res.json({ tasks: [] });
    }

    res.json({ tasks: tasks.map((task) => normalizeTaskForViewer(task, userId)) });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.updateMyTaskStatus = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const id = toPositiveInt(req.params.id);
    const { status } = req.body;
    const commentCheck = normalizeOptionalText(req.body.comment, { maxLength: 1000 });
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (commentCheck.error) {
      return res.status(400).json({ error: commentCheck.error });
    }

    if (status === 'completed' && !commentCheck.value) {
      return res.status(400).json({ error: 'Completion note is required when marking a task as completed' });
    }

    // Check if task exists and is assigned to this user
    const current = await getRow(
      db,
      `SELECT t.*, ta.status as assignment_status, u.first_name, u.last_name
       FROM tasks t
       INNER JOIN task_assignments ta ON ta.task_id = t.id
       INNER JOIN users u ON u.id = ta.user_id
       WHERE t.id = ? AND ta.user_id = ?`,
      [id, userId]
    );
    if (!current) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }

    await db.run(
      `UPDATE task_assignments
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ? AND user_id = ?`,
      [status, id, userId]
    );

    if (commentCheck.value) {
      await db.run(
        `INSERT INTO comments (task_id, user_id, content)
         VALUES (?, ?, ?)`,
        [id, userId, commentCheck.value]
      );
    }

    const derivedStatus = await syncTaskDerivedStatus(db, id, current.status);
    const actorName = `${current.first_name || ''} ${current.last_name || ''}`.trim() || 'Assignee';

    if (current.assignment_status !== 'completed' && status === 'completed') {
      await awardPoints(db, userId, {
        eventType: 'task_completed',
        points: 20,
        referenceType: 'task_assignment',
        referenceId: id
      });
      await awardBadges(db, userId);
    }

    // Notify task creator about status change
    const notifyUserIds = new Set();
    if (current.created_by && current.created_by !== userId) {
      notifyUserIds.add(current.created_by);
    }
    const teammateAssignments = await getTaskAssignmentRows(db, id);
    teammateAssignments.forEach((assignment) => {
      if (assignment.user_id !== userId) {
        notifyUserIds.add(assignment.user_id);
      }
    });

    for (const recipientId of notifyUserIds) {
      await createNotification(
        db,
        recipientId,
        recipientId === current.created_by ? 'Task Status Updated' : 'Assignee Progress Updated',
        recipientId === current.created_by
          ? `Task "${current.title}" progress updated to ${status} by assignee. Overall task status is now ${derivedStatus}.`
          : `A teammate updated "${current.title}" to ${status}. Overall task status is ${derivedStatus}.`,
        'update'
      );
    }

    if (notifyUserIds.size > 0) {
      await emailUsersAboutTaskProgress(
        db,
        Array.from(notifyUserIds),
        current.title,
        actorName,
        status,
        derivedStatus,
        commentCheck.value || null
      );
    }

    await saveDB();

    const task = await getTaskByIdFromDb(db, id);
    task.my_status = status;
    res.json({ task: normalizeTaskForViewer(task, userId) });
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
    const assignedTasks = await getRow(
      db,
      `SELECT COUNT(DISTINCT task_id)::int as count FROM task_assignments`
    );
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
              COALESCE(SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed
       FROM users u
       LEFT JOIN task_assignments ta ON u.id = ta.user_id
       LEFT JOIN tasks t ON ta.task_id = t.id
       WHERE u.role = 'employee'
       GROUP BY u.id
       ORDER BY name ASC`
    );

    // Recent activity
    const recentTasks = await getRows(
      db,
       `SELECT t.*, COALESCE(assignments.assignee_names, '') as assignee_names,
               NULLIF(COALESCE(assignments.assignee_names, ''), '') as assignee_name
       FROM tasks t
       LEFT JOIN (
         SELECT
           ta.task_id,
           STRING_AGG(u.first_name || ' ' || u.last_name, ', ' ORDER BY u.first_name, u.last_name) as assignee_names
         FROM task_assignments ta
         INNER JOIN users u ON u.id = ta.user_id
         GROUP BY ta.task_id
       ) assignments ON assignments.task_id = t.id
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
      recentTasks: recentTasks.map(normalizeTaskAssignees)
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
