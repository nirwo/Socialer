export default {
  preset: "jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  transform: {
    "^.+\.js$": "babel-jest"
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "\!src/**/*.test.js",
    "\!src/server/index.js"
  ],
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 10000
};
