import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { ProgressBar } from './ProgressBar.js';

describe('ProgressBar', () => {
  it('exposes accessibilityValue.now as a 0-100 percentage, clamped', () => {
    const { UNSAFE_root } = render(
      <ThemeProvider>
        <ProgressBar value={0.42} />
      </ThemeProvider>,
    );
    const bar = UNSAFE_root.findByProps({ accessibilityRole: 'progressbar' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });

  it('clamps out-of-range values', () => {
    const { UNSAFE_root: over } = render(
      <ThemeProvider>
        <ProgressBar value={1.5} />
      </ThemeProvider>,
    );
    expect(
      over.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now,
    ).toBe(100);

    const { UNSAFE_root: under } = render(
      <ThemeProvider>
        <ProgressBar value={-0.5} />
      </ThemeProvider>,
    );
    expect(
      under.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now,
    ).toBe(0);
  });
});
