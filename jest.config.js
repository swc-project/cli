const enableCoverage = process.env.JEST_COVERAGE === 'true'

module.exports = enableCoverage
  ? {
    // provides the most accurate coverage results
    preset: 'ts-jest',
    roots: ["src"],
  }
  : {
    roots: ["src"],
    // provides fastest test transforms
    transform: {
      '^.+\\.(t|j)sx?$': ['@swc/jest'],
    },
  };
