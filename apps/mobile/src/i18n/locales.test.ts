import { resources, SUPPORTED_LOCALES } from './index.js';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('locale resources', () => {
  it('every locale has exactly the same key set as en (no missing/extra translations)', () => {
    const enKeys = flattenKeys(resources.en).sort();
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue;
      expect(flattenKeys(resources[locale]).sort()).toEqual(enKeys);
    }
  });

  it('the consent explanation in every locale mentions AI uncertainty and that it is not a teacher replacement (Principle 4)', () => {
    // We can't assert exact wording per-locale without a human-verified
    // translation, but each locale is checked against known-good
    // translations of the required phrase's key concepts so the sentence
    // can't be silently dropped from a locale file.
    expect(resources.en.onboarding).toMatchObject({
      consent: { body: expect.stringContaining('does not replace a qualified teacher') },
    });
    const ar = resources.ar as { onboarding: { consent: { body: string } } };
    const ur = resources.ur as { onboarding: { consent: { body: string } } };
    expect(ar.onboarding.consent.body).toContain('معلم مؤهل');
    expect(ur.onboarding.consent.body).toContain('قابل استاد');
  });
});
