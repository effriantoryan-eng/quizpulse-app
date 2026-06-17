module.exports = {
  testEnvironment: 'node',
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
        pageTitle: 'QuizPulse — v3.0.1 Test Report',
        outputPath: 'tests/reports/v3.0.1-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
