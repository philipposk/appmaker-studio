const express = require('express');
const router = express.Router();
const {
  getApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  testGroq
} = require('../controllers/appController');
const { saveStreamResult } = require('../controllers/streamSaveController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getApps)
  .post(createApp);

router.route('/:id')
  .get(getApp)
  .put(updateApp)
  .delete(deleteApp);

router.post('/:id/test-groq', testGroq);

// Persist a streaming-generator result into an existing or new App.
router.post('/save-stream', saveStreamResult);

module.exports = router;

