module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '**/test/**/*.test.(ts|js)'
  ],
  passWithNoTests: true,
  verbose: false,
  testTimeout: 5000
};