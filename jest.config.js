/** @type {import("jest").Config} **/
export default {
  testEnvironment: "jsdom",
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  globalSetup: "./setup-test-env.js",
  moduleNameMapper: {
    '(.+)\\.js': '$1'
  },
  extensionsToTreatAsEsm: ['.ts']
};