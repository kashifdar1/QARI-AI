import { recorderMachine, type RecorderContext } from '@qari/domain';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { createActor, type Actor } from 'xstate';
import { Button, ErrorState, PermissionDeniedState, Text } from '@qari/ui';
import type { AudioRecorder } from '../../audio/audioRecorder.js';
import { useLocale } from '../../i18n/LocaleContext.js';

export type ReciteProps = {
  audioRecorder: AudioRecorder;
  onReadyToUpload: (localUri: string) => void;
};

/**
 * Wires the canonical recorder state machine (packages/domain, exhaustively
 * unit-tested at Milestone 0) to real capture. Real device capture
 * (expo-audio, ADR-006/ADR-007) is not verified in this environment — see
 * `audio/audioRecorder.ts` and the milestone risk notes; this screen is
 * built and tested against the `AudioRecorder` interface, which a real
 * implementation must satisfy.
 */
export function Recite({ audioRecorder, onReadyToUpload }: ReciteProps): JSX.Element {
  const { locale } = useLocale();
  const actorRef = useRef<Actor<typeof recorderMachine>>();
  const [snapshotValue, setSnapshotValue] = useState<string>('idle');
  const [context, setContext] = useState<RecorderContext>({
    localUri: null,
    attemptId: null,
    retryCount: 0,
    serverConfirmedPersistence: false,
    lastError: null,
  });
  // Native capture failures (e.g. the platform audio recorder rejecting)
  // aren't modeled in the shared recorder state machine — surfaced here
  // instead of leaving the screen stuck showing the pre-failure state.
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    const actor = createActor(recorderMachine);
    actorRef.current = actor;
    const subscription = actor.subscribe((snapshot) => {
      setSnapshotValue(String(snapshot.value));
      setContext(snapshot.context);
    });
    actor.start();

    // Skip the "Allow microphone" screen when the OS permission was already
    // granted on a previous visit — without this, every remount re-asks the
    // user even though the platform itself won't show a second native
    // dialog, which reads as the app "asking again" for no reason.
    let cancelled = false;
    void (async () => {
      const status = await audioRecorder.getPermissionStatus();
      if (!cancelled && status === 'granted') {
        actor.send({ type: 'REQUEST_PERMISSION' });
        actor.send({ type: 'PERMISSION_GRANTED' });
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      actor.stop();
    };
  }, [audioRecorder]);

  async function handleRequestPermission() {
    actorRef.current?.send({ type: 'REQUEST_PERMISSION' });
    const result = await audioRecorder.requestPermission();
    actorRef.current?.send({ type: result === 'granted' ? 'PERMISSION_GRANTED' : 'PERMISSION_DENIED' });
  }

  async function handleStart() {
    try {
      await audioRecorder.startRecording();
      actorRef.current?.send({ type: 'START_RECORDING' });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Could not start recording');
    }
  }

  async function handlePause() {
    try {
      await audioRecorder.pauseRecording();
      actorRef.current?.send({ type: 'PAUSE' });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Could not pause recording');
    }
  }

  async function handleResume() {
    try {
      await audioRecorder.resumeRecording();
      actorRef.current?.send({ type: 'RESUME' });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Could not resume recording');
    }
  }

  async function handleStop() {
    try {
      const localUri = await audioRecorder.stopRecording();
      actorRef.current?.send({ type: 'STOP', localUri });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Could not stop recording');
    }
  }

  function handleConfirmUpload() {
    if (context.localUri) onReadyToUpload(context.localUri);
  }

  function handleDiscard() {
    if (context.localUri) void audioRecorder.discardRecording(context.localUri);
    actorRef.current?.send({ type: 'DISCARD' });
  }

  if (captureError) {
    return (
      <ErrorState
        lang={locale}
        title="Recording error"
        description={captureError}
        actionLabel="Try again"
        onAction={() => setCaptureError(null)}
      />
    );
  }

  if (snapshotValue === 'idle') {
    return (
      <View style={{ padding: 16, gap: 16 }}>
        <Text lang={locale} variant="lg">
          Ready to record
        </Text>
        <Button label="Allow microphone" lang={locale} onPress={handleRequestPermission} />
      </View>
    );
  }

  if (snapshotValue === 'permissionDenied') {
    return (
      <PermissionDeniedState
        lang={locale}
        title="Microphone access needed"
        description="Please allow microphone access to record your recitation."
        actionLabel="Try again"
        onAction={handleRequestPermission}
      />
    );
  }

  if (snapshotValue === 'ready') {
    return (
      <View style={{ padding: 16, gap: 16 }}>
        <Text lang={locale} variant="lg">
          Mic ready
        </Text>
        <Button label="Start recording" lang={locale} onPress={handleStart} />
      </View>
    );
  }

  if (snapshotValue === 'recording') {
    return (
      <View style={{ padding: 16, gap: 16 }}>
        <Text lang={locale} variant="lg" accessibilityLabel="Recording in progress">
          ● Recording
        </Text>
        <Button label="Pause" lang={locale} onPress={handlePause} />
        <Button label="Stop" lang={locale} onPress={handleStop} variant="secondary" />
      </View>
    );
  }

  if (snapshotValue === 'paused') {
    return (
      <View style={{ padding: 16, gap: 16 }}>
        <Text lang={locale} variant="lg">
          Paused
        </Text>
        <Button label="Resume" lang={locale} onPress={handleResume} />
        <Button label="Stop" lang={locale} onPress={handleStop} variant="secondary" />
        <Button label="Discard" lang={locale} onPress={handleDiscard} variant="secondary" />
      </View>
    );
  }

  if (snapshotValue === 'reviewLocal') {
    return (
      <View style={{ padding: 16, gap: 16 }}>
        <Text lang={locale} variant="lg">
          Review your recording
        </Text>
        <Text lang={locale} variant="sm" muted>
          {context.localUri}
        </Text>
        <Button label="Upload" lang={locale} onPress={handleConfirmUpload} />
        <Button label="Re-record" lang={locale} onPress={() => actorRef.current?.send({ type: 'RETRY_RECORD' })} variant="secondary" />
        <Button label="Discard" lang={locale} onPress={handleDiscard} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={{ padding: 16 }}>
      <Text lang={locale} variant="md">
        {`State: ${snapshotValue}`}
      </Text>
    </View>
  );
}
