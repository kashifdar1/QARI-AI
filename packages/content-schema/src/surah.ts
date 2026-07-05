import { z } from 'zod';

/**
 * Structural metadata about the 114 surahs — ayah counts, names, revelation
 * order/type. Sourced from Tanzil's own `quran-data.xml`
 * (content-import/sources/tanzil-quran-metadata-v1.0.xml), never hand-typed
 * (surah/tname/ename ARE Arabic/English strings, but they are proper names
 * pulled from that file by the importer, not literals in this module).
 * Used both to structurally verify the imported Uthmani text (every surah's
 * ayah count must match) and to power the Library screen's surah list.
 */
export const surahMetadataSchema = z.object({
  index: z.number().int().min(1).max(114),
  ayahCount: z.number().int().positive(),
  nameArabic: z.string().min(1),
  nameTransliterated: z.string().min(1),
  nameEnglish: z.string().min(1),
  revelationType: z.enum(['Meccan', 'Medinan']),
  revelationOrder: z.number().int().positive(),
  rukuCount: z.number().int().positive(),
});

export type SurahMetadata = z.infer<typeof surahMetadataSchema>;
