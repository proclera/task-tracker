const { getDB } = require('../config/database');
const { getGamificationStats, getLeaderboard } = require('../services/gamificationService');

exports.getMyGamification = async (req, res) => {
  try {
    const db = await getDB();
    const stats = await getGamificationStats(db, req.user.id);

    res.json({ gamification: stats });
  } catch (error) {
    console.error('Get my gamification error:', error);
    res.status(500).json({ error: 'Failed to fetch gamification data' });
  }
};

exports.getGamificationLeaderboard = async (req, res) => {
  try {
    const db = await getDB();
    const leaderboard = await getLeaderboard(db, req.query.limit);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get gamification leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};
