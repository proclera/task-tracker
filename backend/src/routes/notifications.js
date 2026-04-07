const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);

// Get all notifications
router.get('/', getNotifications);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', markAsRead);

// Mark all as read
router.patch('/read-all', markAllAsRead);

module.exports = router;
