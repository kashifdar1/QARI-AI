import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * Pre-aggregated per-profile rollup so the progress screen is a single
 * indexed read, not a scan over PracticeSession/Attempt history at request
 * time. Recomputed by a job triggered on attempt completion (Milestone A+).
 */
export const progressAggregates = pgTable('progress_aggregates', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' })
    .unique(),
  passagesAttempted: integer('passages_attempted').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
