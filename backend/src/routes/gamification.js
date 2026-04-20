const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getMyGamification, getGamificationLeaderboard } = require('../controllers/gamificationController');

const router = express.Router();

router.use(requireAuth);
router.get('/me', getMyGamification);
router.get('/leaderboard', getGamificationLeaderboard);

module.exports = router;
