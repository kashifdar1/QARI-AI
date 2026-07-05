import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { colorsFor } from '../theme/colors.js';
import { Text } from './Text.js';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('Text — RTL', () => {
  it('renders English as LTR, left-aligned', () => {
    render(
      <ThemeProvider>
        <Text lang="en">Hello</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('Hello').props.style);
    expect(style.writingDirection).toBe('ltr');
    expect(style.textAlign).toBe('left');
  });

  it('renders Arabic as RTL, right-aligned', () => {
    render(
      <ThemeProvider>
        <Text lang="ar">مرحبا</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('مرحبا').props.style);
    expect(style.writingDirection).toBe('rtl');
    expect(style.textAlign).toBe('right');
  });

  it('renders Urdu as RTL, right-aligned', () => {
    render(
      <ThemeProvider>
        <Text lang="ur">سلام</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('سلام').props.style);
    expect(style.writingDirection).toBe('rtl');
    expect(style.textAlign).toBe('right');
  });

  it('uses the Arabic font family only for the ar variant, not en/ur', () => {
    render(
      <ThemeProvider>
        <Text lang="ar">مرحبا</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('مرحبا').props.style);
    expect(style.fontFamily).toBe('KFGQPCUthmanicScriptHafs-Regular');
  });
});

describe('Text — dark mode', () => {
  it('uses light-theme text color under a light ThemeProvider', () => {
    render(
      <ThemeProvider initialScheme="light">
        <Text lang="en">Hello</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('Hello').props.style);
    expect(style.color).toBe(colorsFor('light').textPrimary);
  });

  it('uses dark-theme text color under a dark ThemeProvider', () => {
    render(
      <ThemeProvider initialScheme="dark">
        <Text lang="en">Hello</Text>
      </ThemeProvider>,
    );
    const style = flat(screen.getByText('Hello').props.style);
    expect(style.color).toBe(colorsFor('dark').textPrimary);
  });
});
