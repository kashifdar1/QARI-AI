import { View } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { radius } from '../theme/index.js';

export type ProgressBarProps = {
  /** 0..1 */
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps): JSX.Element {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
