import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { radius } from '../theme/index.js';
import { spacing } from '../tokens.js';

export type IconButtonProps = {
  /** Required, not optional — an icon-only control with no text content
   * would otherwise be invisible to a screen reader. */
  accessibilityLabel: string;
  onPress: (event: GestureResponderEvent) => void;
  children: ReactNode;
  disabled?: boolean;
};

export function IconButton({
  accessibilityLabel,
  onPress,
  children,
  disabled = false,
}: IconButtonProps): JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
        borderRadius: radius.pill,
        padding: spacing.sm,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {children}
    </Pressable>
  );
}
