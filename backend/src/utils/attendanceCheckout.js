const ATTENDANCE_CHECKOUT_FIELDS = [
  {
    key: 'hunting',
    label: 'Hunting',
    type: 'number',
    min: 0,
    max: 50
  },
  {
    key: 'listing',
    label: 'Listing',
    type: 'number',
    min: 0,
    max: 50
  },
  {
    key: 'todays_orders',
    label: "Today's Order",
    type: 'number',
    min: 0,
    max: 50
  },
  {
    key: 'orders_processed',
    label: 'Order Processed',
    type: 'number',
    min: 0,
    max: 50
  },
  {
    key: 'todays_earning',
    label: "Today's Earning",
    type: 'decimal',
    min: 0,
    max: 100000000
  },
  {
    key: 'todays_spending',
    label: "Today's Spending",
    type: 'decimal',
    min: 0,
    max: 100000000
  },
  {
    key: 'messages_responded',
    label: 'Message Responded',
    type: 'boolean_choice',
    options: ['yes', 'no']
  },
  {
    key: 'other_task',
    label: 'Other Task',
    type: 'text',
    maxLength: 400
  }
];

const FIELD_MAP = new Map(ATTENDANCE_CHECKOUT_FIELDS.map((field) => [field.key, field]));

const normalizeAssignedFieldKeys = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => String(item || '').trim())
      .filter((key) => FIELD_MAP.has(key))
  )];
};

const validateCheckoutDetails = (value, assignedFieldKeys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Invalid checkout details' };
  }

  const normalizedKeys = normalizeAssignedFieldKeys(assignedFieldKeys);
  const details = {};

  for (const key of normalizedKeys) {
    const field = FIELD_MAP.get(key);

    if (!field) {
      continue;
    }

    if (field.type === 'number') {
      const rawValue = String(value[key] ?? '').trim();
      const parsed = Number(rawValue);

      if (!Number.isInteger(parsed) || parsed < field.min || parsed > field.max) {
        return { error: `${field.label} must be a whole number between ${field.min} and ${field.max}` };
      }

      details[key] = parsed;
      continue;
    }

    if (field.type === 'decimal') {
      const rawValue = String(value[key] ?? '').trim();
      const parsed = Number(rawValue);

      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
        return { error: `${field.label} must be a valid number ${field.min} or greater` };
      }

      details[key] = Number(parsed.toFixed(2));
      continue;
    }

    if (field.type === 'boolean_choice') {
      const normalized = String(value[key] ?? '').trim().toLowerCase();

      if (!field.options.includes(normalized)) {
        return { error: `${field.label} must be either yes or no` };
      }

      details[key] = normalized;
      continue;
    }

    if (field.type === 'text') {
      const normalized = String(value[key] ?? '').trim();

      if (!normalized) {
        return { error: `${field.label} is required` };
      }

      if (normalized.length > field.maxLength) {
        return { error: `${field.label} must be ${field.maxLength} characters or less` };
      }

      details[key] = normalized;
    }
  }

  return {
    details,
    summaryText: formatCheckoutDetailsSummary(details)
  };
};

const formatCheckoutDetailsSummary = (details) => {
  if (!details || typeof details !== 'object') {
    return '';
  }

  return ATTENDANCE_CHECKOUT_FIELDS
    .filter((field) => details[field.key] !== undefined && details[field.key] !== null && details[field.key] !== '')
    .map((field) => {
      const value = field.type === 'boolean_choice'
        ? String(details[field.key]).toUpperCase()
        : String(details[field.key]);

      return `${field.label}: ${value}`;
    })
    .join(' | ');
};

module.exports = {
  ATTENDANCE_CHECKOUT_FIELDS,
  normalizeAssignedFieldKeys,
  validateCheckoutDetails,
  formatCheckoutDetailsSummary
};
