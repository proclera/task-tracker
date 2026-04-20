const { getDB, saveDB } = require('../config/database');
const { getRow } = require('../utils/sql');
const bcrypt = require('bcryptjs');
const {
  isPlainObject,
  normalizeEmail,
  isValidEmail,
  normalizeName,
  normalizePassword,
  toPositiveInt
} = require('../utils/validation');

exports.getEmployees = async (req, res) => {
  try {
    const db = await getDB();
    const employees = await db.query(
      "SELECT id, email, first_name, last_name, role FROM users ORDER BY role ASC, first_name ASC, last_name ASC"
    );

    res.json({ employees: employees.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

exports.createUserByAdmin = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const {
      email,
      password,
      role = 'employee',
      firstName,
      lastName
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
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

    const existing = await getRow(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (email, password_hash, role, first_name, last_name)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
      [normalizedEmail, passwordHash, role, firstNameCheck.value, lastNameCheck.value]
    );

    await saveDB();

    const createdUser = await getRow(
      db,
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
      [result.rows[0].id]
    );

    res.status(201).json({ user: createdUser });
  } catch (error) {
    console.error('Create user by admin error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const db = await getDB();
    const userId = toPositiveInt(req.params.id);
    const { role } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.user.id === userId) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    const target = await getRow(db, 'SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await getRow(db, "SELECT COUNT(*)::int as count FROM users WHERE role = 'admin'");
      if ((adminCount?.count || 0) <= 1) {
        return res.status(403).json({ error: 'At least one admin account is required' });
      }
    }

    await db.run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
    await saveDB();

    const updatedUser = await getRow(
      db,
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
      [userId]
    );

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const db = await getDB();
    const employeeId = toPositiveInt(req.params.id);

    if (!employeeId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (req.user.id === employeeId) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    const employee = await getRow(
      db,
      'SELECT id, first_name, last_name, role FROM users WHERE id = ?',
      [employeeId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (employee.role === 'admin') {
      const adminCount = await getRow(db, "SELECT COUNT(*)::int as count FROM users WHERE role = 'admin'");
      if ((adminCount?.count || 0) <= 1) {
        return res.status(403).json({ error: 'At least one admin account is required' });
      }
    }

    await db.run('DELETE FROM task_assignments WHERE user_id = ?', [employeeId]);
    await db.run(
      `UPDATE tasks t
       SET assignee_id = assignment.user_id,
           updated_at = CURRENT_TIMESTAMP
       FROM (
         SELECT task_id, MIN(user_id) as user_id
         FROM task_assignments
         GROUP BY task_id
       ) assignment
       WHERE t.id = assignment.task_id
         AND (t.assignee_id IS NULL OR t.assignee_id = ?)`,
      [employeeId]
    );
    await db.run(
      `UPDATE tasks
       SET assignee_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE assignee_id = ?`,
      [employeeId]
    );
    await db.run('DELETE FROM employee_profiles WHERE user_id = ?', [employeeId]);
    await db.run('DELETE FROM comments WHERE user_id = ?', [employeeId]);
    await db.run('DELETE FROM notifications WHERE user_id = ?', [employeeId]);
    await db.run('DELETE FROM time_entries WHERE user_id = ?', [employeeId]);
    await db.run('DELETE FROM attendance_records WHERE user_id = ?', [employeeId]);
    await db.run('DELETE FROM users WHERE id = ?', [employeeId]);

    await saveDB();

    res.json({
      message: 'Employee deleted successfully',
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`
      }
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};
