import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { buildLoggerOptions } from './logger.js';

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: () => chunks.join('') };
}

describe('buildLoggerOptions — wired into a real pino logger', () => {
  it('never writes a signed audio URL to the log stream, even when a call site logs it directly', () => {
    const { stream, output } = captureStream();
    const logger = pino(buildLoggerOptions(), stream);

    const secretUrl =
      'https://s3.example.com/qari-audio-dev/attempts/attempt-42.wav?X-Amz-Signature=topsecret';
    logger.info({ attemptId: 'attempt-42', signedUploadUrl: secretUrl }, 'upload url issued');

    const written = output();
    expect(written).not.toContain(secretUrl);
    expect(written).not.toContain('X-Amz-Signature=topsecret');
    expect(written).toContain('attempt-42');
    expect(written).toContain('[REDACTED]');
  });

  it('redacts an objectKey field the same way', () => {
    const { stream, output } = captureStream();
    const logger = pino(buildLoggerOptions(), stream);

    logger.info({ objectKey: 'audio/private/attempt-9001.wav' }, 'object stored');

    expect(output()).not.toContain('attempt-9001.wav');
  });

  it('leaves ordinary log fields (no url/objectKey in the key name) untouched', () => {
    const { stream, output } = captureStream();
    const logger = pino(buildLoggerOptions(), stream);

    logger.info({ attemptId: 'attempt-42', status: 'queued' }, 'attempt queued');

    const written = output();
    expect(written).toContain('attempt-42');
    expect(written).toContain('queued');
  });
});
