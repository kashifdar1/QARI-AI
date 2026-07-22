import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../../i18n/LocaleContext.js';
import type { AttemptsClient, FeedbackReport as FeedbackReportDto } from '../../api/attemptsClient.js';
import type { ContentClient } from '../../api/contentClient.js';
import { FeedbackReport } from './FeedbackReport.js';

function fakeClient(report: FeedbackReportDto): AttemptsClient {
  return {
    getFeedback: async () => report,
    reportIncorrectFeedback: async () => {},
  } as unknown as AttemptsClient;
}

function fakeContentClient(referenceAudioUrl: string | null = 'https://example.com/reference.wav'): ContentClient {
  return {
    getPassageDetail: async () => ({ referenceAudioUrl }),
  } as unknown as ContentClient;
}

function renderReport(client: AttemptsClient, onRetry = () => {}, contentClient = fakeContentClient()) {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <FeedbackReport
          attemptId="attempt-1"
          passageId="passage-1"
          attemptsClient={client}
          contentClient={contentClient}
          onRetry={onRetry}
        />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

function baseReport(overrides: Partial<FeedbackReportDto> = {}): FeedbackReportDto {
  return {
    evaluationStatus: 'completed',
    passageVersion: 'content-version-1',
    modelBundleVersion: 'model-1',
    audioQuality: { passed: true, durationSeconds: 5, failureReasons: [] },
    wordSegments: [],
    issueCandidates: [],
    confidenceTier: 'high',
    coachingMessages: ['Great job! No issues found.'],
    referenceAudioSlices: [],
    retryRecommendation: 'not_needed',
    teacherReviewAvailable: false,
    ...overrides,
  };
}

describe('FeedbackReport — the abstain state (required acceptance criterion)', () => {
  it('renders the abstain message and never labels anything a mistake when confidenceTier is low', async () => {
    renderReport(
      fakeClient(
        baseReport({
          confidenceTier: 'low',
          issueCandidates: [{ wordIndex: 2, tier: 'low', label: null }],
          coachingMessages: ["We weren't confident enough to flag anything specific."],
        }),
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByText("We're not confident enough to flag anything here — nothing is marked as a mistake."),
      ).toBeTruthy(),
    );
    // No issue card is rendered for the low-confidence candidate.
    expect(screen.queryByText(/Possible/)).toBeNull();
  });
});

describe('FeedbackReport — clean attempt', () => {
  it('shows an encouraging message with no issue cards', async () => {
    renderReport(fakeClient(baseReport()));
    await waitFor(() => expect(screen.getAllByText('Great job! No issues found.').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Possible/)).toBeNull();
  });
});

describe('FeedbackReport — visible issues', () => {
  it('renders a card with a visible label for a high-confidence issue and a tap-to-hear button', async () => {
    renderReport(
      fakeClient(
        baseReport({
          confidenceTier: 'high',
          issueCandidates: [{ wordIndex: 3, tier: 'high', label: 'omission' }],
          referenceAudioSlices: [{ wordIndexStart: 3, wordIndexEnd: 3, audioUrl: 'https://example.com#t=1,2' }],
          coachingMessages: ['Possible omission near word 4 — tap to compare.'],
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText('Possible omission')).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tap to hear reference (full passage)' })).toBeTruthy(),
    );
  });
});

describe('FeedbackReport — retry and report actions', () => {
  it('calls onRetry when Retry is pressed', async () => {
    const onRetry = jest.fn();
    renderReport(fakeClient(baseReport()), onRetry);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('the "Ask a teacher" entry point is present but disabled (Principle 4)', async () => {
    renderReport(fakeClient(baseReport()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ask a teacher (coming soon)' })).toBeTruthy());
    const button = screen.getByRole('button', { name: 'Ask a teacher (coming soon)' });
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('submits an incorrect-feedback report and disables the button after sending', async () => {
    const client = fakeClient(baseReport());
    renderReport(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Report incorrect feedback' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Report incorrect feedback' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Report sent' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Report sent' }).props.accessibilityState.disabled).toBe(true);
  });
});
