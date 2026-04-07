const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getEmployees, deleteEmployee } = require('../controllers/employeeController');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('admin'), getEmployees);
router.delete('/:id', requireRole('admin'), deleteEmployee);

module.exports = router;
