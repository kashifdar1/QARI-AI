import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * One row per checksum-verified content import (ADR-003). No column here
 * ever holds Quranic Arabic as an application-writable value — the text
 * itself lives in `quran_ayah_words`, populated exclusively by the offline
 * import job (content-import CLI), referenced by content_version_id.
 */
export const quranContentVersions = pgTable('quran_content_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  riwayah: text('riwayah', { enum: ['hafs_an_asim'] }).notNull().default('hafs_an_asim'),
  source: text('source', { enum: ['tanzil_net_uthmani'] }).notNull(),
  sourceChecksum: text('source_checksum').notNull(),
  reviewStatus: text('review_status', {
    enum: ['imported', 'approved', 'rolled_back'],
  })
    .notNull()
    .default('imported'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The actual Quran text, one row per word. Written ONLY by
 * services/api/src/content-import/importCommand.ts. `displayText`/
 * `normalizedText` come from packages/content-schema's tokenizeAyah — see
 * docs/content-tokenization.md.
 */
export const quranAyahWords = pgTable(
  'quran_ayah_words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentVersionId: uuid('content_version_id')
      .notNull()
      .references(() => quranContentVersions.id, { onDelete: 'cascade' }),
    surahNumber: integer('surah_number').notNull(),
    ayahNumber: integer('ayah_number').notNull(),
    wordIndex: integer('word_index').notNull(),
    displayText: text('display_text').notNull(),
    normalizedText: text('normalized_text').notNull(),
  },
  (table) => [
    uniqueIndex('quran_ayah_words_version_location_idx').on(
      table.contentVersionId,
      table.surahNumber,
      table.ayahNumber,
      table.wordIndex,
    ),
  ],
);

export const passages = pgTable('passages', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentVersionId: uuid('content_version_id')
    .notNull()
    .references(() => quranContentVersions.id, { onDelete: 'restrict' }),
  surahNumber: integer('surah_number').notNull(),
  ayahStart: integer('ayah_start').notNull(),
  ayahEnd: integer('ayah_end').notNull(),
  riwayah: text('riwayah', { enum: ['hafs_an_asim'] }).notNull().default('hafs_an_asim'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A single cleared MVP reciter per CLAUDE.md §3; multiple rows still model
 * the general case (per-reciter license metadata) for when more are added.
 */
export const reciterAudio = pgTable('reciter_audio', {
  id: uuid('id').primaryKey().defaultRandom(),
  passageId: uuid('passage_id')
    .notNull()
    .references(() => passages.id, { onDelete: 'cascade' }),
  reciterId: uuid('reciter_id').notNull(),
  reciterName: text('reciter_name').notNull(),
  licenseName: text('license_name').notNull(),
  licenseUrl: text('license_url'),
  objectKey: text('object_key').notNull(),
  isPlaceholder: text('is_placeholder').notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A licensed, named translation source (e.g. "Saheeh International", "en").
 * `licenseStatus` starts `blocked_non_commercial` for any Tanzil-hosted
 * translation until a maintainer confirms commercial-use permission — see
 * docs/STUBS.md. No `quran_translation_words` row may exist for a version
 * whose `licenseStatus` isn't `cleared`.
 */
export const translationVersions = pgTable('translation_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  language: text('language', { enum: ['en', 'ur'] }).notNull(),
  sourceName: text('source_name').notNull(),
  licenseName: text('license_name').notNull(),
  licenseUrl: text('license_url'),
  licenseStatus: text('license_status', {
    enum: ['cleared', 'blocked_non_commercial'],
  })
    .notNull()
    .default('blocked_non_commercial'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quranTranslationAyat = pgTable(
  'quran_translation_ayat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    translationVersionId: uuid('translation_version_id')
      .notNull()
      .references(() => translationVersions.id, { onDelete: 'cascade' }),
    surahNumber: integer('surah_number').notNull(),
    ayahNumber: integer('ayah_number').notNull(),
    text: text('text').notNull(),
  },
  (table) => [
    uniqueIndex('quran_translation_ayat_version_location_idx').on(
      table.translationVersionId,
      table.surahNumber,
      table.ayahNumber,
    ),
  ],
);
