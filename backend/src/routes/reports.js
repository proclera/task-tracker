const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getReportSummary } = require('../controllers/reportController');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/summary', getReportSummary);

module.exports = router;
