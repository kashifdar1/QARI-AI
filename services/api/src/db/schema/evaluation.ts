import { integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { attempts } from './attempts';
import { quranContentVersions } from './content';

export const evaluationJobs = pgTable('evaluation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['queued', 'processing', 'completed', 'failed'] })
    .notNull()
    .default('queued'),
  queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  errorMessage: text('error_message'),
});

/**
 * `modelBundleVersion` + `contentVersionId` are required on every result
 * row (milestone deliverable requirement) so a result is always
 * reproducible: which model produced it, against which text version.
 */
export const evaluationResults = pgTable('evaluation_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  modelBundleVersion: text('model_bundle_version').notNull(),
  contentVersionId: uuid('content_version_id')
    .notNull()
    .references(() => quranContentVersions.id, { onDelete: 'restrict' }),
  status: text('status', { enum: ['completed', 'needs_rerecord', 'failed'] }).notNull(),
  audioQualityFailureReasons: jsonb('audio_quality_failure_reasons').$type<string[]>().notNull().default([]),
  audioQualityDurationSeconds: real('audio_quality_duration_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const wordSegments = pgTable('word_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationResultId: uuid('evaluation_result_id')
    .notNull()
    .references(() => evaluationResults.id, { onDelete: 'cascade' }),
  wordIndex: integer('word_index').notNull(),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
});

/**
 * Raw model output. `modelConfidence` is intentionally internal — never
 * exposed by GET /attempts/{id}/feedback (ADR-005); only the confidence
 * policy's tier output reaches the client, via FeedbackReport, not this
 * table.
 */
export const issueCandidates = pgTable('issue_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationResultId: uuid('evaluation_result_id')
    .notNull()
    .references(() => evaluationResults.id, { onDelete: 'cascade' }),
  wordIndex: integer('word_index').notNull(),
  kind: text('kind', { enum: ['omission', 'repetition', 'substitution'] }).notNull(),
  modelConfidence: real('model_confidence').notNull(),
});
