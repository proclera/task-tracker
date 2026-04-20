const WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

const loginAttempts = new Map();

const getClientKey = (req) => `${req.ip || 'unknown'}:${String(req.body?.email || '').toLowerCase()}`;

const now = () => Date.now();

const cleanupEntryIfExpired = (entry, currentTime) => {
  if (!entry) {
    return null;
  }

  if (currentTime > entry.resetAt) {
    return null;
  }

  return entry;
};

const authRateLimit = (req, res, next) => {
  const currentTime = now();
  const key = getClientKey(req);
  const existing = cleanupEntryIfExpired(loginAttempts.get(key), currentTime);

  if (!existing) {
    loginAttempts.set(key, { attempts: 0, resetAt: currentTime + WINDOW_MS });
    return next();
  }

  if (existing.attempts >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  return next();
};

const registerAuthFailure = (req) => {
  const currentTime = now();
  const key = getClientKey(req);
  const entry = cleanupEntryIfExpired(loginAttempts.get(key), currentTime) || {
    attempts: 0,
    resetAt: currentTime + WINDOW_MS
  };

  entry.attempts += 1;
  loginAttempts.set(key, entry);
};

const clearAuthFailures = (req) => {
  const key = getClientKey(req);
  loginAttempts.delete(key);
};

module.exports = {
  authRateLimit,
  registerAuthFailure,
  clearAuthFailures
};
