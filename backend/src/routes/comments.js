const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getComments, addComment, deleteComment } = require('../controllers/commentController');

const router = express.Router();

router.use(requireAuth);

// Get comments for a task
router.get('/', getComments);

// Add comment to a task
router.post('/', addComment);

// Delete a comment
router.delete('/:id', deleteComment);

module.exports = router;
