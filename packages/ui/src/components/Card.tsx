import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { radius } from '../theme/index.js';
import { spacing } from '../tokens.js';

export type CardProps = Omit<ViewProps, 'style'> & {
  children: ViewProps['children'];
};

export function Card({ children, ...rest }: CardProps): JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      {children}
    </View>
  );
}
