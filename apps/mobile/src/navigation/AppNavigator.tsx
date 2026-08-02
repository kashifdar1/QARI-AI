import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { getInfoAsync } from 'expo-file-system';
import { ErrorState, IconButton, Text } from '@qari/ui';
import { AttemptsClient } from '../api/attemptsClient.js';
import { AuthClient, type AuthSession } from '../api/authClient.js';
import { ContentClient } from '../api/contentClient.js';
import { SessionClient, type PracticeSession, type Profile } from '../api/sessionClient.js';
import { uploadLocalFile } from '../api/uploadFile.js';
import { generateUuidV4 } from '../api/uuid.js';
import type { AudioRecorder } from '../audio/audioRecorder.js';
import { createAudioRecorder } from '../audio/createAudioRecorder.js';
import { useLocale } from '../i18n/LocaleContext.js';
import { ConsentExplanation } from '../screens/onboarding/ConsentExplanation.js';
import { LanguageSelect } from '../screens/onboarding/LanguageSelect.js';
import { ProfileType } from '../screens/onboarding/ProfileType.js';
import { Welcome } from '../screens/onboarding/Welcome.js';
import { Home } from '../screens/tabs/Home.js';
import { Progress } from '../screens/tabs/Progress.js';
import { Settings } from '../screens/tabs/Settings.js';
import { Library } from '../screens/library/Library.js';
import { PassagePreview } from '../screens/library/PassagePreview.js';
import { FeedbackReport } from '../screens/practice/FeedbackReport.js';
import { Processing } from '../screens/practice/Processing.js';
import { Recite } from '../screens/practice/Recite.js';
import type { HomeTabParamList, OnboardingStackParamList } from './routeParams.js';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

type OnboardingStep = keyof Pick<
  OnboardingStackParamList,
  'Welcome' | 'LanguageSelect' | 'ProfileType' | 'ConsentExplanation'
>;

const ONBOARDING_ORDER: OnboardingStep[] = [
  'Welcome',
  'LanguageSelect',
  'ProfileType',
  'ConsentExplanation',
];

type TabName = keyof HomeTabParamList;
const TAB_ORDER: TabName[] = ['Home', 'Library', 'Progress', 'Settings'];

/**
 * Milestone A's app shell navigator. Intentionally not react-navigation:
 * at this stage there are only placeholder screens and no deep linking /
 * native back-stack requirements, so a small typed state machine covers the
 * onboarding-stack-then-tabs flow from docs/mobile-architecture.md without
 * pulling in react-native-screens/gesture-handler and their native-module
 * test-mocking overhead. Revisit when Milestone B/C need real stack
 * push/pop (modal PracticeStack) and deep links.
 */
type PracticeState =
  | { status: 'closed' }
  | { status: 'recording' }
  | { status: 'uploading' }
  | { status: 'uploadError'; message: string }
  | { status: 'processing'; attemptId: string }
  | { status: 'processingFailed'; attemptId: string }
  | { status: 'feedback'; attemptId: string };

export type AppNavigatorProps = {
  // Every field below defaults to the real implementation the app ships
  // with — these overrides exist solely so AppNavigator.test.tsx can
  // inject fakes for the record -> upload -> processing -> feedback flow,
  // the same dependency-injection-via-props pattern already used by
  // Recite/Processing/FeedbackReport/Library/PassagePreview. Never passed
  // in production (see src/App.tsx).
  contentClient?: ContentClient;
  audioRecorder?: AudioRecorder;
  authClient?: AuthClient;
  attemptsClient?: AttemptsClient;
  sessionClient?: SessionClient;
  uploadFile?: typeof uploadLocalFile;
  /** Forwarded to Processing; lets tests avoid real poll-interval delays. */
  pollIntervalMs?: number;
};

