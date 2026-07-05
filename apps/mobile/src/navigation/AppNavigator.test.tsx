import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../i18n/LocaleContext.js';
import { AppNavigator } from './AppNavigator.js';

function renderApp() {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <AppNavigator />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe('AppNavigator — onboarding flow', () => {
  it('starts on Welcome and walks through LanguageSelect, ProfileType, ConsentExplanation into the tabs', () => {
    renderApp();
    expect(screen.getByText('Welcome to Qari AI')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Choose your language')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Who is practicing?')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'An adult' }));
    expect(screen.getByText('Before you start')).toBeTruthy();
    expect(screen.getByText(/does not replace a qualified teacher/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // Now in tabs — Home is the default active tab.
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
  });

  it('switching language on LanguageSelect flips subsequent screens to RTL Arabic text', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // Arabic button label as rendered in Arabic script.
    fireEvent.press(screen.getByRole('button', { name: 'العربية' }));
    fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('من الذي سيتدرب؟')).toBeTruthy();
  });

  it('switching language to Urdu flips subsequent screens to RTL Urdu text', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.press(screen.getByRole('button', { name: 'اردو' }));
    fireEvent.press(screen.getByRole('button', { name: 'اگلا' }));
    expect(screen.getByText('مشق کون کر رہا ہے؟')).toBeTruthy();
  });

  it('can navigate between all four tabs after onboarding', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // -> LanguageSelect
    fireEvent.press(screen.getByRole('button', { name: 'Next' })); // -> ProfileType
    fireEvent.press(screen.getByRole('button', { name: 'An adult' })); // -> ConsentExplanation
    fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // -> tabs

    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);

    fireEvent.press(screen.getAllByRole('button', { name: 'Library' })[0]!);
    // Real Library screen fetches from the content API (mocked network in
    // this test environment is out of scope here — see Library.test.tsx
    // for fetch-mocked coverage); it renders its loading state first.
    expect(screen.getAllByText('Library').length).toBeGreaterThan(0);

    fireEvent.press(screen.getAllByRole('button', { name: 'Progress' })[0]!);
    expect(
      screen.getByText('Your progress will appear here after your first practice session.'),
    ).toBeTruthy();

    fireEvent.press(screen.getAllByRole('button', { name: 'Settings' })[0]!);
    expect(screen.getByText('Account and language settings.')).toBeTruthy();
  });
});
