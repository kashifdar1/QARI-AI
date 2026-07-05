import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { practiceSessions } from './sessions';

/**
 * `clientAttemptId` + the unique index on
 * (session_id, client_attempt_id) is the idempotency mechanism behind the
 * Idempotency-Key header (packages/api-contracts openapi.yaml
 * POST /sessions/{sessionId}/attempts): a retried request with the same
 * client-generated UUID returns the original row instead of inserting a
 * duplicate.
 */
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => practiceSessions.id, { onDelete: 'cascade' }),
    clientAttemptId: uuid('client_attempt_id').notNull(),
    status: text('status', {
      enum: [
        'ready',
        'uploading',
        'queued',
        'processing',
        'completed',
        'needs_rerecord',
        'failed',
      ],
    })
      .notNull()
      .default('ready'),
    retentionState: text('retention_state', {
      enum: ['active', 'pending_deletion', 'deleted'],
    })
      .notNull()
      .default('active'),
    objectKey: text('object_key'),
    teacherReviewAvailable: boolean('teacher_review_available').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('attempts_session_id_client_attempt_id_idx').on(
      table.sessionId,
      table.clientAttemptId,
    ),
  ],
);
