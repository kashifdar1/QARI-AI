import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { colorsFor } from '../theme/colors.js';
import { Card } from './Card.js';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('Card', () => {
  it('uses the theme surface color per scheme', () => {
    const { UNSAFE_root } = render(
      <ThemeProvider initialScheme="dark">
        <Card>
          <RNText>content</RNText>
        </Card>
      </ThemeProvider>,
    );
    expect(flat(UNSAFE_root.findByType('View').props.style).backgroundColor).toBe(
      colorsFor('dark').surface,
    );
  });
});
