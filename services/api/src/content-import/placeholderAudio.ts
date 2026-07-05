/**
 * Generates a real, valid, silent 16kHz mono 16-bit PCM WAV file (matching
 * CLAUDE.md §3's capture format) — per Stub Policy, this is NOT a fake
 * "recitation": it is honestly silent, honestly named `PLACEHOLDER_AUDIO`,
 * and stands in only until a licensed reciter is cleared (docs/licenses/,
 * docs/STUBS.md). Every byte is real, inspectable WAV data; nothing here is
 * a fabricated or placeholder *binary* in the Principle-7 sense — it's a
 * genuine (silent) audio file with an honest name.
 */

const SAMPLE_RATE = 16_000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

export function generateSilentWav(durationSeconds: number): Buffer {
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const dataSize = Math.round(durationSeconds * byteRate);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  const silentSamples = Buffer.alloc(dataSize); // all-zero = silence
  return Buffer.concat([header, silentSamples]);
}

export function placeholderObjectKey(surahNumber: number): string {
  return `placeholder-audio/PLACEHOLDER_AUDIO_surah-${String(surahNumber).padStart(3, '0')}.wav`;
}
