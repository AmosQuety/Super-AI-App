/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@infrastructure/(.*)$': '<rootDir>/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
  clearMocks: true,
  restoreMocks: true,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'core/**/*.ts',
    'shared/**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
};

module.exports = config;
