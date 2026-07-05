const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const MAX_DEPTH = 8;

/**
 * Matches any key that names a URL or an object-storage path, regardless of
 * nesting depth or exact key spelling (`url`, `audioUrl`, `signedUploadUrl`,
 * `objectKey`, ...). ADR-004: "the signed URL and any object storage path
 * are never written to application logs" — this is the single choke point
 * that guarantee runs through, applied to every log call (see
 * logging/logger.ts's pino hook), not left to each call site to remember.
 */
const SENSITIVE_KEY_PATTERN = /url|objectkey/i;

export function redactSensitiveFields<T>(value: T): T {
  return redact(value, new WeakSet(), 0) as T;
}

/**
 * This runs as a pino `hooks.logMethod`, which receives arguments BEFORE
 * pino's own req/res serializers run — so on Fastify's internal
 * "incoming request"/"request completed" log lines, `value` can be the
 * live Fastify Request/Reply object, whose `raw`/`socket` chain is
 * circular (Node's IncomingMessage <-> socket <-> parser back-references).
 * Depth-capping and cycle-tracking are load-bearing here, not defensive
 * decoration: without them this recurses into that cycle on every single
 * request the server handles.
 */
function redact(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[MaxDepth]';
  if (Array.isArray(value)) {
    if (seen.has(value)) return CIRCULAR;
    seen.add(value);
    return value.map((item) => redact(item, seen, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return CIRCULAR;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, seen, depth + 1);
    }
    return out;
  }
  return value;
}
