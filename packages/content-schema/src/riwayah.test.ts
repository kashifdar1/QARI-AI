import { describe, expect, it } from 'vitest';
import { assertSupportedRiwayah, SUPPORTED_RIWAYAT } from './riwayah.js';

describe('riwayah guard', () => {
  it('accepts the single launch-supported riwayah', () => {
    expect(() => assertSupportedRiwayah('hafs_an_asim')).not.toThrow();
    expect(SUPPORTED_RIWAYAT).toEqual(['hafs_an_asim']);
  });

  it('rejects any other riwayah, e.g. accidental mixing', () => {
    expect(() => assertSupportedRiwayah('warsh_an_nafi')).toThrow(/Unsupported riwayah/);
  });
});
