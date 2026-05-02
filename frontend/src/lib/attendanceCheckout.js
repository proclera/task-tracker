export const ATTENDANCE_CHECKOUT_FIELDS = [
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

export const ATTENDANCE_CHECKOUT_FIELD_MAP = new Map(
  ATTENDANCE_CHECKOUT_FIELDS.map((field) => [field.key, field])
);

export const getAssignedCheckoutFields = (assignedKeys = [], definitions = ATTENDANCE_CHECKOUT_FIELDS) => {
  const definitionMap = new Map(definitions.map((field) => [field.key, field]));

  return assignedKeys
    .map((key) => definitionMap.get(key))
    .filter(Boolean);
};

export const formatCheckoutDetailsEntries = (details, definitions = ATTENDANCE_CHECKOUT_FIELDS) => {
  if (!details || typeof details !== 'object') {
    return [];
  }

  return definitions
    .filter((field) => details[field.key] !== undefined && details[field.key] !== null && details[field.key] !== '')
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: field.type === 'boolean_choice'
        ? String(details[field.key]).toUpperCase()
        : String(details[field.key])
    }));
};

export const createEmptyCheckoutDetails = (assignedKeys = []) =>
  assignedKeys.reduce((accumulator, key) => ({
    ...accumulator,
    [key]: ''
  }), {});
