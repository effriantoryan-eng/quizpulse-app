module.exports = {
  testEnvironment: 'node',
  // Resolve api/ dependencies (e.g. web-push, @azure/cosmos, jwks-rsa) for unit tests that require
  // real handler modules with mocks in place — api/ has its own node_modules.
  moduleDirectories: ['node_modules', '<rootDir>/api/node_modules'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
  ],
  // No-ops for unit runs; for integration runs, loads api/local.settings.json's Values into
  // process.env so minted dev-bypass JWTs' aud claims match what the func host resolves. See
  // tests/setup/loadLocalSettingsEnv.js.
  setupFiles: ['<rootDir>/tests/setup/loadLocalSettingsEnv.js'],
  testTimeout: 15000,
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'QuizPulse — v4.7.0 Design Overhaul Test Report',
        outputPath: 'tests/reports/v4.7.0-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
