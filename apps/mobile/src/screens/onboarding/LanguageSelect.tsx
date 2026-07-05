import { Button, Screen, Text } from '@qari/ui';
import { View } from 'react-native';
import { SUPPORTED_LOCALES } from '../../i18n/index.js';
import { useLocale } from '../../i18n/LocaleContext.js';

const LOCALE_LABEL: Record<string, string> = { en: 'English', ur: 'اردو', ar: 'العربية' };

export function LanguageSelect({ onNext }: { onNext: () => void }): JSX.Element {
  const { locale, setLocale, t } = useLocale();
  return (
    <Screen lang={locale}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text lang={locale} variant="xl">
          {t('onboarding.languageSelect.title')}
        </Text>
        <Text lang={locale} variant="sm" muted>
          {t('onboarding.languageSelect.prompt')}
        </Text>
        {SUPPORTED_LOCALES.map((candidate) => (
          <Button
            key={candidate}
            label={LOCALE_LABEL[candidate] ?? candidate}
            lang={candidate}
            variant={candidate === locale ? 'primary' : 'secondary'}
            onPress={() => setLocale(candidate)}
          />
        ))}
        <Button label={t('common.next')} lang={locale} onPress={onNext} />
      </View>
    </Screen>
  );
}
