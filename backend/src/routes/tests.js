const express = require('express');
const router = express.Router();
const { runTests, getCoverage } = require('../controllers/testController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/apps/:id/tests/run', runTests);
router.get('/apps/:id/tests/coverage', getCoverage);

module.exports = router;

