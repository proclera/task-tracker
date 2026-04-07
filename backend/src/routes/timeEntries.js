const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getTimeEntriesForTask,
  getActiveTimeEntry,
  startTimeEntry,
  stopTimeEntry
} = require('../controllers/timeEntryController');

const router = express.Router();

router.use(requireAuth);

router.get('/active', getActiveTimeEntry);
router.get('/task/:taskId', getTimeEntriesForTask);
router.post('/start', startTimeEntry);
router.patch('/:id/stop', stopTimeEntry);

module.exports = router;
