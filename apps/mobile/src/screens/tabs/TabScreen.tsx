import { EmptyState, Screen } from '@qari/ui';
import { useLocale } from '../../i18n/LocaleContext.js';

/** Shared placeholder shell for Home/Library/Progress/Settings (Milestone A: no content yet). */
export function TabScreen({ titleKey, emptyKey }: { titleKey: string; emptyKey: string }): JSX.Element {
  const { locale, t } = useLocale();
  return (
    <Screen lang={locale}>
      <EmptyState lang={locale} title={t(titleKey)} description={t(emptyKey)} />
    </Screen>
  );
}
