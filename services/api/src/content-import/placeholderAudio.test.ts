import { describe, expect, it } from 'vitest';
import { generateSilentWav, placeholderObjectKey } from './placeholderAudio.js';

describe('generateSilentWav', () => {
  it('produces a valid RIFF/WAVE header', () => {
    const wav = generateSilentWav(1);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
  });

  it('encodes 16kHz mono 16-bit PCM (CLAUDE.md §3 capture format)', () => {
    const wav = generateSilentWav(1);
    expect(wav.readUInt16LE(20)).toBe(1); // PCM format code
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(16_000); // sample rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it('every audio sample byte is zero (genuinely silent, not fake speech)', () => {
    const wav = generateSilentWav(0.5);
    const samples = wav.subarray(44);
    expect(samples.every((byte) => byte === 0)).toBe(true);
  });

  it('duration scales the data size correctly', () => {
    const oneSecond = generateSilentWav(1);
    const twoSeconds = generateSilentWav(2);
    expect(twoSeconds.length).toBeGreaterThan(oneSecond.length);
    // byteRate = 16000 * 1 * 2 = 32000 bytes/sec
    expect(oneSecond.length).toBe(44 + 32_000);
    expect(twoSeconds.length).toBe(44 + 64_000);
  });
});

describe('placeholderObjectKey', () => {
  it('is stably derived from the surah number and clearly self-identifies as a placeholder', () => {
    expect(placeholderObjectKey(1)).toBe('placeholder-audio/PLACEHOLDER_AUDIO_surah-001.wav');
    expect(placeholderObjectKey(114)).toBe('placeholder-audio/PLACEHOLDER_AUDIO_surah-114.wav');
  });
});
