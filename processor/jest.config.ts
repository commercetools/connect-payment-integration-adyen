/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./src/jest.setup.ts'],
  roots: ['./test'],
  // @faker-js/faker is published as ESM only; default Jest ignores node_modules transforms.
  transformIgnorePatterns: ['/node_modules/(?!@faker-js/faker/)'],
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
