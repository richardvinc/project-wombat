/** @type {import('jest').Config} */
module.exports = {
  displayName: 'api-unit',
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['integration-spec\\.ts$'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  clearMocks: true,
  coverageDirectory: '../../coverage/apps/api/unit',
};
