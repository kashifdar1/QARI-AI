import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../i18n/LocaleContext.js';
import { FakeAudioRecorder } from '../audio/audioRecorder.js';
import type { AttemptsClient, Attempt, FeedbackReport as FeedbackReportDto } from '../api/attemptsClient.js';
import type { AuthClient } from '../api/authClient.js';
import type { ContentClient, PassageDetail, PassageSummary } from '../api/contentClient.js';
import type { SessionClient } from '../api/sessionClient.js';
import { AppNavigator, type AppNavigatorProps } from './AppNavigator.js';

function renderApp(overrides: Partial<AppNavigatorProps> = {}) {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <AppNavigator {...overrides} />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe('AppNavigator — onboarding flow', () => {
  it('starts on Welcome and walks through LanguageSelect, ProfileType, ConsentExplanation into the tabs', () => {
    renderApp();
    expect(screen.getByText('Welcome to Qari AI')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Choose your language')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Who is practicing?')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'An adult' }));
    expect(screen.getByText('Before you start')).toBeTruthy();
    expect(screen.getByText(/does not replace a qualified teacher/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // Now in tabs — Home is the default active tab.
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
  });

  it('switching language on LanguageSelect flips subsequent screens to RTL Arabic text', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // Arabic button label as rendered in Arabic script.
    fireEvent.press(screen.getByRole('button', { name: 'العربية' }));
    fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('من الذي سيتدرب؟')).toBeTruthy();
  });

  it('switching language to Urdu flips subsequent screens to RTL Urdu text', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.press(screen.getByRole('button', { name: 'اردو' }));
    fireEvent.press(screen.getByRole('button', { name: 'اگلا' }));
    expect(screen.getByText('مشق کون کر رہا ہے؟')).toBeTruthy();
  });

  it('can navigate between all four tabs after onboarding', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // -> LanguageSelect
    fireEvent.press(screen.getByRole('button', { name: 'Next' })); // -> ProfileType
    fireEvent.press(screen.getByRole('button', { name: 'An adult' })); // -> ConsentExplanation
    fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // -> tabs

    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);

    fireEvent.press(screen.getAllByRole('button', { name: 'Library' })[0]!);
    // Real Library screen fetches from the content API (mocked network in
    // this test environment is out of scope here — see Library.test.tsx
    // for fetch-mocked coverage); it renders its loading state first.
    expect(screen.getAllByText('Library').length).toBeGreaterThan(0);

    fireEvent.press(screen.getAllByRole('button', { name: 'Progress' })[0]!);
    expect(
      screen.getByText('Your progress will appear here after your first practice session.'),
    ).toBeTruthy();

    fireEvent.press(screen.getAllByRole('button', { name: 'Settings' })[0]!);
    expect(screen.getByText('Account and language settings.')).toBeTruthy();
  });
});

// __dirname (not import.meta.url) — see PassagePreview.test.tsx for why.
const SOURCE_PATH = join(__dirname, '../../../../content-import/sources/tanzil-uthmani-v1.1.txt');

function loadAyahText(sura: number, aya: number): string {
  const lines = readFileSync(SOURCE_PATH, 'utf-8').split('\n');
  const line = lines.find((l) => l.startsWith(`${sura}|${aya}|`));
  if (!line) throw new Error(`Ayah ${sura}:${aya} not found`);
  return line.split('|').slice(2).join('|').trim();
}

function fatihaSummary(): PassageSummary {
  return { id: 'p1', surahNumber: 1, ayahStart: 1, ayahEnd: 1, riwayah: 'hafs_an_asim' };
}

function fatihaDetail(): PassageDetail {
  return {
    ...fatihaSummary(),
    referenceAudioUrl: null,
    reciterId: null,
    ayahs: [
      {
        ayahNumber: 1,
        words: loadAyahText(1, 1)
          .split(/\s+/u)
          .map((displayText, wordIndex) => ({ wordIndex, displayText })),
      },
    ],
    translation: { available: false, reason: 'no_cleared_translation_license' },
  };
}

function fakeContentClient(): ContentClient {
  return {
    listPassages: async () => [fatihaSummary()],
    getPassageDetail: async () => fatihaDetail(),
  } as unknown as ContentClient;
}

function fakeAuthClient(): AuthClient {
  return {
    createGuestSession: async () => ({ accessToken: 'test-token', userId: 'user-1' }),
  } as unknown as AuthClient;
}

function fakeSessionClient(): SessionClient {
  return {
    createProfile: async () => ({
      id: 'profile-1',
      ownerUserId: 'user-1',
      displayName: 'Me',
      profileType: 'adult' as const,
      locale: 'en' as const,
    }),
    createPracticeSession: async () => ({ id: 'session-1', profileId: 'profile-1', passageId: 'p1' }),
  } as unknown as SessionClient;
}

