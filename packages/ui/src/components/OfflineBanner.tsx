import { View } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { spacing } from '../tokens.js';
import { Text, type SupportedLang } from './Text.js';

export type OfflineBannerProps = {
  lang: SupportedLang;
  label: string;
};

/**
 * `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`: a
 * connectivity change is exactly the kind of state a screen-reader user
 * needs announced without hunting for it (parallels ErrorState).
 */
export function OfflineBanner({ lang, label }: OfflineBannerProps): JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.warning,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text lang={lang} variant="sm" style={{ color: colors.onPrimary }}>
        {label}
      </Text>
    </View>
  );
}
