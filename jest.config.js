const shared = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFiles: ['<rootDir>/tests/helpers/env.ts'],
};

/** @type {import('jest').Config} */
module.exports = {
  testTimeout: 20000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/db/migrate.ts'],
  projects: [
    // Pure business rules: no database needed.
    { ...shared, displayName: 'unit', roots: ['<rootDir>/tests/unit'] },
    // HTTP endpoints against a real PostgreSQL test database.
    {
      ...shared,
      displayName: 'integration',
      roots: ['<rootDir>/tests/integration'],
      globalSetup: '<rootDir>/tests/helpers/global-setup.ts',
    },
  ],
};
