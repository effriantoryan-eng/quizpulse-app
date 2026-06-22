module.exports = {
  testEnvironment: 'node',
  // Resolve api/ dependencies (e.g. web-push, @azure/cosmos, jwks-rsa) for unit tests that require
  // real handler modules with mocks in place — api/ has its own node_modules.
  moduleDirectories: ['node_modules', '<rootDir>/api/node_modules'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
  ],
  testTimeout: 15000,
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'QuizPulse — v3.3.0 Simulated Demo Class Test Report',
        outputPath: 'tests/reports/v3.3.0-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
