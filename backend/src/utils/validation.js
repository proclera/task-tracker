const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toTrimmedString = (value) => String(value ?? '').trim();

const normalizeEmail = (value) => toTrimmedString(value).toLowerCase();

const isValidEmail = (email) => EMAIL_REGEX.test(email);

const normalizeName = (value, { fieldName = 'name', maxLength = 60 } = {}) => {
  const normalized = toTrimmedString(value);

  if (!normalized) {
    return { error: `${fieldName} is required` };
  }

  if (normalized.length > maxLength) {
    return { error: `${fieldName} must be ${maxLength} characters or less` };
  }

  return { value: normalized };
};

const normalizePassword = (value, { minLength = 8, maxLength = 128 } = {}) => {
  const password = String(value ?? '');

  if (!password) {
    return { error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { error: `Password must be at least ${minLength} characters` };
  }

  if (password.length > maxLength) {
    return { error: `Password must be ${maxLength} characters or less` };
  }

  return { value: password };
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const normalizeOptionalText = (value, { maxLength = 1000 } = {}) => {
  if (value === undefined) {
    return { value: undefined };
  }

  if (value === null) {
    return { value: null };
  }

  const normalized = toTrimmedString(value);

  if (normalized.length > maxLength) {
    return { error: `Text must be ${maxLength} characters or less` };
  }

  return { value: normalized || null };
};

module.exports = {
  isPlainObject,
  normalizeEmail,
  isValidEmail,
  normalizeName,
  normalizePassword,
  toPositiveInt,
  normalizeOptionalText
};