export function AppNavigator(props: AppNavigatorProps = {}): JSX.Element {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [profileType, setProfileType] = useState<'adult' | 'child'>('adult');
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>({ status: 'closed' });
  const defaultContentClient = useMemo(() => new ContentClient(API_BASE_URL), []);
  const contentClient = props.contentClient ?? defaultContentClient;
  const defaultAudioRecorder = useMemo(() => createAudioRecorder(), []);
  const audioRecorder = props.audioRecorder ?? defaultAudioRecorder;
  const defaultAuthClient = useMemo(() => new AuthClient(API_BASE_URL), []);
  const authClient = props.authClient ?? defaultAuthClient;
  const uploadFile = props.uploadFile ?? uploadLocalFile;

  // Bootstrapped lazily on first upload attempt, then reused — a guest
  // session + one profile + one practice session per passage is enough to
  // exercise the record -> upload -> evaluate -> feedback loop without
  // building full signup/login UI (out of scope here; CLAUDE.md's guest
  // session decision is the minimum this needs).
  const authSessionRef = useRef<AuthSession | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const practiceSessionRef = useRef<PracticeSession | null>(null);
  const defaultAttemptsClient = useMemo(
    () => new AttemptsClient(API_BASE_URL, () => authSessionRef.current?.accessToken ?? ''),
    [],
  );
  const attemptsClient = props.attemptsClient ?? defaultAttemptsClient;
  const defaultSessionClient = useMemo(
    () => new SessionClient(API_BASE_URL, () => authSessionRef.current?.accessToken ?? ''),
    [],
  );
  const sessionClient = props.sessionClient ?? defaultSessionClient;

  if (!onboardingComplete) {
    const step = ONBOARDING_ORDER[stepIndex];
    const goNext = () => {
      if (stepIndex + 1 < ONBOARDING_ORDER.length) {
        setStepIndex(stepIndex + 1);
      } else {
        setOnboardingComplete(true);
      }
    };

    switch (step) {
      case 'Welcome':
        return <Welcome onNext={goNext} />;
      case 'LanguageSelect':
        return <LanguageSelect onNext={goNext} />;
      case 'ProfileType':
        return (
          <ProfileType
            onSelect={(selected) => {
              setProfileType(selected);
              goNext();
            }}
          />
        );
      case 'ConsentExplanation':
        return <ConsentExplanation onAccept={goNext} />;
    }
  }

  async function uploadRecording(passageId: string, localUri: string) {
    setPracticeState({ status: 'uploading' });
    try {
      if (!authSessionRef.current) {
        authSessionRef.current = await authClient.createGuestSession();
      }
      if (!profileRef.current) {
        profileRef.current = await sessionClient.createProfile('Me', profileType);
      }
      // A retry reuses the same practice session (Milestone C: "Retry from
      // feedback creates a new attempt in the same session"); a fresh
      // practice-session ref is only created the first time this passage
      // is practiced in this app session.
      if (!practiceSessionRef.current || practiceSessionRef.current.passageId !== passageId) {
        practiceSessionRef.current = await sessionClient.createPracticeSession(profileRef.current.id, passageId);
      }

      const clientAttemptId = generateUuidV4();
      const idempotencyKey = generateUuidV4();
      const attempt = await attemptsClient.createAttempt(practiceSessionRef.current.id, clientAttemptId, idempotencyKey);

      const fileInfo = await getInfoAsync(localUri, { size: true });
      if (!fileInfo.exists) {
        throw new Error('Recording file no longer exists on device');
      }
      const { url } = await attemptsClient.createUploadUrl(attempt.id, fileInfo.size);
      await uploadFile(localUri, url, 'audio/wav');
      await attemptsClient.completeAttempt(attempt.id);

      setPracticeState({ status: 'processing', attemptId: attempt.id });
    } catch (err) {
      setPracticeState({
        status: 'uploadError',
        message: err instanceof Error ? err.message : 'Failed to upload recording',
      });
    }
  }

  if (selectedPassageId && practiceState.status === 'recording') {
    return (
      <View style={{ flex: 1 }}>
        <IconButton accessibilityLabel="Back to passage" onPress={() => setPracticeState({ status: 'closed' })}>
          <Text lang="en" variant="sm">
            ← Back
          </Text>
        </IconButton>
        <Recite
          audioRecorder={audioRecorder}
          onReadyToUpload={(localUri) => void uploadRecording(selectedPassageId, localUri)}
        />
      </View>
    );
  }

  if (selectedPassageId && practiceState.status === 'uploading') {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Text lang="en" variant="lg">
          Uploading recording…
        </Text>
      </View>
    );
  }

  if (selectedPassageId && practiceState.status === 'uploadError') {
    return (
      <ErrorState
        lang="en"
        title="Upload failed"
        description={practiceState.message}
        actionLabel="Back to passage"
        onAction={() => setPracticeState({ status: 'closed' })}
      />
    );
  }

  if (selectedPassageId && practiceState.status === 'processing') {
    const { attemptId } = practiceState;
    return (
      <Processing
        attemptId={attemptId}
        attemptsClient={attemptsClient}
        {...(props.pollIntervalMs !== undefined ? { pollIntervalMs: props.pollIntervalMs } : {})}
        onDone={(status) =>
          setPracticeState(
            // 'failed' means no report was ever generated (evaluation
            // errored before completing, e.g. an undecodable recording) —
            // going to FeedbackReport for it would just 404 on
            // GET /v1/attempts/:id/feedback. 'completed' and
            // 'needs_rerecord' both have a real report (the latter is the
            // audio-quality-gate rejection path) and go there as before.
            status === 'failed' ? { status: 'processingFailed', attemptId } : { status: 'feedback', attemptId },
          )
        }
        onCancel={() => setPracticeState({ status: 'closed' })}
      />
    );
  }

  if (selectedPassageId && practiceState.status === 'processingFailed') {
    return (
      <ErrorState
        lang="en"
        title="Processing failed"
        description="We couldn't evaluate this recording. Please try recording again."
        actionLabel="Back to passage"
        onAction={() => setPracticeState({ status: 'closed' })}
      />
    );
  }

  if (selectedPassageId && practiceState.status === 'feedback') {
    const { attemptId } = practiceState;
    return (
      <FeedbackReport
        attemptId={attemptId}
        passageId={selectedPassageId}
        attemptsClient={attemptsClient}
        contentClient={contentClient}
        onRetry={() => setPracticeState({ status: 'recording' })}
      />
    );
  }

  if (selectedPassageId) {
    return (
      <View style={{ flex: 1 }}>
        <IconButton
          accessibilityLabel="Back to Library"
          onPress={() => {
            setSelectedPassageId(null);
            setPracticeState({ status: 'closed' });
          }}
        >
          <Text lang="en" variant="sm">
            ← Back
          </Text>
        </IconButton>
        <PassagePreview
          passageId={selectedPassageId}
          contentClient={contentClient}
          onStartPractice={() => setPracticeState({ status: 'recording' })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'Home' && <Home />}
        {activeTab === 'Library' && (
          <Library
            contentClient={contentClient}
            onSelectPassage={(passageId) => {
              setPracticeState({ status: 'closed' });
              setSelectedPassageId(passageId);
            }}
          />
        )}
        {activeTab === 'Progress' && <Progress />}
        {activeTab === 'Settings' && <Settings />}
      </View>
      <TabBar activeTab={activeTab} onSelect={setActiveTab} />
    </View>
  );
}

function TabBar({
  activeTab,
  onSelect,
}: {
  activeTab: TabName;
  onSelect: (tab: TabName) => void;
}): JSX.Element {
  const { locale, t } = useLocale();
  const labelKey: Record<TabName, string> = {
    Home: 'tabs.home.title',
    Library: 'tabs.library.title',
    Progress: 'tabs.progress.title',
    Settings: 'tabs.settings.title',
  };

  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 8 }}
    >
      {TAB_ORDER.map((tab) => (
        <IconButton key={tab} accessibilityLabel={t(labelKey[tab])} onPress={() => onSelect(tab)}>
          <Text lang={locale} variant="sm" style={activeTab === tab ? { fontWeight: '700' } : undefined}>
            {t(labelKey[tab])}
          </Text>
        </IconButton>
      ))}
    </View>
  );
}
