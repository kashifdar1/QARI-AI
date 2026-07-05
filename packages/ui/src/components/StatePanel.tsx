import { View } from 'react-native';
import { spacing } from '../tokens.js';
import { Button } from './Button.js';
import { Text, type SupportedLang } from './Text.js';

export type StatePanelProps = {
  lang: SupportedLang;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Shared layout for EmptyState/ErrorState/PermissionDeniedState. */
export function StatePanel({
  lang,
  title,
  description,
  actionLabel,
  onAction,
}: StatePanelProps): JSX.Element {
  return (
    <View style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
      <Text lang={lang} variant="lg">
        {title}
      </Text>
      {description ? (
        <Text lang={lang} variant="sm" muted>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} lang={lang} onPress={onAction} />
      ) : null}
    </View>
  );
}
