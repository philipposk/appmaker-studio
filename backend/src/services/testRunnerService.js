const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

class TestRunnerService {
  /**
   * Run tests for an app
   * Creates a temporary directory, writes test files, runs Jest, and parses results
   */
  async runTests(app, testType = 'all') {
    const tempDir = path.join(__dirname, '../../temp', app._id.toString());
    
    try {
      // Create temp directory
      await fs.ensureDir(tempDir);

      // Write test files
      const testFiles = [];
      
      if (testType === 'all' || testType === 'unit') {
        for (const test of app.tests?.unitTests || []) {
          const testPath = path.join(tempDir, test.path);
          await fs.ensureDir(path.dirname(testPath));
          await fs.writeFile(testPath, test.content);
          testFiles.push(testPath);
        }
      }

      if (testType === 'all' || testType === 'integration') {
        for (const test of app.tests?.integrationTests || []) {
          const testPath = path.join(tempDir, test.path);
          await fs.ensureDir(path.dirname(testPath));
          await fs.writeFile(testPath, test.content);
          testFiles.push(testPath);
        }
      }

      if (testFiles.length === 0) {
        return {
          success: true,
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          tests: [],
          message: 'No tests to run'
        };
      }

      // Create package.json with Jest configuration
      const packageJson = {
        name: `test-${app._id}`,
        version: '1.0.0',
        scripts: {
          test: 'jest --json --outputFile=test-results.json'
        },
        devDependencies: {
          jest: '^29.0.0',
          '@testing-library/react': '^14.0.0',
          '@testing-library/jest-dom': '^6.0.0',
          'react-test-renderer': '^18.0.0',
          supertest: '^6.3.0',
          express: '^4.18.0'
        },
        jest: {
          testEnvironment: 'jsdom',
          setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
          testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js'],
          collectCoverage: false
        }
      };

      // Create jest.setup.js
      const jestSetup = `
require('@testing-library/jest-dom');
`;

      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      await fs.writeFile(path.join(tempDir, 'jest.setup.js'), jestSetup);

      // Write source files if available (for testing React components)
      if (app.generatedCode?.frontend?.structure) {
        for (const file of app.generatedCode.frontend.structure) {
          const filePath = path.join(tempDir, file.path);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, file.content);
        }
      }

      // Install dependencies (skip if node_modules exists)
      if (!await fs.pathExists(path.join(tempDir, 'node_modules'))) {
        await execPromise('npm install', { cwd: tempDir, timeout: 120000 });
      }

      // Run tests
      let jestOutput;
      try {
        const { stdout, stderr } = await execPromise('npm test', {
          cwd: tempDir,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });
        jestOutput = stdout + stderr;
      } catch (error) {
        // Jest exits with non-zero on test failures, but we still want the results
        jestOutput = error.stdout || error.stderr || '';
      }

      // Read test results
      const resultsPath = path.join(tempDir, 'test-results.json');
      let testResults = {
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: []
      };

      if (await fs.pathExists(resultsPath)) {
        const resultsData = await fs.readFile(resultsPath, 'utf8');
        testResults = JSON.parse(resultsData);
      }

      // Map Jest results to our format
      const mappedTests = testResults.testResults.flatMap(suite =>
        suite.assertionResults.map(test => ({
          path: suite.name,
          name: test.title,
          status: test.status, // 'passed', 'failed', 'pending', 'skipped', 'todo'
          duration: test.duration || 0,
          error: test.failureMessages?.join('\n') || null,
          fullName: test.fullName
        }))
      );

      // Update test statuses in app (simplified - would need more sophisticated matching)
      const updatedTests = {
        unitTests: app.tests?.unitTests?.map((test, index) => {
          const result = mappedTests[index] || {};
          return {
            ...test,
            status: result.status === 'passed' ? 'pass' : result.status === 'failed' ? 'fail' : 'pending',
            results: result,
            lastRun: new Date()
          };
        }) || [],
        integrationTests: app.tests?.integrationTests?.map((test, index) => {
          const unitTestCount = app.tests?.unitTests?.length || 0;
          const result = mappedTests[unitTestCount + index] || {};
          return {
            ...test,
            status: result.status === 'passed' ? 'pass' : result.status === 'failed' ? 'fail' : 'pending',
            results: result,
            lastRun: new Date()
          };
        }) || []
      };

      return {
        success: true,
        total: testResults.numTotalTests,
        passed: testResults.numPassedTests,
        failed: testResults.numFailedTests,
        skipped: testResults.numPendingTests + testResults.numSkippedTests || 0,
        tests: mappedTests,
        coverage: testResults.coverageMap || null,
        output: jestOutput,
        updatedTests
      };

    } catch (error) {
      console.error('Test execution error:', error);
      return {
        success: false,
        error: error.message,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: []
      };
    } finally {
      // Cleanup temp directory (optional - keep for debugging)
      // await fs.remove(tempDir).catch(console.error);
    }
  }

  /**
   * Run a single test file
   */
  async runSingleTest(app, testPath) {
    // Similar to runTests but filtered to single file
    return this.runTests(app, 'single', testPath);
  }

  /**
   * Get test coverage
   */
  async getCoverage(app) {
    const result = await this.runTests(app, 'all');
    return result.coverage || null;
  }
}

module.exports = new TestRunnerService();

