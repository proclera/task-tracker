const formatEntityCode = (prefix, id) => {
  const numericId = Number.parseInt(id, 10);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return '';
  }

  return `${prefix}-${String(numericId).padStart(4, '0')}`;
};

export const formatTaskCode = (id) => formatEntityCode('TASK', id);
export const formatGoalCode = (id) => formatEntityCode('GOAL', id);
