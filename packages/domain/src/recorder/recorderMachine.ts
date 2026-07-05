import { assign, setup } from 'xstate';

/**
 * Canonical recorder state machine (CLAUDE.md §6):
 *
 *   idle -> permission-check -> ready -> recording <-> paused -> review-local
 *     -> uploading -> queued -> processing -> (completed | needs-rerecord | failed)
 *
 * Invariant: the local recording file is never deleted until the server
 * confirms persistence (`SERVER_COMPLETED`/`SERVER_NEEDS_RERECORD`, which set
 * `serverConfirmedPersistence: true`) or the user explicitly discards it
 * (`DISCARD`). Backgrounding, network loss, and low storage must never, by
 * themselves, cause the local file to be deleted.
 */

export type RecorderContext = {
  localUri: string | null;
  attemptId: string | null;
  retryCount: number;
  serverConfirmedPersistence: boolean;
  lastError: string | null;
};

export type RecorderEvent =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'START_RECORDING' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP'; localUri: string }
  | { type: 'DISCARD' }
  | { type: 'RETRY_RECORD' }
  | { type: 'CONFIRM_UPLOAD'; attemptId: string }
  | { type: 'UPLOAD_FAILURE'; error: string }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'NETWORK_LOST' }
  | { type: 'RETRY_UPLOAD' }
  | { type: 'SERVER_PROCESSING' }
  | { type: 'SERVER_COMPLETED' }
  | { type: 'SERVER_NEEDS_RERECORD'; reason: string }
  | { type: 'SERVER_FAILED'; error: string }
  | { type: 'APP_BACKGROUNDED' }
  | { type: 'APP_FOREGROUNDED' }
  | { type: 'STORAGE_LOW' }
  | { type: 'CLEAR_LOCAL' };

const initialContext: RecorderContext = {
  localUri: null,
  attemptId: null,
  retryCount: 0,
  serverConfirmedPersistence: false,
  lastError: null,
};

export const recorderMachine = setup({
  types: {
    context: {} as RecorderContext,
    events: {} as RecorderEvent,
  },
}).createMachine({
  id: 'recorder',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        REQUEST_PERMISSION: 'permissionCheck',
      },
    },
    permissionCheck: {
      on: {
        PERMISSION_GRANTED: 'ready',
        PERMISSION_DENIED: 'permissionDenied',
      },
    },
    permissionDenied: {
      on: {
        REQUEST_PERMISSION: 'permissionCheck',
      },
    },
    ready: {
      on: {
        START_RECORDING: 'recording',
      },
    },
    recording: {
      on: {
        PAUSE: 'paused',
        // Backgrounding mid-recording auto-pauses; nothing is lost because
        // the underlying capture is flushed to the same local file used by
        // an explicit PAUSE.
        APP_BACKGROUNDED: 'paused',
        STOP: {
          target: 'reviewLocal',
          actions: assign({
            localUri: ({ event }) => event.localUri,
          }),
        },
      },
    },
    paused: {
      on: {
        RESUME: 'recording',
        STOP: {
          target: 'reviewLocal',
          actions: assign({
            localUri: ({ event }) => event.localUri,
          }),
        },
        // Explicit user action; only place a not-yet-reviewed take can be
        // deleted, and only because the user asked for it.
        DISCARD: {
          target: 'ready',
          actions: assign({ localUri: () => null }),
        },
      },
    },
    reviewLocal: {
      on: {
        CONFIRM_UPLOAD: {
          target: 'uploading',
          actions: assign({
            attemptId: ({ event }) => event.attemptId,
          }),
        },
        RETRY_RECORD: {
          target: 'ready',
          actions: assign({ localUri: () => null, retryCount: ({ context }) => context.retryCount + 1 }),
        },
        DISCARD: {
          target: 'ready',
          actions: assign({ localUri: () => null }),
        },
      },
    },
    uploading: {
      on: {
        UPLOAD_SUCCESS: 'queued',
        // Local file is retained on failure/network loss so the user can retry
        // without re-recording.
        UPLOAD_FAILURE: {
          target: 'reviewLocal',
          actions: assign({ lastError: ({ event }) => event.error }),
        },
        NETWORK_LOST: 'reviewLocal',
        APP_BACKGROUNDED: 'uploading',
      },
    },
    queued: {
      on: {
        SERVER_PROCESSING: 'processing',
      },
    },
    processing: {
      on: {
        SERVER_COMPLETED: {
          target: 'completed',
          actions: assign({ serverConfirmedPersistence: () => true }),
        },
        SERVER_NEEDS_RERECORD: {
          target: 'needsRerecord',
          actions: assign({ serverConfirmedPersistence: () => true }),
        },
        SERVER_FAILED: {
          target: 'failed',
          actions: assign({ lastError: ({ event }) => event.error }),
        },
      },
    },
    completed: {
      on: {
        // Only now — after server-confirmed persistence — may local storage
        // be reclaimed.
        CLEAR_LOCAL: {
          target: 'idle',
          actions: assign(() => initialContext),
        },
      },
    },
    needsRerecord: {
      on: {
        RETRY_RECORD: {
          target: 'ready',
          actions: assign({ localUri: () => null, retryCount: ({ context }) => context.retryCount + 1 }),
        },
      },
    },
    failed: {
      on: {
        // Never confirmed persisted server-side, so the local file is still
        // present and a bare retry (no re-recording) is safe.
        RETRY_UPLOAD: 'uploading',
        RETRY_RECORD: {
          target: 'ready',
          actions: assign({ localUri: () => null, retryCount: ({ context }) => context.retryCount + 1 }),
        },
      },
    },
  },
});

export type RecorderState = ReturnType<typeof recorderMachine.transition>;
