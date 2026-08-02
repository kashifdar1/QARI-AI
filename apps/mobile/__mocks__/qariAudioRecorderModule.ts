// modules/qari-audio-recorder wraps expo-modules-core's requireNativeModule,
// which isn't available under the plain "react-native" Jest preset used
// here (no jest-expo native-module mocking layer) — see
// __mocks__/expo-audio.ts for the same underlying reason. Screens are
// exercised against the FakeAudioRecorder (src/audio/audioRecorder.ts);
// this mock only exists so that files which import qariAudioRecorder.ts
// transitively (e.g. AppNavigator, via createAudioRecorder.ts) don't crash
// the test suite. Real capture is exercised on device, not under Jest.
export default {
  async requestPermissionsAsync(): Promise<{ granted: boolean; status: string }> {
    return { granted: true, status: 'granted' };
  },
  async getPermissionsAsync(): Promise<{ granted: boolean; status: string }> {
    return { granted: true, status: 'granted' };
  },
  async startRecording(): Promise<{ fileUri: string }> {
    return { fileUri: 'file://fake-qari-audio-recording.wav' };
  },
  async pauseRecording(): Promise<void> {},
  async resumeRecording(): Promise<void> {},
  async stopRecording(): Promise<{ fileUri: string }> {
    return { fileUri: 'file://fake-qari-audio-recording.wav' };
  },
};
