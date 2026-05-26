const express = require('express');
const router = express.Router();
const {
  deployApp,
  getDeploymentStatus
} = require('../controllers/deploymentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/apps/:id/deploy', deployApp);
router.get('/apps/:id/deployment/status', getDeploymentStatus);

module.exports = router;

