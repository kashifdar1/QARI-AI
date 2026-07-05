/**
 * Typed param lists for the navigation map documented in
 * docs/mobile-architecture.md. Screens themselves are built in Milestone A;
 * this file is the typed contract navigation code will depend on.
 */

export type OnboardingStackParamList = {
  Welcome: undefined;
  LanguageSelect: undefined;
  ProfileType: undefined;
  ConsentExplanation: undefined;
  GuardianSignup: undefined;
  GuestStart: undefined;
};

/**
 * Milestone A's actual booted tab set (Home/Library/Progress/Settings) —
 * simpler than the eventual Learner/Parent/Settings split in
 * `RootTabParamList` below, which needs family/consent features that don't
 * exist yet. `RootTabParamList` is the target shape once the Parent stack
 * ships; `HomeTabParamList` is what Milestone A actually wires up.
 */
export type HomeTabParamList = {
  Home: undefined;
  Library: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type LearnerTabParamList = {
  PassageBrowser: undefined;
  Practice: { passageId: string };
  Progress: { profileId: string };
};

export type PracticeStackParamList = {
  Recite: { passageId: string; sessionId: string };
  ReviewLocal: { attemptId: string };
  FeedbackReport: { attemptId: string };
};

export type ParentStackParamList = {
  FamilyHome: undefined;
  ChildProfile: { profileId: string };
  ConsentSettings: { profileId: string };
  ProgressDetail: { profileId: string };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Locale: undefined;
  DataPrivacy: undefined;
  Account: undefined;
};

export type RootTabParamList = {
  Learner: undefined;
  Parent: undefined;
  Settings: undefined;
};
