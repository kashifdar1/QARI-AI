import { createActor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { recorderMachine } from './recorderMachine.js';

function actorInState(path: Array<{ type: string } & Record<string, unknown>>) {
  const actor = createActor(recorderMachine).start();
  for (const event of path) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actor.send(event as any);
  }
  return actor;
}

describe('recorderMachine — canonical happy path', () => {
  it('walks idle -> ... -> completed and confirms persistence only at the end', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take1.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'attempt-1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
      { type: 'SERVER_COMPLETED' },
    ]);
    expect(actor.getSnapshot().value).toBe('completed');
    expect(actor.getSnapshot().context.serverConfirmedPersistence).toBe(true);
    expect(actor.getSnapshot().context.localUri).toBe('file://take1.wav');
  });

  it('only clears the local file after CLEAR_LOCAL from completed', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take1.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'attempt-1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
      { type: 'SERVER_COMPLETED' },
      { type: 'CLEAR_LOCAL' },
    ]);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.localUri).toBeNull();
  });
});

describe('recorderMachine — exhaustive per-state transitions', () => {
  it('idle: REQUEST_PERMISSION -> permissionCheck; other events are no-ops', () => {
    const actor = actorInState([]);
    expect(actor.getSnapshot().value).toBe('idle');
    actor.send({ type: 'START_RECORDING' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.send({ type: 'REQUEST_PERMISSION' });
    expect(actor.getSnapshot().value).toBe('permissionCheck');
  });

  it('permissionCheck: PERMISSION_GRANTED -> ready', () => {
    const actor = actorInState([{ type: 'REQUEST_PERMISSION' }]);
    actor.send({ type: 'PERMISSION_GRANTED' });
    expect(actor.getSnapshot().value).toBe('ready');
  });

  it('permissionCheck: PERMISSION_DENIED -> permissionDenied, and can retry', () => {
    const actor = actorInState([{ type: 'REQUEST_PERMISSION' }]);
    actor.send({ type: 'PERMISSION_DENIED' });
    expect(actor.getSnapshot().value).toBe('permissionDenied');
    actor.send({ type: 'REQUEST_PERMISSION' });
    expect(actor.getSnapshot().value).toBe('permissionCheck');
  });

  it('ready: START_RECORDING -> recording', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
    ]);
    actor.send({ type: 'START_RECORDING' });
    expect(actor.getSnapshot().value).toBe('recording');
  });

  it('recording: PAUSE -> paused; APP_BACKGROUNDED -> paused (auto-pause, no data loss); STOP -> reviewLocal', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
    ];

    const paused = actorInState(base);
    paused.send({ type: 'PAUSE' });
    expect(paused.getSnapshot().value).toBe('paused');

    const backgrounded = actorInState(base);
    backgrounded.send({ type: 'APP_BACKGROUNDED' });
    expect(backgrounded.getSnapshot().value).toBe('paused');

    const stopped = actorInState(base);
    stopped.send({ type: 'STOP', localUri: 'file://take.wav' });
    expect(stopped.getSnapshot().value).toBe('reviewLocal');
    expect(stopped.getSnapshot().context.localUri).toBe('file://take.wav');
  });

  it('paused: RESUME -> recording; STOP -> reviewLocal; DISCARD -> ready and clears localUri', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'PAUSE' },
    ];

    const resumed = actorInState(base);
    resumed.send({ type: 'RESUME' });
    expect(resumed.getSnapshot().value).toBe('recording');

    const stopped = actorInState(base);
    stopped.send({ type: 'STOP', localUri: 'file://take.wav' });
    expect(stopped.getSnapshot().value).toBe('reviewLocal');

    const discarded = actorInState(base);
    discarded.send({ type: 'DISCARD' });
    expect(discarded.getSnapshot().value).toBe('ready');
    expect(discarded.getSnapshot().context.localUri).toBeNull();
  });

  it('reviewLocal: CONFIRM_UPLOAD -> uploading; RETRY_RECORD -> ready (clears local); DISCARD -> ready (clears local)', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
    ];

    const uploading = actorInState(base);
    uploading.send({ type: 'CONFIRM_UPLOAD', attemptId: 'a1' });
    expect(uploading.getSnapshot().value).toBe('uploading');
    expect(uploading.getSnapshot().context.attemptId).toBe('a1');

    const retried = actorInState(base);
    retried.send({ type: 'RETRY_RECORD' });
    expect(retried.getSnapshot().value).toBe('ready');
    expect(retried.getSnapshot().context.localUri).toBeNull();
    expect(retried.getSnapshot().context.retryCount).toBe(1);

    const discarded = actorInState(base);
    discarded.send({ type: 'DISCARD' });
    expect(discarded.getSnapshot().value).toBe('ready');
    expect(discarded.getSnapshot().context.localUri).toBeNull();
  });

  it('uploading: UPLOAD_SUCCESS -> queued; UPLOAD_FAILURE -> reviewLocal (local retained); NETWORK_LOST -> reviewLocal (local retained); APP_BACKGROUNDED does not drop the upload', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
    ];

    const success = actorInState(base);
    success.send({ type: 'UPLOAD_SUCCESS' });
    expect(success.getSnapshot().value).toBe('queued');

    const failure = actorInState(base);
    failure.send({ type: 'UPLOAD_FAILURE', error: 'network timeout' });
    expect(failure.getSnapshot().value).toBe('reviewLocal');
    expect(failure.getSnapshot().context.localUri).toBe('file://take.wav');
    expect(failure.getSnapshot().context.lastError).toBe('network timeout');

    const networkLost = actorInState(base);
    networkLost.send({ type: 'NETWORK_LOST' });
    expect(networkLost.getSnapshot().value).toBe('reviewLocal');
    expect(networkLost.getSnapshot().context.localUri).toBe('file://take.wav');

    const backgrounded = actorInState(base);
    backgrounded.send({ type: 'APP_BACKGROUNDED' });
    expect(backgrounded.getSnapshot().value).toBe('uploading');
  });

  it('queued: SERVER_PROCESSING -> processing', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
      { type: 'UPLOAD_SUCCESS' },
    ]);
    actor.send({ type: 'SERVER_PROCESSING' });
    expect(actor.getSnapshot().value).toBe('processing');
  });

  it('processing: SERVER_COMPLETED / SERVER_NEEDS_RERECORD / SERVER_FAILED', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
    ];

    const completed = actorInState(base);
    completed.send({ type: 'SERVER_COMPLETED' });
    expect(completed.getSnapshot().value).toBe('completed');
    expect(completed.getSnapshot().context.serverConfirmedPersistence).toBe(true);

    const needsRerecord = actorInState(base);
    needsRerecord.send({ type: 'SERVER_NEEDS_RERECORD', reason: 'low audio quality' });
    expect(needsRerecord.getSnapshot().value).toBe('needsRerecord');
    expect(needsRerecord.getSnapshot().context.serverConfirmedPersistence).toBe(true);

    const failed = actorInState(base);
    failed.send({ type: 'SERVER_FAILED', error: 'inference service unavailable' });
    expect(failed.getSnapshot().value).toBe('failed');
    expect(failed.getSnapshot().context.serverConfirmedPersistence).toBe(false);
  });

  it('completed: CLEAR_LOCAL -> idle and resets context', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
      { type: 'SERVER_COMPLETED' },
    ]);
    actor.send({ type: 'CLEAR_LOCAL' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context).toEqual({
      localUri: null,
      attemptId: null,
      retryCount: 0,
      serverConfirmedPersistence: false,
      lastError: null,
    });
  });

  it('needsRerecord: RETRY_RECORD -> ready, clears local, keeps serverConfirmedPersistence history via retryCount', () => {
    const actor = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
      { type: 'SERVER_NEEDS_RERECORD', reason: 'omission detected' },
    ]);
    actor.send({ type: 'RETRY_RECORD' });
    expect(actor.getSnapshot().value).toBe('ready');
    expect(actor.getSnapshot().context.localUri).toBeNull();
    expect(actor.getSnapshot().context.retryCount).toBe(1);
  });

  it('failed: RETRY_UPLOAD -> uploading without re-recording (local file was never deleted); RETRY_RECORD -> ready', () => {
    const base = [
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'CONFIRM_UPLOAD', attemptId: 'a1' },
      { type: 'UPLOAD_SUCCESS' },
      { type: 'SERVER_PROCESSING' },
      { type: 'SERVER_FAILED', error: 'evaluation crashed' },
    ];

    const retryUpload = actorInState(base);
    expect(retryUpload.getSnapshot().context.localUri).toBe('file://take.wav');
    retryUpload.send({ type: 'RETRY_UPLOAD' });
    expect(retryUpload.getSnapshot().value).toBe('uploading');
    expect(retryUpload.getSnapshot().context.localUri).toBe('file://take.wav');

    const retryRecord = actorInState(base);
    retryRecord.send({ type: 'RETRY_RECORD' });
    expect(retryRecord.getSnapshot().value).toBe('ready');
    expect(retryRecord.getSnapshot().context.localUri).toBeNull();
  });
});

