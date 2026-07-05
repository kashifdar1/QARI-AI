import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * Tracks a downloaded-for-offline content bundle for a profile (passages +
 * reference audio + word timings for a content_version). Offline
 * reliability is Milestone D scope; this table exists now so Attempt/
 * PracticeSession creation logic can be written against a stable schema.
 */
export const offlinePacks = pgTable('offline_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  contentVersionId: uuid('content_version_id').notNull(),
  status: text('status', { enum: ['downloading', 'ready', 'stale', 'failed'] })
    .notNull()
    .default('downloading'),
  sizeBytes: text('size_bytes'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
