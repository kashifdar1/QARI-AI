import { Button, Screen, Text } from '@qari/ui';
import { View } from 'react-native';
import { useLocale } from '../../i18n/LocaleContext.js';

export function Welcome({ onNext }: { onNext: () => void }): JSX.Element {
  const { locale, t } = useLocale();
  return (
    <Screen lang={locale}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text lang={locale} variant="xl">
          {t('onboarding.welcome.title')}
        </Text>
        <Text lang={locale} variant="md" muted>
          {t('onboarding.welcome.subtitle')}
        </Text>
        <Button label={t('common.continue')} lang={locale} onPress={onNext} />
      </View>
    </Screen>
  );
}
