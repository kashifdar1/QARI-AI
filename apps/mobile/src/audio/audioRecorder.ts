/**
 * Recording capture interface (Milestone C task 1). The real implementation
 * (expo-audio, per ADR-006/ADR-007) is NOT wired up in this environment —
 * there is no simulator/device or native build tooling here to verify it
 * against. `FakeAudioRecorder` is what screens are tested against; a real
 * `ExpoAudioRecorder` implementing the same interface is future work,
 * explicitly flagged as unverified in the milestone risk notes.
 */
export type AudioRecorder = {
  requestPermission(): Promise<'granted' | 'denied'>;
  /** Reads the current OS permission grant without prompting — lets the UI
   * skip the "Allow microphone" screen on repeat visits once the user has
   * already granted it once, instead of asking again every time. */
  getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'>;
  startRecording(): Promise<void>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  /** Stops capture and returns the local file URI — the recorder state
   * machine (packages/domain) treats this as the 16kHz mono 16-bit PCM WAV
   * artifact (ADR-004/ADR-007: transcoded on-device where the OS recorder
   * doesn't natively emit it). */
  stopRecording(): Promise<string>;
  discardRecording(localUri: string): Promise<void>;
};

export class FakeAudioRecorder implements AudioRecorder {
  private fileCounter = 0;
  constructor(
    private readonly permissionResult: 'granted' | 'denied' | 'undetermined' = 'granted',
  ) {}

  async requestPermission(): Promise<'granted' | 'denied'> {
    return this.permissionResult === 'denied' ? 'denied' : 'granted';
  }

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    return this.permissionResult;
  }

  async startRecording(): Promise<void> {}
  async pauseRecording(): Promise<void> {}
  async resumeRecording(): Promise<void> {}

  async stopRecording(): Promise<string> {
    this.fileCounter += 1;
    return `file://fake-recording-${this.fileCounter}.wav`;
  }

  async discardRecording(): Promise<void> {}
}
