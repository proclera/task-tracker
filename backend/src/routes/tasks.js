const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  assignTask,
  deleteTask,
  getMyTasks,
  updateMyTaskStatus,
  getAnalytics
} = require('../controllers/taskController');

const router = express.Router();

router.use(requireAuth);

// All tasks - admin sees all, employee sees their tasks only
router.get('/', (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return next();
  }
  return res.redirect('/api/tasks/my');
}, getAllTasks);

// My tasks (employee sees their assigned tasks)
router.get('/my', getMyTasks);

// Analytics (admin only)
router.get('/analytics', requireRole('admin'), getAnalytics);

// Get single task
router.get('/:id', getTaskById);

// Create task (admin only)
router.post('/', requireRole('admin', 'manager'), createTask);

// Full update task (admin only)
router.put('/:id', requireRole('admin', 'manager'), updateTask);

// Assign or unassign task (admin only)
router.patch('/:id/assign', requireRole('admin', 'manager'), assignTask);

// Delete task (admin only)
router.delete('/:id', requireRole('admin', 'manager'), deleteTask);

// Update own task status (employee updates their assigned task's status)
router.patch('/:id/status', updateMyTaskStatus);

module.exports = router;
