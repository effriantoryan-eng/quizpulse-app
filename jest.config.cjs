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
        pageTitle: 'QuizPulse — v3.2.1 Sign-up Flow Test Report',
        outputPath: 'tests/reports/signup-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
