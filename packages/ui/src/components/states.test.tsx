import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { EmptyState } from './EmptyState.js';
import { ErrorState } from './ErrorState.js';
import { LoadingState } from './LoadingState.js';
import { OfflineBanner } from './OfflineBanner.js';
import { PermissionDeniedState } from './PermissionDeniedState.js';

function withTheme(ui: JSX.Element) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('state components', () => {
  it('EmptyState renders title/description and an optional action', () => {
    withTheme(
      <EmptyState
        lang="en"
        title="No passages yet"
        description="Browse the library to start practicing."
        actionLabel="Browse"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('No passages yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy();
  });

  it('ErrorState exposes accessibilityRole="alert" so screen readers announce it', () => {
    const { UNSAFE_root } = withTheme(
      <ErrorState lang="en" title="Something went wrong" />,
    );
    expect(UNSAFE_root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
  });

  it('PermissionDeniedState renders in Urdu with RTL text', () => {
    withTheme(<PermissionDeniedState lang="ur" title="اجازت نہیں ملی" />);
    expect(screen.getByText('اجازت نہیں ملی')).toBeTruthy();
  });

  it('LoadingState exposes accessibilityRole="progressbar" with a label', () => {
    withTheme(<LoadingState lang="en" label="Loading passages" />);
    expect(screen.getByLabelText('Loading passages')).toBeTruthy();
  });

  it('OfflineBanner exposes an announced alert with a polite live region', () => {
    const { UNSAFE_root } = withTheme(<OfflineBanner lang="en" label="You are offline" />);
    const banner = UNSAFE_root.findByProps({ accessibilityRole: 'alert' });
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('You are offline')).toBeTruthy();
  });
});
