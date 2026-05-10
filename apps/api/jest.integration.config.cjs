/** @type {import('jest').Config} */
module.exports = {
  displayName: 'api-integration',
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.integration-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  clearMocks: true,
  testTimeout: 30000,
  coverageDirectory: '../../coverage/apps/api/integration',
};
