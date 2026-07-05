import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * One row per (profile, purpose) grant/revoke event — append-only history,
 * not an upsert-in-place row, so "was consent for X active on date Y" is
 * always answerable (Principle 6, data-export/delete requirements).
 */
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  purpose: text('purpose', {
    enum: ['audio_model_training', 'audio_research', 'product_analytics'],
  }).notNull(),
  status: text('status', { enum: ['granted', 'revoked'] }).notNull(),
  grantedByUserId: uuid('granted_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
