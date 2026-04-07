const VALID_STATUSES = ['pending', 'in_progress', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const normalizeOptionalText = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return String(value).trim();
};

const normalizeAssigneeId = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const validateTaskPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const task = {};

  const normalizedTitle = normalizeOptionalText(payload.title);
  if (!partial || payload.title !== undefined) {
    if (!normalizedTitle) {
      errors.push('Title is required');
    } else {
      task.title = normalizedTitle;
    }
  }

  if (payload.description !== undefined) {
    task.description = normalizeOptionalText(payload.description) ?? '';
  }

  if (payload.status !== undefined) {
    if (!VALID_STATUSES.includes(payload.status)) {
      errors.push('Invalid status');
    } else {
      task.status = payload.status;
    }
  }

  if (payload.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(payload.priority)) {
      errors.push('Invalid priority');
    } else {
      task.priority = payload.priority;
    }
  }

  if (payload.due_date !== undefined) {
    const dueDate = normalizeOptionalText(payload.due_date);

    if (dueDate && Number.isNaN(Date.parse(dueDate))) {
      errors.push('Invalid due date');
    } else {
      task.due_date = dueDate || null;
    }
  }

  if (payload.assignee_id !== undefined) {
    const assigneeId = normalizeAssigneeId(payload.assignee_id);

    if (Number.isNaN(assigneeId)) {
      errors.push('Invalid assignee_id');
    } else {
      task.assignee_id = assigneeId;
    }
  }

  if (!partial) {
    if (task.description === undefined) task.description = '';
    if (task.status === undefined) task.status = 'pending';
    if (task.priority === undefined) task.priority = 'medium';
    if (task.assignee_id === undefined) task.assignee_id = null;
    if (task.due_date === undefined) task.due_date = null;
  }

  return { errors, task };
};

const validateAssignmentPayload = (payload) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'assignee_id')) {
    return { errors: ['assignee_id is required'], assignment: null };
  }

  const assigneeId = normalizeAssigneeId(payload.assignee_id);
  if (Number.isNaN(assigneeId)) {
    return { errors: ['Invalid assignee_id'], assignment: null };
  }

  return {
    errors: [],
    assignment: {
      assignee_id: assigneeId
    }
  };
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateTaskPayload,
  validateAssignmentPayload
};
