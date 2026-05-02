const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getMyAttendanceToday,
  checkIn,
  checkOut,
  getMyAttendanceHistory,
  getAttendanceSummary,
  downloadAttendanceMonthlyPdf,
  getManagerCheckoutConfigs,
  updateManagerCheckoutConfig
} = require('../controllers/attendanceController');

const router = express.Router();

router.use(requireAuth);

router.get('/me/today', getMyAttendanceToday);
router.get('/me/history', getMyAttendanceHistory);
router.get('/manager/checkout-configs', requireRole('manager'), getManagerCheckoutConfigs);
router.put('/manager/checkout-configs/:employeeId', requireRole('manager'), updateManagerCheckoutConfig);
router.post('/check-in', checkIn);
router.patch('/:id/check-out', checkOut);
router.get('/admin/summary', requireRole('admin'), getAttendanceSummary);
router.get('/admin/monthly-pdf', requireRole('admin'), downloadAttendanceMonthlyPdf);

module.exports = router;
