// expo-audio wraps native modules (expo-modules-core's EventEmitter) that
// aren't available under the plain "react-native" Jest preset used here (no
// jest-expo native-module mocking layer). Screens are exercised against the
// FakeAudioRecorder (src/audio/audioRecorder.ts); this mock only exists so
// that files which import expoAudioRecorder.ts transitively (e.g.
// AppNavigator) don't crash the test suite. Real capture is exercised on
// device, not under Jest.
class MockAudioRecorder {
  uri: string | null = null;
  async prepareToRecordAsync(): Promise<void> {}
  record(): void {}
  pause(): void {}
  async stop(): Promise<void> {}
}

export const AudioModule = {
  AudioRecorder: MockAudioRecorder,
};

export const RecordingPresets: Record<string, Record<string, unknown>> = {
  HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
};

export async function requestRecordingPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted: true };
}

export async function setAudioModeAsync(): Promise<void> {}

export type RecordingOptions = Record<string, unknown>;

export class MockAudioPlayer {
  play(): void {}
  pause(): void {}
  release(): void {}
}

export type AudioPlayer = MockAudioPlayer;

export function createAudioPlayer(): MockAudioPlayer {
  return new MockAudioPlayer();
}
