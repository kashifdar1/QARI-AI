import { Pressable, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { radius } from '../theme/index.js';
import { spacing } from '../tokens.js';
import { Text, type SupportedLang } from './Text.js';

export type ButtonProps = {
  label: string;
  lang: SupportedLang;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({
  label,
  lang,
  onPress,
  variant = 'primary',
  disabled = false,
}: ButtonProps): JSX.Element {
  const { colors } = useTheme();
  const background = variant === 'primary' ? colors.primary : colors.surfaceRaised;
  const textColor = variant === 'primary' ? colors.onPrimary : colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed && variant === 'primary' ? colors.primaryPressed : background,
        opacity: disabled ? 0.5 : 1,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text lang={lang} variant="md" style={{ color: textColor, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