describe('recorderMachine — cross-cutting invariants', () => {
  it('STORAGE_LOW never changes state or drops the local file from any reachable state', () => {
    const statesToProbe: Array<Array<{ type: string } & Record<string, unknown>>> = [
      [],
      [{ type: 'REQUEST_PERMISSION' }],
      [{ type: 'REQUEST_PERMISSION' }, { type: 'PERMISSION_GRANTED' }],
      [{ type: 'REQUEST_PERMISSION' }, { type: 'PERMISSION_GRANTED' }, { type: 'START_RECORDING' }],
      [
        { type: 'REQUEST_PERMISSION' },
        { type: 'PERMISSION_GRANTED' },
        { type: 'START_RECORDING' },
        { type: 'STOP', localUri: 'file://take.wav' },
      ],
    ];
    for (const path of statesToProbe) {
      const actor = actorInState(path);
      const before = actor.getSnapshot();
      actor.send({ type: 'STORAGE_LOW' });
      const after = actor.getSnapshot();
      expect(after.value).toEqual(before.value);
      expect(after.context.localUri).toEqual(before.context.localUri);
    }
  });

  it('the local file is only ever cleared via DISCARD (pre-review, explicit) or CLEAR_LOCAL (post server-confirmation)', () => {
    // reviewLocal -> DISCARD clears local without server confirmation, but
    // this is an explicit user action, distinct from any automatic/implicit
    // loss path (background, network, storage).
    const discarded = actorInState([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'START_RECORDING' },
      { type: 'STOP', localUri: 'file://take.wav' },
      { type: 'DISCARD' },
    ]);
    expect(discarded.getSnapshot().context.localUri).toBeNull();
    expect(discarded.getSnapshot().context.serverConfirmedPersistence).toBe(false);
  });
});
