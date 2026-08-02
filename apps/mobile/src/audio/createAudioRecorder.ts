import { Platform } from 'react-native';
import { ExpoAudioRecorder } from './expoAudioRecorder.js';
import { QariAudioRecorder } from './qariAudioRecorder.js';
import type { AudioRecorder } from './audioRecorder.js';

/**
 * Android needs QariAudioRecorder's raw-PCM capture (a local Expo module,
 * modules/qari-audio-recorder) to produce real WAV (see
 * qariAudioRecorder.ts / ADR-008) — MediaRecorder-based ExpoAudioRecorder
 * only ever produces AAC on Android. iOS's expo-audio path already emits
 * real WAV natively via LINEARPCM, so it's untouched.
 */
export function createAudioRecorder(): AudioRecorder {
  return Platform.OS === 'android' ? new QariAudioRecorder() : new ExpoAudioRecorder();
}
