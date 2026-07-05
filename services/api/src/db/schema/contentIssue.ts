import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { evaluationResults } from './evaluation';

/**
 * Linked to EvaluationResult (per milestone deliverable requirement) so a
 * report is always traceable to the exact model/content version pair that
 * produced the flagged feedback (ADR-003).
 */
export const contentIssueReports = pgTable('content_issue_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationResultId: uuid('evaluation_result_id')
    .notNull()
    .references(() => evaluationResults.id, { onDelete: 'cascade' }),
  reportedByUserId: uuid('reported_by_user_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['open', 'triaged', 'resolved', 'wont_fix'] })
    .notNull()
    .default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
