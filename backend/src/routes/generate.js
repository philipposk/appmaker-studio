const express = require('express');
const router = express.Router();
const {
  generateApp,
  refineApp,
  downloadApp
} = require('../controllers/generateController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/generate', generateApp);
router.post('/refine/:id', refineApp);
router.get('/:id/download', downloadApp);

module.exports = router;

