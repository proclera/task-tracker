const SERVER_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export const parseServerDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string') {
    return new Date(value);
  }

  if (SERVER_TIMESTAMP_PATTERN.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }

  return new Date(value);
};

export const formatServerDateTime = (value, options) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleString(undefined, options) : '';
};

export const formatServerTime = (value, options) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleTimeString(undefined, options) : '';
};

export const formatDateLabel = (value, options) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleDateString(undefined, options) : '';
};

export const isDateOverdue = (value) => {
  const date = parseServerDate(value);
  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
};
