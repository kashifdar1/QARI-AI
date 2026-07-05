import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../../i18n/LocaleContext.js';
import type { AttemptsClient } from '../../api/attemptsClient.js';
import { Processing } from './Processing.js';

function fakeClient(statuses: string[]): AttemptsClient {
  let call = 0;
  return {
    getEvaluationStatus: async () => {
      const status = statuses[Math.min(call, statuses.length - 1)];
      call += 1;
      return { status };
    },
  } as unknown as AttemptsClient;
}

describe('Processing', () => {
  it('polls until a terminal status and calls onDone', async () => {
    const onDone = jest.fn();
    const client = fakeClient(['queued', 'processing', 'completed']);
    render(
      <ThemeProvider>
        <LocaleProvider>
          <Processing attemptId="a1" attemptsClient={client} onDone={onDone} onCancel={() => {}} pollIntervalMs={5} />
        </LocaleProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('completed'), { timeout: 2000 });
  });

  it('stops polling and calls onCancel when Cancel is pressed', async () => {
    const onDone = jest.fn();
    const onCancel = jest.fn();
    const client = fakeClient(['queued']);
    render(
      <ThemeProvider>
        <LocaleProvider>
          <Processing attemptId="a1" attemptsClient={client} onDone={onDone} onCancel={onCancel} pollIntervalMs={5} />
        </LocaleProvider>
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
  });
});
