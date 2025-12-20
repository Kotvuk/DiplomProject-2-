module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.js',
    '!tests/**',
    '!server.js',
    '!utils/logger.js',
    '!middleware/metrics.js'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000,
};
