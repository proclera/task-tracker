const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getEmployees,
  createUserByAdmin,
  updateUserRole,
  deleteEmployee
} = require('../controllers/employeeController');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('admin'), getEmployees);
router.post('/', requireRole('admin'), createUserByAdmin);
router.patch('/:id/role', requireRole('admin'), updateUserRole);
router.delete('/:id', requireRole('admin'), deleteEmployee);

module.exports = router;
