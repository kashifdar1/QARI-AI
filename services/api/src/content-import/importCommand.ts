import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  parseQuranMetadata,
  parseTanzilText,
  tokenizeAyah,
  verifyStructure,
  type SurahMetadata,
} from '@qari/content-schema';
import type { AyahWordRecord, ContentRepository, ContentVersionRecord } from './contentRepository.js';

export class ImportVerificationError extends Error {
  constructor(
    message: string,
    public readonly details: unknown,
  ) {
    super(message);
  }
}

export type ImportResult = {
  contentVersion: ContentVersionRecord;
  ayahCount: number;
  wordCount: number;
  sha256: string;
};

/**
 * The ONLY code path permitted to turn the raw Tanzil file into rows in
 * `quran_ayah_words` (Principle 1). Structural verification
 * (verifyStructure, cross-checked against Tanzil's own metadata — see
 * content-import/sources/PROVENANCE.md for why this replaces a bare
 * published-checksum comparison) must pass before ANY row is written; a
 * failed verification writes nothing and throws.
 */
export async function importTanzilContent(
  repo: ContentRepository,
  textFilePath: string,
  metadataFilePath: string,
): Promise<ImportResult> {
  const [rawText, rawMetadata] = await Promise.all([
    readFile(textFilePath, 'utf-8'),
    readFile(metadataFilePath, 'utf-8'),
  ]);

  const { ayat, unparseableLines } = parseTanzilText(rawText);
  if (unparseableLines.length > 0) {
    throw new ImportVerificationError(
      `${unparseableLines.length} unparseable line(s) in source file`,
      unparseableLines,
    );
  }

  const metadata: SurahMetadata[] = parseQuranMetadata(rawMetadata);
  const verification = verifyStructure(ayat, metadata);
  if (!verification.valid) {
    throw new ImportVerificationError(
      `Structural verification failed: ${verification.mismatches.length} surah(s) mismatched against Tanzil metadata`,
      verification.mismatches,
    );
  }

  const sha256 = createHash('sha256').update(rawText, 'utf-8').digest('hex');

  const contentVersion = await repo.insertContentVersion({
    riwayah: 'hafs_an_asim',
    source: 'tanzil_net_uthmani',
    sourceChecksum: sha256,
  });

  const words: AyahWordRecord[] = ayat.flatMap((ayah) =>
    tokenizeAyah(ayah.text).map((token) => ({
      contentVersionId: contentVersion.id,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.ayahNumber,
      wordIndex: token.wordIndex,
      displayText: token.displayText,
      normalizedText: token.normalizedText,
    })),
  );
  await repo.insertWords(words);

  await repo.recordAuditEvent({
    eventType: 'content_version.imported',
    subjectType: 'quran_content_version',
    subjectId: contentVersion.id,
    metadata: { ayahCount: ayat.length, wordCount: words.length, sha256 },
  });

  return {
    contentVersion,
    ayahCount: ayat.length,
    wordCount: words.length,
    sha256,
  };
}
