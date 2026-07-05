import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { passages } from './content';
import { profiles } from './profiles';

export const practiceSessions = pgTable('practice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  passageId: uuid('passage_id')
    .notNull()
    .references(() => passages.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
