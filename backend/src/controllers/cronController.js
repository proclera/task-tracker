const { getDB } = require('../config/database');
const { evaluateGoalsForAdmins } = require('./goalController');

const isAuthorizedCronRequest = (req) => {
  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = String(req.headers.authorization || '');
  const expectedHeader = cronSecret ? `Bearer ${cronSecret}` : '';

  if (cronSecret && authHeader === expectedHeader) {
    return true;
  }

  const userAgent = String(req.headers['user-agent'] || '');
  return userAgent.includes('vercel-cron/1.0') && !cronSecret;
};

exports.runGoalAlertCron = async (req, res) => {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized cron invocation' });
    }

    const db = await getDB();
    await evaluateGoalsForAdmins(db);

    res.json({
      ok: true,
      message: 'Goal alerts evaluated successfully',
      ranAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Goal alert cron error:', error);
    res.status(500).json({ error: 'Failed to evaluate goal alerts' });
  }
};
