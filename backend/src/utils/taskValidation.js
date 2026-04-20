const VALID_STATUSES = ['pending', 'in_progress', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

const normalizeAssigneeIds = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [];
  const seen = new Set();

  for (const item of value) {
    const parsed = normalizeAssigneeId(item);
    if (Number.isNaN(parsed)) {
      return null;
    }

    if (parsed !== null && !seen.has(parsed)) {
      seen.add(parsed);
      normalized.push(parsed);
    }
  }

  return normalized;
};

const validateTaskPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const task = {};

  const normalizedTitle = normalizeOptionalText(payload.title);
  if (!partial || payload.title !== undefined) {
    if (!normalizedTitle) {
      errors.push('Title is required');
    } else if (normalizedTitle.length > 160) {
      errors.push('Title must be 160 characters or less');
    } else {
      task.title = normalizedTitle;
    }
  }

  if (payload.description !== undefined) {
    const normalizedDescription = normalizeOptionalText(payload.description) ?? '';
    if (normalizedDescription && normalizedDescription.length > 2000) {
      errors.push('Description must be 2000 characters or less');
    } else {
      task.description = normalizedDescription;
    }
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

    if (dueDate && !DATE_REGEX.test(dueDate)) {
      errors.push('Invalid due date format. Use YYYY-MM-DD');
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

  if (payload.assignee_ids !== undefined) {
    const assigneeIds = normalizeAssigneeIds(payload.assignee_ids);

    if (assigneeIds === null) {
      errors.push('Invalid assignee_ids');
    } else {
      task.assignee_ids = assigneeIds;
      task.assignee_id = assigneeIds[0] ?? null;
    }
  }

  if (!partial) {
    if (task.description === undefined) task.description = '';
    if (task.status === undefined) task.status = 'pending';
    if (task.priority === undefined) task.priority = 'medium';
    if (task.assignee_ids === undefined) {
      task.assignee_ids = task.assignee_id ? [task.assignee_id] : [];
    }
    if (task.assignee_id === undefined) task.assignee_id = null;
    if (task.due_date === undefined) task.due_date = null;
  }

  return { errors, task };
};

const validateAssignmentPayload = (payload) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'assignee_ids') &&
      !Object.prototype.hasOwnProperty.call(payload, 'assignee_id')) {
    return { errors: ['assignee_ids is required'], assignment: null };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'assignee_ids')) {
    const assigneeIds = normalizeAssigneeIds(payload.assignee_ids);
    if (assigneeIds === null) {
      return { errors: ['Invalid assignee_ids'], assignment: null };
    }

    return {
      errors: [],
      assignment: {
        assignee_ids: assigneeIds,
        assignee_id: assigneeIds[0] ?? null
      }
    };
  }

  const assigneeId = normalizeAssigneeId(payload.assignee_id);
  if (Number.isNaN(assigneeId)) {
    return { errors: ['Invalid assignee_id'], assignment: null };
  }

  return {
    errors: [],
    assignment: {
      assignee_id: assigneeId,
      assignee_ids: assigneeId ? [assigneeId] : []
    }
  };
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateTaskPayload,
  validateAssignmentPayload
};
