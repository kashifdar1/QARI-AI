import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text } from '@qari/ui';
import { ContentClient } from '../api/contentClient.js';
import { ExpoAudioRecorder } from '../audio/expoAudioRecorder.js';
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
type PracticeState = { status: 'closed' } | { status: 'recording' } | { status: 'saved'; localUri: string };

export function AppNavigator(): JSX.Element {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>({ status: 'closed' });
  const contentClient = useMemo(() => new ContentClient(API_BASE_URL), []);
  const audioRecorder = useMemo(() => new ExpoAudioRecorder(), []);

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
        return <ProfileType onSelect={goNext} />;
      case 'ConsentExplanation':
        return <ConsentExplanation onAccept={goNext} />;
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
          onReadyToUpload={(localUri) => setPracticeState({ status: 'saved', localUri })}
        />
      </View>
    );
  }

  if (selectedPassageId && practiceState.status === 'saved') {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Text lang="en" variant="lg">
          Recording saved
        </Text>
        <Text lang="en" variant="sm" muted>
          Saved locally on this device. Uploading for evaluation and feedback isn't available yet — that part of
          the app isn't built.
        </Text>
        <Button
          label="Back to passage"
          lang="en"
          onPress={() => setPracticeState({ status: 'closed' })}
        />
      </View>
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
