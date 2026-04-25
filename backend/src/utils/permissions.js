const { getRow, getRows } = require('./sql');

const USER_ROLES = ['admin', 'manager', 'employee'];

const getManagedUsers = async (db, managerId) => getRows(
  db,
  `SELECT u.id, u.email, u.role, u.first_name, u.last_name
   FROM employee_profiles ep
   INNER JOIN users u ON u.id = ep.user_id
   WHERE ep.manager_id = ?
   ORDER BY u.first_name ASC, u.last_name ASC`,
  [managerId]
);

const getManagedUserIds = async (db, managerId) => {
  const users = await getManagedUsers(db, managerId);
  return users.map((user) => user.id);
};

const getTaskAccessContext = async (db, taskId, userId) => getRow(
  db,
  `SELECT
     t.id,
     t.created_by,
     EXISTS(
       SELECT 1
       FROM task_assignments ta
       WHERE ta.task_id = t.id
         AND ta.user_id = ?
     ) as is_directly_assigned,
     EXISTS(
       SELECT 1
       FROM task_assignments ta
       INNER JOIN employee_profiles ep ON ep.user_id = ta.user_id
       WHERE ta.task_id = t.id
         AND ep.manager_id = ?
     ) as has_managed_assignee
   FROM tasks t
   WHERE t.id = ?`,
  [userId, userId, taskId]
);

const canUserAccessTask = async (db, taskId, user) => {
  if (user.role === 'admin') {
    return true;
  }

  const context = await getTaskAccessContext(db, taskId, user.id);
  if (!context) {
    return false;
  }

  if (user.role === 'manager') {
    return Boolean(
      context.created_by === user.id ||
      context.is_directly_assigned ||
      context.has_managed_assignee
    );
  }

  return Boolean(context.is_directly_assigned);
};

const canUserManageTask = async (db, taskId, user) => {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role !== 'manager') {
    return false;
  }

  const task = await getRow(
    db,
    `SELECT id, created_by
     FROM tasks
     WHERE id = ?`,
    [taskId]
  );

  return Boolean(task && task.created_by === user.id);
};

const canAssignUsers = async (db, user, assigneeIds) => {
  if (user.role === 'admin') {
    return { allowed: true };
  }

  if (user.role !== 'manager') {
    return { allowed: false, error: 'Only admins or managers can assign tasks' };
  }

  const allowedIds = new Set([user.id, ...(await getManagedUserIds(db, user.id))]);
  const invalidIds = assigneeIds.filter((id) => !allowedIds.has(id));

  if (invalidIds.length > 0) {
    return {
      allowed: false,
      error: 'Managers can only assign tasks to themselves or their direct reports'
    };
  }

  return { allowed: true };
};

module.exports = {
  USER_ROLES,
  getManagedUsers,
  getManagedUserIds,
  canUserAccessTask,
  canUserManageTask,
  canAssignUsers
};
