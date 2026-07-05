import { render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { IconButton } from './IconButton.js';

describe('IconButton', () => {
  it('requires and exposes an accessibilityLabel (icon-only controls are otherwise invisible to screen readers)', () => {
    render(
      <ThemeProvider>
        <IconButton accessibilityLabel="Play reference audio" onPress={() => {}}>
          <RNText>▶</RNText>
        </IconButton>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Play reference audio' })).toBeTruthy();
  });
});
