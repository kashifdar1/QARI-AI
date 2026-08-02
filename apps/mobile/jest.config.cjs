module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/src/**/*.test.[jt]s?(x)'],
  // See packages/ui/jest.config.cjs for why this is empty under pnpm.
  transformIgnorePatterns: [],
  moduleNameMapper: {
    // Must precede the generic ".js"-stripping rule below (Jest applies
    // mappers in definition order, first match wins) — see
    // __mocks__/qariAudioRecorderModule.ts for why this is mocked.
    '^.*/modules/qari-audio-recorder/src/QariAudioRecorderModule\\.js$':
      '<rootDir>/__mocks__/qariAudioRecorderModule.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
