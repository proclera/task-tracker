const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getEmployees,
  createUserByAdmin,
  updateUserRole,
  updateEmployeeManager,
  deleteEmployee
} = require('../controllers/employeeController');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('admin', 'manager'), getEmployees);
router.post('/', requireRole('admin'), createUserByAdmin);
router.patch('/:id/role', requireRole('admin'), updateUserRole);
router.patch('/:id/manager', requireRole('admin'), updateEmployeeManager);
router.delete('/:id', requireRole('admin'), deleteEmployee);

module.exports = router;
