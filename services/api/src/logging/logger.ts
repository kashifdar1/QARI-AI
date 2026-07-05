import type { LoggerOptions } from 'pino';
import { redactSensitiveFields } from './redact.js';

/**
 * Applied as a pino `hooks.logMethod` so EVERY log call in the process —
 * not just ones a developer remembers to sanitize — has any URL/object-key
 * field stripped before it's serialized. This is what proves ADR-004's
 * "signed URLs and object storage paths are never written to application
 * logs": it's structural (a logger-level hook), not a per-call-site
 * convention that a future route can forget.
 */
export function buildLoggerOptions(
  stream?: NodeJS.WritableStream,
): LoggerOptions & { stream?: NodeJS.WritableStream } {
  return {
    level: 'info',
    ...(stream ? { stream } : {}),
    hooks: {
      logMethod(inputArgs, method) {
        const redactedArgs = inputArgs.map((arg) =>
          arg && typeof arg === 'object' ? redactSensitiveFields(arg) : arg,
        ) as unknown[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (method as (...args: any[]) => unknown).apply(this, redactedArgs);
      },
    },
  };
}