function baseFeedbackReport(overrides: Partial<FeedbackReportDto> = {}): FeedbackReportDto {
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

function fakeAttemptsClient(
  options: { evaluationStatuses?: string[]; report?: FeedbackReportDto } = {},
): AttemptsClient {
  const statuses = options.evaluationStatuses ?? ['completed'];
  let pollCall = 0;
  let attemptCounter = 0;
  return {
    createAttempt: async (): Promise<Attempt> => {
      attemptCounter += 1;
      return {
        id: `attempt-${attemptCounter}`,
        sessionId: 'session-1',
        status: 'created',
        retentionState: 'active',
        objectKey: null,
        teacherReviewAvailable: false,
      };
    },
    createUploadUrl: async () => ({ url: 'https://example.com/signed-upload', objectKey: 'recordings/attempt.wav' }),
    completeAttempt: async (): Promise<Attempt> => ({
      id: 'attempt-1',
      sessionId: 'session-1',
      status: 'queued',
      retentionState: 'active',
      objectKey: 'recordings/attempt.wav',
      teacherReviewAvailable: false,
    }),
    getEvaluationStatus: async () => {
      const status = statuses[Math.min(pollCall, statuses.length - 1)];
      pollCall += 1;
      return { status };
    },
    getFeedback: async () => options.report ?? baseFeedbackReport(),
    reportIncorrectFeedback: async () => {},
  } as unknown as AttemptsClient;
}

/** Full dependency set for the practice flow, individually overridable per test. */
function practiceFlowDeps(overrides: Partial<AppNavigatorProps> = {}): AppNavigatorProps {
  return {
    contentClient: fakeContentClient(),
    audioRecorder: new FakeAudioRecorder('granted'),
    authClient: fakeAuthClient(),
    attemptsClient: fakeAttemptsClient(),
    sessionClient: fakeSessionClient(),
    uploadFile: jest.fn(async () => {}),
    pollIntervalMs: 5,
    ...overrides,
  };
}

async function completeOnboardingAndOpenPassage() {
  fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // Welcome -> LanguageSelect
  fireEvent.press(screen.getByRole('button', { name: 'Next' })); // -> ProfileType
  fireEvent.press(screen.getByRole('button', { name: 'An adult' })); // -> ConsentExplanation
  fireEvent.press(screen.getByRole('button', { name: 'Continue' })); // -> tabs

  fireEvent.press(screen.getAllByRole('button', { name: 'Library' })[0]!);
  await waitFor(() => expect(screen.getByText('Surah 1')).toBeTruthy());
  fireEvent.press(screen.getByText('Surah 1'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start practice' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Start practice' }));
  // Recite mounts here and its own permission-check effect
  // (getPermissionStatus(), async) resolves shortly after — wait for it to
  // settle (wrapped in waitFor's act()) before returning, rather than
  // leaving that resolution to land in the gap between this function
  // returning and the caller's next awaited call, which is what caused
  // React's "not wrapped in act(...)" warning during development.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());
}

/** Drives Recite through to Upload — assumes the recorder is already
 * permission-granted (FakeAudioRecorder('granted') auto-skips "Allow
 * microphone", per Recite.tsx's own permission-check effect). Waits for
 * "Start recording" itself too (not just in completeOnboardingAndOpenPassage),
 * since a Retry remounts Recite fresh without going through that helper
 * again. */
async function recordAndUpload() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Start recording' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Upload' }));
}

describe('AppNavigator — record -> upload -> processing -> feedback (Milestone C vertical slice)', () => {
  it('walks the full happy path from Library through a completed feedback report', async () => {
    renderApp(practiceFlowDeps({ attemptsClient: fakeAttemptsClient({ evaluationStatuses: ['queued', 'processing', 'completed'] }) }));
    await completeOnboardingAndOpenPassage();
    await recordAndUpload();
    await waitFor(() => expect(screen.getAllByText('Great job! No issues found.').length).toBeGreaterThan(0), {
      timeout: 3000,
    });
  });

  it('routes a failed evaluation to a dedicated "Processing failed" screen, not the feedback 404 path', async () => {
    renderApp(practiceFlowDeps({ attemptsClient: fakeAttemptsClient({ evaluationStatuses: ['queued', 'failed'] }) }));
    await completeOnboardingAndOpenPassage();
    await recordAndUpload();
    await waitFor(() => expect(screen.getByText('Processing failed')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText("We couldn't evaluate this recording. Please try recording again.")).toBeTruthy();
  });

  it('routes needs_rerecord (audio-quality-gate rejection) to the real feedback screen, with its report', async () => {
    renderApp(
      practiceFlowDeps({
        attemptsClient: fakeAttemptsClient({
          evaluationStatuses: ['needs_rerecord'],
          report: baseFeedbackReport({
            evaluationStatus: 'needs_rerecord',
            confidenceTier: 'low',
            audioQuality: { passed: false, durationSeconds: 2, failureReasons: ['noisy'] },
            coachingMessages: ["We weren't confident enough to flag anything specific."],
          }),
        }),
      }),
    );
    await completeOnboardingAndOpenPassage();
    await recordAndUpload();
    await waitFor(
      () =>
        expect(
          screen.getByText("We're not confident enough to flag anything here — nothing is marked as a mistake."),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
  });

  it('shows "Upload failed" with the real error message when the upload orchestration throws', async () => {
    const failingAuthClient = {
      createGuestSession: async () => {
        throw new Error('network down');
      },
    } as unknown as AuthClient;
    renderApp(practiceFlowDeps({ authClient: failingAuthClient }));
    await completeOnboardingAndOpenPassage();
    await recordAndUpload();
    await waitFor(() => expect(screen.getByText('Upload failed')).toBeTruthy());
    expect(screen.getByText('network down')).toBeTruthy();
  });

  it('reuses one practice session across a Retry within the same passage', async () => {
    let createSessionCalls = 0;
    const sessionClient = {
      createProfile: async () => ({
        id: 'profile-1',
        ownerUserId: 'user-1',
        displayName: 'Me',
        profileType: 'adult' as const,
        locale: 'en' as const,
      }),
      createPracticeSession: async () => {
        createSessionCalls += 1;
        return { id: 'session-1', profileId: 'profile-1', passageId: 'p1' };
      },
    } as unknown as SessionClient;
    renderApp(
      practiceFlowDeps({
        sessionClient,
        attemptsClient: fakeAttemptsClient({ evaluationStatuses: ['completed'] }),
      }),
    );
    await completeOnboardingAndOpenPassage();
    await recordAndUpload();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy(), { timeout: 3000 });

    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await recordAndUpload();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy(), { timeout: 3000 });

    expect(createSessionCalls).toBe(1);
  });
});
