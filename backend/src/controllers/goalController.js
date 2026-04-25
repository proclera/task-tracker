const { getDB, saveDB } = require('../config/database');
const { getRow, getRows } = require('../utils/sql');
const { isPlainObject, normalizeOptionalText, toPositiveInt } = require('../utils/validation');
const { createNotification } = require('./notificationController');

const VALID_PERIOD_TYPES = ['weekly', 'monthly', 'yearly'];
const VALID_METRIC_TYPES = ['assigned_tasks', 'completed_tasks'];

const toDateValue = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
};

const diffDaysInclusive = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
};

const clampDate = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const normalizeGoalPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const goal = {};

  if (payload.title !== undefined) {
    const title = String(payload.title || '').trim();
    if (!title) {
      errors.push('Title is required');
    } else if (title.length > 120) {
      errors.push('Title cannot exceed 120 characters');
    } else {
      goal.title = title;
    }
  } else if (!partial) {
    errors.push('Title is required');
  }

  if (payload.description !== undefined) {
    const descriptionCheck = normalizeOptionalText(payload.description, { maxLength: 500 });
    if (descriptionCheck.error) {
      errors.push(descriptionCheck.error);
    } else {
      goal.description = descriptionCheck.value || '';
    }
  } else if (!partial) {
    goal.description = '';
  }

  if (payload.period_type !== undefined) {
    if (!VALID_PERIOD_TYPES.includes(payload.period_type)) {
      errors.push('Invalid period_type');
    } else {
      goal.period_type = payload.period_type;
    }
  } else if (!partial) {
    errors.push('period_type is required');
  }

  if (payload.metric_type !== undefined) {
    if (!VALID_METRIC_TYPES.includes(payload.metric_type)) {
      errors.push('Invalid metric_type');
    } else {
      goal.metric_type = payload.metric_type;
    }
  } else if (!partial) {
    errors.push('metric_type is required');
  }

  if (payload.target_count !== undefined) {
    const targetCount = Number.parseInt(payload.target_count, 10);
    if (!Number.isInteger(targetCount) || targetCount <= 0) {
      errors.push('target_count must be a positive integer');
    } else {
      goal.target_count = targetCount;
    }
  } else if (!partial) {
    errors.push('target_count is required');
  }

  if (payload.start_date !== undefined) {
    const startDate = toDateValue(payload.start_date);
    if (!startDate) {
      errors.push('Invalid start_date');
    } else {
      goal.start_date = startDate;
    }
  } else if (!partial) {
    errors.push('start_date is required');
  }

  if (payload.end_date !== undefined) {
    const endDate = toDateValue(payload.end_date);
    if (!endDate) {
      errors.push('Invalid end_date');
    } else {
      goal.end_date = endDate;
    }
  } else if (!partial) {
    errors.push('end_date is required');
  }

  if (payload.is_active !== undefined) {
    goal.is_active = Boolean(payload.is_active);
  }

  if ((goal.start_date || payload.start_date !== undefined) &&
      (goal.end_date || payload.end_date !== undefined) &&
      goal.start_date &&
      goal.end_date &&
      goal.end_date < goal.start_date) {
    errors.push('end_date must be on or after start_date');
  }

  return { errors, goal };
};

const getGoalMetricCount = async (db, goal) => {
  if (goal.metric_type === 'assigned_tasks') {
    const row = await getRow(
      db,
      `SELECT COUNT(*)::int as count
       FROM task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       INNER JOIN users creator ON creator.id = t.created_by
       WHERE creator.role = 'admin'
         AND ta.created_at::date BETWEEN ? AND ?`,
      [goal.start_date, goal.end_date]
    );

    return row?.count || 0;
  }

  const row = await getRow(
    db,
    `SELECT COUNT(*)::int as count
     FROM task_assignments ta
     INNER JOIN tasks t ON t.id = ta.task_id
     INNER JOIN users creator ON creator.id = t.created_by
     WHERE creator.role = 'admin'
       AND ta.status = 'completed'
       AND ta.updated_at::date BETWEEN ? AND ?`,
    [goal.start_date, goal.end_date]
  );

  return row?.count || 0;
};

const enrichGoal = async (db, goal) => {
  const progressCount = await getGoalMetricCount(db, goal);
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = diffDaysInclusive(goal.start_date, goal.end_date);
  const elapsedDays = today < goal.start_date
    ? 0
    : diffDaysInclusive(goal.start_date, clampDate(today, goal.start_date, goal.end_date));
  const expectedProgress = today < goal.start_date
    ? 0
    : Math.ceil(goal.target_count * (elapsedDays / totalDays));
  const completionPercent = Math.min(100, Math.round((progressCount / goal.target_count) * 100));

  let status = 'on_track';
  if (!goal.is_active) {
    status = 'inactive';
  } else if (progressCount >= goal.target_count) {
    status = 'completed';
  } else if (today < goal.start_date) {
    status = 'upcoming';
  } else if (today > goal.end_date) {
    status = 'missed';
  } else if (progressCount < expectedProgress) {
    status = 'off_track';
  }

  return {
    ...goal,
    progress_count: progressCount,
    remaining_count: Math.max(0, goal.target_count - progressCount),
    completion_percent: completionPercent,
    expected_progress: expectedProgress,
    status
  };
};

