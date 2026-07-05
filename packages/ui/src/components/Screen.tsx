import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext.js';
import { directionFor, type WritingDirection } from '../tokens.js';
import type { SupportedLang } from './Text.js';

export type ScreenProps = Omit<ViewProps, 'style'> & {
  lang: SupportedLang;
  children: ViewProps['children'];
};

/**
 * The root container every screen wraps its content in. `lang` drives
 * `direction` so screen-level RTL flip (padding/margin start-end flip in RN
 * is automatic for `flexDirection: 'row'` layouts) is applied at the same
 * layer as the background/theme color, not left to each screen to remember.
 */
export function Screen({ lang, children, ...rest }: ScreenProps): JSX.Element {
  const { colors } = useTheme();
  const direction: WritingDirection = directionFor(lang);

  return (
    <View
      {...rest}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        direction,
      }}
    >
      {children}
    </View>
  );
}
