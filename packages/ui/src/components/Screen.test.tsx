import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { colorsFor } from '../theme/colors.js';
import { Screen } from './Screen.js';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('Screen', () => {
  it('flips direction to rtl for ar/ur, ltr for en', () => {
    const { UNSAFE_root: enRoot } = render(
      <ThemeProvider>
        <Screen lang="en">
          <RNText>content</RNText>
        </Screen>
      </ThemeProvider>,
    );
    expect(flat(enRoot.findByType('View').props.style).direction).toBe('ltr');

    const { UNSAFE_root: arRoot } = render(
      <ThemeProvider>
        <Screen lang="ar">
          <RNText>محتوى</RNText>
        </Screen>
      </ThemeProvider>,
    );
    expect(flat(arRoot.findByType('View').props.style).direction).toBe('rtl');

    const { UNSAFE_root: urRoot } = render(
      <ThemeProvider>
        <Screen lang="ur">
          <RNText>مواد</RNText>
        </Screen>
      </ThemeProvider>,
    );
    expect(flat(urRoot.findByType('View').props.style).direction).toBe('rtl');
  });

  it('uses the correct background color per theme scheme', () => {
    const { UNSAFE_root: lightRoot } = render(
      <ThemeProvider initialScheme="light">
        <Screen lang="en">
          <RNText>content</RNText>
        </Screen>
      </ThemeProvider>,
    );
    expect(flat(lightRoot.findByType('View').props.style).backgroundColor).toBe(
      colorsFor('light').background,
    );

    const { UNSAFE_root: darkRoot } = render(
      <ThemeProvider initialScheme="dark">
        <Screen lang="en">
          <RNText>content</RNText>
        </Screen>
      </ThemeProvider>,
    );
    expect(flat(darkRoot.findByType('View').props.style).backgroundColor).toBe(
      colorsFor('dark').background,
    );
  });
});
