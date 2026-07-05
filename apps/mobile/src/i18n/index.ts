import en from './locales/en.json';
import ar from './locales/ar.json';
import ur from './locales/ur.json';

export type SupportedLocale = 'en' | 'ur' | 'ar';

/**
 * Minimal home-grown resource + lookup, deliberately not i18next: at this
 * milestone's scope (a handful of onboarding/tab strings) a full i18n
 * library is unneeded weight. Swapping to i18next later is a drop-in
 * replacement for `translate()` since the resource shape (nested JSON,
 * dot-path keys) is the same convention i18next uses.
 */
export const resources: Record<SupportedLocale, Record<string, unknown>> = { en, ar, ur };

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'ur', 'ar'];

function lookup(resource: Record<string, unknown>, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      resource,
    );
  return typeof value === 'string' ? value : undefined;
}

/**
 * Looks up `key` in `locale`, falling back to `en` if missing — a missing
 * translation degrades to English rather than rendering a raw key or
 * crashing. CI (Milestone G) is expected to fail the build on any key
 * present in en.json but missing from ar.json/ur.json; this fallback is a
 * runtime safety net, not a substitute for that check.
 */
export function translate(locale: SupportedLocale, key: string): string {
  return lookup(resources[locale], key) ?? lookup(resources.en, key) ?? key;
}
