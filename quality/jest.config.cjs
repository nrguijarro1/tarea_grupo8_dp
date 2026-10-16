const path = require('node:path');

module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/quality/tests/**/*.test.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['<rootDir>/quality/node_modules/babel-jest', {
      plugins: [path.join(__dirname, 'node_modules/@babel/plugin-transform-modules-commonjs')]
    }]
  },
  collectCoverageFrom: ['<rootDir>/js/model.js', '<rootDir>/js/rules.js'],
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/quality/coverage'
};
