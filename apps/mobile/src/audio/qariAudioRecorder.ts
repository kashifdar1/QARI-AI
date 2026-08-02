import QariAudioRecorderModule from '../../modules/qari-audio-recorder/src/QariAudioRecorderModule.js';
import { deleteAsync } from 'expo-file-system';
import type { AudioRecorder } from './audioRecorder.js';

// Android-only capture path (ADR-008): Android's MediaRecorder has no
// WAV/PCM output option — it only ever produces AAC-in-m4a (see
// expoAudioRecorder.ts's BASE_OPTIONS comment), which
// services/inference's soundfile-based decoder cannot read. Rather than
// transcode AAC to WAV after the fact (lossy, and requires trimming the AAC
// encoder's leading priming-sample silence to avoid skewing word-onset
// timing), this local Expo module captures raw PCM directly via Android's
// AudioRecord API, so no encode/decode round-trip ever happens. iOS keeps
// using ExpoAudioRecorder (expo-audio), which already emits real WAV
// natively.
export class QariAudioRecorder implements AudioRecorder {
  async requestPermission(): Promise<'granted' | 'denied'> {
    const result = await QariAudioRecorderModule.requestPermissionsAsync();
    return result.granted ? 'granted' : 'denied';
  }

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    const result = await QariAudioRecorderModule.getPermissionsAsync();
    return result.status;
  }

  async startRecording(): Promise<void> {
    await QariAudioRecorderModule.startRecording();
  }

  async pauseRecording(): Promise<void> {
    await QariAudioRecorderModule.pauseRecording();
  }

  async resumeRecording(): Promise<void> {
    await QariAudioRecorderModule.resumeRecording();
  }

  async stopRecording(): Promise<string> {
    const result = await QariAudioRecorderModule.stopRecording();
    const uri = result?.fileUri;
    if (!uri) throw new Error('Recorder stopped without producing a file URI');
    // Kotlin's File.toURI().toString() produces a single-slash "file:/..."
    // URI, not the standard three-slash "file:///...". expo-file-system's
    // own getInfoAsync tolerates this (its regex matches any number of
    // slashes after "file:"), but React Native's fetch() (used by
    // uploadFile.ts to read the local file for upload) does not — it fails
    // with "Failed to construct 'Response': The status provided (0) is
    // outside the range [200, 599]" on a single-slash URI. Normalize once
    // here so every consumer gets an unambiguous, standard file:// URI.
    return uri.replace(/^file:\/*/, 'file:///');
  }

  async discardRecording(localUri: string): Promise<void> {
    await deleteAsync(localUri, { idempotent: true });
  }
}
