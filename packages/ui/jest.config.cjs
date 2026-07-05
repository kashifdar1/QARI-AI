module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/src/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // pnpm's nested .pnpm/<pkg>@<version>/node_modules/<pkg> store layout
  // breaks react-native's default transformIgnorePatterns (written for a
  // flat node_modules tree), so RN's own Flow-typed source never gets
  // Babel-transformed under pnpm. Transforming everything is slower but
  // correct; a tighter pnpm-aware pattern can replace this once measured.
  transformIgnorePatterns: [],
};
