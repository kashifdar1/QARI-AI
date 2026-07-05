import { describe, expect, it } from 'vitest';
import { redactSensitiveFields } from './redact.js';

describe('redactSensitiveFields', () => {
  it('redacts a top-level signed URL field', () => {
    const result = redactSensitiveFields({ signedUploadUrl: 'https://s3.example.com/secret' });
    expect(result.signedUploadUrl).toBe('[REDACTED]');
  });

  it('redacts nested audioUrl and objectKey fields at any depth', () => {
    const input = {
      attempt: {
        id: 'attempt-1',
        upload: { audioUrl: 'https://s3.example.com/audio/secret.wav', objectKey: 'audio/secret.wav' },
      },
    };
    const result = redactSensitiveFields(input);
    expect(result.attempt.upload.audioUrl).toBe('[REDACTED]');
    expect(result.attempt.upload.objectKey).toBe('[REDACTED]');
    expect(result.attempt.id).toBe('attempt-1');
  });

  it('redacts URL fields inside arrays', () => {
    const input = { items: [{ url: 'https://s3.example.com/a' }, { url: 'https://s3.example.com/b' }] };
    const result = redactSensitiveFields(input);
    expect(result.items[0]?.url).toBe('[REDACTED]');
    expect(result.items[1]?.url).toBe('[REDACTED]');
  });

  it('never leaves the raw URL string reachable anywhere in the output', () => {
    const secretUrl = 'https://s3.example.com/qari-audio-dev/attempt-42.wav?sig=abc123';
    const input = { evaluation: { attemptId: 'attempt-42', sourceUrl: secretUrl } };
    const result = redactSensitiveFields(input);
    expect(JSON.stringify(result)).not.toContain(secretUrl);
    expect(JSON.stringify(result)).not.toContain('sig=abc123');
  });

  it('leaves unrelated fields untouched', () => {
    const result = redactSensitiveFields({ attemptId: 'attempt-1', status: 'completed' });
    expect(result).toEqual({ attemptId: 'attempt-1', status: 'completed' });
  });

  it('does not recurse infinitely on a circular object (e.g. a raw Node request/socket)', () => {
    const circular: Record<string, unknown> = { attemptId: 'attempt-1' };
    circular.self = circular;
    expect(() => redactSensitiveFields(circular)).not.toThrow();
    const result = redactSensitiveFields(circular) as { attemptId: string; self: string };
    expect(result.attemptId).toBe('attempt-1');
    expect(result.self).toBe('[Circular]');
  });
});
