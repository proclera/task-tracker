const { getDB, saveDB } = require('../config/database');
const { getRow } = require('../utils/sql');

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
    const { email, password, role, firstName, lastName } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = await getDB();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = getRow(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)`,
      [normalizedEmail, passwordHash, role, firstName.trim(), lastName.trim()]
    );

    const result = db.exec('SELECT last_insert_rowid()');
    const userId = result[0].values[0][0];

    saveDB();

    const user = {
      id: userId,
      email: normalizedEmail,
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim()
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const db = await getDB();
    const normalizedEmail = email.trim().toLowerCase();
    const user = getRow(db, 'SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

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
    const user = getRow(
      db,
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: buildUserResponse(user) });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
};
