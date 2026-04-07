const { getDB, saveDB } = require('../config/database');
const { getRow } = require('../utils/sql');

exports.getEmployees = async (req, res) => {
  try {
    const db = await getDB();
    const employees = await db.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE role = 'employee' ORDER BY first_name, last_name"
    );

    res.json({ employees: employees.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const db = await getDB();
    const employeeId = Number(req.params.id);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: 'Invalid employee id' });
    }

    const employee = await getRow(
      db,
      'SELECT id, first_name, last_name, role FROM users WHERE id = ?',
      [employeeId]
    );

    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await db.run('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [employeeId]);
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
