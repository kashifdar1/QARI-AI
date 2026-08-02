import { registerWebModule, NativeModule } from 'expo';

// QariAudioRecorderModule is not available on the web platform.
class QariAudioRecorderModule extends NativeModule<Record<string, never>> {}

export default registerWebModule(QariAudioRecorderModule, 'QariAudioRecorderModule');
