/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: false,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 20000, // Increase timeout for blockchain operations
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // globalSetup: '<rootDir>/src/__tests__/globalSetup.ts', // Uncomment if needed
  // globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts', // Uncomment if needed
};
