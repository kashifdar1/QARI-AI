import { directionFor } from './tokens.js';

describe('directionFor', () => {
  it('marks ur and ar as RTL, en as LTR', () => {
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('ur')).toBe('rtl');
    expect(directionFor('ar')).toBe('rtl');
  });
});
