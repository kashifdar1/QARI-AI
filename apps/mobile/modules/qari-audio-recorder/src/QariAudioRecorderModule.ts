import { NativeModule, requireNativeModule } from 'expo';

export type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  expires: 'never' | number;
  canAskAgain: boolean;
};

export type StartOrStopRecordingResult = {
  fileUri: string;
  size?: number;
};

declare class QariAudioRecorderModule extends NativeModule<Record<string, never>> {
  requestPermissionsAsync(): Promise<PermissionResponse>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  startRecording(): Promise<StartOrStopRecordingResult>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  stopRecording(): Promise<StartOrStopRecordingResult>;
}

export default requireNativeModule<QariAudioRecorderModule>('QariAudioRecorder');
