const App = require('../models/App');
const testRunnerService = require('../services/testRunnerService');

// @desc    Run tests for an app
// @route   POST /api/apps/:id/tests/run
// @access  Private
exports.runTests = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to run tests for this app'
      });
    }

    if (!app.tests || (!app.tests.unitTests?.length && !app.tests.integrationTests?.length)) {
      return res.status(400).json({
        success: false,
        message: 'No tests found for this app'
      });
    }

    const testType = req.body.type || 'all'; // 'all', 'unit', 'integration'
    
    // Run tests
    const results = await testRunnerService.runTests(app, testType);

    if (!results.success) {
      return res.status(500).json({
        success: false,
        message: results.error || 'Failed to run tests',
        results
      });
    }

    // Update app with test results
    if (results.updatedTests) {
      app.tests.unitTests = results.updatedTests.unitTests;
      app.tests.integrationTests = results.updatedTests.integrationTests;
      
      if (results.coverage) {
        app.tests.testCoverage = {
          lines: results.coverage.lines?.pct || 0,
          functions: results.coverage.functions?.pct || 0,
          branches: results.coverage.branches?.pct || 0,
          statements: results.coverage.statements?.pct || 0
        };
      }
      
      await app.save();
    }

    res.json({
      success: true,
      results: {
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        tests: results.tests,
        coverage: results.coverage,
        output: results.output
      }
    });
  } catch (error) {
    console.error('Test runner error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run tests'
    });
  }
};

// @desc    Get test coverage
// @route   GET /api/apps/:id/tests/coverage
// @access  Private
exports.getCoverage = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view coverage for this app'
      });
    }

    const coverage = await testRunnerService.getCoverage(app);

    res.json({
      success: true,
      coverage: app.tests?.testCoverage || coverage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get coverage'
    });
  }
};

