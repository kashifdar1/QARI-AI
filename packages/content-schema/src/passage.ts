import { z } from 'zod';

/**
 * Metadata-only schema. The Quranic Arabic text itself is never a string
 * literal here or anywhere in application code (CLAUDE.md Principle 1) — it
 * is loaded at runtime from the versioned content import pipeline and
 * referenced here only by ID/checksum.
 */
export const passageRefSchema = z.object({
  id: z.string().uuid(),
  contentVersionId: z.string().uuid(),
  surahNumber: z.number().int().min(1).max(114),
  ayahStart: z.number().int().min(1),
  ayahEnd: z.number().int().min(1),
  riwayah: z.literal('hafs_an_asim'),
});

export type PassageRef = z.infer<typeof passageRefSchema>;

export const quranContentVersionSchema = z.object({
  id: z.string().uuid(),
  source: z.literal('tanzil_net_uthmani'),
  sourceChecksum: z.string().min(1),
  reviewStatus: z.enum(['pending_review', 'approved', 'rolled_back']),
  releasedAt: z.string().datetime().nullable(),
});

export type QuranContentVersion = z.infer<typeof quranContentVersionSchema>;
