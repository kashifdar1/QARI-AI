/**
 * Placeholder design tokens. Full theme + component library is post-Milestone-0;
 * this establishes the RTL-aware structure that packages/mobile and
 * packages/admin build on (CLAUDE.md §5 accessibility + RTL requirements).
 */
export type WritingDirection = 'ltr' | 'rtl';

export const LOCALE_DIRECTION: Record<'en' | 'ur' | 'ar', WritingDirection> = {
  en: 'ltr',
  ur: 'rtl',
  ar: 'rtl',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export function directionFor(locale: keyof typeof LOCALE_DIRECTION): WritingDirection {
  return LOCALE_DIRECTION[locale];
}
