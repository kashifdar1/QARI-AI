import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { SUPPORTED_LOCALES, translate, type SupportedLocale } from './index.js';

export type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale = 'en',
  children,
}: {
  initialLocale?: SupportedLocale;
  children: ReactNode;
}): JSX.Element {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => translate(locale, key),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}

export { SUPPORTED_LOCALES };
