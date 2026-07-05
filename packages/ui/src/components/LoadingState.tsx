import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { spacing } from '../tokens.js';
import { Text, type SupportedLang } from './Text.js';

export type LoadingStateProps = {
  lang: SupportedLang;
  label: string;
};

export function LoadingState({ lang, label }: LoadingStateProps): JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.sm }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text lang={lang} variant="sm" muted>
        {label}
      </Text>
    </View>
  );
}
