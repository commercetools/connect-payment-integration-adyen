/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./src/jest.setup.ts'],
  roots: ['./test'],
  // @faker-js/faker and composable-commerce-test-data are ESM-only packages.
  // In pnpm the store path uses '+' as a separator, so we match both variants.
  transformIgnorePatterns: ['/node_modules/\\.pnpm/(?!(@faker-js|@commercetools\\+composable-commerce-test-data))'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
        },
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          isolatedModules: true,
        },
      },
    ],
  },
};
