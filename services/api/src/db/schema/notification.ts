import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', {
    enum: ['streak_reminder', 'evaluation_ready', 'teacher_feedback', 'system'],
  }).notNull(),
  payload: text('payload'),
  readAt: timestamp('read_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  isChildSafe: boolean('is_child_safe').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
