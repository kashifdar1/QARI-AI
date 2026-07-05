import { View } from 'react-native';
import { StatePanel, type StatePanelProps } from './StatePanel.js';

/**
 * `accessibilityRole="alert"` so screen readers announce it immediately —
 * an error state that only a sighted user notices fails the same users a
 * silently-abstaining confidence tier is designed to protect (Principle 2).
 */
export function ErrorState(props: StatePanelProps): JSX.Element {
  return (
    <View accessibilityRole="alert">
      <StatePanel {...props} />
    </View>
  );
}
