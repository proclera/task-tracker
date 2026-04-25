const express = require('express');
const { runGoalAlertCron } = require('../controllers/cronController');

const router = express.Router();

router.get('/goals/check-alerts', runGoalAlertCron);

module.exports = router;
