import { Button, Screen, Text } from '@qari/ui';
import { View } from 'react-native';
import { useLocale } from '../../i18n/LocaleContext.js';

export function ProfileType({
  onSelect,
}: {
  onSelect: (profileType: 'adult' | 'child') => void;
}): JSX.Element {
  const { locale, t } = useLocale();
  return (
    <Screen lang={locale}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text lang={locale} variant="xl">
          {t('onboarding.profileType.title')}
        </Text>
        <Button label={t('onboarding.profileType.adult')} lang={locale} onPress={() => onSelect('adult')} />
        <Button label={t('onboarding.profileType.child')} lang={locale} onPress={() => onSelect('child')} />
      </View>
    </Screen>
  );
}
