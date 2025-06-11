/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/web-console', '<rootDir>/packages', '<rootDir>/apps'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'server/**/*.{ts,tsx}',
    'web-console/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    'apps/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^@config/(.*)$': '<rootDir>/server/config/$1',
    '^@utils/(.*)$': '<rootDir>/server/utils/$1',
    '^@routes/(.*)$': '<rootDir>/server/routes/$1',
    '^@middleware/(.*)$': '<rootDir>/server/middleware/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  verbose: true,
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/server/**/*.(test|spec).+(ts|tsx|js)'],
      testEnvironment: 'node',
    },
    {
      displayName: 'web-console',
      testMatch: ['<rootDir>/web-console/**/*.(test|spec).+(ts|tsx|js)'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.(test|spec).+(ts|tsx|js)'],
      testEnvironment: 'node',
    }
  ]
};