const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getMyAttendanceToday,
  checkIn,
  checkOut,
  getMyAttendanceHistory,
  getAttendanceSummary
} = require('../controllers/attendanceController');

const router = express.Router();

router.use(requireAuth);

router.get('/me/today', getMyAttendanceToday);
router.get('/me/history', getMyAttendanceHistory);
router.post('/check-in', checkIn);
router.patch('/:id/check-out', checkOut);
router.get('/admin/summary', requireRole('admin'), getAttendanceSummary);

module.exports = router;
