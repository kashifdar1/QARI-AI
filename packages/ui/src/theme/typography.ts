/**
 * Latin/Urdu-script type scale plus dedicated Arabic presets. Arabic and
 * Nastaliq scripts need looser leading than Latin at the same point size to
 * avoid diacritic/loop clipping — that's why arabic/urdu presets aren't just
 * the Latin scale with a font swap.
 */
export type TypePreset = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
};

export const latinType: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', TypePreset> = {
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  md: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  lg: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  xl: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  xxl: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
};

/**
 * `arabic-sm` = compact display (Library list previews). `arabic-reader` =
 * body-length Quran text (passage browser, practice prompt). `arabic-xl` =
 * the large single-ayah-at-a-time display used during active recitation.
 * All three intentionally use a looser line-height ratio (~1.8x) than the
 * Latin scale.
 */
export const arabicType: Record<'arabic-sm' | 'arabic-reader' | 'arabic-xl', TypePreset> = {
  'arabic-sm': { fontSize: 18, lineHeight: 32, fontWeight: '400' },
  'arabic-reader': { fontSize: 24, lineHeight: 44, fontWeight: '400' },
  'arabic-xl': { fontSize: 34, lineHeight: 60, fontWeight: '400' },
};

export const urduType: Record<'urdu-reader' | 'urdu-xl', TypePreset> = {
  'urdu-reader': { fontSize: 20, lineHeight: 38, fontWeight: '400' },
  'urdu-xl': { fontSize: 28, lineHeight: 50, fontWeight: '400' },
};

/**
 * Font family tokens. The actual font binaries are not bundled by this
 * package (see packages/ui/assets/fonts/README.md — tracked in
 * docs/STUBS.md as blocked on a human obtaining/verifying the licensed
 * files); apps/mobile loads them via `expo-font` under these family names,
 * so this module is the single source of truth for the *names* regardless
 * of when the binaries land.
 */
export const fontFamilies = {
  latin: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
  },
  arabic: {
    // KFGQPC Uthmanic Script Hafs — Quran text only (CLAUDE.md §3).
    regular: 'KFGQPCUthmanicScriptHafs-Regular',
  },
  urdu: {
    // Nastaliq-capable. Android fallback: Nastaliq shaping via HarfBuzz is
    // unreliable on API < 29 / some OEM skins; below that OS version the app
    // falls back to 'NotoNaskhArabicUI-Regular' (Naskh renders Urdu
    // correctly, just without the calligraphic Nastaliq style) rather than
    // rendering unshaped glyphs. That fallback selection is a runtime
    // decision in apps/mobile (Milestone A task), not encoded in this
    // token — this module only names the two family options.
    regular: 'NotoNastaliqUrdu-Regular',
    androidFallback: 'NotoNaskhArabicUI-Regular',
  },
} as const;