const getGoalsWithProgress = async (db) => {
  const goals = await getRows(
    db,
    `SELECT
       g.*,
       u.first_name || ' ' || u.last_name as created_by_name
     FROM goals g
     INNER JOIN users u ON u.id = g.created_by
     ORDER BY g.end_date ASC, g.created_at DESC`
  );

  return Promise.all(goals.map((goal) => enrichGoal(db, goal)));
};

const createGoalNotificationIfNeeded = async (db, adminUserId, goal) => {
  if (goal.status !== 'off_track' && goal.status !== 'missed') {
    return;
  }

  const notificationType = goal.status === 'missed' ? 'goal_missed' : 'goal_off_track';
  const title = goal.status === 'missed'
    ? `Goal Missed: ${goal.title}`
    : `Goal Off Track: ${goal.title}`;
  const message = goal.status === 'missed'
    ? `The ${goal.period_type} goal "${goal.title}" closed at ${goal.progress_count}/${goal.target_count}.`
    : `The ${goal.period_type} goal "${goal.title}" is behind pace at ${goal.progress_count}/${goal.target_count}.`;

  const existing = await getRow(
    db,
    `SELECT id
     FROM notifications
     WHERE user_id = ?
       AND type = ?
       AND title = ?
       AND created_at::date = CURRENT_DATE
     LIMIT 1`,
    [adminUserId, notificationType, title]
  );

  if (!existing) {
    await createNotification(db, adminUserId, title, message, notificationType);
  }
};

const getAdminUserIds = async (db) => {
  const admins = await getRows(db, `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC`);
  return admins.map((admin) => admin.id);
};

const ensureGoalNotifications = async (db, adminUserId) => {
  const goals = await getGoalsWithProgress(db);

  for (const goal of goals) {
    await createGoalNotificationIfNeeded(db, adminUserId, goal);
  }

  await saveDB();

  return goals;
};

const evaluateGoalsForAdmins = async (db) => {
  const [adminUserIds, goals] = await Promise.all([
    getAdminUserIds(db),
    getGoalsWithProgress(db)
  ]);

  for (const adminUserId of adminUserIds) {
    for (const goal of goals) {
      await createGoalNotificationIfNeeded(db, adminUserId, goal);
    }
  }

  if (adminUserIds.length > 0) {
    await saveDB();
  }
};

exports.getGoals = async (req, res) => {
  try {
    const db = await getDB();
    const goals = await ensureGoalNotifications(db, req.user.id);
    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
};

exports.createGoal = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const { errors, goal } = normalizeGoalPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const result = await db.run(
      `INSERT INTO goals (
         title,
         description,
         period_type,
         metric_type,
         target_count,
         start_date,
         end_date,
         is_active,
         created_by
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        goal.title,
        goal.description || '',
        goal.period_type,
        goal.metric_type,
        goal.target_count,
        goal.start_date,
        goal.end_date,
        goal.is_active !== false,
        req.user.id
      ]
    );

    await saveDB();
    await evaluateGoalsForAdmins(db);

    const createdGoal = await getRow(
      db,
      `SELECT
         g.*,
         u.first_name || ' ' || u.last_name as created_by_name
       FROM goals g
       INNER JOIN users u ON u.id = g.created_by
       WHERE g.id = ?`,
      [result.rows[0].id]
    );

    res.status(201).json({ goal: await enrichGoal(db, createdGoal) });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const goalId = toPositiveInt(req.params.id);

    if (!goalId) {
      return res.status(400).json({ error: 'Invalid goal id' });
    }

    const currentGoal = await getRow(db, `SELECT * FROM goals WHERE id = ?`, [goalId]);
    if (!currentGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const { errors, goal } = normalizeGoalPayload(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const nextGoal = {
      title: goal.title ?? currentGoal.title,
      description: goal.description ?? currentGoal.description,
      period_type: goal.period_type ?? currentGoal.period_type,
      metric_type: goal.metric_type ?? currentGoal.metric_type,
      target_count: goal.target_count ?? currentGoal.target_count,
      start_date: goal.start_date ?? currentGoal.start_date,
      end_date: goal.end_date ?? currentGoal.end_date,
      is_active: goal.is_active ?? currentGoal.is_active
    };

    if (nextGoal.end_date < nextGoal.start_date) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }

    await db.run(
      `UPDATE goals
       SET title = ?,
           description = ?,
           period_type = ?,
           metric_type = ?,
           target_count = ?,
           start_date = ?,
           end_date = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextGoal.title,
        nextGoal.description,
        nextGoal.period_type,
        nextGoal.metric_type,
        nextGoal.target_count,
        nextGoal.start_date,
        nextGoal.end_date,
        nextGoal.is_active,
        goalId
      ]
    );

    await saveDB();
    await evaluateGoalsForAdmins(db);

    const updatedGoal = await getRow(
      db,
      `SELECT
         g.*,
         u.first_name || ' ' || u.last_name as created_by_name
       FROM goals g
       INNER JOIN users u ON u.id = g.created_by
       WHERE g.id = ?`,
      [goalId]
    );

    res.json({ goal: await enrichGoal(db, updatedGoal) });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const db = await getDB();
    const goalId = toPositiveInt(req.params.id);

    if (!goalId) {
      return res.status(400).json({ error: 'Invalid goal id' });
    }

    const existingGoal = await getRow(db, `SELECT id FROM goals WHERE id = ?`, [goalId]);
    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await db.run(`DELETE FROM goals WHERE id = ?`, [goalId]);
    await saveDB();

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
};

exports.ensureGoalNotifications = ensureGoalNotifications;
exports.evaluateGoalsForAdmins = evaluateGoalsForAdmins;
