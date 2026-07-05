import { describe, expect, it } from 'vitest';
import { passageRefSchema } from './passage.js';

describe('passageRefSchema', () => {
  it('accepts a valid passage reference', () => {
    const result = passageRefSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      contentVersionId: '22222222-2222-2222-2222-222222222222',
      surahNumber: 1,
      ayahStart: 1,
      ayahEnd: 7,
      riwayah: 'hafs_an_asim',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a surah number out of range', () => {
    const result = passageRefSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      contentVersionId: '22222222-2222-2222-2222-222222222222',
      surahNumber: 200,
      ayahStart: 1,
      ayahEnd: 1,
      riwayah: 'hafs_an_asim',
    });
    expect(result.success).toBe(false);
  });
});
