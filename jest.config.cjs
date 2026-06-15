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
        pageTitle: 'QuizPulse — Sprint 2 Test Report',
        outputPath: 'tests/reports/sprint2-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
