const { getDB, saveDB } = require('../config/database');
const { getRow } = require('../utils/sql');
const { ensureOverdueNotifications } = require('./notificationController');
const {
  isPlainObject,
  normalizeEmail,
  isValidEmail,
  normalizeName,
  normalizePassword
} = require('../utils/validation');
const { registerAuthFailure, clearAuthFailures } = require('../middleware/rateLimit');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const buildUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.first_name,
  lastName: user.last_name
});

exports.register = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { email, password, role, firstName, lastName } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || normalizedEmail.length > 120) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const passwordCheck = normalizePassword(password);
    if (passwordCheck.error) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    const firstNameCheck = normalizeName(firstName, { fieldName: 'First name' });
    if (firstNameCheck.error) {
      return res.status(400).json({ error: firstNameCheck.error });
    }

    const lastNameCheck = normalizeName(lastName, { fieldName: 'Last name' });
    if (lastNameCheck.error) {
      return res.status(400).json({ error: lastNameCheck.error });
    }

    const db = await getDB();
    const existing = await getRow(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users (email, password_hash, role, first_name, last_name)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
      [normalizedEmail, passwordHash, role, firstNameCheck.value, lastNameCheck.value]
    );

    const userId = result.rows[0].id;

    await saveDB();

    const user = {
      id: userId,
      email: normalizedEmail,
      role,
      first_name: firstNameCheck.value,
      last_name: lastNameCheck.value
    };

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({ token, user: buildUserResponse(user) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      registerAuthFailure(req);
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || normalizedEmail.length > 120) {
      registerAuthFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (String(password).length > 128) {
      registerAuthFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const db = await getDB();
    const user = await getRow(db, 'SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      registerAuthFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      registerAuthFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearAuthFailures(req);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    await ensureOverdueNotifications(db, user.id);

    res.json({
      token,
      user: buildUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const db = await getDB();
    const user = await getRow(
      db,
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await ensureOverdueNotifications(db, req.user.id);

    res.json({ user: buildUserResponse(user) });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
};
