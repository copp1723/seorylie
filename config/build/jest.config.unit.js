export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../../test'],
  testMatch: [
    '**/test/**/*.spec.jest.(ts|js)'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    '<rootDir>/../../server/**/*.ts',
    '<rootDir>/../../shared/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage/jest',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../client/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
    '^@server/(.*)$': '<rootDir>/../../server/$1'
  },
  testTimeout: 10000
};