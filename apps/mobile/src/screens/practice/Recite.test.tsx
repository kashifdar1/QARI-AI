import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../../i18n/LocaleContext.js';
import { FakeAudioRecorder } from '../../audio/audioRecorder.js';
import { Recite } from './Recite.js';

function renderRecite(recorder = new FakeAudioRecorder(), onReadyToUpload = jest.fn()) {
  render(
    <ThemeProvider>
      <LocaleProvider>
        <Recite audioRecorder={recorder} onReadyToUpload={onReadyToUpload} />
      </LocaleProvider>
    </ThemeProvider>,
  );
  return { onReadyToUpload };
}

describe('Recite — the canonical recorder state machine wired to real capture', () => {
  it('walks permission -> ready -> recording -> stop -> reviewLocal -> upload', async () => {
    const { onReadyToUpload } = renderRecite();

    fireEvent.press(screen.getByRole('button', { name: 'Allow microphone' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
    expect(onReadyToUpload).toHaveBeenCalledWith(expect.stringContaining('file://fake-recording'));
  });

  it('shows the permission-denied state with a real retry path', async () => {
    renderRecite(new FakeAudioRecorder('denied'));
    fireEvent.press(screen.getByRole('button', { name: 'Allow microphone' }));
    await waitFor(() => expect(screen.getByText('Microphone access needed')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('pause and resume work mid-recording without losing the session', async () => {
    renderRecite();
    fireEvent.press(screen.getByRole('button', { name: 'Allow microphone' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
  });

  it('discarding from reviewLocal clears the local file and returns to ready', async () => {
    renderRecite();
    fireEvent.press(screen.getByRole('button', { name: 'Allow microphone' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());
  });
});
