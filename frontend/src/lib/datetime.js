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
