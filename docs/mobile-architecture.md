# Mobile Architecture

Scope at Milestone 0: navigation map and recorder state machine only, types
only, no screens. **Updated at Milestone A**: the app shell now actually
boots this flow with placeholder screens — see "Milestone A implementation"
below for what's real vs. still-future.

## Navigation map (target shape)

Root is a bottom tab navigator gated by auth state: unauthenticated sessions
render the onboarding stack full-screen instead of the tabs.

```
OnboardingStack (unauthenticated / guest)
├── Welcome
├── LanguageSelect
├── ProfileType                    — adult vs. guardian-managed child
├── ConsentExplanation             — must state AI feedback is uncertain / not a teacher replacement (Principle 4)
├── GuardianSignup
└── GuestStart                     — creates a local-only guest session

RootTabs (authenticated)           — packages/mobile/src/navigation/routeParams.ts: RootTabParamList
├── Learner (tab)                  — LearnerTabParamList
│   ├── PassageBrowser
│   ├── Practice(passageId)        — pushes PracticeStack
│   └── Progress(profileId)
│       └── PracticeStack (modal)  — PracticeStackParamList
│           ├── Recite(passageId, sessionId)     — hosts the recorder
│           ├── ReviewLocal(attemptId)            — recorder state: reviewLocal
│           └── FeedbackReport(attemptId)         — recorder state: completed/needsRerecord
├── Parent (tab)                   — ParentStackParamList
│   ├── FamilyHome
│   ├── ChildProfile(profileId)
│   ├── ConsentSettings(profileId) — grant/revoke, calls /v1/consent
│   └── ProgressDetail(profileId)
└── Settings (tab)                 — SettingsStackParamList
    ├── SettingsHome
    ├── Locale                     — en / ur / ar; ur & ar set RTL (packages/ui LOCALE_DIRECTION)
    ├── DataPrivacy                — export/delete, calls /v1/privacy/*
    └── Account
```

Typed param lists live in `apps/mobile/src/navigation/routeParams.ts` so
screen components and any navigation-service helper share one contract.

## Milestone A implementation

What's actually booted right now is simpler than the target shape above,
because Learner/Parent/Settings need family/consent features that don't
exist yet:

```
OnboardingStack (real, in apps/mobile/src/screens/onboarding/)
Welcome → LanguageSelect → ProfileType → ConsentExplanation → (tabs)

HomeTabs (real, in apps/mobile/src/screens/tabs/)             — HomeTabParamList
Home | Library | Progress | Settings   (all placeholder EmptyState screens)
```

Implementation notes:
- **Not react-navigation.** `apps/mobile/src/navigation/AppNavigator.tsx` is
  a small hand-rolled typed state machine (onboarding step index + active
  tab), not `@react-navigation/*`. At this stage there's no deep linking or
  native back-stack requirement, and avoiding
  `react-native-screens`/`react-native-gesture-handler` sidesteps their
  native-module Jest-mocking overhead. Revisit when Milestone B/C need real
  stack push/pop (the modal `PracticeStack`) and deep links — `RootTabs` /
  `LearnerTabParamList` / `ParentStackParamList` above are the target types
  to navigate to at that point.
- i18n is a minimal home-grown resource+lookup (`apps/mobile/src/i18n/`),
  not i18next — see the module comment there for why, and how to swap it in
  later without touching call sites.
- RTL is proven via `packages/ui`'s `Screen`/`Text` `lang` prop (which sets
  `direction`/`writingDirection`/`textAlign`), not `I18nManager.forceRTL`
  (which requires an app reload and models OS-level RTL, not per-component
  direction) — sufficient to prove the flip in tests without a simulator.

### Guest → guardian upgrade

`GuestStart` creates child profiles and local progress without an account.
`GuardianSignup` reachable from onboarding *or* from Settings while still a
guest calls `POST /v1/auth/guest-upgrade` (see openapi.yaml), which must
preserve those profiles — this is a product requirement carried into the
navigation shape: Settings > Account must expose the upgrade path even
post-guest-session, not just at first launch.

## Recorder state machine

Canonical definition: `packages/domain/src/recorder/recorderMachine.ts`
(XState v5), exhaustively unit-tested in
`packages/domain/src/recorder/recorderMachine.test.ts` (20 tests, all
states and their defined transitions, plus cross-cutting invariants for
`STORAGE_LOW` and the "local file only ever cleared by explicit discard or
post-confirmation clear" rule).

```
idle
  --REQUEST_PERMISSION--> permissionCheck
permissionCheck
  --PERMISSION_GRANTED--> ready
  --PERMISSION_DENIED--> permissionDenied --REQUEST_PERMISSION--> permissionCheck
ready
  --START_RECORDING--> recording
recording
  --PAUSE / APP_BACKGROUNDED--> paused        (auto-pause; nothing lost)
  --STOP--> reviewLocal                        (sets localUri)
paused
  --RESUME--> recording
  --STOP--> reviewLocal
  --DISCARD--> ready                            (explicit; clears localUri)
reviewLocal
  --CONFIRM_UPLOAD--> uploading                 (sets attemptId)
  --RETRY_RECORD / DISCARD--> ready              (explicit; clears localUri)
uploading
  --UPLOAD_SUCCESS--> queued
  --UPLOAD_FAILURE / NETWORK_LOST--> reviewLocal (localUri retained — retry without re-recording)
  --APP_BACKGROUNDED--> uploading                (upload continues; no state change)
queued
  --SERVER_PROCESSING--> processing
processing
  --SERVER_COMPLETED--> completed                (serverConfirmedPersistence = true)
  --SERVER_NEEDS_RERECORD--> needsRerecord       (serverConfirmedPersistence = true)
  --SERVER_FAILED--> failed
completed
  --CLEAR_LOCAL--> idle                          (only now may localUri be reclaimed)
needsRerecord
  --RETRY_RECORD--> ready                        (clears localUri, increments retryCount)
failed
  --RETRY_UPLOAD--> uploading                    (localUri retained; no re-record needed)
  --RETRY_RECORD--> ready

Any state: STORAGE_LOW is a no-op (verified for every reachable state up to
reviewLocal in the exhaustive test suite) — it never transitions or drops
localUri. A real low-storage warning is a UI-layer concern reading machine
context, not an FSM transition.
```

### Invariant this machine enforces

The local recording file (`context.localUri`) is deleted in exactly two
circumstances:

1. **Explicit user action before upload is confirmed**: `DISCARD` (from
   `paused` or `reviewLocal`) or `RETRY_RECORD` (from `reviewLocal`,
   `needsRerecord`, or `failed`).
2. **After the server has confirmed persistence**: `CLEAR_LOCAL`, only
   reachable from `completed`, which is only reachable via
   `SERVER_COMPLETED`/`SERVER_NEEDS_RERECORD` setting
   `serverConfirmedPersistence: true`.

Backgrounding, network loss, and low storage are all modeled as events that
either auto-pause (recording), retain the file for retry (uploading), or are
no-ops (everywhere else) — none of them reach a code path that clears
`localUri`. This satisfies CLAUDE.md §6 directly and is why the test suite
asserts on `context.localUri`, not just on `state.value`, for every
background/network/storage event.

## Open questions for Milestone A

- Whether `APP_BACKGROUNDED` during `uploading` should eventually pause the
  upload on iOS background execution limits (currently modeled as
  continuing) — depends on background task entitlement decisions.
- Exact screen ownership of `RETRY_RECORD` vs. `RETRY_UPLOAD` prompts (UX
  copy, not a state machine question) when a request lands in `failed`.
