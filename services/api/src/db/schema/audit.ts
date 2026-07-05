import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Append-only. Written for content-version review/release/rollback
 * (ADR-003), consent grant/revoke, retention-state transitions (ADR-004),
 * and data export/delete requests — anywhere §2 requires an inspectable
 * trail rather than trusting application logs.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id'),
  eventType: text('event_type').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
