const express = require('express');
const { login, getCurrentUser } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Public registration is disabled. Contact an admin.' });
});
router.post('/login', authRateLimit, login);
router.get('/me', requireAuth, getCurrentUser);

module.exports = router;
