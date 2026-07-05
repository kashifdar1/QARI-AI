import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from './i18n/LocaleContext.js';
import { AppNavigator } from './navigation/AppNavigator.js';

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppNavigator />
      </LocaleProvider>
    </ThemeProvider>
  );
}
