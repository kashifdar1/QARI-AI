import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder as NativeAudioRecorderType,
  type RecordingOptions,
} from 'expo-audio';
import { Platform } from 'react-native';
import { deleteAsync } from 'expo-file-system';
import type { AudioRecorder } from './audioRecorder.js';

// Target capture format per ADR-004/ADR-007: 16kHz mono, 16-bit PCM WAV.
// Built on Expo's own HIGH_QUALITY preset (known-good option shape) rather
// than a from-scratch options object. Android's MediaRecorder has no
// WAV/PCM output option (AndroidOutputFormat has no "wav" member) — it
// records AAC-in-m4a here, and per CLAUDE.md's own capture-format note
// ("transcode on device if the recorder emits AAC/m4a") an on-device
// transcode step to WAV is still required before upload; not implemented yet.
const BASE_OPTIONS: RecordingOptions = {
  ...(RecordingPresets.HIGH_QUALITY as RecordingOptions),
  sampleRate: 16000,
  numberOfChannels: 1,
};

// expo-audio's native constructor (AudioModule.AudioRecorder, not a bare
// "AudioRecorder" export — that name only exists as a type, and importing it
// as a value resolves to undefined) expects the platform-specific overrides
// flattened into the top-level options object, not nested under
// `{ android: {...}, ios: {...} }`. This mirrors expo-audio's own internal
// `createRecordingOptions` (build/utils/options.js), which isn't exported
// publicly.
function flattenRecordingOptions(options: RecordingOptions): Record<string, unknown> {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  };
  if (Platform.OS === 'ios') return { ...common, ...options.ios };
  if (Platform.OS === 'android') return { ...common, ...options.android };
  return common;
}

export class ExpoAudioRecorder implements AudioRecorder {
  private recorder: NativeAudioRecorderType | null = null;

  async requestPermission(): Promise<'granted' | 'denied'> {
    const result = await requestRecordingPermissionsAsync();
    return result.granted ? 'granted' : 'denied';
  }

  async startRecording(): Promise<void> {
    await setAudioModeAsync({ allowsRecording: true });
    const recorder = new AudioModule.AudioRecorder(flattenRecordingOptions(BASE_OPTIONS));
    await recorder.prepareToRecordAsync();
    recorder.record();
    this.recorder = recorder;
  }

  async pauseRecording(): Promise<void> {
    this.recorder?.pause();
  }

  async resumeRecording(): Promise<void> {
    this.recorder?.record();
  }

  async stopRecording(): Promise<string> {
    if (!this.recorder) throw new Error('No active recording to stop');
    await this.recorder.stop();
    const uri = this.recorder.uri;
    if (!uri) throw new Error('Recorder stopped without producing a file URI');
    return uri;
  }

  async discardRecording(localUri: string): Promise<void> {
    await deleteAsync(localUri, { idempotent: true });
  }
}
