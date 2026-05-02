const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getIdeas,
  createIdea,
  updateIdea,
  addIdeaComment,
  convertIdeaToTask
} = require('../controllers/ideaController');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', getIdeas);
router.post('/', createIdea);
router.put('/:id', updateIdea);
router.post('/:id/comments', addIdeaComment);
router.post('/:id/convert-to-task', convertIdeaToTask);

module.exports = router;
