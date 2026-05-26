import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../utils/hooks';
import { fetchApp } from '../../store/slices/appSlice';
import api from '../../services/api';
import './TestRunner.scss';

interface TestRunnerProps {
  app: any;
}

const TestRunner: React.FC<TestRunnerProps> = ({ app }) => {
  const dispatch = useAppDispatch();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Refresh app data after tests run to get updated statuses
  useEffect(() => {
    if (!running && results) {
      dispatch(fetchApp(app._id));
    }
  }, [results, running, dispatch, app._id]);

  const allTests = [
    ...(app.tests?.unitTests || []),
    ...(app.tests?.integrationTests || []),
  ];

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const response = await api.post(`/apps/${app._id}/tests/run`, { type: 'all' });
      const data = response.data;
      
      if (data.success) {
        // Map backend results to frontend format
        const mappedResults = {
          total: data.results.total,
          passed: data.results.passed,
          failed: data.results.failed,
          skipped: data.results.skipped,
          tests: data.results.tests.map((test: any) => ({
            ...test,
            status: test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'pending',
            path: test.path,
            name: test.name || test.fullName,
            duration: test.duration,
            error: test.error
          }))
        };
        setResults(mappedResults);
      } else {
        console.error('Test execution failed:', data.message);
        setResults({
          total: 0,
          passed: 0,
          failed: 1,
          skipped: 0,
          tests: [{
            path: 'Test Runner',
            name: 'Execution Error',
            status: 'fail',
            error: data.message || 'Failed to run tests'
          }]
        });
      }
    } catch (error) {
      console.error('Test execution error:', error);
      setResults({
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        tests: [{
          path: 'Test Runner',
          name: 'Network Error',
          status: 'fail',
          error: 'Failed to connect to test server'
        }]
      });
    } finally {
      setRunning(false);
    }
  };

  const passedCount = allTests.filter((t: any) => t.status === 'pass').length;
  const failedCount = allTests.filter((t: any) => t.status === 'fail').length;
  const pendingCount = allTests.filter((t: any) => t.status === 'pending').length;

  return (
    <div className="test-runner">
      <div className="test-runner-header">
        <div className="header-content">
          <h3>Test Runner</h3>
          <p>Run unit and integration tests for your app</p>
        </div>
        <button
          onClick={handleRunTests}
          className="btn btn--primary"
          disabled={running || allTests.length === 0}
        >
          {running ? (
            <>
              <div className="spinner spinner--small"></div>
              Running Tests...
            </>
          ) : (
            '▶ Run All Tests'
          )}
        </button>
      </div>

      <div className="test-stats">
        <div className="stat-card stat-card--total">
          <div className="stat-value">{allTests.length}</div>
          <div className="stat-label">Total Tests</div>
        </div>
        <div className="stat-card stat-card--passed">
          <div className="stat-value">{passedCount}</div>
          <div className="stat-label">Passed</div>
        </div>
        <div className="stat-card stat-card--failed">
          <div className="stat-value">{failedCount}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card stat-card--pending">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>

      {results && (
        <div className="test-results">
          <div className="results-summary">
            <h4>Test Results</h4>
            <div className="summary-stats">
              <span className="stat passed">{results.passed} Passed</span>
              <span className="stat failed">{results.failed} Failed</span>
              <span className="stat skipped">{results.skipped} Skipped</span>
            </div>
          </div>
          <div className="test-list">
            {results.tests.map((test: any, index: number) => (
              <div key={index} className={`test-item test-item--${test.status}`}>
                <div className="test-header">
                  <span className="test-status-icon">
                    {test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏳'}
                  </span>
                  <span className="test-name">{test.name || test.path}</span>
                  {test.duration && (
                    <span className="test-duration">{test.duration.toFixed(0)}ms</span>
                  )}
                </div>
                {test.error && (
                  <div className="test-error">
                    <pre>{test.error}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!results && allTests.length > 0 && (
        <div className="test-list">
          {allTests.map((test: any, index: number) => (
            <div key={index} className={`test-item test-item--${test.status || 'pending'}`}>
              <div className="test-header">
                <span className="test-status-icon">
                  {test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏳'}
                </span>
                <span className="test-name">{test.name || test.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {allTests.length === 0 && (
        <div className="test-empty">
          <p>No tests generated yet. Generate your app to create tests automatically.</p>
        </div>
      )}
    </div>
  );
};

export default TestRunner;

