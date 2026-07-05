import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { colorsFor } from '../theme/colors.js';
import { Button } from './Button.js';

function renderWithTheme(ui: JSX.Element, scheme: 'light' | 'dark' = 'light') {
  return render(<ThemeProvider initialScheme={scheme}>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('exposes an accessible button role and label for English', () => {
    renderWithTheme(<Button label="Start" lang="en" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  it('exposes an accessible button role and label for Arabic', () => {
    renderWithTheme(<Button label="ابدأ" lang="ar" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'ابدأ' })).toBeTruthy();
  });

  it('marks itself disabled via accessibilityState when disabled', () => {
    renderWithTheme(<Button label="Start" lang="en" onPress={() => {}} disabled />);
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('renders with the light theme primary color', () => {
    renderWithTheme(<Button label="Start" lang="en" onPress={() => {}} />, 'light');
    const button = screen.getByRole('button', { name: 'Start' });
    const flatStyle = [button.props.style].flat();
    const bg = flatStyle.find((s: Record<string, unknown>) => s && 'backgroundColor' in s);
    expect(bg.backgroundColor).toBe(colorsFor('light').primary);
  });

  it('renders with the dark theme primary color', () => {
    renderWithTheme(<Button label="Start" lang="en" onPress={() => {}} />, 'dark');
    const button = screen.getByRole('button', { name: 'Start' });
    const flatStyle = [button.props.style].flat();
    const bg = flatStyle.find((s: Record<string, unknown>) => s && 'backgroundColor' in s);
    expect(bg.backgroundColor).toBe(colorsFor('dark').primary);
  });
});
