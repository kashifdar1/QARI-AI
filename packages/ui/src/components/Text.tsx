import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { arabicType, fontFamilies, latinType, urduType } from '../theme/typography.js';
import { directionFor, type WritingDirection } from '../tokens.js';

export type SupportedLang = 'en' | 'ur' | 'ar';

export type TextVariant =
  | keyof typeof latinType
  | keyof typeof arabicType
  | keyof typeof urduType;

export type TextProps = Omit<RNTextProps, 'style'> & {
  lang: SupportedLang;
  variant?: TextVariant;
  muted?: boolean;
  children: RNTextProps['children'];
};

function presetFor(lang: SupportedLang, variant: TextVariant) {
  if (lang === 'ar' && variant in arabicType) {
    return arabicType[variant as keyof typeof arabicType];
  }
  if (lang === 'ur' && variant in urduType) {
    return urduType[variant as keyof typeof urduType];
  }
  return latinType[(variant in latinType ? variant : 'md') as keyof typeof latinType];
}

function fontFamilyFor(lang: SupportedLang): string {
  if (lang === 'ar') return fontFamilies.arabic.regular;
  if (lang === 'ur') return fontFamilies.urdu.regular;
  return fontFamilies.latin.regular;
}

/**
 * The one Text primitive every screen uses. `lang` is required (not
 * inferred) so writing direction and font family are always an explicit,
 * reviewable choice at the call site — never a silent default that could
 * mis-render Arabic/Urdu as LTR Latin text.
 */
export function Text({ lang, variant = 'md', muted = false, style, ...rest }: TextProps & { style?: RNTextProps['style'] }): JSX.Element {
  const { colors } = useTheme();
  const direction: WritingDirection = directionFor(lang);
  const preset = presetFor(lang, variant);

  return (
    <RNText
      {...rest}
      accessibilityLanguage={lang}
      style={[
        {
          color: muted ? colors.textMuted : colors.textPrimary,
          fontFamily: fontFamilyFor(lang),
          fontSize: preset.fontSize,
          lineHeight: preset.lineHeight,
          fontWeight: preset.fontWeight,
          writingDirection: direction,
          textAlign: direction === 'rtl' ? 'right' : 'left',
        },
        style,
      ]}
    />
  );
}
