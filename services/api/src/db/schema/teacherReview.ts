import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { attempts } from './attempts';

/**
 * Reserved per Principle 4 (AI does not replace a teacher) — table exists
 * from Milestone 0 even though the teacher portal is post-MVP, so the
 * escalation path is a real, queryable entity, not a TODO.
 */
export const teacherReviews = pgTable('teacher_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' })
    .unique(),
  status: text('status', {
    enum: ['not_requested', 'requested', 'in_review', 'completed'],
  })
    .notNull()
    .default('not_requested'),
  teacherUserId: uuid('teacher_user_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
