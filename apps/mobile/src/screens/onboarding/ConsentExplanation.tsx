import { Button, Screen, Text } from '@qari/ui';
import { View } from 'react-native';
import { useLocale } from '../../i18n/LocaleContext.js';

/**
 * The body text here (onboarding.consent.body, all three locales) must
 * always include the sentence "AI feedback can be uncertain and does not
 * replace a qualified teacher" (localized) — this is a hard product/trust
 * requirement (Principle 4), not just onboarding copy, so do not shorten it
 * when editing the translation resources.
 */
export function ConsentExplanation({ onAccept }: { onAccept: () => void }): JSX.Element {
  const { locale, t } = useLocale();
  return (
    <Screen lang={locale}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text lang={locale} variant="xl">
          {t('onboarding.consent.title')}
        </Text>
        <Text lang={locale} variant="md" muted>
          {t('onboarding.consent.body')}
        </Text>
        <Button label={t('common.continue')} lang={locale} onPress={onAccept} />
      </View>
    </Screen>
  );
}
